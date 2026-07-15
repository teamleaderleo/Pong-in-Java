(() => {
  'use strict';

  const canvas = document.querySelector('#game');
  const nudgeOutput = document.querySelector('#nudge-count');
  const banner = document.querySelector('#bullshit-banner');
  const bannerTitle = document.querySelector('#bullshit-banner-title');
  const telemetryLog = document.querySelector('#telemetry-log');

  if (!canvas || !nudgeOutput) return;

  const findDescriptor = (target, property) => {
    let prototype = target;
    while (prototype) {
      const descriptor = Object.getOwnPropertyDescriptor(prototype, property);
      if (descriptor) return descriptor;
      prototype = Object.getPrototypeOf(prototype);
    }
    return null;
  };

  const valueDescriptor = findDescriptor(nudgeOutput, 'value');
  if (!valueDescriptor?.get || !valueDescriptor?.set) return;

  const nativeGetValue = valueDescriptor.get;
  const nativeSetValue = valueDescriptor.set;
  let rawNudgeCount = Number.parseInt(nativeGetValue.call(nudgeOutput) || '0', 10) || 0;
  let suppressedNudges = 0;
  let completedFrame = null;
  let drawingFrame = blankFrame();
  let priorSegment = null;
  let recentOrdinaryDistances = [];
  let movementFrames = 0;
  let stationaryFrames = 0;
  let frameSerial = 0;
  let candidate = null;
  let candidateConsumed = false;

  function blankFrame() {
    return {
      ball: null,
      paddles: { green: null, pink: null }
    };
  }

  function median(values) {
    if (!values.length) return 9;
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2
      ? sorted[middle]
      : (sorted[middle - 1] + sorted[middle]) / 2;
  }

  function resetMovementBaseline() {
    movementFrames = 0;
    stationaryFrames = 0;
    priorSegment = null;
    recentOrdinaryDistances = [];
    candidate = null;
    candidateConsumed = false;
  }

  function collisionContext(previous, current, segment) {
    const flippedHorizontally = Boolean(
      priorSegment?.dx
      && segment.dx
      && Math.sign(priorSegment.dx) !== Math.sign(segment.dx)
    );

    for (const side of ['green', 'pink']) {
      const paddle = current.paddles[side] || previous.paddles[side];
      if (!paddle) continue;

      const verticalDistance = Math.min(
        Math.abs(previous.ball.y - paddle.y),
        Math.abs(current.ball.y - paddle.y)
      );
      if (verticalDistance > 78) continue;

      const horizontalDistance = Math.min(
        Math.abs(previous.ball.x - paddle.x),
        Math.abs(current.ball.x - paddle.x)
      );
      if (horizontalDistance > 34) continue;

      const face = side === 'green' ? paddle.x + 8 : paddle.x - 8;
      const crossedFace = side === 'green'
        ? previous.ball.x >= face && current.ball.x <= face
        : previous.ball.x <= face && current.ball.x >= face;

      if (flippedHorizontally || crossedFace || horizontalDistance <= 18) {
        return { side, horizontalDistance, flippedHorizontally, crossedFace };
      }
    }

    return null;
  }

  function finishFrame() {
    if (!drawingFrame.ball) return;
    frameSerial += 1;
    candidate = null;
    candidateConsumed = false;

    if (!completedFrame?.ball) {
      completedFrame = drawingFrame;
      return;
    }

    const segment = {
      dx: drawingFrame.ball.x - completedFrame.ball.x,
      dy: drawingFrame.ball.y - completedFrame.ball.y
    };
    const distance = Math.hypot(segment.dx, segment.dy);

    if (distance === 0) {
      stationaryFrames += 1;
      if (stationaryFrames >= 2) {
        movementFrames = 0;
        priorSegment = null;
        recentOrdinaryDistances = [];
      }
      completedFrame = drawingFrame;
      return;
    }

    stationaryFrames = 0;

    if (distance > 80) {
      completedFrame = drawingFrame;
      resetMovementBaseline();
      return;
    }

    movementFrames += 1;
    const baseline = median(recentOrdinaryDistances);
    const threshold = Math.max(20, baseline * 1.9);
    const context = collisionContext(completedFrame, drawingFrame, segment);

    if (
      movementFrames >= 20
      && recentOrdinaryDistances.length >= 10
      && distance >= threshold
      && distance <= 38
      && context
    ) {
      candidate = {
        frame: frameSerial,
        distance,
        baseline,
        side: context.side
      };
    } else if (distance >= 3 && distance <= 15) {
      recentOrdinaryDistances.push(distance);
      if (recentOrdinaryDistances.length > 24) recentOrdinaryDistances.shift();
    }

    priorSegment = segment;
    completedFrame = drawingFrame;
  }

  function removeRejectedReport() {
    const title = bannerTitle?.textContent?.toUpperCase() || '';
    if (title.includes('VISIBLE BONUS MOVEMENT') || title.includes('FREE MOVEMENT')) {
      banner?.classList.remove('visible');
    }

    for (const item of [...(telemetryLog?.children || [])].slice(0, 3)) {
      const text = item.textContent?.toUpperCase() || '';
      if (text.includes('VISIBLE BONUS MOVEMENT') || text.includes('FREE MOVEMENT')) {
        item.remove();
      }
    }

    const review = document.querySelector('#forensic-review');
    const reviewTitle = document.querySelector('#forensic-title')?.textContent?.toUpperCase() || '';
    if (reviewTitle.includes('FREE MOVEMENT')) {
      review?.classList.remove('visible');
      document.querySelector('.court-stage')?.classList.remove('reviewing');
    }
  }

  Object.defineProperty(nudgeOutput, 'value', {
    configurable: true,
    enumerable: true,
    get() {
      return nativeGetValue.call(this);
    },
    set(value) {
      const incoming = Number.parseInt(String(value), 10) || 0;
      const delta = incoming - rawNudgeCount;

      if (incoming < rawNudgeCount) {
        suppressedNudges = 0;
        resetMovementBaseline();
      } else if (delta > 0) {
        const accepted = Boolean(candidate && !candidateConsumed);
        const acceptedCount = accepted ? 1 : 0;
        suppressedNudges += Math.max(0, delta - acceptedCount);
        candidateConsumed = accepted;

        if (!accepted) {
          removeRejectedReport();
          queueMicrotask(removeRejectedReport);
        }
      }

      rawNudgeCount = incoming;
      nativeSetValue.call(this, String(Math.max(0, rawNudgeCount - suppressedNudges)));
    }
  });

  const context = canvas.getContext('2d');
  if (!context) return;

  const priorClearRect = context.clearRect.bind(context);
  const priorFillRect = context.fillRect.bind(context);

  context.clearRect = (...args) => {
    finishFrame();
    drawingFrame = blankFrame();
    return priorClearRect(...args);
  };

  context.fillRect = (x, y, width, height) => {
    if (width === 6 && height === 6) {
      drawingFrame.ball = { x: x + width / 2, y: y + height / 2 };
    } else if (width === 10 && height === 140) {
      const paddle = { x: x + width / 2, y: y + height / 2 };
      drawingFrame.paddles[paddle.x < 400 ? 'green' : 'pink'] = paddle;
    }

    return priorFillRect(x, y, width, height);
  };
})();
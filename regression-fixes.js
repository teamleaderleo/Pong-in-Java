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
  let stableMovementFrames = 0;

  function blankFrame() {
    return {
      ball: null,
      paddles: { green: null, pink: null }
    };
  }

  function finishFrame() {
    if (!drawingFrame.ball) return;

    if (completedFrame?.ball) {
      const dx = drawingFrame.ball.x - completedFrame.ball.x;
      const dy = drawingFrame.ball.y - completedFrame.ball.y;
      const distance = Math.hypot(dx, dy);

      if (distance === 0 || distance > 120) {
        stableMovementFrames = 0;
      } else if (distance >= 3 && distance <= 24) {
        stableMovementFrames += 1;
      } else {
        stableMovementFrames = Math.max(0, stableMovementFrames - 1);
      }
    }

    completedFrame = drawingFrame;
  }

  function nearPaddleContact() {
    if (stableMovementFrames < 6 || !completedFrame?.ball) return false;

    const { ball, paddles } = completedFrame;
    return Object.values(paddles).some((paddle) => paddle
      && Math.abs(ball.x - paddle.x) <= 70
      && Math.abs(ball.y - paddle.y) <= 105);
  }

  function removeFalseStartupReport() {
    const title = bannerTitle?.textContent?.toUpperCase() || '';
    if (title.includes('VISIBLE BONUS MOVEMENT') || title.includes('FREE MOVEMENT')) {
      banner?.classList.remove('visible');
    }

    const firstLog = telemetryLog?.firstElementChild;
    const logText = firstLog?.textContent?.toUpperCase() || '';
    if (logText.includes('VISIBLE BONUS MOVEMENT') || logText.includes('FREE MOVEMENT')) {
      firstLog.remove();
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
      } else if (delta > 0 && !nearPaddleContact()) {
        suppressedNudges += delta;
        removeFalseStartupReport();
        queueMicrotask(removeFalseStartupReport);
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

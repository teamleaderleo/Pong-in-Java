(() => {
  'use strict';

  const BALL_SIZE = 6;
  const PADDLE_WIDTH = 10;
  const PADDLE_HEIGHT = 140;
  const COMBO_WINDOW_MS = 4000;
  const RESET_JUMP = 120;

  const canvas = document.querySelector('#game');
  const banner = document.querySelector('#bullshit-banner');
  const bannerTitle = document.querySelector('#bullshit-banner-title');
  const bannerDetail = document.querySelector('#bullshit-banner-detail');
  const telemetryLog = document.querySelector('#telemetry-log');
  const chaosButton = document.querySelector('#chaos-mode');

  const outputs = {
    green: document.querySelector('#green-phase-count'),
    pink: document.querySelector('#pink-phase-count'),
    blockers: document.querySelector('#blocker-phase-count'),
    weird: document.querySelector('#weird-bounce-count'),
    nudges: document.querySelector('#nudge-count'),
    combo: document.querySelector('#combo-count'),
    bestCombo: document.querySelector('#best-combo-count')
  };

  if (!canvas || !banner || !telemetryLog || Object.values(outputs).some((output) => !output)) return;

  const stats = {
    paddlePhases: { green: 0, pink: 0 },
    blockerPhases: 0,
    weirdBounces: 0,
    nudges: 0,
    combo: 0,
    bestCombo: 0,
    lastHarmfulAt: -Infinity
  };

  const paddleTransits = { green: null, pink: null };
  const blockerTransits = [null, null];
  const cooldowns = new Map();
  let previousFrame = null;
  let currentFrame = blankFrame();
  let bannerTimer = null;
  let bannerPriority = 0;
  let frameNumber = 0;

  function blankFrame() {
    return {
      ball: null,
      paddles: { green: null, pink: null },
      blockers: []
    };
  }

  function chaosIsActive() {
    return chaosButton?.classList.contains('active') ?? true;
  }

  function updateCounters() {
    outputs.green.value = String(stats.paddlePhases.green);
    outputs.pink.value = String(stats.paddlePhases.pink);
    outputs.blockers.value = String(stats.blockerPhases);
    outputs.weird.value = String(stats.weirdBounces);
    outputs.nudges.value = String(stats.nudges);
    outputs.combo.value = `x${stats.combo}`;
    outputs.bestCombo.value = `x${stats.bestCombo}`;
  }

  function resetTelemetry() {
    stats.paddlePhases.green = 0;
    stats.paddlePhases.pink = 0;
    stats.blockerPhases = 0;
    stats.weirdBounces = 0;
    stats.nudges = 0;
    stats.combo = 0;
    stats.bestCombo = 0;
    stats.lastHarmfulAt = -Infinity;
    paddleTransits.green = null;
    paddleTransits.pink = null;
    blockerTransits.fill(null);
    cooldowns.clear();
    telemetryLog.replaceChildren(makeLogItem('Evidence cleared. The detector is hungry again.', 'neutral'));
    updateCounters();
    showBanner('EVIDENCE DESTROYED', 'All bullshit counters returned to zero.', 'clean');
  }

  function makeLogItem(message, severity) {
    const item = document.createElement('li');
    item.textContent = message;
    item.className = `${severity}-entry`;
    return item;
  }

  function logEvent(message, severity) {
    telemetryLog.prepend(makeLogItem(message, severity));
    while (telemetryLog.children.length > 10) {
      telemetryLog.lastElementChild?.remove();
    }
  }

  function allowEvent(key, cooldownFrames) {
    const last = cooldowns.get(key) ?? -Infinity;
    if (frameNumber - last < cooldownFrames) return false;
    cooldowns.set(key, frameNumber);
    return true;
  }

  function showBanner(title, detail, severity) {
    const priorities = { clean: 1, nudge: 1, weird: 2, harmful: 3 };
    const priority = priorities[severity] || 1;
    if (bannerPriority > priority && banner.classList.contains('visible')) return;

    clearTimeout(bannerTimer);
    bannerPriority = priority;
    bannerTitle.textContent = title;
    bannerDetail.textContent = detail;
    banner.className = `bullshit-banner visible ${severity}`;

    const duration = severity === 'harmful' ? 1900 : (severity === 'weird' ? 1350 : 1000);
    bannerTimer = window.setTimeout(() => {
      banner.classList.remove('visible');
      bannerPriority = 0;
    }, duration);
  }

  function registerHarmful(title, detail) {
    const now = performance.now();
    stats.combo = now - stats.lastHarmfulAt <= COMBO_WINDOW_MS ? stats.combo + 1 : 1;
    stats.lastHarmfulAt = now;
    stats.bestCombo = Math.max(stats.bestCombo, stats.combo);

    const comboText = stats.combo > 1 ? ` • BULLSHIT COMBO x${stats.combo}` : '';
    logEvent(`${title}: ${detail}${comboText}`, 'harmful');
    showBanner(title, `${detail}${comboText}`, 'harmful');
    updateCounters();
  }

  function registerWeird(key, title, detail, cooldownFrames = 12) {
    if (!allowEvent(`weird:${key}`, cooldownFrames)) return;
    stats.weirdBounces += 1;
    logEvent(`${title}: ${detail}`, 'weird');
    showBanner(title, `${detail} • WEIRD SAVE #${stats.weirdBounces}`, 'weird');
    updateCounters();
  }

  function registerNudge(title, detail) {
    if (!allowEvent('visible-nudge', 8)) return;
    stats.nudges += 1;
    logEvent(`${title}: ${detail}`, 'nudge');
    showBanner(title, `${detail} • NUDGE #${stats.nudges}`, 'nudge');
    updateCounters();
  }

  function segmentDirection(previousBall, ball) {
    return {
      dx: ball.x - previousBall.x,
      dy: ball.y - previousBall.y
    };
  }

  function isResetJump(direction) {
    return Math.abs(direction.dx) > RESET_JUMP || Math.abs(direction.dy) > RESET_JUMP;
  }

  function processFrame(frame) {
    if (!frame.ball || !frame.paddles.green || !frame.paddles.pink || frame.blockers.length < 2) return;

    frame.blockers.sort((a, b) => a.y - b.y);

    if (!previousFrame?.ball) {
      previousFrame = frame;
      return;
    }

    const direction = segmentDirection(previousFrame.ball, frame.ball);
    frameNumber += 1;

    if (isResetJump(direction)) {
      paddleTransits.green = null;
      paddleTransits.pink = null;
      blockerTransits.fill(null);
      previousFrame = frame;
      return;
    }

    if (chaosIsActive()) {
      detectVisibleNudge(direction);
      detectPaddleBullshit('green', previousFrame, frame, direction);
      detectPaddleBullshit('pink', previousFrame, frame, direction);
      detectBlockerBullshit(previousFrame, frame, direction);
      detectGhostBounce(previousFrame, frame, direction);
    }

    previousFrame = frame;
  }

  function detectVisibleNudge(direction) {
    const distance = Math.hypot(direction.dx, direction.dy);
    if (distance > 13 && distance < RESET_JUMP) {
      registerNudge(
        'VISIBLE BONUS MOVEMENT',
        `The ball jumped ${distance.toFixed(1)} pixels between rendered frames.`
      );
    }
  }

  function detectPaddleBullshit(side, previous, frame, direction) {
    const paddle = frame.paddles[side];
    const previousPaddle = previous.paddles[side] || paddle;
    const halfBall = BALL_SIZE / 2;
    const halfPaddle = PADDLE_WIDTH / 2;
    const face = side === 'green' ? paddle.x + halfPaddle : paddle.x - halfPaddle;
    const back = side === 'green' ? paddle.x - halfPaddle : paddle.x + halfPaddle;
    const targetCenter = side === 'green' ? face + halfBall : face - halfBall;

    let transit = paddleTransits[side];

    if (!transit) {
      const approached = side === 'green' ? direction.dx < 0 : direction.dx > 0;
      const crossedFace = side === 'green'
        ? previous.ball.x >= targetCenter && frame.ball.x < targetCenter
        : previous.ball.x <= targetCenter && frame.ball.x > targetCenter;

      if (approached && crossedFace) {
        const denominator = frame.ball.x - previous.ball.x;
        const t = denominator === 0 ? 0 : (targetCenter - previous.ball.x) / denominator;
        const contactY = previous.ball.y + (frame.ball.y - previous.ball.y) * clamp(t, 0, 1);
        const paddleY = previousPaddle.y + (paddle.y - previousPaddle.y) * clamp(t, 0, 1);
        const insideY = contactY + halfBall >= paddleY - PADDLE_HEIGHT / 2
          && contactY - halfBall <= paddleY + PADDLE_HEIGHT / 2;

        if (insideY) {
          transit = {
            frames: 0,
            bounceCount: 0,
            lastDx: direction.dx,
            insideAnnounced: false
          };
          paddleTransits[side] = transit;
        }
      }
    }

    if (!transit) return;
    transit.frames += 1;

    const overlapping = frame.ball.x + halfBall >= paddle.x - halfPaddle
      && frame.ball.x - halfBall <= paddle.x + halfPaddle
      && frame.ball.y + halfBall >= paddle.y - PADDLE_HEIGHT / 2
      && frame.ball.y - halfBall <= paddle.y + PADDLE_HEIGHT / 2;

    if (Math.sign(direction.dx) !== 0
      && Math.sign(transit.lastDx) !== 0
      && Math.sign(direction.dx) !== Math.sign(transit.lastDx)) {
      transit.bounceCount += 1;
      if (overlapping && transit.bounceCount >= 2 && !transit.insideAnnounced) {
        transit.insideAnnounced = true;
        registerWeird(
          `inside-paddle-${side}-${frameNumber}`,
          `BALL BOUNCING INSIDE ${side.toUpperCase()} PADDLE`,
          `Observed ${transit.bounceCount} direction flips before the ball escaped.`,
          1
        );
      }
    }
    if (direction.dx !== 0) transit.lastDx = direction.dx;

    const passedBehind = side === 'green'
      ? frame.ball.x + halfBall < back
      : frame.ball.x - halfBall > back;
    const stillGoingWrongWay = side === 'green' ? direction.dx < 0 : direction.dx > 0;
    const escapedCourtSide = side === 'green'
      ? frame.ball.x - halfBall > face && direction.dx > 0
      : frame.ball.x + halfBall < face && direction.dx < 0;

    if (passedBehind && stillGoingWrongWay) {
      stats.paddlePhases[side] += 1;
      registerHarmful(
        `${side.toUpperCase()} GOT FUCKED`,
        `PADDLE PHASE-THROUGH +1 • ${transit.bounceCount} observed internal flips`
      );
      paddleTransits[side] = null;
      return;
    }

    if (escapedCourtSide) {
      if (transit.bounceCount > 1) {
        registerWeird(
          `paddle-recovery-${side}-${frameNumber}`,
          `${side.toUpperCase()} PADDLE RECOVERED EVENTUALLY`,
          `${transit.bounceCount} direction flips somehow returned the ball to play.`,
          1
        );
      }
      paddleTransits[side] = null;
      return;
    }

    if (transit.frames > 30 || Math.abs(frame.ball.y - paddle.y) > PADDLE_HEIGHT * 1.6) {
      paddleTransits[side] = null;
    }
  }

  function detectBlockerBullshit(previous, frame, direction) {
    frame.blockers.forEach((blocker, index) => {
      const previousBlocker = previous.blockers[index] || blocker;
      const halfBall = BALL_SIZE / 2;
      const left = blocker.x - blocker.width / 2;
      const right = blocker.x + blocker.width / 2;
      const top = blocker.y - blocker.height / 2;
      const bottom = blocker.y + blocker.height / 2;

      let transit = blockerTransits[index];

      if (!transit) {
        const entry = blockerEntry(previous.ball, frame.ball, previousBlocker, blocker);
        if (entry) {
          transit = {
            axis: entry.axis,
            direction: entry.direction,
            frames: 0,
            bounceCount: 0,
            lastDx: direction.dx,
            lastDy: direction.dy
          };
          blockerTransits[index] = transit;
        }
      }

      if (!transit) return;
      transit.frames += 1;

      if (transit.axis === 'x'
        && direction.dx !== 0
        && transit.lastDx !== 0
        && Math.sign(direction.dx) !== Math.sign(transit.lastDx)) {
        transit.bounceCount += 1;
      }
      if (transit.axis === 'y'
        && direction.dy !== 0
        && transit.lastDy !== 0
        && Math.sign(direction.dy) !== Math.sign(transit.lastDy)) {
        transit.bounceCount += 1;
      }

      if (direction.dx !== 0) transit.lastDx = direction.dx;
      if (direction.dy !== 0) transit.lastDy = direction.dy;

      let passedThrough;
      let returned;

      if (transit.axis === 'x') {
        passedThrough = transit.direction === 'right'
          ? frame.ball.x - halfBall > right
          : frame.ball.x + halfBall < left;
        returned = transit.direction === 'right'
          ? frame.ball.x + halfBall < left && direction.dx < 0
          : frame.ball.x - halfBall > right && direction.dx > 0;
      } else {
        passedThrough = transit.direction === 'down'
          ? frame.ball.y - halfBall > bottom
          : frame.ball.y + halfBall < top;
        returned = transit.direction === 'down'
          ? frame.ball.y + halfBall < top && direction.dy < 0
          : frame.ball.y - halfBall > bottom && direction.dy > 0;
      }

      if (passedThrough) {
        stats.blockerPhases += 1;
        const label = index === 0 ? 'UPPER BLOCKER' : 'LOWER BLOCKER';
        const route = transit.axis === 'x' ? 'SIDE-TO-SIDE' : 'TOP-TO-BOTTOM';
        registerHarmful(
          `${label} PHASE-THROUGH`,
          `${route} BLOCKER BULLSHIT +1 • ${transit.bounceCount} attempted recoveries`
        );
        blockerTransits[index] = null;
        return;
      }

      if (returned) {
        if (transit.bounceCount > 1) {
          registerWeird(
            `blocker-recovery-${index}-${frameNumber}`,
            'BLOCKER RECOVERED EVENTUALLY',
            `${transit.bounceCount} flips occurred before the ball returned.`,
            1
          );
        }
        blockerTransits[index] = null;
        return;
      }

      if (transit.frames > 70) blockerTransits[index] = null;
    });
  }

  function blockerEntry(previousBall, ball, previousBlocker, blocker) {
    const halfBall = BALL_SIZE / 2;
    const left = blocker.x - blocker.width / 2;
    const right = blocker.x + blocker.width / 2;
    const top = blocker.y - blocker.height / 2;
    const bottom = blocker.y + blocker.height / 2;

    if (ball.x > previousBall.x
      && previousBall.x + halfBall <= left
      && ball.x + halfBall > left) {
      const t = ratioAt(left - halfBall, previousBall.x, ball.x);
      const y = lerp(previousBall.y, ball.y, t);
      const blockerY = lerp(previousBlocker.y, blocker.y, t);
      if (y + halfBall >= blockerY - blocker.height / 2
        && y - halfBall <= blockerY + blocker.height / 2) {
        return { axis: 'x', direction: 'right' };
      }
    }

    if (ball.x < previousBall.x
      && previousBall.x - halfBall >= right
      && ball.x - halfBall < right) {
      const t = ratioAt(right + halfBall, previousBall.x, ball.x);
      const y = lerp(previousBall.y, ball.y, t);
      const blockerY = lerp(previousBlocker.y, blocker.y, t);
      if (y + halfBall >= blockerY - blocker.height / 2
        && y - halfBall <= blockerY + blocker.height / 2) {
        return { axis: 'x', direction: 'left' };
      }
    }

    if (ball.y > previousBall.y
      && previousBall.y + halfBall <= top
      && ball.y + halfBall > top) {
      const t = ratioAt(top - halfBall, previousBall.y, ball.y);
      const x = lerp(previousBall.x, ball.x, t);
      if (x + halfBall >= left && x - halfBall <= right) {
        return { axis: 'y', direction: 'down' };
      }
    }

    if (ball.y < previousBall.y
      && previousBall.y - halfBall >= bottom
      && ball.y - halfBall < bottom) {
      const t = ratioAt(bottom + halfBall, previousBall.y, ball.y);
      const x = lerp(previousBall.x, ball.x, t);
      if (x + halfBall >= left && x - halfBall <= right) {
        return { axis: 'y', direction: 'up' };
      }
    }

    return null;
  }

  function detectGhostBounce(previous, frame, direction) {
    if (!previousFrame?.previousDirection) {
      frame.previousDirection = direction;
      return;
    }

    const prior = previousFrame.previousDirection;
    const flippedX = prior.dx !== 0 && direction.dx !== 0 && Math.sign(prior.dx) !== Math.sign(direction.dx);
    const flippedY = prior.dy !== 0 && direction.dy !== 0 && Math.sign(prior.dy) !== Math.sign(direction.dy);
    frame.previousDirection = direction;

    if (!flippedX && !flippedY) return;

    const nearWall = frame.ball.y < 18 || frame.ball.y > 782;
    const nearPaddle = Object.values(frame.paddles).some((paddle) =>
      Math.abs(frame.ball.x - paddle.x) < 28
      && Math.abs(frame.ball.y - paddle.y) < PADDLE_HEIGHT / 2 + 20);
    const nearBlocker = frame.blockers.some((blocker) =>
      Math.abs(frame.ball.x - blocker.x) < blocker.width / 2 + 24
      && Math.abs(frame.ball.y - blocker.y) < blocker.height / 2 + 24);

    if (nearWall || nearPaddle || nearBlocker) return;

    registerWeird(
      `ghost-${flippedX ? 'x' : 'y'}`,
      'GHOST BOUNCE',
      'The ball reversed direction far from any visible collision surface.',
      24
    );
  }

  function ratioAt(target, start, end) {
    const denominator = end - start;
    return denominator === 0 ? 0 : clamp((target - start) / denominator, 0, 1);
  }

  function lerp(start, end, t) {
    return start + (end - start) * t;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  const originalGetContext = canvas.getContext.bind(canvas);
  const context = originalGetContext('2d');
  const originalClearRect = context.clearRect.bind(context);
  const originalFillRect = context.fillRect.bind(context);

  context.clearRect = (...args) => {
    processFrame(currentFrame);
    currentFrame = blankFrame();
    return originalClearRect(...args);
  };

  context.fillRect = (x, y, width, height) => {
    if (width === BALL_SIZE && height === BALL_SIZE) {
      currentFrame.ball = { x: x + width / 2, y: y + height / 2 };
    } else if (width === PADDLE_WIDTH && height === PADDLE_HEIGHT) {
      const paddle = { x: x + width / 2, y: y + height / 2 };
      currentFrame.paddles[paddle.x < 400 ? 'green' : 'pink'] = paddle;
    } else if (width === 200 && height === 12) {
      currentFrame.blockers.push({ x: x + width / 2, y: y + height / 2, width, height });
    }

    return originalFillRect(x, y, width, height);
  };

  canvas.getContext = (type, options) => type === '2d' ? context : originalGetContext(type, options);

  window.addEventListener('keydown', (event) => {
    if (event.key.toLowerCase() === 'r') resetTelemetry();
  });

  telemetryLog.replaceChildren(makeLogItem('Visual bullshit detector armed.', 'neutral'));
  updateCounters();
})();
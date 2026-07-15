(() => {
  'use strict';

  const WIDTH = 800;
  const HEIGHT = 800;
  const BALL_SIZE = 6;
  const PADDLE_WIDTH = 10;
  const PADDLE_HEIGHT = 140;
  const PADDLE_SPEED = 9;
  const BALL_SPEED = 9;
  const MID_ZONE = 10;
  const MAX_LOG = 8;

  const canvas = document.querySelector('#game');
  const ctx = canvas.getContext('2d');
  const greenScore = document.querySelector('#green-score');
  const pinkScore = document.querySelector('#pink-score');
  const status = document.querySelector('#status');
  const logElement = document.querySelector('#incident-log');
  const chaosButton = document.querySelector('#chaos-mode');
  const cleanButton = document.querySelector('#clean-mode');
  const modeCopy = document.querySelector('#mode-copy');

  class PongGame {
    constructor() {
      this.keys = new Set();
      this.mode = 'chaos';
      this.scores = { green: 0, pink: 0 };
      this.incidents = [];
      this.lastTime = performance.now();
      this.accumulator = 0;
      this.stepMs = 1000 / 60;
      this.flash = 0;
      this.lightning = null;
      this.resetRound();
      this.bindEvents();
      requestAnimationFrame((time) => this.loop(time));
    }

    resetRound() {
      this.green = { x: 25, y: 400, vy: 0, color: '#84f5b5' };
      this.pink = { x: 775, y: 400, vy: 0, color: '#f584c4' };
      this.blockers = [
        { x: 400, y: 200, width: 200, height: 12 },
        { x: 400, y: 600, width: 200, height: 12 }
      ];
      this.ball = {
        x: 400,
        y: 400,
        previousX: 400,
        previousY: 400,
        vx: 0,
        vy: 0,
        speed: 0,
        angle: this.randomServeAngle(),
        active: false
      };
      this.updateHud();
    }

    randomServeAngle() {
      const degrees = 25 + Math.random() * 40;
      return Math.random() < 0.5 ? degrees : 180 - degrees;
    }

    bindEvents() {
      window.addEventListener('keydown', (event) => {
        const key = this.normalizeKey(event);
        if (['ArrowUp', 'ArrowDown', 'Space'].includes(key)) event.preventDefault();
        this.keys.add(key);

        if (key === 'Space') this.serve();
        if (key === 'r') this.resetGame();
        if (key === 'c') this.setMode(this.mode === 'chaos' ? 'clean' : 'chaos');

        if (this.mode === 'chaos' && ['w', 's', 'ArrowUp', 'ArrowDown'].includes(key)) {
          this.setLegacySpeed(BALL_SPEED);
        }
      });

      window.addEventListener('keyup', (event) => this.keys.delete(this.normalizeKey(event)));
      chaosButton.addEventListener('click', () => this.setMode('chaos'));
      cleanButton.addEventListener('click', () => this.setMode('clean'));
    }

    normalizeKey(event) {
      if (event.code === 'Space') return 'Space';
      if (event.key.startsWith('Arrow')) return event.key;
      return event.key.toLowerCase();
    }

    setMode(mode) {
      if (this.mode === mode) return;
      this.mode = mode;
      chaosButton.classList.toggle('active', mode === 'chaos');
      cleanButton.classList.toggle('active', mode === 'clean');
      modeCopy.textContent = mode === 'chaos'
        ? 'Integer coordinates. Collision checks after movement. Secret dead lines. Bonus movement during bounces. An authentic little disaster.'
        : 'Floating-point positions, swept paddle collisions, one movement per frame, and actual paddle-velocity spin.';
      this.report(mode === 'chaos' ? 'The museum exhibit has resumed committing crimes.' : 'Causality has entered the building.');
      this.resetRound();
    }

    resetGame() {
      this.scores.green = 0;
      this.scores.pink = 0;
      this.incidents = [];
      this.renderLog();
      this.resetRound();
      this.report('Scores cleared. The ball has retained no legal counsel.');
    }

    serve() {
      if (this.ball.active) return;
      this.ball.active = true;
      this.ball.speed = BALL_SPEED;
      this.setBallFromAngle(this.ball.angle, BALL_SPEED);
      this.report(this.mode === 'chaos' ? 'Legacy serve armed. Integer wood chipper engaged.' : 'Clean serve armed.');
      this.updateHud();
    }

    setLegacySpeed(speed) {
      this.ball.speed = speed;
      if (this.ball.active) this.setBallFromAngle(this.ball.angle, speed);
    }

    setBallFromAngle(angle, speed = this.ball.speed || BALL_SPEED) {
      this.ball.angle = angle;
      const radians = angle * Math.PI / 180;
      this.ball.vx = speed * Math.cos(radians);
      this.ball.vy = speed * Math.sin(radians);
      this.ball.speed = speed;
    }

    loop(time) {
      const frame = Math.min(100, time - this.lastTime);
      this.lastTime = time;
      this.accumulator += frame;

      while (this.accumulator >= this.stepMs) {
        this.update();
        this.accumulator -= this.stepMs;
      }

      this.draw();
      requestAnimationFrame((next) => this.loop(next));
    }

    update() {
      this.updatePaddles();
      if (!this.ball.active) return;

      if (this.mode === 'chaos') this.updateChaos();
      else this.updateClean();

      this.flash = Math.max(0, this.flash - 1);
      if (this.lightning) {
        this.lightning.life -= 1;
        if (this.lightning.life <= 0) this.lightning = null;
      }
      this.updateHud();
    }

    updatePaddles() {
      this.green.vy = (this.keys.has('s') ? PADDLE_SPEED : 0) - (this.keys.has('w') ? PADDLE_SPEED : 0);
      this.pink.vy = (this.keys.has('ArrowDown') ? PADDLE_SPEED : 0) - (this.keys.has('ArrowUp') ? PADDLE_SPEED : 0);

      this.green.y = this.clamp(this.green.y + this.green.vy, PADDLE_HEIGHT / 2, HEIGHT - PADDLE_HEIGHT / 2);
      this.pink.y = this.clamp(this.pink.y + this.pink.vy, PADDLE_HEIGHT / 2, HEIGHT - PADDLE_HEIGHT / 2);
    }

    updateChaos() {
      this.ball.previousX = this.ball.x;
      this.ball.previousY = this.ball.y;
      this.legacyMove(1);
      this.legacyWallBounce();
      this.legacyBlockerBounces();

      if (this.green.vy !== 0) this.legacyMovingPaddleCollision(this.green, 'green');
      if (this.pink.vy !== 0) this.legacyMovingPaddleCollision(this.pink, 'pink');

      const embedded = (this.legacyBallInsideGreen() && this.green.vy !== 0)
        || (this.legacyBallInsidePink() && this.pink.vy !== 0);

      if (embedded) {
        this.legacyMove(0.5);
        this.reportOnce('half-move', 'Embedded ball received a complimentary half-move deeper into the incident.');
      } else {
        this.legacyRegularCollision(this.green, 'green');
        this.legacyRegularCollision(this.pink, 'pink');
      }

      this.maybeSummonZeus();
      this.checkScore();
    }

    legacyMove(multiplier) {
      this.ball.x = Math.trunc(this.ball.x + this.ball.vx * multiplier);
      this.ball.y = Math.trunc(this.ball.y + this.ball.vy * multiplier);
    }

    legacyWallBounce() {
      if (this.ball.y > HEIGHT || this.ball.y < 0) {
        this.setBallFromAngle(360 - this.ball.angle);
        this.reportOnce('wall-outside', 'Wall collision detected after the ball had already left the building.');
      }
    }

    legacyMovingPaddleCollision(paddle, side) {
      const halfBall = BALL_SIZE / 2;
      const horizontallyOverlapping = side === 'green'
        ? this.ball.x - halfBall <= paddle.x + PADDLE_WIDTH / 2 && this.ball.x >= paddle.x - PADDLE_WIDTH / 2
        : this.ball.x + halfBall >= paddle.x - PADDLE_WIDTH / 2 && this.ball.x <= paddle.x + PADDLE_WIDTH / 2;

      if (!horizontallyOverlapping) return;
      const zone = this.legacyZone(paddle);
      if (zone === null) {
        this.report('The ball landed on a secret paddle dead line and became legally uncollidable.');
        this.flash = 8;
        return;
      }

      if (zone.name === 'mid') {
        this.setBallFromAngle(180 - this.ball.angle);
        this.reportOnce(`mid-${side}`, `Mid-paddle reflection fired without checking which way the ball was traveling.`);
        return;
      }

      const outgoing = this.legacyAngleForZone(side, zone);
      this.setBallFromAngle(outgoing);

      const pinkTopCaseZero = side === 'pink' && zone.name === 'top' && zone.bucket === 0;
      if (!pinkTopCaseZero) {
        this.legacyMove(1);
        this.reportOnce('second-move', 'Spin bounce moved the ball a second full time inside one frame.');
      } else {
        this.reportOnce('pink-case-zero', 'Pink top case 0 skipped the bonus move because one switch branch wandered off alone.');
      }
    }

    legacyZone(paddle) {
      const y = this.ball.y;
      const top = paddle.y - PADDLE_HEIGHT / 2;
      const bottom = paddle.y + PADDLE_HEIGHT / 2;
      if (y < paddle.y - MID_ZONE && y > top) {
        return { name: 'top', bucket: Math.trunc((y - paddle.y + MID_ZONE) / 10) };
      }
      if (y > paddle.y + MID_ZONE && y < bottom) {
        return { name: 'bottom', bucket: Math.trunc((y - paddle.y - MID_ZONE) / 10) };
      }
      if (y > paddle.y - MID_ZONE && y < paddle.y + MID_ZONE) {
        return { name: 'mid', bucket: 0 };
      }
      return null;
    }

    legacyAngleForZone(side, zone) {
      const bucket = this.clamp(Math.abs(zone.bucket), 0, 5);
      const degree = 20 + bucket * 10;
      if (side === 'green') return zone.name === 'top' ? -degree : degree;
      return zone.name === 'top' ? 180 + degree : 180 - degree;
    }

    legacyRegularCollision(paddle, side) {
      const halfBall = BALL_SIZE / 2;
      const insideY = this.ball.y > paddle.y - PADDLE_HEIGHT / 2 && this.ball.y < paddle.y + PADDLE_HEIGHT / 2;
      const insideX = side === 'green'
        ? this.ball.x - halfBall <= paddle.x + PADDLE_WIDTH / 2 && this.ball.x >= paddle.x - PADDLE_WIDTH / 2
        : this.ball.x + halfBall >= paddle.x - PADDLE_WIDTH / 2 && this.ball.x <= paddle.x + PADDLE_WIDTH / 2;
      if (insideX && insideY) {
        this.setBallFromAngle(180 - this.ball.angle);
        this.reportOnce(`repeat-${side}`, 'A collision fired with no approaching-direction check. Repeat offenses remain available.');
      }
    }

    legacyBallInsideGreen() {
      return this.ball.x - BALL_SIZE < this.green.x - PADDLE_WIDTH / 2 && this.withinPaddleY(this.green);
    }

    legacyBallInsidePink() {
      return this.ball.x + BALL_SIZE > this.pink.x + PADDLE_WIDTH / 2 && this.withinPaddleY(this.pink);
    }

    legacyBlockerBounces() {
      for (const blocker of this.blockers) {
        const horizontalOverlap = this.ball.x - BALL_SIZE / 2 <= blocker.x + blocker.width / 2
          && this.ball.x + BALL_SIZE / 2 >= blocker.x - blocker.width / 2;
        const insideVerticalBand = this.ball.y > blocker.y - blocker.height / 2
          && this.ball.y < blocker.y + blocker.height / 2;

        if (horizontalOverlap && !insideVerticalBand) {
          this.setBallFromAngle(360 - this.ball.angle);
          this.reportOnce('blocker-vertical-inverse', 'Obstacle bounced the ball specifically while it was outside the obstacle.');
        }

        if (this.ball.x > blocker.x + blocker.width / 2 - 9
          || this.ball.x < blocker.x - blocker.width / 2 + 9) {
          this.setBallFromAngle(180 - this.ball.angle);
          this.reportOnce('blocker-global-side', 'Obstacle side logic reflected the ball from an impressively unrelated location.');
        }
      }
    }

    maybeSummonZeus() {
      if (this.green.vy === 0 || Math.random() > 0.0008) return;
      const direction = this.green.y < HEIGHT / 2 ? 1 : -1;
      this.green.y = this.clamp(this.green.y + direction * 90, PADDLE_HEIGHT / 2, HEIGHT - PADDLE_HEIGHT / 2);
      this.lightning = { x: this.green.x, y: this.green.y, life: 14 };
      this.report('ZEUS HAS REVIEWED GREEN’S INPUT AND ISSUED A CORRECTION.');
    }

    updateClean() {
      const ball = this.ball;
      ball.previousX = ball.x;
      ball.previousY = ball.y;

      let nextX = ball.x + ball.vx;
      let nextY = ball.y + ball.vy;

      if (nextY - BALL_SIZE / 2 <= 0 || nextY + BALL_SIZE / 2 >= HEIGHT) {
        ball.vy *= -1;
        nextY = this.clamp(nextY, BALL_SIZE / 2, HEIGHT - BALL_SIZE / 2);
      }

      const hit = this.cleanPaddleHit(nextX, nextY);
      if (hit) {
        const paddle = hit.side === 'green' ? this.green : this.pink;
        this.applyCleanPaddleBounce(paddle, hit.side, hit.contactY);
        nextX = hit.side === 'green'
          ? paddle.x + PADDLE_WIDTH / 2 + BALL_SIZE / 2
          : paddle.x - PADDLE_WIDTH / 2 - BALL_SIZE / 2;
        nextY = this.clamp(hit.contactY, BALL_SIZE / 2, HEIGHT - BALL_SIZE / 2);
      }

      const blockerHit = this.cleanBlockerHit(nextX, nextY);
      if (blockerHit) {
        if (blockerHit.axis === 'y') ball.vy *= -1;
        else ball.vx *= -1;
        nextX = ball.x + ball.vx;
        nextY = ball.y + ball.vy;
      }

      ball.x = nextX;
      ball.y = nextY;
      ball.angle = Math.atan2(ball.vy, ball.vx) * 180 / Math.PI;
      this.checkScore();
    }

    cleanPaddleHit(nextX, nextY) {
      const halfBall = BALL_SIZE / 2;
      const candidates = [
        { side: 'green', paddle: this.green, face: this.green.x + PADDLE_WIDTH / 2, approaching: this.ball.vx < 0 },
        { side: 'pink', paddle: this.pink, face: this.pink.x - PADDLE_WIDTH / 2, approaching: this.ball.vx > 0 }
      ];

      for (const candidate of candidates) {
        if (!candidate.approaching) continue;
        const crossed = candidate.side === 'green'
          ? this.ball.x - halfBall >= candidate.face && nextX - halfBall <= candidate.face
          : this.ball.x + halfBall <= candidate.face && nextX + halfBall >= candidate.face;
        if (!crossed) continue;

        const denominator = nextX - this.ball.x;
        const t = denominator === 0 ? 0 : (candidate.face - this.ball.x) / denominator;
        const contactY = this.ball.y + (nextY - this.ball.y) * this.clamp(t, 0, 1);
        if (contactY + halfBall >= candidate.paddle.y - PADDLE_HEIGHT / 2
          && contactY - halfBall <= candidate.paddle.y + PADDLE_HEIGHT / 2) {
          return { side: candidate.side, contactY };
        }
      }
      return null;
    }

    applyCleanPaddleBounce(paddle, side, contactY) {
      const normalizedHit = this.clamp((contactY - paddle.y) / (PADDLE_HEIGHT / 2), -1, 1);
      const maxAngle = 68 * Math.PI / 180;
      const horizontalDirection = side === 'green' ? 1 : -1;
      const speed = Math.min(15, Math.max(BALL_SPEED, Math.hypot(this.ball.vx, this.ball.vy) * 1.025));
      const baseVy = speed * Math.sin(normalizedHit * maxAngle);
      const spinVy = paddle.vy * 0.55;
      this.ball.vx = horizontalDirection * Math.max(3.4, speed * Math.cos(normalizedHit * maxAngle));
      this.ball.vy = this.clamp(baseVy + spinVy, -speed * 0.94, speed * 0.94);
      this.ball.speed = Math.hypot(this.ball.vx, this.ball.vy);
      this.reportOnce('actual-spin', `Clean hit: paddle velocity contributed ${spinVy.toFixed(1)} px/frame of actual spin.`);
    }

    cleanBlockerHit(nextX, nextY) {
      const halfBall = BALL_SIZE / 2;
      for (const blocker of this.blockers) {
        const overlapX = nextX + halfBall >= blocker.x - blocker.width / 2
          && nextX - halfBall <= blocker.x + blocker.width / 2;
        const overlapY = nextY + halfBall >= blocker.y - blocker.height / 2
          && nextY - halfBall <= blocker.y + blocker.height / 2;
        if (!overlapX || !overlapY) continue;

        const previousOverlapX = this.ball.x + halfBall >= blocker.x - blocker.width / 2
          && this.ball.x - halfBall <= blocker.x + blocker.width / 2;
        return { axis: previousOverlapX ? 'y' : 'x' };
      }
      return null;
    }

    withinPaddleY(paddle) {
      return this.ball.y > paddle.y - PADDLE_HEIGHT / 2 && this.ball.y < paddle.y + PADDLE_HEIGHT / 2;
    }

    checkScore() {
      if (this.ball.x > WIDTH + BALL_SIZE) {
        this.scores.green += 1;
        this.report('Green scores. Pink files an appeal against geometry.');
        this.resetRound();
      } else if (this.ball.x < -BALL_SIZE) {
        this.scores.pink += 1;
        this.report('Pink scores. Green suspects Zeus and is correct often enough.');
        this.resetRound();
      }
    }

    report(message) {
      if (this.incidents[0] === message) return;
      this.incidents.unshift(message);
      this.incidents = this.incidents.slice(0, MAX_LOG);
      this.renderLog();
    }

    reportOnce(key, message) {
      const marker = `__${key}`;
      if (this[marker]) return;
      this[marker] = true;
      this.report(message);
    }

    renderLog() {
      logElement.replaceChildren();
      const entries = this.incidents.length ? this.incidents : ['Awaiting the first collision felony.'];
      for (const incident of entries) {
        const item = document.createElement('li');
        item.textContent = incident;
        logElement.append(item);
      }
    }

    updateHud() {
      greenScore.value = String(this.scores.green);
      pinkScore.value = String(this.scores.pink);
      status.textContent = this.ball.active
        ? (this.mode === 'chaos' ? 'LEGACY CRIMES IN PROGRESS' : 'RESPONSIBLE PHYSICS')
        : 'PRESS SPACE TO SERVE';
    }

    draw() {
      ctx.clearRect(0, 0, WIDTH, HEIGHT);
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      ctx.strokeStyle = 'rgba(255,255,255,.16)';
      ctx.setLineDash([10, 14]);
      ctx.beginPath();
      ctx.moveTo(WIDTH / 2, 0);
      ctx.lineTo(WIDTH / 2, HEIGHT);
      ctx.stroke();
      ctx.setLineDash([]);

      for (const blocker of this.blockers) {
        ctx.fillStyle = '#4dd2ff';
        ctx.fillRect(blocker.x - blocker.width / 2, blocker.y - blocker.height / 2, blocker.width, blocker.height);
      }

      this.drawPaddle(this.green);
      this.drawPaddle(this.pink);

      if (this.flash > 0) {
        ctx.fillStyle = 'rgba(255, 235, 120, .22)';
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
      }

      if (this.lightning) this.drawLightning();

      ctx.fillStyle = '#fff';
      ctx.fillRect(this.ball.x - BALL_SIZE / 2, this.ball.y - BALL_SIZE / 2, BALL_SIZE, BALL_SIZE);
    }

    drawPaddle(paddle) {
      ctx.fillStyle = paddle.color;
      ctx.fillRect(paddle.x - PADDLE_WIDTH / 2, paddle.y - PADDLE_HEIGHT / 2, PADDLE_WIDTH, PADDLE_HEIGHT);
    }

    drawLightning() {
      ctx.strokeStyle = '#fff59d';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(this.lightning.x + 40, 0);
      ctx.lineTo(this.lightning.x - 10, this.lightning.y - 80);
      ctx.lineTo(this.lightning.x + 28, this.lightning.y - 48);
      ctx.lineTo(this.lightning.x, this.lightning.y + 20);
      ctx.stroke();
      ctx.lineWidth = 1;
    }

    clamp(value, min, max) {
      return Math.min(max, Math.max(min, value));
    }
  }

  new PongGame();
})();

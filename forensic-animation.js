(() => {
  'use strict';

  const review = document.querySelector('#forensic-review');
  const stage = document.querySelector('.court-stage');
  const path = document.querySelector('#forensic-path');
  const motion = document.querySelector('#forensic-motion');
  const replayBall = document.querySelector('#forensic-replay-ball');

  if (!review || !stage || !path || !motion || !replayBall) return;

  // Keep the commentary while allowing the rally to continue uninterrupted.
  let rafSerial = 0;
  const rafTimers = new Map();

  window.requestAnimationFrame = (callback) => {
    const id = ++rafSerial;
    const timer = window.setTimeout(() => {
      rafTimers.delete(id);
      callback(performance.now());
    }, 16);
    rafTimers.set(id, timer);
    return id;
  };

  window.cancelAnimationFrame = (id) => {
    const timer = rafTimers.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      rafTimers.delete(id);
    }
  };

  let lastSignature = '';
  let hideTimer = null;

  function hideReview() {
    review.classList.remove('visible');
    stage.classList.remove('reviewing');
    replayBall.classList.remove('running');
  }

  function playEvidence() {
    if (!review.classList.contains('visible')) return;

    clearTimeout(hideTimer);

    // Harmless anomalies stay in the counters and logs. They no longer cover
    // the court or interrupt play.
    if (review.classList.contains('weird') || review.classList.contains('nudge')) {
      hideReview();
      return;
    }

    hideTimer = window.setTimeout(
      hideReview,
      review.classList.contains('goal') ? 900 : 700
    );

    const points = path.getAttribute('points')?.trim();
    if (!points || points === lastSignature) return;
    lastSignature = points;

    const coordinates = points
      .split(/\s+/)
      .map((pair) => pair.split(',').map(Number))
      .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));

    if (coordinates.length < 2) return;

    const pathData = coordinates
      .map(([x, y], index) => `${index === 0 ? 'M' : 'L'} ${x} ${y}`)
      .join(' ');

    motion.setAttribute('path', pathData);
    motion.setAttribute('dur', review.classList.contains('goal') ? '.8s' : '.55s');
    replayBall.classList.remove('running');
    void replayBall.getBoundingClientRect();
    replayBall.classList.add('running');

    try {
      motion.beginElement();
    } catch {
      const [x, y] = coordinates.at(-1);
      replayBall.setAttribute('cx', String(x));
      replayBall.setAttribute('cy', String(y));
    }
  }

  const observer = new MutationObserver(playEvidence);
  observer.observe(review, { attributes: true, attributeFilter: ['class'] });
  observer.observe(path, { attributes: true, attributeFilter: ['points'] });
})();
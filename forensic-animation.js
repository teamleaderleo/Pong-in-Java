(() => {
  'use strict';

  const review = document.querySelector('#forensic-review');
  const stage = document.querySelector('.court-stage');
  const path = document.querySelector('#forensic-path');
  const motion = document.querySelector('#forensic-motion');
  const replayBall = document.querySelector('#forensic-replay-ball');
  const coarsePointer = window.matchMedia('(hover: none), (pointer: coarse)');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  if (!review || !stage || !path || !motion || !replayBall) return;

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

    // Harmless anomalies stay in counters and logs only.
    if (review.classList.contains('weird') || review.classList.contains('nudge')) {
      hideReview();
      return;
    }

    hideTimer = window.setTimeout(
      hideReview,
      review.classList.contains('goal') ? 800 : 600
    );

    // Phones get the compact text callout without an SVG animation competing
    // with the game loop. Desktop keeps the tiny evidence replay.
    if (coarsePointer.matches || reducedMotion.matches) return;

    const points = path.getAttribute('points')?.trim();
    if (!points || points === lastSignature) return;
    lastSignature = points;

    const coordinates = points
      .split(/\s+/)
      .map((pair) => pair.split(',').map(Number))
      .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));

    if (coordinates.length < 2) return;

    motion.setAttribute('path', coordinates
      .map(([x, y], index) => `${index === 0 ? 'M' : 'L'} ${x} ${y}`)
      .join(' '));
    motion.setAttribute('dur', review.classList.contains('goal') ? '.65s' : '.45s');
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
})();
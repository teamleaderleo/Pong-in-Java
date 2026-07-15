(() => {
  'use strict';

  const review = document.querySelector('#forensic-review');
  const path = document.querySelector('#forensic-path');
  const motion = document.querySelector('#forensic-motion');
  const replayBall = document.querySelector('#forensic-replay-ball');

  if (!review || !path || !motion || !replayBall) return;

  let lastSignature = '';

  function playEvidence() {
    if (!review.classList.contains('visible')) return;
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
    motion.setAttribute('dur', review.classList.contains('goal') ? '1.2s' : (review.classList.contains('harmful') ? '.9s' : '.45s'));
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
(() => {
  'use strict';

  const canvas = document.querySelector('#game');
  const status = document.querySelector('#status');
  const stage = document.querySelector('.court-stage');
  const review = document.querySelector('#forensic-review');
  const replayBall = document.querySelector('#forensic-replay-ball');

  const nativeRequestAnimationFrame = window.requestAnimationFrame.bind(window);
  const nativeCancelAnimationFrame = window.cancelAnimationFrame.bind(window);
  const nativeSetInterval = window.setInterval.bind(window);

  // The forensic observer used to poll roughly thirty times per second. Ten is
  // plenty for counters and removes a steady stream of unnecessary mobile work.
  window.setInterval = (callback, delay, ...args) => nativeSetInterval(
    callback,
    delay === 32 ? 100 : delay,
    ...args
  );

  // Keep the browser's native animation scheduler available after the forensic
  // scripts initialize. The game loop should never be converted to setTimeout.
  window.__pongNativeAnimation = {
    request: nativeRequestAnimationFrame,
    cancel: nativeCancelAnimationFrame
  };

  if (canvas) {
    const context = canvas.getContext('2d');
    const nativeFillRect = context.fillRect.bind(context);

    context.fillRect = (x, y, width, height) => {
      const fill = String(context.fillStyle).replace(/\s+/g, '').toLowerCase();
      const staleFullCourtFlash = x === 0
        && y === 0
        && width === 800
        && height === 800
        && (fill === 'rgba(255,235,120,0.22)' || fill === 'rgba(255,235,120,.22)');

      if (staleFullCourtFlash) return undefined;
      return nativeFillRect(x, y, width, height);
    };
  }

  function clearVisualEffects() {
    review?.classList.remove('visible', 'harmful', 'weird', 'nudge', 'goal');
    stage?.classList.remove('reviewing');
    replayBall?.classList.remove('running');

    if (canvas) {
      canvas.style.filter = 'none';
      canvas.style.opacity = '1';
    }
  }

  window.addEventListener('keydown', (event) => {
    if (event.key.toLowerCase() === 'r') clearVisualEffects();
  });

  if (status) {
    const observer = new MutationObserver(() => {
      const text = status.textContent?.toUpperCase() || '';
      if (text.includes('SERVE')) clearVisualEffects();
    });
    observer.observe(status, { childList: true, characterData: true, subtree: true });
  }

  // All bottom-of-page scripts execute before this timer. Restore the native
  // scheduling APIs once the forensic scripts have installed their observers.
  window.setTimeout(() => {
    window.requestAnimationFrame = nativeRequestAnimationFrame;
    window.cancelAnimationFrame = nativeCancelAnimationFrame;
    window.setInterval = nativeSetInterval;
  }, 0);
})();
(() => {
  'use strict';

  const controls = document.querySelector('.touch-controls');
  const canvas = document.querySelector('#game');
  const cabinet = document.querySelector('#game-cabinet');
  const fullscreenButton = document.querySelector('#fullscreen-button');
  const status = document.querySelector('#status');
  const mobileQuery = window.matchMedia('(hover: none), (pointer: coarse), (max-width: 760px)');

  if (!controls || !canvas || !cabinet || !status) return;

  const codeForKey = {
    w: 'KeyW',
    s: 'KeyS',
    r: 'KeyR',
    Space: 'Space',
    ArrowUp: 'ArrowUp',
    ArrowDown: 'ArrowDown'
  };

  const pointerAssignments = new Map();
  const heldKeyCounts = new Map();

  function dispatchKey(type, key) {
    const keyboardKey = key === 'Space' ? ' ' : key;
    window.dispatchEvent(new KeyboardEvent(type, {
      key: keyboardKey,
      code: codeForKey[key] || key,
      bubbles: true,
      cancelable: true
    }));
  }

  function pressKey(key) {
    const count = heldKeyCounts.get(key) || 0;
    heldKeyCounts.set(key, count + 1);
    if (count === 0) dispatchKey('keydown', key);
  }

  function releaseKey(key) {
    const count = heldKeyCounts.get(key) || 0;
    if (count <= 1) {
      heldKeyCounts.delete(key);
      dispatchKey('keyup', key);
      return;
    }
    heldKeyCounts.set(key, count - 1);
  }

  function beginHold(event) {
    const button = event.currentTarget;
    const key = button.dataset.holdKey;
    if (!key || pointerAssignments.has(event.pointerId)) return;

    event.preventDefault();
    button.setPointerCapture?.(event.pointerId);
    pointerAssignments.set(event.pointerId, { button, key });
    button.classList.add('pressed');
    pressKey(key);
  }

  function endHold(event) {
    const assignment = pointerAssignments.get(event.pointerId);
    if (!assignment) return;

    event.preventDefault();
    pointerAssignments.delete(event.pointerId);
    assignment.button.classList.remove('pressed');
    releaseKey(assignment.key);
  }

  for (const button of controls.querySelectorAll('[data-hold-key]')) {
    button.addEventListener('pointerdown', beginHold);
    button.addEventListener('pointerup', endHold);
    button.addEventListener('pointercancel', endHold);
    button.addEventListener('lostpointercapture', endHold);
  }

  for (const button of controls.querySelectorAll('[data-tap-key]')) {
    const key = button.dataset.tapKey;

    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      button.setPointerCapture?.(event.pointerId);
      button.classList.add('pressed');
    });

    const activate = (event) => {
      event.preventDefault();
      button.classList.remove('pressed');
      dispatchKey('keydown', key);
      dispatchKey('keyup', key);
    };

    button.addEventListener('pointerup', activate);
    button.addEventListener('pointercancel', (event) => {
      event.preventDefault();
      button.classList.remove('pressed');
    });
  }

  canvas.addEventListener('pointerdown', (event) => {
    if (!mobileQuery.matches || event.pointerType === 'mouse') return;
    event.preventDefault();
    dispatchKey('keydown', 'Space');
    dispatchKey('keyup', 'Space');
  });

  controls.addEventListener('contextmenu', (event) => event.preventDefault());

  fullscreenButton?.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }

      if (cabinet.requestFullscreen) {
        await cabinet.requestFullscreen({ navigationUI: 'hide' });
        try {
          await screen.orientation?.lock?.('landscape');
        } catch {
          // Orientation locking is optional and unavailable on several mobile browsers.
        }
      } else {
        cabinet.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } catch {
      cabinet.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  function releaseEverything() {
    for (const { button, key } of pointerAssignments.values()) {
      button.classList.remove('pressed');
      dispatchKey('keyup', key);
    }
    pointerAssignments.clear();
    heldKeyCounts.clear();
  }

  window.addEventListener('blur', releaseEverything);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) releaseEverything();
  });

  function updateMobileStatus() {
    if (mobileQuery.matches && status.textContent === 'PRESS SPACE TO SERVE') {
      status.textContent = 'TAP SERVE OR THE COURT';
    }
  }

  const observer = new MutationObserver(updateMobileStatus);
  observer.observe(status, { childList: true, characterData: true, subtree: true });
  mobileQuery.addEventListener?.('change', updateMobileStatus);
  updateMobileStatus();
})();

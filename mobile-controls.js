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

  function tapKey(key) {
    dispatchKey('keydown', key);
    dispatchKey('keyup', key);
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

  function assignPointer(event, key, element, kind) {
    if (!key || pointerAssignments.has(event.pointerId)) return;
    event.preventDefault();
    element.setPointerCapture?.(event.pointerId);
    pointerAssignments.set(event.pointerId, { element, key, kind });
    element.classList.add('pressed');
    pressKey(key);
  }

  function releasePointer(event) {
    const assignment = pointerAssignments.get(event.pointerId);
    if (!assignment) return;

    event.preventDefault();
    pointerAssignments.delete(event.pointerId);
    assignment.element.classList.remove('pressed');
    releaseKey(assignment.key);
  }

  function keyForCourtPoint(event) {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const leftSide = x < rect.width / 2;
    const upperHalf = y < rect.height / 2;

    if (leftSide) return upperHalf ? 'w' : 's';
    return upperHalf ? 'ArrowUp' : 'ArrowDown';
  }

  for (const button of controls.querySelectorAll('[data-hold-key]')) {
    button.addEventListener('pointerdown', (event) => {
      assignPointer(event, button.dataset.holdKey, button, 'button');
    });
    button.addEventListener('pointerup', releasePointer);
    button.addEventListener('pointercancel', releasePointer);
    button.addEventListener('lostpointercapture', releasePointer);
  }

  for (const button of controls.querySelectorAll('[data-tap-key]')) {
    const key = button.dataset.tapKey;

    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      button.setPointerCapture?.(event.pointerId);
      button.classList.add('pressed');
    });

    button.addEventListener('pointerup', (event) => {
      event.preventDefault();
      button.classList.remove('pressed');
      tapKey(key);
    });

    button.addEventListener('pointercancel', (event) => {
      event.preventDefault();
      button.classList.remove('pressed');
    });
  }

  canvas.addEventListener('pointerdown', (event) => {
    if (!mobileQuery.matches || event.pointerType === 'mouse') return;

    const waitingForServe = (status.textContent || '').toUpperCase().includes('SERVE');
    if (waitingForServe) tapKey('Space');

    assignPointer(event, keyForCourtPoint(event), canvas, 'court');
  });

  canvas.addEventListener('pointermove', (event) => {
    const assignment = pointerAssignments.get(event.pointerId);
    if (!assignment || assignment.kind !== 'court') return;

    event.preventDefault();
    const nextKey = keyForCourtPoint(event);
    if (nextKey === assignment.key) return;

    releaseKey(assignment.key);
    assignment.key = nextKey;
    pressKey(nextKey);
  });

  canvas.addEventListener('pointerup', releasePointer);
  canvas.addEventListener('pointercancel', releasePointer);
  canvas.addEventListener('lostpointercapture', releasePointer);

  controls.addEventListener('contextmenu', (event) => event.preventDefault());
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

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
          // Orientation locking is optional on mobile browsers.
        }
      } else {
        cabinet.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } catch {
      cabinet.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  function releaseEverything() {
    for (const { element, key } of pointerAssignments.values()) {
      element.classList.remove('pressed');
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
    if (!mobileQuery.matches) return;
    if ((status.textContent || '').toUpperCase().includes('SERVE')) {
      status.textContent = 'HOLD COURT QUADRANTS • TAP SERVE';
    }
  }

  const observer = new MutationObserver(updateMobileStatus);
  observer.observe(status, { childList: true, characterData: true, subtree: true });
  mobileQuery.addEventListener?.('change', updateMobileStatus);
  updateMobileStatus();
})();
(() => {
  'use strict';

  const COMBO_WINDOW_MS = 4000;
  const ASSIST_WINDOW_MS = 6500;
  const SERIOUS_FREEZE_MS = 950;
  const WEIRD_FREEZE_MS = 320;
  const TRAIL_LENGTH = 28;

  const canvas = document.querySelector('#game');
  const stage = document.querySelector('.court-stage');
  const review = document.querySelector('#forensic-review');
  const caseLabel = document.querySelector('#forensic-case');
  const reviewTitle = document.querySelector('#forensic-title');
  const reviewDetail = document.querySelector('#forensic-detail');
  const reviewVerdict = document.querySelector('#forensic-verdict');
  const pathElement = document.querySelector('#forensic-path');
  const arrowElement = document.querySelector('#forensic-arrow');
  const impactElement = document.querySelector('#forensic-impact');
  const crossA = document.querySelector('#forensic-cross-a');
  const crossB = document.querySelector('#forensic-cross-b');
  const telemetryLog = document.querySelector('#telemetry-log');
  const existingBanner = document.querySelector('#bullshit-banner');
  const existingBannerTitle = document.querySelector('#bullshit-banner-title');
  const existingBannerDetail = document.querySelector('#bullshit-banner-detail');

  const outputs = {
    green: document.querySelector('#green-phase-count'),
    pink: document.querySelector('#pink-phase-count'),
    blockers: document.querySelector('#blocker-phase-count'),
    weird: document.querySelector('#weird-bounce-count'),
    nudges: document.querySelector('#nudge-count'),
    combo: document.querySelector('#combo-count'),
    cases: document.querySelector('#case-count'),
    assistedGoals: document.querySelector('#bullshit-goal-count'),
    greenScore: document.querySelector('#green-score'),
    pinkScore: document.querySelector('#pink-score')
  };

  if (!canvas || !stage || !review || Object.values(outputs).some((output) => !output)) return;

  const nativeRequestAnimationFrame = window.requestAnimationFrame.bind(window);
  let freezeUntil = 0;

  window.requestAnimationFrame = (callback) => {
    const guarded = (timestamp) => {
      if (performance.now() < freezeUntil) {
        nativeRequestAnimationFrame(guarded);
        return;
      }
      callback(timestamp);
    };
    return nativeRequestAnimationFrame(guarded);
  };

  const state = {
    cases: 0,
    assistedGoals: 0,
    lastHarmfulAt: -Infinity,
    chain: [],
    assistChain: [],
    trail: [],
    previous: {
      green: 0,
      pink: 0,
      blockers: 0,
      weird: 0,
      nudges: 0,
      greenScore: 0,
      pinkScore: 0
    },
    lastBannerTitle: '',
    reviewTimer: null,
    comboTimer: null,
    eventSerial: 0
  };

  const paddleHeadlines = [
    'COLLISION SCHEDULED. BALL DIDN’T ATTEND.',
    'THE PADDLE FILED A COMPLAINT.',
    'OBJECT PERMANENCE FAILURE.',
    'THE BALL DECLINED JURISDICTION.',
    'PADDLE CONTACT: ADMINISTRATIVELY LOST.'
  ];

  const blockerHeadlines = [
    'OBSTACLE DECLARED OPTIONAL.',
    'THE BLUE BAR WAS A SUGGESTION.',
    'SOLID OBJECT STATUS REVOKED.',
    'BLOCKER PRESENT. COLLISION ABSENT.',
    'THE BALL USED THE EXPRESS LANE.'
  ];

  function numericValue(output) {
    const parsed = Number.parseInt(output.value || output.textContent || '0', 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function updateForensicCounters() {
    outputs.cases.value = String(state.cases);
    outputs.assistedGoals.value = String(state.assistedGoals);
  }

  function resetForensics() {
    state.cases = 0;
    state.assistedGoals = 0;
    state.lastHarmfulAt = -Infinity;
    state.chain = [];
    state.assistChain = [];
    state.trail = [];
    state.eventSerial = 0;
    clearTimeout(state.reviewTimer);
    clearTimeout(state.comboTimer);
    outputs.combo.value = 'x0';
    updateForensicCounters();
    hideReview();
  }

  function addLog(message, severity = 'harmful') {
    if (!telemetryLog) return;
    const item = document.createElement('li');
    item.textContent = message;
    item.className = `${severity}-entry forensic-entry`;
    telemetryLog.prepend(item);
    while (telemetryLog.children.length > 12) telemetryLog.lastElementChild?.remove();
  }

  function choose(list) {
    return list[(state.cases - 1) % list.length];
  }

  function chainSummary() {
    const paddles = state.chain.filter((event) => event.type === 'paddle').length;
    const blockers = state.chain.filter((event) => event.type === 'blocker').length;
    if (blockers >= 2) return 'DOUBLE BLOCKER PENETRATION';
    if (paddles >= 1 && blockers >= 1) return 'CHAIN OF CUSTODY LOST';
    if (state.chain.length >= 3) return `BULLSHIT COMBO x${state.chain.length}`;
    if (state.chain.length === 2) return 'SECOND CONSECUTIVE PHYSICS FELONY';
    return 'COLLISION MISSING';
  }

  function scheduleComboExpiry(serial) {
    clearTimeout(state.comboTimer);
    state.comboTimer = window.setTimeout(() => {
      if (serial !== state.eventSerial) return;
      state.chain = [];
      outputs.combo.value = 'x0';
    }, COMBO_WINDOW_MS + 80);
  }

  function registerHarmful(type, victim) {
    const now = performance.now();
    if (now - state.lastHarmfulAt > COMBO_WINDOW_MS) state.chain = [];

    state.cases += 1;
    state.eventSerial += 1;
    state.lastHarmfulAt = now;
    const event = { type, victim, at: now };
    state.chain.push(event);
    state.assistChain = state.assistChain.filter((item) => now - item.at <= ASSIST_WINDOW_MS);
    state.assistChain.push(event);
    outputs.combo.value = `x${state.chain.length}`;
    updateForensicCounters();
    scheduleComboExpiry(state.eventSerial);

    const headline = type === 'paddle' ? choose(paddleHeadlines) : choose(blockerHeadlines);
    const subject = type === 'paddle'
      ? `${victim} PADDLE PHASE-THROUGH`
      : 'BLOCKER PHASE-THROUGH';
    const verdict = chainSummary();
    const detail = `${subject}. Harmful chain x${state.chain.length}.`;

    addLog(`CASE #${String(state.cases).padStart(3, '0')} — ${headline} ${detail} Verdict: ${verdict}.`);
    showReview({
      label: `PHYSICS REVIEW • CASE #${String(state.cases).padStart(3, '0')}`,
      title: headline,
      detail,
      verdict: `❌ ${verdict}`,
      severity: 'harmful',
      freezeMs: SERIOUS_FREEZE_MS
    });
  }

  function registerAssistedGoal(scorer) {
    const now = performance.now();
    state.assistChain = state.assistChain.filter((event) => now - event.at <= ASSIST_WINDOW_MS);
    if (!state.assistChain.length || now - state.lastHarmfulAt > ASSIST_WINDOW_MS) return;

    state.assistedGoals += 1;
    updateForensicCounters();
    const combo = state.assistChain.length;
    const verdict = combo >= 3 ? `BULLSHIT x${combo} FINISHER` : 'BULLSHIT-ASSISTED GOAL';
    addLog(`${scorer} scored after ${combo} harmful physics ${combo === 1 ? 'offense' : 'offenses'}. ${verdict}.`);
    showReview({
      label: `SCORING REVIEW • CASE #${String(state.cases).padStart(3, '0')}`,
      title: 'BULLSHIT-ASSISTED GOAL',
      detail: `${scorer} scored after ${combo} consecutive physics ${combo === 1 ? 'felony' : 'felonies'}.`,
      verdict: `⚠ ${verdict}`,
      severity: 'goal',
      freezeMs: 1250
    });
    state.chain = [];
    state.assistChain = [];
    outputs.combo.value = 'x0';
    clearTimeout(state.comboTimer);
  }

  function registerAnomaly(title, detail, severity = 'weird') {
    const normalized = title.toUpperCase();
    if (normalized.includes('GOT FUCKED') || normalized.includes('PHASE-THROUGH')) return;

    let headline = title;
    let verdict = 'WEIRD BUT PLAY CONTINUED';

    if (normalized.includes('BOUNCING INSIDE')) {
      headline = 'INTERNAL PADDLE COMBAT';
      verdict = 'BULLSHIT FIXED ITSELF';
    } else if (normalized.includes('GHOST BOUNCE')) {
      headline = 'OBJECT PERMANENCE FAILURE';
      verdict = 'UNSCHEDULED REFLECTION';
    } else if (normalized.includes('VISIBLE BONUS MOVEMENT')) {
      headline = 'FREE MOVEMENT DETECTED';
      verdict = 'NUDGE, NO ROBBERY';
      severity = 'nudge';
    } else if (normalized.includes('RECOVERED EVENTUALLY')) {
      headline = 'BULLSHIT FIXED ITSELF';
      verdict = 'WEIRD SAVE';
    }

    addLog(`${headline}: ${detail} Verdict: ${verdict}.`, severity);
    showReview({
      label: 'NON-HARMFUL ANOMALY',
      title: headline,
      detail,
      verdict: `✓ ${verdict}`,
      severity,
      freezeMs: WEIRD_FREEZE_MS
    });
  }

  function showReview({ label, title, detail, verdict, severity, freezeMs }) {
    clearTimeout(state.reviewTimer);
    freezeUntil = Math.max(freezeUntil, performance.now() + freezeMs);
    drawEvidence();

    caseLabel.textContent = label;
    reviewTitle.textContent = title;
    reviewDetail.textContent = detail;
    reviewVerdict.textContent = verdict;
    review.className = `forensic-review visible ${severity}`;
    stage.classList.add('reviewing');

    state.reviewTimer = window.setTimeout(() => {
      hideReview();
    }, Math.max(freezeMs + 350, severity === 'goal' ? 1800 : 1350));
  }

  function hideReview() {
    review.classList.remove('visible');
    stage.classList.remove('reviewing');
  }

  function drawEvidence() {
    const points = state.trail.slice(-TRAIL_LENGTH);
    if (!points.length) return;

    pathElement.setAttribute('points', points.map((point) => `${point.x},${point.y}`).join(' '));
    const impact = points[points.length - 1];
    const from = points[Math.max(0, points.length - 5)];

    arrowElement.setAttribute('x1', String(from.x));
    arrowElement.setAttribute('y1', String(from.y));
    arrowElement.setAttribute('x2', String(impact.x));
    arrowElement.setAttribute('y2', String(impact.y));
    impactElement.setAttribute('cx', String(impact.x));
    impactElement.setAttribute('cy', String(impact.y));

    const radius = 24;
    crossA.setAttribute('x1', String(impact.x - radius));
    crossA.setAttribute('y1', String(impact.y - radius));
    crossA.setAttribute('x2', String(impact.x + radius));
    crossA.setAttribute('y2', String(impact.y + radius));
    crossB.setAttribute('x1', String(impact.x + radius));
    crossB.setAttribute('y1', String(impact.y - radius));
    crossB.setAttribute('x2', String(impact.x - radius));
    crossB.setAttribute('y2', String(impact.y + radius));
  }

  function captureBall() {
    const context = canvas.getContext('2d');
    const previousFillRect = context.fillRect.bind(context);
    context.fillRect = (x, y, width, height) => {
      if (width === 6 && height === 6) {
        state.trail.push({ x: x + width / 2, y: y + height / 2, at: performance.now() });
        if (state.trail.length > 90) state.trail.splice(0, state.trail.length - 90);
      }
      return previousFillRect(x, y, width, height);
    };
  }

  function readCounters() {
    const current = {
      green: numericValue(outputs.green),
      pink: numericValue(outputs.pink),
      blockers: numericValue(outputs.blockers),
      weird: numericValue(outputs.weird),
      nudges: numericValue(outputs.nudges),
      greenScore: numericValue(outputs.greenScore),
      pinkScore: numericValue(outputs.pinkScore)
    };

    const resetDetected = current.green < state.previous.green
      || current.pink < state.previous.pink
      || current.blockers < state.previous.blockers;
    if (resetDetected) resetForensics();

    for (let count = state.previous.green; count < current.green; count += 1) registerHarmful('paddle', 'GREEN');
    for (let count = state.previous.pink; count < current.pink; count += 1) registerHarmful('paddle', 'PINK');
    for (let count = state.previous.blockers; count < current.blockers; count += 1) registerHarmful('blocker', 'COURT');

    if (current.greenScore > state.previous.greenScore) registerAssistedGoal('GREEN');
    if (current.pinkScore > state.previous.pinkScore) registerAssistedGoal('PINK');

    state.previous = current;
  }

  function observeExistingBanner() {
    if (!existingBannerTitle || !existingBannerDetail || !existingBanner) return;
    const observer = new MutationObserver(() => {
      if (!existingBanner.classList.contains('visible') || existingBanner.classList.contains('clean')) return;
      const title = existingBannerTitle.textContent.trim();
      if (!title || title === state.lastBannerTitle) return;
      state.lastBannerTitle = title;
      registerAnomaly(title, existingBannerDetail.textContent.trim(), existingBanner.classList.contains('nudge') ? 'nudge' : 'weird');
    });
    observer.observe(existingBanner, { attributes: true, childList: true, subtree: true, characterData: true });
  }

  captureBall();
  observeExistingBanner();
  updateForensicCounters();
  window.setInterval(readCounters, 32);
})();
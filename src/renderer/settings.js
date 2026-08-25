// Settings window. Reuses the same Mark renderer as the mascot itself, so the
// preview and the shape chips are the real character, not illustrations of it.

import DATA from '../shared/mascot-data.js';
import { Mark, SHAPE_KEYS, ACCESSORY_GROUPS } from './lib/mark.js';
import { EMOTIONS, PREVIEW_REEL } from './lib/emotions.js';
import { COATS, GRADIENTS, resolveCoat, inkForGradient, rgba } from '../shared/themes.js';
import { centroid, ringPath, clamp, TAU, approach, rand } from './lib/geom.js';
import { t as translate, isRTL, LANGUAGES } from '../shared/i18n.js';

const api = window.emooSettings;
const $ = (id) => document.getElementById(id);

// Switching language rebuilds every list, because their labels are baked into
// innerHTML. Their listeners must not be rebound each time, or one click fires
// once per language the window has been in.
const wired = new Set();
const bindOnce = (id, fn) => { if (!wired.has(id)) { wired.add(id); fn(); } };

let settings = null;
let lang = 'en';
const t = (key, vars) => translate(lang, key, vars);

// The preview shows the bot feeling things on its own rather than offering a
// grid of feelings to press. Nothing here reaches the mascot on the desktop —
// what it feels out there is its own business now.
let previewEmotion = 'idle';
let previewLeft = 3;

// ---------------------------------------------------------------- live preview
const preview = new Mark($('preview'));
let pClock = 0;
let pLast = performance.now();
let pLid = 0;
let pNextBlink = 2;

function previewLoop(now) {
  requestAnimationFrame(previewLoop);
  const dt = Math.min(0.05, (now - pLast) / 1000);
  pLast = now;
  if (!settings) return;
  pClock += dt;

  // Drift through the reel on its own, the way it does on the desktop.
  previewLeft -= dt;
  if (previewLeft <= 0) {
    previewLeft = rand(3.5, 6.5);
    let next = previewEmotion;
    while (next === previewEmotion) next = PREVIEW_REEL[Math.floor(Math.random() * PREVIEW_REEL.length)];
    previewEmotion = next;
    $('heroSub').textContent = t(`emotion.${next}`);
  }

  const def = EMOTIONS[previewEmotion] || EMOTIONS.idle;
  const bob = Math.sin(pClock * def.bob.rate * TAU) * def.bob.amp;
  const sway = Math.sin(pClock * def.sway.rate * TAU + 1.1) * def.sway.amp;
  const breathe = Math.sin(pClock * def.breathe.rate * TAU) * def.breathe.amp;

  pNextBlink -= dt;
  if (pNextBlink <= 0 && def.blink) { pLid = 1; pNextBlink = rand(...def.blink); }
  pLid = approach(pLid, 0, 12, dt);
  const droop = def.lidBias || 0;

  preview.update({
    rings: DATA.expressions[def.expr],
    gaze: { x: 0, y: 0 },
    lid: clamp(droop + pLid * (1 - droop), 0, 0.97),
    eyeScale: def.eye,
    body: {
      x: 0, y: bob + def.yOffset, rot: sway + def.lean,
      sx: def.scale * (1 - breathe), sy: def.scale * (1 + breathe),
    },
    blush: def.blush,
    star: def.star,
  });
}

// ---------------------------------------------------------------- static thumbnails
// A tiny non-animated mark for the shape chips.
function shapeThumb(shapeKey) {
  const shape = DATA.shapes[shapeKey];
  const face = shape.face;
  const C = DATA.HEAD_C;
  const eyes = DATA.expressions[10].map((ring) => {
    const [cx, cy] = centroid(ring);
    const tx = C + face.x + (cx - C) * face.sx;
    const ty = C + face.y + (cy - C) * face.sy;
    return `<path class="mark__eye" d="${ringPath(ring)}" transform="translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${face.eye}) translate(${(-cx).toFixed(2)} ${(-cy).toFixed(2)})"/>`;
  }).join('');
  return `<svg class="mark" viewBox="${DATA.viewBox}" xmlns="http://www.w3.org/2000/svg">
    <path class="mark__head" d="${shape.path}"/>${eyes}</svg>`;
}

// ---------------------------------------------------------------- builders
function buildShapes() {
  $('shapeGrid').innerHTML = SHAPE_KEYS.map((key) => `
    <button class="chip" data-shape="${key}">
      ${shapeThumb(key)}
      <span>${t(`shape.${key}`)}</span>
    </button>`).join('');

  bindOnce('shapeGrid', () => {
    $('shapeGrid').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-shape]');
      if (btn) api.update({ shape: btn.dataset.shape });
    });
  });
}

function buildCoats() {
  $('coatGrid').innerHTML = COATS.map((c) => `
    <button class="swatch" data-coat="${c.key}" title="${t(`coat.${c.key}`)}"
            style="background:${c.coat}"></button>`).join('');

  bindOnce('coatGrid', () => {
    $('coatGrid').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-coat]');
      if (btn) api.update({ coat: btn.dataset.coat });
    });
  });
}

// The gradient controls. Picking a preset selects the gradient coat as well —
// clicking a gradient and having nothing happen because a different coat is
// still selected would be a puzzle, not a feature.
const cssGradient = (colors, angle = 135) =>
  `linear-gradient(${angle + 90}deg, ${colors.join(', ')})`;

function buildGradients() {
  $('gradientGrid').innerHTML = GRADIENTS.map((g) => `
    <button class="swatch swatch--grad" data-gradient="${g.key}" title="${t(`gradient.${g.key}`)}"
            style="background:${cssGradient(g.colors)}"></button>`).join('');

  bindOnce('gradientGrid', () => {
    $('gradientGrid').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-gradient]');
      if (!btn) return;
      const preset = GRADIENTS.find((g) => g.key === btn.dataset.gradient);
      if (preset) api.update({ coat: 'gradient', gradient: { colors: [...preset.colors], angle: currentAngle() } });
    });

    // Editing a stop or the angle also switches the coat over, for the same
    // reason: the control you just used should be the one that takes effect.
    $('gradientStops').addEventListener('input', (e) => {
      const input = e.target.closest('[data-stop]');
      if (!input) return;
      const colors = [...$$('#gradientStops [data-stop]')].map((i) => i.value);
      api.update({ coat: 'gradient', gradient: { colors, angle: currentAngle() } });
    });

    $('gradientAngle').addEventListener('input', () => {
      $('gradientAngleOut').textContent = `${currentAngle()}°`;
      const colors = [...$$('#gradientStops [data-stop]')].map((i) => i.value);
      api.update({ coat: 'gradient', gradient: { colors, angle: currentAngle() } });
    });
  });
}

const currentAngle = () => Number($('gradientAngle').value) || 0;
const $$ = (sel) => document.querySelectorAll(sel);

const TOGGLES = [
  'followCursor', 'watchActivity', 'rideWindows', 'homeWhenBusy', 'focusReports',
  'machineAware', 'autoUpdate', 'roam', 'gravity', 'chatter', 'gestures', 'sleepWhenIdle',
  'nudges', 'gazeFollowsCursor', 'soundEnabled', 'alwaysOnTop', 'greetOnLaunch',
  'launchOnLogin',
];

function buildToggles() {
  $('toggles').innerHTML = TOGGLES.map((key) => `
    <label class="toggle">
      <span class="toggle__text"><strong>${t(`toggle.${key}`)}</strong><span>${t(`toggle.${key}.d`)}</span></span>
      <input type="checkbox" data-key="${key}" />
    </label>`).join('');

  // Bound on the document rather than on the container: some switches (focus
  // mode) live in their own panel, and render() already updates every
  // [data-key] on the page regardless of where it sits.
  bindOnce('toggles', () => {
    document.addEventListener('change', (e) => {
      const input = e.target.closest('input[type=checkbox][data-key]');
      if (input) api.update({ [input.dataset.key]: input.checked });
    });
  });
}

function buildTabs() {
  document.querySelector('.tabs').addEventListener('click', (e) => {
    const tab = e.target.closest('.tab');
    if (!tab) return;
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('is-active', t === tab));
    document.querySelectorAll('.panel').forEach((p) =>
      p.classList.toggle('is-active', p.dataset.panel === tab.dataset.tab));
  });
}

function buildActions() {
  // There is more than one action row now, so bind them all rather than the
  // first one the document happens to contain.
  document.querySelectorAll('.actions').forEach((row) => {
    row.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-cmd]');
      if (btn) api.command(btn.dataset.cmd);
    });
  });
  $('resetAll').addEventListener('click', () => api.reset());
}

// ---------------------------------------------------------------- timers
const QUICK = [5, 10, 15, 25, 45, 60];

const mmss = (seconds) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

let timerState = { pomodoro: null, timers: [] };

function renderTimers(next) {
  if (next) timerState = next;
  const list = $('timerList');
  if (!timerState.timers.length) {
    list.innerHTML = `<li class="empty">${t('focus.noTimers')}</li>`;
  } else {
    list.innerHTML = timerState.timers.map((x) => `
      <li>
        <span class="timers__label">${escapeText(x.label)}</span>
        <span class="timers__left">${mmss(x.remaining)}</span>
        <button class="link" data-cancel="${x.id}">${t('focus.cancel')}</button>
      </li>`).join('');
  }
  $('pomodoroToggle').textContent = timerState.pomodoro
    ? `${t('focus.stop')} (${timerState.pomodoro})` : t('focus.start');
}

// Timer labels are user-entered, so they go in as text rather than as markup.
const escapeText = (s) => {
  const d = document.createElement('div');
  d.textContent = String(s ?? '');
  return d.innerHTML;
};

function buildTimers() {
  $('quickTimers').innerHTML = QUICK.map((m) =>
    `<button data-quick="${m}">${t('menu.nMinutes', { n: m })}</button>`).join('');

  $('quickTimers').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-quick]');
    if (btn) renderTimers(await api.addTimer(Number(btn.dataset.quick), t('menu.nMinutes', { n: btn.dataset.quick })));
  });

  $('addTimer').addEventListener('click', async () => {
    const mins = Number($('timerMinutes').value);
    if (!mins || mins < 1) return;
    const label = $('timerLabel').value.trim() || t('menu.nMinutes', { n: mins });
    renderTimers(await api.addTimer(mins, label));
    $('timerMinutes').value = '';
    $('timerLabel').value = '';
  });

  $('timerList').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-cancel]');
    if (btn) renderTimers(await api.cancelTimer(btn.dataset.cancel));
  });

  $('pomodoroToggle').addEventListener('click', async () => {
    renderTimers(await api.pomodoro());
  });

  for (const key of ['pomodoroWork', 'pomodoroBreak']) {
    $(key).addEventListener('change', (e) => {
      const v = Number(e.target.value);
      if (v > 0) api.update({ [key]: v });
    });
  }

  // The remaining times are only meaningful if they actually tick.
  setInterval(async () => {
    if (!document.querySelector('[data-panel="focus"].is-active')) return;
    renderTimers(await api.timers());
  }, 1000);
}

// ---------------------------------------------------------------- accessory
// What 'auto' resolves to today, so the Automatic button can say what you will
// actually get rather than leaving you to guess. Returns a wearable key, or null.
function seasonalToday(date = new Date()) {
  const m = date.getMonth();
  const d = date.getDate();
  if (m === 0 && d <= 2) return 'party';
  if (m === 11 || (m === 0 && d <= 5)) return 'santa';
  if (m === 9 && d >= 24) return 'witch';
  if (m === 6 || m === 7) return 'shades';
  return null;
}

function buildAccessories() {
  const btn = (key, label) => `<button data-accessory="${key}">${label}</button>`;
  $('accessoryPicker').innerHTML = `
    <div class="actions">${btn('auto', t('wear.auto'))}${btn('none', t('wear.none'))}</div>
    ${ACCESSORY_GROUPS.map((g) => `
      <h3 class="subhead">${t(`wear.${g.key}`)}</h3>
      <div class="actions">${g.keys.map((k) => btn(k, t(`acc.${k}`))).join('')}</div>`).join('')}`;
  bindOnce('accessoryPicker', () => {
    $('accessoryPicker').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-accessory]');
      if (btn) api.update({ accessory: btn.dataset.accessory });
    });
  });
}

// ---------------------------------------------------------------- its spot
const CORNERS = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];

function buildLanguages() {
  $('languagePicker').innerHTML = LANGUAGES
    .map((l) => `<button data-lang="${l.key}">${l.key === 'auto' ? t('wear.auto') : l.native}</button>`).join('');
  bindOnce('languagePicker', () => {
    $('languagePicker').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-lang]');
      if (btn) api.update({ language: btn.dataset.lang });
    });
  });
}

// How it talks, which is not the same choice as which language the menus are in.
// Egyptian is a voice rather than a locale — colloquial, mixed with English —
// so it appears here and never in the language list.
const VOICES = [
  { key: 'auto', i18n: 'voice.auto' },
  { key: 'en', native: 'English' },
  { key: 'ar', native: 'العربية' },
  { key: 'eg', native: 'مصري + English' },
];

function buildVoices() {
  $('voicePicker').innerHTML = VOICES
    .map((v) => `<button data-voice="${v.key}">${v.i18n ? t(v.i18n) : v.native}</button>`).join('');
  bindOnce('voicePicker', () => {
    $('voicePicker').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-voice]');
      if (btn) api.update({ voice: btn.dataset.voice });
    });
  });
}

// Everything with a key in the markup, plus the direction of the whole window.
// Called once at boot and again whenever main tells us the language changed —
// the built lists are rebuilt rather than patched, because their labels are
// baked into innerHTML.
function applyLanguage(next) {
  lang = next || 'en';
  const rtl = isRTL(lang);
  document.documentElement.lang = lang;
  document.documentElement.dir = rtl ? 'rtl' : 'ltr';

  for (const el of document.querySelectorAll('[data-i18n]')) {
    el.textContent = t(el.dataset.i18n, el.dataset.i18nKey ? { key: el.dataset.i18nKey } : undefined);
  }
  for (const el of document.querySelectorAll('[data-i18n-ph]')) {
    el.placeholder = t(el.dataset.i18nPh);
  }

  buildShapes();
  buildCoats();
  buildGradients();
  buildToggles();
  buildAccessories();
  buildCorners();
  buildLanguages();
  buildVoices();
  buildQuickTimerLabels();
  renderCredit();
  if (settings) render(settings);
  renderTimers();
  renderBond();
  if (lastUpdate) renderUpdate(lastUpdate);
}

// The credit line. Not part of the generic [data-i18n] sweep because the
// copyright carries the current year, and the dedication is a name rather than
// a string to be translated around.
function renderCredit() {
  $('creditRights').textContent = t('credit.rights', { year: new Date().getFullYear() });
  $('creditMade').firstElementChild.textContent = t('credit.made');
}

function buildQuickTimerLabels() {
  $('quickTimers').innerHTML = QUICK.map((m) =>
    `<button data-quick="${m}">${t('menu.nMinutes', { n: m })}</button>`).join('');
}

function buildCorners() {
  $('cornerPicker').innerHTML = CORNERS
    .map((key) => `<button data-corner="${key}">${t(`corner.${key}`)}</button>`).join('');
  bindOnce('cornerPicker', () => {
    $('cornerPicker').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-corner]');
      if (btn) api.command('__homeCorner', { corner: btn.dataset.corner });
    });
  });
}

// ---------------------------------------------------------------- updates
function updateLabel(u) {
  switch (u.status) {
    case 'unsupported': return t('update.unsupported', { reason: u.reason });
    case 'checking': return t('update.checking');
    case 'available': return t('update.available', { version: u.version });
    case 'downloading': return t('update.downloading', { percent: u.percent });
    case 'ready': return t('update.ready', { version: u.version });
    case 'none': return t('update.none');
    case 'error': return t('update.error', { reason: u.reason });
    default: return t('update.check');
  }
}

let lastUpdate = null;

function renderUpdate(u) {
  if (!u) return;
  lastUpdate = u;
  const version = u.current ? t('update.current', { version: u.current }) : '';
  $('updateState').textContent = version + updateLabel(u);
  $('installUpdate').hidden = u.status !== 'ready';
  // A check already in flight, or a build that cannot update, has nothing for
  // the button to do.
  $('checkUpdate').disabled = u.status === 'checking'
    || u.status === 'downloading'
    || u.status === 'unsupported';
}

function buildUpdates() {
  $('checkUpdate').addEventListener('click', async () => {
    renderUpdate({ status: 'checking' });
    renderUpdate(await api.checkUpdate());
  });
  $('installUpdate').addEventListener('click', () => api.installUpdate());
  api.onUpdate(renderUpdate);
}

// ---------------------------------------------------------------- bond
let bondState = null;

function renderBond(b) {
  if (b) bondState = b;
  if (!bondState) return;
  const n = bondState;
  const hours = Math.floor(n.seconds / 3600);
  const num = (v) => new Intl.NumberFormat(lang).format(v);
  const rows = [
    [t('bond.days'), num(n.daysKnown)],
    [t('bond.sessions'), num(n.sessions)],
    [t('bond.time'), hours >= 1 ? num(hours) : '< 1'],
    [t('bond.pokes'), num(n.pokes)],
    [t('bond.pets'), num(n.pets)],
    [t('bond.tickles'), num(n.tickles)],
    [t('bond.throws'), num(n.throws)],
  ];
  $('bondStats').innerHTML = rows
    .map(([k, v]) => `<dt>${escapeText(k)}</dt><dd>${escapeText(v)}</dd>`).join('');
}

function buildBond() {
  $('forgetBond').addEventListener('click', async () => {
    renderBond(await api.forgetBond());
  });
  document.querySelector('.tabs').addEventListener('click', async (e) => {
    if (e.target.closest('[data-tab="bond"]')) renderBond(await api.bond());
  });
}

// ---------------------------------------------------------------- sync
function render(next) {
  settings = next;
  const { coat, ink, gradient } = resolveCoat(next.coat, next.customCoat, next.gradient);
  const root = document.documentElement.style;
  root.setProperty('--coat', coat);
  root.setProperty('--ink', ink);
  // The preview glows the way the real one does, so the slider demonstrates
  // itself rather than sending you off to look at the desktop.
  const stops = gradient ? gradient.colors : [coat, coat];
  root.setProperty('--glow-core', rgba(stops[stops.length - 1], 0.6));
  root.setProperty('--glow-mid', rgba(stops[0], 0.26));
  root.setProperty('--glow-strength', String(next.glow ?? 0));
  preview.setColors({ coat, ink, gradient });
  preview.setShape(next.shape);

  document.querySelectorAll('[data-shape]').forEach((b) =>
    b.classList.toggle('is-on', b.dataset.shape === next.shape));
  document.querySelectorAll('[data-coat]').forEach((b) =>
    b.classList.toggle('is-on', b.dataset.coat === next.coat));
  // A gradient preset is "on" when the coat is a gradient AND its colours are
  // the ones showing — otherwise every preset would look selected the moment
  // you nudged one stop away from it.
  const g = next.gradient || {};
  const wornGradient = next.coat === 'gradient' ? (g.colors || []).join(',').toLowerCase() : '';
  document.querySelectorAll('[data-gradient]').forEach((b) => {
    const preset = GRADIENTS.find((p) => p.key === b.dataset.gradient);
    b.classList.toggle('is-on', !!preset && preset.colors.join(',').toLowerCase() === wornGradient);
  });
  document.querySelectorAll('#gradientStops [data-stop]').forEach((i, n) => {
    if (document.activeElement !== i) i.value = (g.colors || [])[n] || '#000000';
  });
  if (document.activeElement !== $('gradientAngle')) $('gradientAngle').value = g.angle ?? 135;
  $('gradientAngleOut').textContent = `${g.angle ?? 135}°`;

  // Warn only when it actually matters: a gradient no eye colour survives.
  const worst = (g.colors || []).length ? inkForGradient(g.colors).ratio : 99;
  $('gradientNote').textContent = next.coat === 'gradient' && worst < 3
    ? t('look.gradientFaint')
    : t('look.gradientNote');

  document.querySelectorAll('[data-lang]').forEach((b) =>
    b.classList.toggle('is-on', b.dataset.lang === (next.language || 'auto')));
  document.querySelectorAll('[data-voice]').forEach((b) =>
    b.classList.toggle('is-on', b.dataset.voice === (next.voice || 'auto')));
  document.querySelectorAll('[data-key]').forEach((i) => { i.checked = !!next[i.dataset.key]; });

  $('customCoat').value = next.customCoat;
  // Same reason as the sliders below: a value echoed back mid-drag drops the
  // thumb wherever the last round trip finished, not where the finger is.
  if (document.activeElement !== $('size')) $('size').value = next.size;
  $('sizeOut').textContent = `${next.size}px`;
  if (document.activeElement !== $('opacity')) $('opacity').value = Math.round(next.opacity * 100);
  $('opacityOut').textContent = `${Math.round(next.opacity * 100)}%`;

  // Do not fight the user mid-word: every keystroke round-trips through the
  // store and comes back here, which would reset the caret to the end.
  if (document.activeElement !== $('botName')) $('botName').value = next.name || '';
  $('heroName').textContent = next.name || 'EMoO BOT';

  for (const key of PERCENT_SLIDERS) {
    const pct = Math.round((next[key] ?? 0) * 100);
    if (document.activeElement !== $(key)) $(key).value = pct;
    $(`${key}Out`).textContent = `${pct}%`;
  }

  for (const key of ['pomodoroWork', 'pomodoroBreak']) {
    if (document.activeElement !== $(key)) $(key).value = next[key];
  }

  const worn = next.accessory || 'auto';
  document.querySelectorAll('[data-accessory]').forEach((b) =>
    b.classList.toggle('is-on', b.dataset.accessory === worn));
  const today = seasonalToday();
  $('accessoryNote').textContent = worn !== 'auto' ? ''
    : today ? t('wear.autoNote', { what: t(`acc.${today}`) })
      : t('wear.autoNothing');

  // Say which of the two "where does it wait" rules is actually winning. A spot
  // beats sitting on your window, and finding that out by wondering why the bot
  // never sits on anything is a bad way to learn it.
  const spotWins = next.home && next.homeWhenBusy;
  const xy = next.home ? { x: next.home.x, y: next.home.y } : null;
  $('homeState').textContent = !next.home
    ? t(next.rideWindows ? 'home.none' : 'home.noneDrift')
    : spotWins
      ? t(next.rideWindows ? 'home.waitingOverRide' : 'home.waiting', xy)
      : t('home.focusOnly', xy);
}

const PERCENT_SLIDERS = ['chatty', 'clingy', 'sassy', 'grabResponse', 'volume', 'glow'];

for (const key of PERCENT_SLIDERS) {
  $(key).addEventListener('input', (e) => {
    const pct = Number(e.target.value);
    $(`${key}Out`).textContent = `${pct}%`;
    api.update({ [key]: pct / 100 });
  });
}

$('botName').addEventListener('input', (e) => {
  api.update({ name: e.target.value });
});

$('size').addEventListener('input', (e) => {
  $('sizeOut').textContent = `${e.target.value}px`;
  api.update({ size: Number(e.target.value) });
});

$('opacity').addEventListener('input', (e) => {
  $('opacityOut').textContent = `${e.target.value}%`;
  api.update({ opacity: Number(e.target.value) / 100 });
});

$('customCoat').addEventListener('input', (e) => {
  api.update({ customCoat: e.target.value, coat: 'custom' });
});

// ---------------------------------------------------------------- boot
buildTabs();
buildShapes();
buildCoats();
buildToggles();
buildActions();
buildTimers();
buildBond();
buildUpdates();
buildAccessories();
buildCorners();

api.onSettings(render);
api.onLanguage((l) => applyLanguage(l));

Promise.all([api.get(), api.lang()]).then(([s, l]) => {
  applyLanguage(l);
  render(s);
  requestAnimationFrame(previewLoop);
});
api.timers().then(renderTimers);
api.bond().then(renderBond);
api.updateState().then(renderUpdate);

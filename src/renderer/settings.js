// Settings window. Reuses the same Mark renderer as the mascot itself, so the
// preview and the shape chips are the real character, not illustrations of it.

import DATA from '../shared/mascot-data.js';
import { Mark, SHAPE_KEYS } from './lib/mark.js';
import { EMOTIONS, EMOTION_GROUPS } from './lib/emotions.js';
import { COATS, resolveCoat } from '../shared/themes.js';
import { centroid, ringPath, clamp, TAU, approach, rand } from './lib/geom.js';

const api = window.qubotSettings;
const $ = (id) => document.getElementById(id);

let settings = null;
let previewEmotion = 'idle';

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
      <span>${DATA.shapes[key].label}</span>
    </button>`).join('');

  $('shapeGrid').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-shape]');
    if (btn) api.update({ shape: btn.dataset.shape });
  });
}

function buildCoats() {
  $('coatGrid').innerHTML = COATS.map((c) => `
    <button class="swatch" data-coat="${c.key}" title="${c.label}"
            style="background:${c.coat}"></button>`).join('');

  $('coatGrid').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-coat]');
    if (btn) api.update({ coat: btn.dataset.coat });
  });
}

const TOGGLES = [
  ['followCursor', 'Watch what you do', 'Floats near your cursor and the window you are working in'],
  ['watchActivity', 'Notice the app in front', 'Reacts when you switch apps, and perches beside that window. Read locally only, never stored or sent anywhere'],
  ['roam', 'Wander around', 'Drifts around the screen on its own when you are idle'],
  ['gravity', 'Gravity', 'Off, it flies. On, it falls and sits on the ground like a desk pet'],
  ['chatter', 'Speech bubbles', 'Occasional remarks and reactions'],
  ['sleepWhenIdle', 'Sleep when idle', 'Dozes off when you step away'],
  ['nudges', 'Occasional nudges', 'Hourly notes and the odd reminder to take a break'],
  ['gazeFollowsCursor', 'Eyes follow cursor', 'Tracks your pointer around the screen'],
  ['soundEnabled', 'Sound', 'Small procedural blips on interaction'],
  ['alwaysOnTop', 'Always on top', 'Floats above other windows'],
  ['greetOnLaunch', 'Greet on launch', 'Says hello when it starts up'],
  ['launchOnLogin', 'Start with Windows', 'Launches quietly when you sign in'],
];

function buildToggles() {
  $('toggles').innerHTML = TOGGLES.map(([key, title, desc]) => `
    <label class="toggle">
      <span class="toggle__text"><strong>${title}</strong><span>${desc}</span></span>
      <input type="checkbox" data-key="${key}" />
    </label>`).join('');

  $('toggles').addEventListener('change', (e) => {
    const input = e.target.closest('[data-key]');
    if (input) api.update({ [input.dataset.key]: input.checked });
  });
}

function buildEmotions() {
  $('emotionGroups').innerHTML = EMOTION_GROUPS.map((g) => `
    <div class="group">
      <h3>${g.name}</h3>
      <div class="emotions">
        ${g.keys.map((k) => `
          <button class="emotion" data-emotion="${k}">
            <span>${EMOTIONS[k].emoji}</span>${EMOTIONS[k].label}
          </button>`).join('')}
      </div>
    </div>`).join('');

  $('emotionGroups').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-emotion]');
    if (!btn) return;
    previewEmotion = btn.dataset.emotion;
    api.command('emotion', { key: previewEmotion });
    document.querySelectorAll('[data-emotion]').forEach((b) => b.classList.toggle('is-on', b === btn));
    $('heroSub').textContent = EMOTIONS[previewEmotion].label;
  });

  // Hovering previews without disturbing the mascot on screen.
  $('emotionGroups').addEventListener('pointerover', (e) => {
    const btn = e.target.closest('[data-emotion]');
    if (btn) previewEmotion = btn.dataset.emotion;
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
  document.querySelector('.actions').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-cmd]');
    if (btn) api.command(btn.dataset.cmd);
  });
  $('resetAll').addEventListener('click', () => api.reset());
}

// ---------------------------------------------------------------- sync
function render(next) {
  settings = next;
  const { coat, ink } = resolveCoat(next.coat, next.customCoat);
  document.documentElement.style.setProperty('--coat', coat);
  document.documentElement.style.setProperty('--ink', ink);
  preview.setShape(next.shape);

  document.querySelectorAll('[data-shape]').forEach((b) =>
    b.classList.toggle('is-on', b.dataset.shape === next.shape));
  document.querySelectorAll('[data-coat]').forEach((b) =>
    b.classList.toggle('is-on', b.dataset.coat === next.coat));
  document.querySelectorAll('[data-key]').forEach((i) => { i.checked = !!next[i.dataset.key]; });

  $('customCoat').value = next.customCoat;
  $('size').value = next.size;
  $('sizeOut').textContent = `${next.size}px`;
  $('opacity').value = Math.round(next.opacity * 100);
  $('opacityOut').textContent = `${Math.round(next.opacity * 100)}%`;
}

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
buildEmotions();
buildActions();

api.onSettings(render);
api.get().then((s) => {
  render(s);
  requestAnimationFrame(previewLoop);
});

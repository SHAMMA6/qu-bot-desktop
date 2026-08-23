// Contact sheet for eyeballing the character set:
//   node tools/make-sheet.cjs expressions   -> every eye ring on the default body
//   node tools/make-sheet.cjs shapes        -> every body shape wearing the same eyes
//   node tools/make-sheet.cjs emotions      -> the emotion table, in menu order

const fs = require('fs');
const path = require('path');
const icons = require('./make-icons.cjs');

const ROOT = path.join(__dirname, '..');

function loadData() {
  const src = fs.readFileSync(path.join(ROOT, 'src/shared/mascot-data.js'), 'utf8');
  return JSON.parse(src.slice(src.indexOf('export default ') + 15).replace(/;\s*$/, ''));
}

function loadEmotions() {
  const src = fs.readFileSync(path.join(ROOT, 'src/renderer/lib/emotions.js'), 'utf8');
  const body = src.slice(src.indexOf('export const EMOTIONS = {') + 'export const EMOTIONS = '.length);
  const end = body.indexOf('\n};');
  // eslint-disable-next-line no-new-func
  return new Function(`return ${body.slice(0, end + 2)}`)();
}

function main() {
  const mode = process.argv[2] || 'expressions';
  const data = loadData();
  const cell = 128;
  const cols = 7;

  let items;
  if (mode === 'shapes') {
    items = Object.keys(data.shapes).map((k) => ({ shape: k, expression: 10, label: k }));
  } else if (mode === 'emotions') {
    const E = loadEmotions();
    items = Object.entries(E).map(([k, v]) => ({ shape: 'circle', expression: v.expr, label: k }));
  } else {
    items = data.expressions.map((_, i) => ({ shape: 'circle', expression: i, label: String(i) }));
  }

  const rows = Math.ceil(items.length / cols);
  const W = cols * cell;
  const H = rows * cell;
  const sheet = Buffer.alloc(W * H * 4);

  items.forEach((item, i) => {
    const png = icons.renderRaw(cell, {
      shape: item.shape, expression: item.expression,
      coat: '#17171B', ink: '#FFFFFF', padding: 0.12, data,
    });
    const ox = (i % cols) * cell;
    const oy = Math.floor(i / cols) * cell;
    for (let y = 0; y < cell; y++) {
      png.copy(sheet, ((oy + y) * W + ox) * 4, y * cell * 4, (y + 1) * cell * 4);
    }
  });

  const out = path.join(ROOT, `.ref/sheet-${mode}.png`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, icons.encodePNG(W, H, sheet));
  console.log('wrote', out, `(${cols}x${rows}, ${items.length} cells)`);
  items.forEach((it, i) => {
    if (i % cols === 0) process.stdout.write('\n row ' + (i / cols + 1) + ': ');
    process.stdout.write(it.label + '  ');
  });
  console.log();
}

main();

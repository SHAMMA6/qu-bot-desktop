// Renders the mascot into PNG/ICO app + tray icons, with no image dependencies:
// the SVG paths are flattened to polygons and scan-converted with supersampling.
//
//   node tools/make-icons.cjs

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'assets');

// ---------------------------------------------------------------- data
function loadData() {
  const src = fs.readFileSync(path.join(ROOT, 'src/shared/mascot-data.js'), 'utf8');
  const json = src.slice(src.indexOf('export default ') + 'export default '.length).replace(/;\s*$/, '');
  return JSON.parse(json);
}

// ---------------------------------------------------------------- path -> polygon
// Handles the M / L / C / Q / Z subset the shapes are authored with.
function flattenPath(d, steps = 24) {
  const polys = [];
  let poly = null;
  let cx = 0, cy = 0, sx = 0, sy = 0;

  const tokens = d.match(/[MLCQZmlcqz]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) || [];
  let i = 0;
  const num = () => parseFloat(tokens[i++]);

  while (i < tokens.length) {
    const tok = tokens[i];
    let cmd;
    if (/[MLCQZmlcqz]/.test(tok)) { cmd = tok; i++; } else { cmd = lastCmd === 'M' ? 'L' : lastCmd; }
    var lastCmd = cmd;

    switch (cmd.toUpperCase()) {
      case 'M':
        if (poly && poly.length > 2) polys.push(poly);
        cx = num(); cy = num();
        sx = cx; sy = cy;
        poly = [[cx, cy]];
        break;
      case 'L':
        cx = num(); cy = num();
        poly.push([cx, cy]);
        break;
      case 'C': {
        const x1 = num(), y1 = num(), x2 = num(), y2 = num(), x = num(), y = num();
        for (let s = 1; s <= steps; s++) {
          const t = s / steps, mt = 1 - t;
          poly.push([
            mt * mt * mt * cx + 3 * mt * mt * t * x1 + 3 * mt * t * t * x2 + t * t * t * x,
            mt * mt * mt * cy + 3 * mt * mt * t * y1 + 3 * mt * t * t * y2 + t * t * t * y,
          ]);
        }
        cx = x; cy = y;
        break;
      }
      case 'Q': {
        const x1 = num(), y1 = num(), x = num(), y = num();
        for (let s = 1; s <= steps; s++) {
          const t = s / steps, mt = 1 - t;
          poly.push([
            mt * mt * cx + 2 * mt * t * x1 + t * t * x,
            mt * mt * cy + 2 * mt * t * y1 + t * t * y,
          ]);
        }
        cx = x; cy = y;
        break;
      }
      case 'Z':
        if (poly) { poly.push([sx, sy]); polys.push(poly); poly = null; }
        cx = sx; cy = sy;
        break;
    }
  }
  if (poly && poly.length > 2) polys.push(poly);
  return polys;
}

function inPolys(x, y, polys) {
  let inside = false;
  for (const ring of polys) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

// ---------------------------------------------------------------- PNG writer
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePNG(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------- render
const hexToRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

function renderRaw(size, { shape, expression, coat, ink, padding = 0.06, data }) {
  const headPolys = flattenPath(data.shapes[shape].path);
  const face = data.shapes[shape].face;
  const C = data.HEAD_C;

  // Eye rings get the same per-shape face fitting the app applies at runtime.
  const eyePolys = data.expressions[expression].map((ring) => {
    let mx = 0, my = 0;
    for (const [x, y] of ring) { mx += x; my += y; }
    mx /= ring.length; my /= ring.length;
    const tx = C + face.x + (mx - C) * face.sx;
    const ty = C + face.y + (my - C) * face.sy;
    return ring.map(([x, y]) => [tx + (x - mx) * face.eye, ty + (y - my) * face.eye]);
  });

  const SS = 4;                      // supersampling factor
  const span = 228.541;
  const pad = span * padding;
  const scale = size / (span + pad * 2);
  const [cr, cg, cb] = hexToRgb(coat);
  const [ir, ig, ib] = hexToRgb(ink);

  const out = Buffer.alloc(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let head = 0, eye = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = (px + (sx + 0.5) / SS) / scale - pad;
          const y = (py + (sy + 0.5) / SS) / scale - pad;
          if (inPolys(x, y, headPolys)) {
            head++;
            if (inPolys(x, y, eyePolys)) eye++;
          }
        }
      }
      const n = SS * SS;
      const a = head / n;
      const e = head ? eye / head : 0;
      const o = (py * size + px) * 4;
      out[o] = Math.round(cr + (ir - cr) * e);
      out[o + 1] = Math.round(cg + (ig - cg) * e);
      out[o + 2] = Math.round(cb + (ib - cb) * e);
      out[o + 3] = Math.round(a * 255);
    }
  }
  return out;
}

const render = (size, opts) => encodePNG(size, size, renderRaw(size, opts));

// ---------------------------------------------------------------- ICO writer
function encodeICO(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);            // type: icon
  header.writeUInt16LE(entries.length, 4);

  const dir = Buffer.alloc(16 * entries.length);
  let offset = 6 + dir.length;
  entries.forEach((e, i) => {
    const o = i * 16;
    dir[o] = e.size >= 256 ? 0 : e.size;
    dir[o + 1] = e.size >= 256 ? 0 : e.size;
    dir[o + 2] = 0;                       // palette
    dir[o + 3] = 0;
    dir.writeUInt16LE(1, o + 4);          // colour planes
    dir.writeUInt16LE(32, o + 6);         // bits per pixel
    dir.writeUInt32LE(e.png.length, o + 8);
    dir.writeUInt32LE(offset, o + 12);
    offset += e.png.length;
  });

  return Buffer.concat([header, dir, ...entries.map((e) => e.png)]);
}

// ---------------------------------------------------------------- main
function main() {
  const data = loadData();
  fs.mkdirSync(OUT, { recursive: true });

  // App icon: the brand silhouette in violet with white eyes.
  const app = { shape: 'blob', expression: 0, coat: '#885CF5', ink: '#FFFFFF', data };
  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const pngs = sizes.map((s) => ({ size: s, png: render(s, app) }));

  fs.writeFileSync(path.join(OUT, 'icon.png'), pngs.find((p) => p.size === 256).png);
  fs.writeFileSync(path.join(OUT, 'icon.ico'), encodeICO(pngs));

  // Tray icons: flat monochrome so they sit correctly on light and dark taskbars.
  for (const [name, coat] of [['tray-light', '#FFFFFF'], ['tray-dark', '#1A1A1F']]) {
    const ink = coat === '#FFFFFF' ? '#00000000'.slice(0, 7) : '#FFFFFF';
    for (const s of [16, 20, 24, 32]) {
      fs.writeFileSync(
        path.join(OUT, `${name}${s === 16 ? '' : `@${s}`}.png`),
        render(s, { shape: 'blob', expression: 0, coat, ink: ink === '#000000' ? '#000000' : ink, padding: 0.02, data }),
      );
    }
  }

  console.log('icons written to', OUT);
  for (const f of fs.readdirSync(OUT)) {
    console.log(' ', f, (fs.statSync(path.join(OUT, f)).size / 1024).toFixed(1) + 'KB');
  }
}

module.exports = { render, renderRaw, encodePNG, encodeICO, flattenPath, loadData };

if (require.main === module) main();

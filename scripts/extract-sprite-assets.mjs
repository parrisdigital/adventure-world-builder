import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const sources = {
  action: path.join(repoRoot, 'assets/concepts/character-action-sheet.png'),
};
const outRoot = path.join(repoRoot, 'assets/sprites');

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function readPng(file) {
  return PNG.sync.read(readFileSync(file));
}

function writePng(file, png) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, PNG.sync.write(png));
}

function sampleBackground(src, rect) {
  const bounds = rect || [0, 0, src.width, src.height];
  const [rx, ry, rw, rh] = bounds;
  const acc = [0, 0, 0];
  let count = 0;
  for (let y = 4; y < Math.min(22, rh); y++) {
    for (let x = 4; x < Math.min(22, rw); x++) {
      const px = clamp(rx + x, 0, src.width - 1);
      const py = clamp(ry + y, 0, src.height - 1);
      const i = (py * src.width + px) * 4;
      acc[0] += src.data[i];
      acc[1] += src.data[i + 1];
      acc[2] += src.data[i + 2];
      count += 1;
    }
  }
  return acc.map(v => v / count);
}

function cropWithAlpha(src, rect) {
  const [rx, ry, rw, rh] = rect;
  const bg = sampleBackground(src, rect);
  const crop = new PNG({ width: rw, height: rh });
  for (let y = 0; y < rh; y++) {
    for (let x = 0; x < rw; x++) {
      const sx = clamp(rx + x, 0, src.width - 1);
      const sy = clamp(ry + y, 0, src.height - 1);
      const si = (sy * src.width + sx) * 4;
      const di = (y * rw + x) * 4;
      const r = src.data[si];
      const g = src.data[si + 1];
      const b = src.data[si + 2];
      const dist = Math.hypot(r - bg[0], g - bg[1], b - bg[2]);
      const warmPaper = r > 205 && g > 190 && b > 165 && b < 228 && r - b > 10 && r >= g - 4 && g >= b - 10;
      const castShadow = r > 132 && g > 118 && b > 96 && r < 222 && g < 212 && b < 202 && r - b > 10 && r - b < 86 && r >= g - 14 && g >= b - 22;
      const nearCorner = dist < 42;
      const alpha = warmPaper || castShadow || nearCorner ? 0 : clamp(Math.round((dist - 26) * 10), 0, 255);
      crop.data[di] = r;
      crop.data[di + 1] = g;
      crop.data[di + 2] = b;
      crop.data[di + 3] = alpha;
    }
  }
  return trimAlpha(crop, 20, 12);
}

function trimAlpha(src, threshold, pad) {
  let minX = src.width;
  let minY = src.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      const a = src.data[(y * src.width + x) * 4 + 3];
      if (a <= threshold) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (maxX < minX || maxY < minY) return src;
  minX = clamp(minX - pad, 0, src.width - 1);
  minY = clamp(minY - pad, 0, src.height - 1);
  maxX = clamp(maxX + pad, 0, src.width - 1);
  maxY = clamp(maxY + pad, 0, src.height - 1);
  const out = new PNG({ width: maxX - minX + 1, height: maxY - minY + 1 });
  for (let y = 0; y < out.height; y++) {
    for (let x = 0; x < out.width; x++) {
      const si = ((minY + y) * src.width + (minX + x)) * 4;
      const di = (y * out.width + x) * 4;
      out.data[di] = src.data[si];
      out.data[di + 1] = src.data[si + 1];
      out.data[di + 2] = src.data[si + 2];
      out.data[di + 3] = src.data[si + 3];
    }
  }
  return out;
}

function resizeToCanvas(src, frame, opts = {}) {
  const maxW = opts.maxW || frame.width - 24;
  const maxH = opts.maxH || frame.height - 24;
  const bottom = opts.bottom ?? 10;
  const scale = Math.min(maxW / src.width, maxH / src.height);
  const sw = Math.max(1, Math.round(src.width * scale));
  const sh = Math.max(1, Math.round(src.height * scale));
  const out = new PNG({ width: frame.width, height: frame.height });
  const ox = Math.round((frame.width - sw) / 2);
  const oy = Math.round(frame.height - bottom - sh);
  for (let y = 0; y < sh; y++) {
    const sy = clamp(Math.floor(y / scale), 0, src.height - 1);
    for (let x = 0; x < sw; x++) {
      const sx = clamp(Math.floor(x / scale), 0, src.width - 1);
      const si = (sy * src.width + sx) * 4;
      const dx = opts.flip ? sw - 1 - x : x;
      const di = ((oy + y) * frame.width + (ox + dx)) * 4;
      out.data[di] = src.data[si];
      out.data[di + 1] = src.data[si + 1];
      out.data[di + 2] = src.data[si + 2];
      out.data[di + 3] = src.data[si + 3];
    }
  }
  return out;
}

const frame = { width: 256, height: 256 };
const sourcePngs = Object.fromEntries(Object.entries(sources).map(([key, file]) => [key, readPng(file)]));

const spriteSpecs = [
  { role: 'hero', action: 'idle',   rect: [48, 58, 170, 214], maxH: 226 },
  { role: 'hero', action: 'move',   rect: [284, 58, 180, 214], maxH: 226 },
  { role: 'hero', action: 'dash',   rect: [500, 50, 246, 220], maxH: 226 },
  { role: 'hero', action: 'guard',  rect: [758, 48, 206, 222], maxH: 226 },
  { role: 'hero', action: 'slash',  rect: [980, 26, 286, 244], maxH: 232 },
  { role: 'hero', action: 'hit',    rect: [1310, 50, 202, 220], maxH: 226 },

  { role: 'villain', action: 'idle',   rect: [36, 310, 194, 238], maxH: 234 },
  { role: 'villain', action: 'move',   rect: [500, 302, 244, 250], maxH: 234 },
  { role: 'villain', action: 'guard',  rect: [272, 304, 208, 246], maxH: 234 },
  { role: 'villain', action: 'attack', rect: [952, 300, 312, 252], maxH: 238 },
  { role: 'villain', action: 'hit',    rect: [1280, 318, 230, 222], maxH: 228 },

  { role: 'npc', action: 'villager', rect: [372, 574, 176, 196], maxH: 212 },
  { role: 'npc', action: 'farmer',   rect: [666, 554, 188, 216], maxH: 212 },
  { role: 'npc', action: 'guard',    rect: [858, 560, 186, 214], maxH: 212 },

  { role: 'chest', action: 'closed', rect: [248, 808, 220, 184], maxW: 230, maxH: 178, bottom: 28 },
  { role: 'chest', action: 'open',   rect: [548, 790, 246, 204], maxW: 236, maxH: 190, bottom: 28 },
  { role: 'chest', action: 'relic',  rect: [786, 786, 246, 208], maxW: 236, maxH: 194, bottom: 28 },
];

const manifest = {
  version: 1,
  frame: { width: frame.width, height: frame.height },
  anchor: 'bottom-center',
  sprites: {},
};

for (const spec of spriteSpecs) {
  const cropped = cropWithAlpha(sourcePngs.action, spec.rect);
  const directions = spec.role === 'chest' || spec.role === 'npc'
    ? [{ name: 'default', flip: false }]
    : [{ name: 'right', flip: false }, { name: 'left', flip: true }];
  for (const direction of directions) {
    const image = resizeToCanvas(cropped, frame, {
      maxW: spec.maxW || 238,
      maxH: spec.maxH || 228,
      bottom: spec.bottom ?? 10,
      flip: direction.flip,
    });
    const file = direction.name === 'default'
      ? path.join(outRoot, spec.role, `${spec.action}.png`)
      : path.join(outRoot, spec.role, `${spec.action}-${direction.name}.png`);
    writePng(file, image);
    manifest.sprites[spec.role] ||= {};
    manifest.sprites[spec.role][spec.action] ||= {};
    manifest.sprites[spec.role][spec.action][direction.name] = path.relative(outRoot, file).replaceAll(path.sep, '/');
  }
}

writeFileSync(path.join(outRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote ${spriteSpecs.length} sprite specs to ${path.relative(repoRoot, outRoot)}`);

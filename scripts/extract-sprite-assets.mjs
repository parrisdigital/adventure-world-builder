import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const sources = {
  action: path.join(repoRoot, 'assets/concepts/character-action-sheet.png'),
  turnaround: path.join(repoRoot, 'assets/concepts/character-turnaround-sheet.png'),
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
  const bottom = opts.bottom ?? 22;
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
  return removeEdgeScraps(out, { allowLargeEdgeComponents: !!opts.allowLargeEdgeComponents });
}

function removeEdgeScraps(src, opts = {}) {
  const threshold = 18;
  const edgePad = 40;
  const seen = new Uint8Array(src.width * src.height);
  const comps = [];
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      const start = y * src.width + x;
      if (seen[start]) continue;
      seen[start] = 1;
      if (src.data[start * 4 + 3] <= threshold) continue;
      const pixels = [[x, y]];
      let minX = x, maxX = x, minY = y, maxY = y;
      for (let i = 0; i < pixels.length; i++) {
        const [cx, cy] = pixels[i];
        minX = Math.min(minX, cx);
        maxX = Math.max(maxX, cx);
        minY = Math.min(minY, cy);
        maxY = Math.max(maxY, cy);
        for (const [dx, dy] of dirs) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || nx >= src.width || ny < 0 || ny >= src.height) continue;
          const ni = ny * src.width + nx;
          if (seen[ni]) continue;
          seen[ni] = 1;
          if (src.data[ni * 4 + 3] > threshold) pixels.push([nx, ny]);
        }
      }
      comps.push({ pixels, area: pixels.length, minX, maxX, minY, maxY });
    }
  }
  if (comps.length <= 1) return src;
  const mainArea = Math.max(...comps.map(c => c.area));
  const out = PNG.sync.read(PNG.sync.write(src));
  for (const comp of comps) {
    const edge = Math.min(comp.minX, comp.minY, src.width - 1 - comp.maxX, src.height - 1 - comp.maxY);
    const small = comp.area < Math.max(800, mainArea * 0.05);
    const tinyNoise = comp.area < (opts.allowLargeEdgeComponents ? 24 : 64);
    const detachedEdgeScrap = edge < edgePad && (small || (!opts.allowLargeEdgeComponents && comp.area < mainArea * 0.70));
    if (!tinyNoise && !detachedEdgeScrap) continue;
    for (const [x, y] of comp.pixels) {
      out.data[(y * out.width + x) * 4 + 3] = 0;
    }
  }
  for (let i = 0; i < out.data.length; i += 4) {
    if (out.data[i + 3] > threshold) continue;
    out.data[i] = 0;
    out.data[i + 1] = 0;
    out.data[i + 2] = 0;
    out.data[i + 3] = 0;
  }
  return out;
}

const frame = { width: 320, height: 320 };
const sourcePngs = Object.fromEntries(Object.entries(sources).map(([key, file]) => [key, readPng(file)]));

function actionFrame(rect, extra = {}) {
  return { source: 'action', rect, ...extra };
}

function turnaroundFrame(rect, extra = {}) {
  return { source: 'turnaround', rect, ...extra };
}

function fourWay({ right, left, front, back }) {
  return {
    right,
    left: left || { ...right, flip: !right.flip },
    front: front || right,
    back: back || front || right,
  };
}

const spriteSpecs = [
  {
    role: 'hero',
    action: 'idle',
    maxH: 248,
    frames: fourWay({
      right: actionFrame([18, 38, 220, 238], { maxW: 284 }),
      front: turnaroundFrame([208, 26, 190, 202]),
      back: turnaroundFrame([956, 22, 198, 210], { maxW: 250 }),
    }),
  },
  {
    role: 'hero',
    action: 'move',
    maxH: 248,
    frames: fourWay({
      right: actionFrame([260, 44, 228, 234], { maxW: 286 }),
      front: turnaroundFrame([778, 24, 194, 208], { maxW: 250 }),
      back: turnaroundFrame([956, 22, 198, 210], { maxW: 250 }),
    }),
  },
  {
    role: 'hero',
    action: 'dash',
    maxH: 252,
    frames: fourWay({
      right: actionFrame([448, 42, 314, 236], { maxW: 300, allowLargeEdgeComponents: true }),
      front: turnaroundFrame([778, 24, 194, 208], { maxW: 250 }),
      back: turnaroundFrame([956, 22, 198, 210], { maxW: 250 }),
    }),
  },
  {
    role: 'hero',
    action: 'guard',
    maxH: 248,
    frames: fourWay({
      right: actionFrame([728, 26, 262, 250], { maxW: 292 }),
      front: turnaroundFrame([208, 26, 190, 202]),
      back: turnaroundFrame([956, 22, 198, 210], { maxW: 250 }),
    }),
  },
  {
    role: 'hero',
    action: 'slash',
    maxH: 258,
    frames: fourWay({
      right: actionFrame([990, 14, 320, 266], { maxW: 306, allowLargeEdgeComponents: true }),
      front: turnaroundFrame([208, 26, 190, 202]),
      back: turnaroundFrame([956, 22, 198, 210], { maxW: 250 }),
    }),
  },
  {
    role: 'hero',
    action: 'hit',
    maxH: 248,
    frames: fourWay({
      right: actionFrame([1286, 30, 246, 246], { maxW: 286 }),
      front: turnaroundFrame([208, 26, 190, 202]),
      back: turnaroundFrame([956, 22, 198, 210], { maxW: 250 }),
    }),
  },
  {
    role: 'hero',
    action: 'defeated',
    maxH: 238,
    bottom: 22,
    frames: fourWay({
      right: actionFrame([1286, 30, 246, 246], { maxW: 286 }),
      front: actionFrame([1286, 30, 246, 246], { maxW: 286 }),
      back: actionFrame([1286, 30, 246, 246], { maxW: 286 }),
    }),
  },

  {
    role: 'villain',
    action: 'idle',
    maxH: 254,
    frames: fourWay({
      right: actionFrame([18, 292, 230, 264], { maxW: 286 }),
      front: turnaroundFrame([22, 232, 204, 218], { maxW: 260 }),
      back: turnaroundFrame([1150, 228, 212, 214], { maxW: 262 }),
    }),
  },
  {
    role: 'villain',
    action: 'move',
    maxH: 254,
    frames: fourWay({
      right: actionFrame([476, 284, 292, 278], { maxW: 300 }),
      front: turnaroundFrame([22, 232, 204, 218], { maxW: 260 }),
      back: turnaroundFrame([1150, 228, 212, 214], { maxW: 262 }),
    }),
  },
  {
    role: 'villain',
    action: 'guard',
    maxH: 254,
    frames: fourWay({
      right: actionFrame([252, 286, 246, 268], { maxW: 288 }),
      front: turnaroundFrame([22, 232, 204, 218], { maxW: 260 }),
      back: turnaroundFrame([1150, 228, 212, 214], { maxW: 262 }),
    }),
  },
  {
    role: 'villain',
    action: 'attack',
    maxH: 260,
    frames: fourWay({
      right: actionFrame([940, 274, 380, 294], { maxW: 292, allowLargeEdgeComponents: true }),
      front: turnaroundFrame([22, 232, 204, 218], { maxW: 260 }),
      back: turnaroundFrame([1150, 228, 212, 214], { maxW: 262 }),
    }),
  },
  {
    role: 'villain',
    action: 'hit',
    maxH: 254,
    frames: fourWay({
      right: actionFrame([1260, 302, 272, 250], { maxW: 292 }),
      front: turnaroundFrame([22, 232, 204, 218], { maxW: 260 }),
      back: turnaroundFrame([1150, 228, 212, 214], { maxW: 262 }),
    }),
  },
  {
    role: 'villain',
    action: 'defeated',
    maxH: 238,
    bottom: 22,
    frames: fourWay({
      right: actionFrame([1250, 306, 282, 248], { maxW: 292 }),
      front: actionFrame([1250, 306, 282, 248], { maxW: 292 }),
      back: actionFrame([1250, 306, 282, 248], { maxW: 292 }),
    }),
  },

  {
    role: 'npc',
    action: 'villager',
    maxH: 238,
    frames: fourWay({
      right: actionFrame([354, 558, 216, 222], { maxW: 250 }),
      front: turnaroundFrame([218, 446, 180, 196]),
      back: turnaroundFrame([966, 444, 182, 198]),
    }),
  },
  {
    role: 'npc',
    action: 'merchant',
    maxH: 238,
    frames: fourWay({
      right: turnaroundFrame([778, 448, 192, 196], { maxW: 250 }),
      front: turnaroundFrame([218, 446, 180, 196]),
      back: turnaroundFrame([966, 444, 182, 198]),
    }),
  },
  {
    role: 'npc',
    action: 'farmer',
    maxH: 238,
    frames: fourWay({
      right: actionFrame([644, 536, 236, 250], { maxW: 254 }),
      front: turnaroundFrame([218, 446, 180, 196]),
      back: turnaroundFrame([966, 444, 182, 198]),
    }),
  },
  {
    role: 'npc',
    action: 'guard',
    maxH: 238,
    frames: fourWay({
      right: actionFrame([840, 536, 228, 250], { maxW: 254 }),
      front: turnaroundFrame([30, 648, 184, 214], { maxW: 244 }),
      back: turnaroundFrame([968, 648, 186, 166], { maxW: 244 }),
    }),
  },

  { role: 'chest', action: 'closed', maxW: 274, maxH: 210, bottom: 36, frames: { default: actionFrame([230, 792, 260, 214]) } },
  { role: 'chest', action: 'open',   maxW: 282, maxH: 224, bottom: 36, frames: { default: actionFrame([526, 770, 288, 236]) } },
  { role: 'chest', action: 'relic',  maxW: 282, maxH: 228, bottom: 36, frames: { default: actionFrame([760, 764, 300, 244]) } },
];

const manifest = {
  version: 1,
  frame: { width: frame.width, height: frame.height },
  anchor: 'bottom-center',
  sprites: {},
};

let written = 0;
for (const spec of spriteSpecs) {
  for (const [directionName, frameSpec] of Object.entries(spec.frames)) {
    const cropped = cropWithAlpha(sourcePngs[frameSpec.source], frameSpec.rect);
    const image = resizeToCanvas(cropped, frame, {
      maxW: frameSpec.maxW || spec.maxW || 238,
      maxH: frameSpec.maxH || spec.maxH || 228,
      bottom: spec.bottom ?? 22,
      flip: !!frameSpec.flip,
      allowLargeEdgeComponents: spec.allowLargeEdgeComponents || frameSpec.allowLargeEdgeComponents,
    });
    const file = directionName === 'default'
      ? path.join(outRoot, spec.role, `${spec.action}.png`)
      : path.join(outRoot, spec.role, `${spec.action}-${directionName}.png`);
    writePng(file, image);
    manifest.sprites[spec.role] ||= {};
    manifest.sprites[spec.role][spec.action] ||= {};
    manifest.sprites[spec.role][spec.action][directionName] = path.relative(outRoot, file).replaceAll(path.sep, '/');
    written += 1;
  }
}

writeFileSync(path.join(outRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote ${written} sprite frames from ${spriteSpecs.length} specs to ${path.relative(repoRoot, outRoot)}`);

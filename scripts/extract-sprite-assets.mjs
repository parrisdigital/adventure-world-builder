import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const sources = {
  action: path.join(repoRoot, 'assets/concepts/character-action-sheet.png'),
  turnaround: path.join(repoRoot, 'assets/concepts/character-turnaround-sheet.png'),
  direction: path.join(repoRoot, 'assets/concepts/character-direction-sheet.png'),
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
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const coolLightDetail = max > 148 && max < 246 && max - min < 36 && b >= r - 18 && g >= r - 22 && dist > 18;
      const alpha = (warmPaper || castShadow || nearCorner) && !coolLightDetail ? 0 : clamp(Math.round((dist - 26) * 10), 0, 255);
      crop.data[di] = r;
      crop.data[di + 1] = g;
      crop.data[di + 2] = b;
      crop.data[di + 3] = alpha;
    }
  }
  recoverCoolLightDetails(crop);
  return trimAlpha(crop, 20, 12);
}

function recoverCoolLightDetails(crop) {
  const threshold = 20;
  const seen = new Uint8Array(crop.width * crop.height);
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const neighbors = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

  function isRecoverableDetail(x, y) {
    const i = (y * crop.width + x) * 4;
    if (crop.data[i + 3] > threshold) return false;
    const r = crop.data[i], g = crop.data[i + 1], b = crop.data[i + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const coolNeutral = max > 135 && max < 250 && max - min < 62 && b >= r - 16 && g >= r - 24;
    const warmPaper = r > 225 && g > 214 && b > 198 && r - b > 16 && r >= g - 6;
    return coolNeutral && !warmPaper;
  }

  function touchesVisible(component) {
    for (const [x, y] of component) {
      for (const [dx, dy] of neighbors) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= crop.width || ny < 0 || ny >= crop.height) continue;
        if (crop.data[(ny * crop.width + nx) * 4 + 3] > threshold) return true;
      }
    }
    return false;
  }

  for (let y = 0; y < crop.height; y++) {
    for (let x = 0; x < crop.width; x++) {
      const start = y * crop.width + x;
      if (seen[start] || !isRecoverableDetail(x, y)) continue;
      seen[start] = 1;
      const component = [[x, y]];
      let minX = x, maxX = x, minY = y, maxY = y;
      for (let i = 0; i < component.length; i++) {
        const [cx, cy] = component[i];
        minX = Math.min(minX, cx);
        maxX = Math.max(maxX, cx);
        minY = Math.min(minY, cy);
        maxY = Math.max(maxY, cy);
        for (const [dx, dy] of dirs) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || nx >= crop.width || ny < 0 || ny >= crop.height) continue;
          const ni = ny * crop.width + nx;
          if (seen[ni] || !isRecoverableDetail(nx, ny)) continue;
          seen[ni] = 1;
          component.push([nx, ny]);
        }
      }
      const spanX = maxX - minX + 1;
      const spanY = maxY - minY + 1;
      const edge = Math.min(minX, minY, crop.width - 1 - maxX, crop.height - 1 - maxY);
      const plausibleWeaponOrTrim = component.length <= 2800 && spanX <= crop.width * 0.78 && spanY <= crop.height * 0.78;
      if (!plausibleWeaponOrTrim || (!touchesVisible(component) && edge <= 18)) continue;
      for (const [px, py] of component) {
        crop.data[(py * crop.width + px) * 4 + 3] = 245;
      }
    }
  }
}

function cropCheckerWithAlpha(src, rect) {
  const [rx, ry, rw, rh] = rect;
  const crop = new PNG({ width: rw, height: rh });
  for (let y = 0; y < rh; y++) {
    for (let x = 0; x < rw; x++) {
      const sx = clamp(rx + x, 0, src.width - 1);
      const sy = clamp(ry + y, 0, src.height - 1);
      const si = (sy * src.width + sx) * 4;
      const di = (y * rw + x) * 4;
      crop.data[di] = src.data[si];
      crop.data[di + 1] = src.data[si + 1];
      crop.data[di + 2] = src.data[si + 2];
      crop.data[di + 3] = 255;
    }
  }

  const seen = new Uint8Array(rw * rh);
  const queue = [];
  function isCheckerBackground(x, y) {
      const i = (y * rw + x) * 4;
      const r = crop.data[i], g = crop.data[i + 1], b = crop.data[i + 2];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      return r > 224 && g > 224 && b > 224 && max - min < 14;
  }
  function enqueue(x, y) {
    if (x < 0 || x >= rw || y < 0 || y >= rh) return;
    const idx = y * rw + x;
    if (seen[idx] || !isCheckerBackground(x, y)) return;
    seen[idx] = 1;
    queue.push([x, y]);
  }
  for (let x = 0; x < rw; x++) {
    enqueue(x, 0);
    enqueue(x, rh - 1);
  }
  for (let y = 0; y < rh; y++) {
    enqueue(0, y);
    enqueue(rw - 1, y);
  }
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i];
    const di = (y * rw + x) * 4;
    crop.data[di] = 0;
    crop.data[di + 1] = 0;
    crop.data[di + 2] = 0;
    crop.data[di + 3] = 0;
    enqueue(x + 1, y);
    enqueue(x - 1, y);
    enqueue(x, y + 1);
    enqueue(x, y - 1);
  }

  for (let i = 0; i < crop.data.length; i += 4) {
    const r = crop.data[i], g = crop.data[i + 1], b = crop.data[i + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (r > 180 && g > 180 && b > 180 && max - min < 35) {
      crop.data[i] = 0;
      crop.data[i + 1] = 0;
      crop.data[i + 2] = 0;
      crop.data[i + 3] = 0;
    }
  }

  return trimAlpha(crop, 20, 14);
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

function pointInPolygon(x, y, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i][0], yi = points[i][1];
    const xj = points[j][0], yj = points[j][1];
    const intersects = ((yi > y) !== (yj > y)) &&
      (x < (xj - xi) * (y - yi) / ((yj - yi) || 1e-6) + xi);
    if (intersects) inside = !inside;
  }
  return inside;
}

function blendPixel(png, x, y, color) {
  if (x < 0 || x >= png.width || y < 0 || y >= png.height) return;
  const i = (y * png.width + x) * 4;
  const a = color[3] / 255;
  const ia = 1 - a;
  png.data[i] = Math.round(color[0] * a + png.data[i] * ia);
  png.data[i + 1] = Math.round(color[1] * a + png.data[i + 1] * ia);
  png.data[i + 2] = Math.round(color[2] * a + png.data[i + 2] * ia);
  png.data[i + 3] = Math.min(255, Math.round(color[3] + png.data[i + 3] * ia));
}

function drawPolygon(png, points, color) {
  const minX = Math.max(0, Math.floor(Math.min(...points.map(p => p[0]))));
  const maxX = Math.min(png.width - 1, Math.ceil(Math.max(...points.map(p => p[0]))));
  const minY = Math.max(0, Math.floor(Math.min(...points.map(p => p[1]))));
  const maxY = Math.min(png.height - 1, Math.ceil(Math.max(...points.map(p => p[1]))));
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (pointInPolygon(x + 0.5, y + 0.5, points)) blendPixel(png, x, y, color);
    }
  }
}

function mirrorPoints(points, shouldMirror) {
  if (!shouldMirror) return points;
  return points.map(([x, y]) => [frame.width - x, y]);
}

function drawHeroWeaponOverlay(png, action, directionName) {
  if (directionName !== 'right' && directionName !== 'left') return;
  const mirror = directionName === 'left';
  if (action === 'slash') {
    drawPolygon(png, mirrorPoints([[168, 190], [258, 192], [286, 180], [264, 217], [170, 208]], mirror), [110, 103, 91, 210]);
    drawPolygon(png, mirrorPoints([[174, 194], [254, 197], [278, 185], [257, 210], [176, 204]], mirror), [205, 209, 207, 245]);
    drawPolygon(png, mirrorPoints([[181, 195], [250, 198], [266, 190], [254, 201], [182, 200]], mirror), [238, 239, 232, 210]);
  }
  if (action === 'guard') {
    drawPolygon(png, mirrorPoints([[88, 130], [72, 61], [90, 47], [113, 125]], mirror), [105, 99, 91, 205]);
    drawPolygon(png, mirrorPoints([[94, 126], [78, 65], [89, 57], [106, 123]], mirror), [203, 208, 211, 240]);
    drawPolygon(png, mirrorPoints([[97, 122], [84, 67], [90, 61], [101, 121]], mirror), [240, 242, 239, 190]);
  }
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

function directionFrame(rect, extra = {}) {
  return { source: 'direction', cropMode: 'checker', rect, ...extra };
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
      back: directionFrame([592, 23, 162, 218], { maxW: 236 }),
    }),
  },
  {
    role: 'hero',
    action: 'move',
    maxH: 248,
    frames: fourWay({
      right: actionFrame([260, 44, 228, 234], { maxW: 286 }),
      front: turnaroundFrame([778, 24, 194, 208], { maxW: 250 }),
      back: directionFrame([592, 23, 162, 218], { maxW: 236 }),
    }),
  },
  {
    role: 'hero',
    action: 'dash',
    maxH: 252,
    frames: fourWay({
      right: actionFrame([448, 42, 314, 236], { maxW: 300, allowLargeEdgeComponents: true }),
      front: turnaroundFrame([778, 24, 194, 208], { maxW: 250 }),
      back: directionFrame([592, 23, 162, 218], { maxW: 236 }),
    }),
  },
  {
    role: 'hero',
    action: 'guard',
    maxH: 248,
    frames: fourWay({
      right: actionFrame([728, 26, 262, 250], { maxW: 292 }),
      front: turnaroundFrame([208, 26, 190, 202]),
      back: directionFrame([592, 23, 162, 218], { maxW: 236 }),
    }),
  },
  {
    role: 'hero',
    action: 'slash',
    maxH: 258,
    frames: fourWay({
      right: actionFrame([990, 14, 320, 266], { maxW: 306, allowLargeEdgeComponents: true }),
      front: turnaroundFrame([208, 26, 190, 202]),
      back: directionFrame([592, 23, 162, 218], { maxW: 236 }),
    }),
  },
  {
    role: 'hero',
    action: 'hit',
    maxH: 248,
    frames: fourWay({
      right: actionFrame([1286, 30, 246, 246], { maxW: 286 }),
      front: turnaroundFrame([208, 26, 190, 202]),
      back: directionFrame([592, 23, 162, 218], { maxW: 236 }),
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
      back: directionFrame([596, 240, 170, 226], { maxW: 252 }),
    }),
  },
  {
    role: 'villain',
    action: 'move',
    maxH: 254,
    frames: fourWay({
      right: actionFrame([476, 284, 292, 278], { maxW: 300 }),
      front: turnaroundFrame([22, 232, 204, 218], { maxW: 260 }),
      back: directionFrame([596, 240, 170, 226], { maxW: 252 }),
    }),
  },
  {
    role: 'villain',
    action: 'guard',
    maxH: 254,
    frames: fourWay({
      right: actionFrame([252, 286, 246, 268], { maxW: 288 }),
      front: turnaroundFrame([22, 232, 204, 218], { maxW: 260 }),
      back: directionFrame([596, 240, 170, 226], { maxW: 252 }),
    }),
  },
  {
    role: 'villain',
    action: 'attack',
    maxH: 260,
    frames: fourWay({
      right: actionFrame([940, 274, 380, 294], { maxW: 292, allowLargeEdgeComponents: true }),
      front: turnaroundFrame([22, 232, 204, 218], { maxW: 260 }),
      back: directionFrame([596, 240, 170, 226], { maxW: 252 }),
    }),
  },
  {
    role: 'villain',
    action: 'hit',
    maxH: 254,
    frames: fourWay({
      right: actionFrame([1260, 302, 272, 250], { maxW: 292 }),
      front: turnaroundFrame([22, 232, 204, 218], { maxW: 260 }),
      back: directionFrame([596, 240, 170, 226], { maxW: 252 }),
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
      back: directionFrame([608, 458, 140, 184], { maxW: 220 }),
    }),
  },
  {
    role: 'npc',
    action: 'merchant',
    maxH: 238,
    frames: fourWay({
      right: turnaroundFrame([778, 448, 192, 196], { maxW: 250 }),
      front: turnaroundFrame([218, 446, 180, 196]),
      back: directionFrame([608, 458, 140, 184], { maxW: 220 }),
    }),
  },
  {
    role: 'npc',
    action: 'farmer',
    maxH: 238,
    frames: fourWay({
      right: actionFrame([644, 536, 236, 250], { maxW: 254 }),
      front: turnaroundFrame([218, 446, 180, 196]),
      back: directionFrame([608, 458, 140, 184], { maxW: 220 }),
    }),
  },
  {
    role: 'npc',
    action: 'guard',
    maxH: 238,
    frames: fourWay({
      right: actionFrame([840, 536, 228, 250], { maxW: 254 }),
      front: turnaroundFrame([30, 648, 184, 214], { maxW: 244 }),
      back: directionFrame([596, 634, 170, 206], { maxW: 244 }),
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
    const cropped = frameSpec.cropMode === 'checker'
      ? cropCheckerWithAlpha(sourcePngs[frameSpec.source], frameSpec.rect)
      : cropWithAlpha(sourcePngs[frameSpec.source], frameSpec.rect);
    const image = resizeToCanvas(cropped, frame, {
      maxW: frameSpec.maxW || spec.maxW || 238,
      maxH: frameSpec.maxH || spec.maxH || 228,
      bottom: spec.bottom ?? 22,
      flip: !!frameSpec.flip,
      allowLargeEdgeComponents: spec.allowLargeEdgeComponents || frameSpec.allowLargeEdgeComponents,
    });
    if (spec.role === 'hero') drawHeroWeaponOverlay(image, spec.action, directionName);
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

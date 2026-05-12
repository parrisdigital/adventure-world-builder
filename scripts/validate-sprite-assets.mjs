import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const spritesRoot = path.join(repoRoot, 'assets/sprites');
const edgeThreshold = 18;
const minMargin = 8;
const detachedEffectAllowlist = new Set([
  'assets/sprites/hero/dash-left.png',
  'assets/sprites/hero/dash-right.png',
  'assets/sprites/hero/slash-left.png',
  'assets/sprites/hero/slash-right.png',
  'assets/sprites/villain/attack-left.png',
  'assets/sprites/villain/attack-right.png',
]);

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else if (entry.isFile() && entry.name.endsWith('.png')) files.push(full);
  }
  return files;
}

function alphaBounds(png) {
  let minX = png.width;
  let minY = png.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const a = png.data[(y * png.width + x) * 4 + 3];
      if (a <= edgeThreshold) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (maxX < minX || maxY < minY) return null;
  return {
    minX,
    minY,
    maxX,
    maxY,
    left: minX,
    top: minY,
    right: png.width - 1 - maxX,
    bottom: png.height - 1 - maxY,
  };
}

function connectedComponents(png) {
  const seen = new Uint8Array(png.width * png.height);
  const components = [];
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const start = y * png.width + x;
      if (seen[start]) continue;
      seen[start] = 1;
      if (png.data[start * 4 + 3] <= edgeThreshold) continue;
      const pixels = [[x, y]];
      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;
      for (let i = 0; i < pixels.length; i++) {
        const [cx, cy] = pixels[i];
        minX = Math.min(minX, cx);
        maxX = Math.max(maxX, cx);
        minY = Math.min(minY, cy);
        maxY = Math.max(maxY, cy);
        for (const [dx, dy] of dirs) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || nx >= png.width || ny < 0 || ny >= png.height) continue;
          const ni = ny * png.width + nx;
          if (seen[ni]) continue;
          seen[ni] = 1;
          if (png.data[ni * 4 + 3] > edgeThreshold) pixels.push([nx, ny]);
        }
      }
      components.push({
        area: pixels.length,
        minX,
        maxX,
        minY,
        maxY,
        cx: (minX + maxX) / 2,
        cy: (minY + maxY) / 2,
      });
    }
  }
  return components.sort((a, b) => b.area - a.area);
}

const failures = [];
const warnings = [];
for (const file of walk(spritesRoot)) {
  const rel = path.relative(repoRoot, file);
  const png = PNG.sync.read(readFileSync(file));
  const bounds = alphaBounds(png);
  if (!bounds) {
    failures.push(`${rel}: no visible non-transparent pixels`);
    continue;
  }
  const margins = [bounds.left, bounds.top, bounds.right, bounds.bottom];
  if (margins.some(v => v < minMargin)) {
    failures.push(`${rel}: edge margin too small ${JSON.stringify(bounds)}`);
  }
  if (bounds.bottom < 14 && !rel.includes('/chest/')) {
    warnings.push(`${rel}: feet/weapon near bottom margin ${bounds.bottom}px`);
  }
  const components = connectedComponents(png);
  const main = components[0];
  const allowDetachedEffects = detachedEffectAllowlist.has(rel);
  for (const component of components.slice(1)) {
    const edge = Math.min(component.minX, component.minY, png.width - 1 - component.maxX, png.height - 1 - component.maxY);
    const largeFragment = component.area > 1200 || component.area > main.area * 0.08;
    const closeToFrameEdge = edge < 28;
    if (largeFragment && closeToFrameEdge && !allowDetachedEffects) {
      failures.push(`${rel}: detached cropped fragment near frame edge ${JSON.stringify({
        area: component.area,
        edge,
        minX: component.minX,
        maxX: component.maxX,
        minY: component.minY,
        maxY: component.maxY,
      })}`);
    }
  }
}

if (warnings.length) {
  console.warn(warnings.map(w => `warning: ${w}`).join('\n'));
}
if (failures.length) {
  console.error(failures.map(f => `error: ${f}`).join('\n'));
  process.exit(1);
}

console.log(`Validated ${walk(spritesRoot).length} sprite PNGs with >=${minMargin}px transparent edge padding.`);

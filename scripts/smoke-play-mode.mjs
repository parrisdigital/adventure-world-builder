import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const port = Number(process.env.TINYWORLD_PORT || 4173);
const debugPort = Number(process.env.TINYWORLD_DEBUG_PORT || 9223);
const url = `http://127.0.0.1:${port}/tiny-world-builder.html`;

function findChrome() {
  const candidates = [
    process.env.CHROME_BIN,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    'google-chrome',
    'chromium',
    'chromium-browser',
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (candidate.includes('/')) return candidate;
    const found = spawnSync('which', [candidate], { encoding: 'utf8' });
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim();
  }
  throw new Error('Chrome/Chromium not found. Set CHROME_BIN to a local browser binary.');
}

async function waitFor(check, label, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const value = await check();
      if (value) return value;
    } catch (_) {}
    await new Promise(resolve => setTimeout(resolve, 120));
  }
  throw new Error(`Timed out waiting for ${label}`);
}

function openCdpSocket(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  const events = [];
  ws.onmessage = event => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result || {});
    } else if (msg.method) {
      events.push(msg);
    }
  };
  const opened = new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const callId = ++id;
      pending.set(callId, { resolve, reject });
      ws.send(JSON.stringify({ id: callId, method, params }));
    });
  }
  return { ws, opened, send, events };
}

async function main() {
  const chromePath = findChrome();
  const userDataDir = mkdtempSync(path.join(tmpdir(), 'tinyworld-chrome-'));
  const screenshotPath = path.join(tmpdir(), 'tinyworld-play-smoke.png');
  const server = spawn('python3', ['-m', 'http.server', String(port)], {
    cwd: repoRoot,
    stdio: 'ignore',
  });
  const chrome = spawn(chromePath, [
    '--headless=new',
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${userDataDir}`,
    '--window-size=1280,900',
    '--enable-webgl',
    '--ignore-gpu-blocklist',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    url,
  ], { stdio: 'ignore' });

  const cleanup = () => {
    try { chrome.kill('SIGTERM'); } catch (_) {}
    try { server.kill('SIGTERM'); } catch (_) {}
    try { rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  };
  process.once('exit', cleanup);
  process.once('SIGINT', () => { cleanup(); process.exit(130); });

  try {
    await waitFor(() => fetch(url).then(r => r.ok), 'static server');
    const targets = await waitFor(async () => {
      const res = await fetch(`http://127.0.0.1:${debugPort}/json`);
      if (!res.ok) return null;
      const pages = await res.json();
      return pages.find(p => p.type === 'page' && p.url.includes('tiny-world-builder.html'));
    }, 'Chrome DevTools target');

    const cdp = openCdpSocket(targets.webSocketDebuggerUrl);
    await cdp.opened;
    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');
    await cdp.send('Log.enable');

    async function evaluate(expression) {
      const res = await cdp.send('Runtime.evaluate', {
        expression,
        awaitPromise: true,
        returnByValue: true,
        userGesture: true,
      });
      if (res.exceptionDetails) {
        throw new Error(res.exceptionDetails.text + ': ' + (res.exceptionDetails.exception?.description || ''));
      }
      return res.result.value;
    }

    await evaluate(`new Promise((resolve, reject) => {
    const started = Date.now();
    (function check() {
      if (window.__tinyworldPlay && window.__tinyworldGameLayer && window.render_game_to_text && window.advanceTime) resolve(true);
      else if (Date.now() - started > 15000) reject(new Error('game hooks not ready'));
      else setTimeout(check, 100);
    })();
  })`);

    const entered = await evaluate(`(() => {
    const welcome = document.getElementById('welcome-modal');
    if (welcome) welcome.hidden = true;
    window.__tinyworldGameLayer.clear();
    window.__tinyworldGameLayer.setObjective('defeat_villain');
    window.__tinyworldGameLayer.setMarker('playerSpawn', 0, 7);
    window.__tinyworldGameLayer.setMarker('villainSpawn', 5, 3);
    const ok = window.__tinyworldPlay.enter();
    return { ok, state: JSON.parse(window.render_game_to_text()) };
  })()`);
    if (!entered.ok || entered.state.mode !== 'play') throw new Error('Play Mode did not start');

    const won = await evaluate(`(() => {
    const play = window.__tinyworldPlay.state();
    play.player.x = play.villain.x;
    play.player.z = Math.max(0, play.villain.z - 0.6);
    for (let i = 0; i < 4; i++) {
      window.__tinyworldPlay.attack();
      window.advanceTime(420);
    }
    return JSON.parse(window.render_game_to_text());
  })()`);
    if (won.result !== 'won') throw new Error('Defeat objective did not complete');

    const exited = await evaluate(`(() => {
    window.__tinyworldPlay.exit();
    return JSON.parse(window.render_game_to_text());
  })()`);
    if (exited.mode !== 'editor' || exited.player !== null || exited.villain !== null) {
      throw new Error('Play Mode did not exit cleanly');
    }

    const validation = await evaluate(`(() => {
    window.__tinyworldGameLayer.clear();
    window.__tinyworldGameLayer.setObjective('unlock_gate');
    window.__tinyworldGameLayer.setMarker('playerSpawn', 0, 7);
    window.__tinyworldGameLayer.setMarker('villainSpawn', 5, 3);
    return window.__tinyworldGameLayer.validate();
  })()`);
    if (validation.ok || !validation.errors.some(e => e.includes('Chest')) || !validation.errors.some(e => e.includes('Gate'))) {
      throw new Error('Unlock objective validation did not require chest and gate markers');
    }

    const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(screenshotPath, Buffer.from(shot.data, 'base64'));
    const errors = cdp.events.filter(e => {
      if (e.method === 'Runtime.exceptionThrown') return true;
      if (e.method === 'Log.entryAdded' && e.params.entry.level === 'error') return true;
      if (e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error') return true;
      return false;
    });
    if (errors.length) throw new Error('Console errors found: ' + JSON.stringify(errors.slice(0, 3)));

    cdp.ws.close();
    console.log(JSON.stringify({
      ok: true,
      entered: entered.state,
      won,
      exited,
      validation,
      screenshot: screenshotPath,
    }, null, 2));
  } finally {
    cleanup();
  }
}

main().catch(err => {
  console.error(err.stack || err.message || err);
  process.exitCode = 1;
});

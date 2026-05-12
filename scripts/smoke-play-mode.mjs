import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const port = Number(process.env.TINYWORLD_PORT || 4173);
const debugPort = Number(process.env.TINYWORLD_DEBUG_PORT || 9223);
const url = `http://127.0.0.1:${port}/tiny-world-builder.html`;
const appHtml = readFileSync(path.join(repoRoot, 'tiny-world-builder.html'), 'utf8');

if (appHtml.includes('document.write')) {
  throw new Error('Optional auth loading must not use document.write; it can swallow following script tags in production.');
}
if (!appHtml.includes('vendor/three-r128.min.js')) {
  throw new Error('The app must load the vendored Three.js runtime for reliable static hosting.');
}

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

    const releaseUi = await evaluate(`(() => {
      const open = document.getElementById('about-open');
      const modal = document.getElementById('about-modal');
      if (!open || !modal) return { ok: false };
      open.click();
      const links = Array.from(modal.querySelectorAll('a')).map(a => a.href);
      const text = modal.textContent || '';
      const visible = !modal.hidden;
      document.getElementById('about-close')?.click();
      return {
        ok: visible &&
          text.includes('Parris Digital') &&
          links.some(href => href.includes('jasonkneen/tiny-world-builder')) &&
          links.some(href => href.includes('parrisdigital/adventure-world-builder')),
      };
    })()`);
    if (!releaseUi.ok) throw new Error('Credits/About modal did not expose source attribution');

    const baseMarkers = {
      playerSpawn: { x: 0, z: 7 },
      villainSpawn: { x: 5, z: 3 },
    };
    const objectiveMarkers = {
      chest: { x: 3, z: 7 },
      gate: { x: 4, z: 5 },
      exit: { x: 3, z: 0 },
      npc: { x: 4, z: 6 },
    };

    async function startScenario(objective, markers) {
      return evaluate(`(() => {
      const welcome = document.getElementById('welcome-modal');
      if (welcome) welcome.hidden = true;
      window.__tinyworldPlay.exit({ silent: true, restoreCamera: false });
      window.applyState({ v: 5, gridSize: 8, cells: [], gameLayer: { objective: 'defeat_villain', markers: {} } });
      window.__tinyworldGameLayer.clear();
      window.__tinyworldGameLayer.setObjective(${JSON.stringify(objective)});
      const markers = ${JSON.stringify(markers)};
      const placed = Object.entries(markers).map(([type, marker]) => ({
        type,
        ok: window.__tinyworldGameLayer.setMarker(type, marker.x, marker.z),
      }));
      const validation = window.__tinyworldGameLayer.validate();
      const ok = validation.ok && window.__tinyworldPlay.enter();
      return { ok, placed, validation, state: JSON.parse(window.render_game_to_text()) };
    })()`);
    }

    const defeatEntered = await startScenario('defeat_villain', baseMarkers);
    if (!defeatEntered.ok || defeatEntered.state.mode !== 'play') {
      throw new Error('Defeat scenario did not start: ' + JSON.stringify(defeatEntered));
    }
    if (defeatEntered.state.player.fightingStyle !== 'Vanguard' ||
        defeatEntered.state.player.speed <= 0 ||
        !defeatEntered.state.tactics.playerActions.includes('dash') ||
        !defeatEntered.state.tactics.playerActions.includes('guard') ||
        defeatEntered.state.turn !== 'player' ||
        defeatEntered.state.actionPoints.player !== 2 ||
        defeatEntered.state.reachableTiles <= 0 ||
        defeatEntered.state.villain.fightingStyle !== 'Hexblade') {
      throw new Error('Tactics metadata missing from play state: ' + JSON.stringify(defeatEntered.state));
    }
    const tacticsActions = await evaluate(`(() => {
      const play = window.__tinyworldPlay.state();
      const movedOk = window.__tinyworldPlay.moveTo(0, 6);
      const moved = JSON.parse(window.render_game_to_text());
      window.__tinyworldPlay.attack();
      const preview = JSON.parse(window.render_game_to_text());
      window.__tinyworldPlay.restart();
      const duel = window.__tinyworldPlay.state();
      duel.player.x = 5;
      duel.player.z = 4;
      duel.villain.x = 4;
      duel.villain.z = 4;
      window.__tinyworldPlay.attack();
      const left = JSON.parse(window.render_game_to_text());
      window.advanceTime(500);
      duel.villain.x = 6;
      duel.villain.z = 4;
      window.__tinyworldPlay.attack();
      const right = JSON.parse(window.render_game_to_text());
      window.__tinyworldPlay.restart();
      window.__tinyworldPlay.dash();
      const dashSelected = JSON.parse(window.render_game_to_text());
      const dashMovedOk = window.__tinyworldPlay.moveTo(3, 7);
      const dashed = JSON.parse(window.render_game_to_text());
      window.__tinyworldPlay.restart();
      window.__tinyworldPlay.guard();
      const guarded = JSON.parse(window.render_game_to_text());
      window.__tinyworldPlay.restart();
      const enemy = window.__tinyworldPlay.state();
      enemy.player.x = 3;
      enemy.player.z = 4;
      enemy.villain.x = 4;
      enemy.villain.z = 4;
      const hpBeforeEnemy = enemy.player.hp;
      window.__tinyworldPlay.endTurn();
      window.advanceTime(500);
      const enemyResolved = JSON.parse(window.render_game_to_text());
      return { movedOk, moved, preview, left, right, dashSelected, dashMovedOk, dashed, guarded, hpBeforeEnemy, enemyResolved };
    })()`);
    if (!tacticsActions.movedOk ||
        tacticsActions.moved.player.x !== 0 ||
        tacticsActions.moved.player.z !== 6 ||
        tacticsActions.moved.actionPoints.player !== 1 ||
        tacticsActions.preview.selectedAction !== 'slash' ||
        tacticsActions.preview.attackTiles <= 0 ||
        tacticsActions.left.player.facing !== 'left' ||
        tacticsActions.right.player.facing !== 'right' ||
        tacticsActions.dashSelected.selectedAction !== 'dash' ||
        !tacticsActions.dashMovedOk ||
        tacticsActions.dashed.player.action !== 'dash' ||
        tacticsActions.dashed.actionPoints.player !== 0 ||
        tacticsActions.dashed.turn !== 'enemy' ||
        tacticsActions.guarded.player.action !== 'guard' ||
        tacticsActions.guarded.turn !== 'enemy' ||
        tacticsActions.enemyResolved.turn !== 'player' ||
        tacticsActions.enemyResolved.player.hp >= tacticsActions.hpBeforeEnemy) {
      throw new Error('Tactical movement, facing, or actions failed: ' + JSON.stringify(tacticsActions));
    }
    await evaluate(`window.__tinyworldPlay.restart()`);
    const defeat = await evaluate(`(() => {
      const play = window.__tinyworldPlay.state();
      play.player.x = play.villain.x;
      play.player.z = Math.max(0, play.villain.z - 0.6);
      for (let i = 0; i < 4; i++) {
        window.__tinyworldPlay.attack();
        window.advanceTime(420);
      }
      return JSON.parse(window.render_game_to_text());
    })()`);
    if (defeat.result !== 'won') throw new Error('Defeat objective did not complete');

    const collectEntered = await startScenario('collect_relic', {
      ...baseMarkers,
      chest: objectiveMarkers.chest,
      npc: objectiveMarkers.npc,
    });
    if (!collectEntered.ok) throw new Error('Collect scenario did not start: ' + JSON.stringify(collectEntered));
    const npcLine = await evaluate(`(() => {
      const play = window.__tinyworldPlay.state();
      play.player.x = 4;
      play.player.z = 6;
      window.advanceTime(120);
      return JSON.parse(window.render_game_to_text()).npcLine;
    })()`);
    if (!npcLine.includes('Villager:')) throw new Error('NPC marker did not surface dialogue');
    const collect = await evaluate(`(() => {
      const play = window.__tinyworldPlay.state();
      play.player.x = 3;
      play.player.z = 7;
      window.advanceTime(120);
      return JSON.parse(window.render_game_to_text());
    })()`);
    if (collect.result !== 'won' || !collect.collectedRelic) throw new Error('Collect objective did not complete');

    const unlockEntered = await startScenario('unlock_gate', {
      ...baseMarkers,
      chest: objectiveMarkers.chest,
      gate: objectiveMarkers.gate,
    });
    if (!unlockEntered.ok) throw new Error('Unlock scenario did not start: ' + JSON.stringify(unlockEntered));
    const unlock = await evaluate(`(() => {
      const play = window.__tinyworldPlay.state();
      play.player.x = 3;
      play.player.z = 7;
      window.advanceTime(120);
      play.player.x = 4;
      play.player.z = 5;
      window.advanceTime(120);
      return JSON.parse(window.render_game_to_text());
    })()`);
    if (unlock.result !== 'won' || !unlock.collectedRelic || !unlock.gateUnlocked) {
      throw new Error('Unlock objective did not complete');
    }

    const escapeEntered = await startScenario('escape', {
      ...baseMarkers,
      exit: objectiveMarkers.exit,
    });
    if (!escapeEntered.ok) throw new Error('Escape scenario did not start: ' + JSON.stringify(escapeEntered));
    const escape = await evaluate(`(() => {
      const play = window.__tinyworldPlay.state();
      play.player.x = 3;
      play.player.z = 0;
      window.advanceTime(120);
      return JSON.parse(window.render_game_to_text());
    })()`);
    if (escape.result !== 'won') throw new Error('Escape objective did not complete');

    const validation = await evaluate(`(() => {
      window.__tinyworldPlay.exit({ silent: true, restoreCamera: false });
      window.__tinyworldGameLayer.clear();
      window.__tinyworldGameLayer.setObjective('unlock_gate');
      window.__tinyworldGameLayer.setMarker('playerSpawn', 0, 7);
      window.__tinyworldGameLayer.setMarker('villainSpawn', 5, 3);
      return window.__tinyworldGameLayer.validate();
    })()`);
    if (validation.ok || !validation.errors.some(e => e.includes('Chest')) || !validation.errors.some(e => e.includes('Gate'))) {
      throw new Error('Unlock objective validation did not require chest and gate markers');
    }

    const flexibleSpawn = await evaluate(`(() => {
      window.__tinyworldPlay.exit({ silent: true, restoreCamera: false });
      window.__tinyworldGameLayer.clear();
      setCell(1, 1, { terrain: 'grass', terrainFloors: 1, kind: 'house', floors: 1 });
      window.__tinyworldGameLayer.setObjective('defeat_villain');
      const placed = [
        window.__tinyworldGameLayer.setMarker('playerSpawn', 1, 1),
        window.__tinyworldGameLayer.setMarker('villainSpawn', 5, 3),
      ];
      const layer = window.__tinyworldGameLayer.state();
      const validation = window.__tinyworldGameLayer.validate();
      const entered = window.__tinyworldPlay.enter();
      const state = JSON.parse(window.render_game_to_text());
      return { placed, layer, validation, entered, state };
    })()`);
    if (!flexibleSpawn.placed.every(Boolean) ||
        !flexibleSpawn.validation.ok ||
        !flexibleSpawn.entered ||
        flexibleSpawn.layer.markers.playerSpawn.x !== 1 ||
        flexibleSpawn.layer.markers.playerSpawn.z !== 1 ||
        (flexibleSpawn.state.player.x === 1 && flexibleSpawn.state.player.z === 1)) {
      throw new Error('Flexible spawn marker placement did not resolve correctly: ' + JSON.stringify(flexibleSpawn));
    }

    const preserved = await evaluate(`(() => {
      window.__tinyworldPlay.exit({ silent: true, restoreCamera: false });
      window.__tinyworldGameLayer.clear();
      window.__tinyworldGameLayer.setObjective('escape');
      window.__tinyworldGameLayer.setMarker('playerSpawn', 0, 7);
      window.__tinyworldGameLayer.setMarker('villainSpawn', 5, 3);
      window.__tinyworldGameLayer.setMarker('exit', 3, 0);
      window.__tinyworldGameLayer.setMarker('npc', 4, 6);
      const before = window.__tinyworldGameLayer.state();
      const ok = typeof window.applyState === 'function' && window.applyState({
        v: 5,
        gridSize: 8,
        cells: [],
        gameLayer: before,
      });
      const after = window.__tinyworldGameLayer.state();
      return { ok, before, after, validation: window.__tinyworldGameLayer.validate() };
    })()`);
    if (!preserved.ok ||
        JSON.stringify(preserved.before) !== JSON.stringify(preserved.after) ||
        !preserved.validation.ok) {
      throw new Error('Export/import did not preserve gameLayer: ' + JSON.stringify(preserved));
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
      releaseUi,
      defeat,
      npcLine,
      collect,
      unlock,
      escape,
      validation,
      preserved,
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

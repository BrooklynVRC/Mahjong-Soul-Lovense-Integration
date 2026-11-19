import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { DATA_DIR, HINTS, loadConfig, saveConfig, type Config } from './config.js';
import { VERSION, builtinPack, captureExe, pauseIfPackaged, readAsset, sharedDir, showUi } from './runtime.js';
import { ScreenReader } from './screen/reader.js';
import { keyLabel, type Detection, type GameState } from './screen/keys.js';
import { Lovense } from './lovense.js';
import { forGame, forTwitch } from './triggers.js';

let config: Config = loadConfig();
const toy = new Lovense(() => config);

const localOrigins = () => [`http://localhost:${config.port}`, `http://127.0.0.1:${config.port}`];

// ---------------- Game events from the screen reader ----------------
let lastGameEvent = '';
let gameState: GameState | null = null;
// Call streak: calls you make in the same hand build up (reset when the hand ends).
let myCalls = 0;
const MY_CALLS = ['my_pon', 'my_chi', 'my_kan', 'my_call'];
const HAND_ENDS = ['my_win_ron', 'my_win_tsumo', 'my_yakuman', 'dealt_in', 'opponent_tsumo', 'opponent_ron', 'opponent_ron_other', 'draw', 'game_start', 'round_start', 'game_end_1', 'game_end_2', 'game_end_3', 'game_end_4'];
function playGame(key: string) {
  lastGameEvent = keyLabel(key) === key ? key.replace('_', ' ') : keyLabel(key);
  if (HAND_ENDS.includes(key)) myCalls = 0;
  const t = forGame(config, key);
  if (!t) { if (MY_CALLS.includes(key)) myCalls++; return; }
  if (MY_CALLS.includes(key) && config.callStreak.enabled) {
    myCalls++;
    const extra = myCalls - 1, s = config.callStreak;
    toy.play({ ...t.action, strength: t.action.strength + extra * s.strengthPerCall, seconds: t.action.seconds + extra * s.secondsPerCall }, `${t.label} (call #${myCalls} this hand)`);
    return;
  }
  toy.play(t.action, t.label);
}
const reader = new ScreenReader({
  sharedDir: sharedDir(),
  captureExe,
  builtinPack,
  onDetect: (d: Detection) => playGame(d.key),
  onState: (st: GameState) => {
    const prev = gameState?.place ?? null;
    gameState = st;
    if (st.inGame && prev && st.place && prev !== st.place) {
      if (st.place === 1) playGame('took_lead');
      else if (prev === 1) playGame('lost_lead');
    }
  },
});

// ---------------- Twitch events from mahjong-soul-twitch ----------------
let twitchWs: WebSocket | null = null;
let twitchStatus = 'off';
let twitchTimer: NodeJS.Timeout | null = null;
let twitchUrl = '';

function handleTwitch(e: any) {
  const r = forTwitch(config, e);
  if (!r) return;
  if ('stop' in r) void toy.stopAll(r.label);
  else toy.play(r.action, r.label);
}

function syncTwitch() {
  const want = config.twitch.enabled ? config.twitch.url : '';
  if (want === twitchUrl && (twitchWs || twitchTimer || !want)) return;
  twitchUrl = want;
  if (twitchTimer) { clearTimeout(twitchTimer); twitchTimer = null; }
  if (twitchWs) { twitchWs.removeAllListeners(); twitchWs.terminate(); twitchWs = null; }
  if (!want) { twitchStatus = 'off'; return; }
  const open = () => {
    twitchTimer = null;
    twitchStatus = 'connecting…';
    const ws = new WebSocket(want);
    twitchWs = ws;
    ws.on('open', () => { twitchStatus = 'connected'; console.log('[twitch] connected to', want); });
    ws.on('message', (raw) => { try { const e = JSON.parse(String(raw)); if (e?.source === 'twitch') handleTwitch(e); } catch { /* ignore */ } });
    ws.on('error', () => { /* close follows */ });
    ws.on('close', () => {
      if (twitchWs !== ws) return;
      twitchWs = null; twitchStatus = 'disconnected, retrying (is mahjong-soul-twitch running?)';
      twitchTimer = setTimeout(open, 5000);
    });
  };
  open();
}

// ---------------- HTTP ----------------
function send(res: ServerResponse, code: number, body: unknown, type = 'application/json') {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}
function file(res: ServerResponse, name: string, type: string) {
  try { send(res, 200, readAsset(name), type); } catch { send(res, 404, 'not found', 'text/plain'); }
}
async function body(req: IncomingMessage): Promise<any> {
  let data = '';
  for await (const chunk of req) { data += chunk; if (data.length > 1e6) throw new Error('too large'); }
  return data ? JSON.parse(data) : {};
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const origin = req.headers.origin;
  if (req.method !== 'GET' && origin && !localOrigins().includes(origin)) return send(res, 403, { error: 'forbidden origin' });
  try {
    if (await reader.handle(req, res, url.pathname)) return;
    switch (`${req.method} ${url.pathname}`) {
      case 'GET /': return file(res, 'settings.html', 'text/html; charset=utf-8');
      case 'GET /screen': return file(res, 'screen.html', 'text/html; charset=utf-8');
      case 'GET /ui.js': return file(res, 'ui.js', 'text/javascript; charset=utf-8');
      case 'GET /api/config': return send(res, 200, { config, hints: HINTS });
      case 'POST /api/config':
        config = saveConfig(await body(req));
        syncTwitch();
        return send(res, 200, { ok: true, config });
      case 'GET /api/status': return send(res, 200, {
        version: VERSION, dataDir: DATA_DIR,
        enabled: config.enabled,
        lovense: { lastError: toy.lastError, lastOk: toy.lastOk, busy: toy.busy, queue: toy.queueLength, output: config.output, status: toy.connectionStatus, ok: toy.connectionOk },
        screen: reader.summary(), lastGameEvent,
        twitch: twitchStatus,
        log: toy.log.slice(0, 25),
      });
      case 'POST /api/stop': await toy.stopAll('STOP button'); return send(res, 200, { ok: true });
      case 'POST /api/enabled': {
        const b = await body(req);
        config = saveConfig({ ...config, enabled: !!b.enabled });
        if (!config.enabled) await toy.stopAll('master switch off');
        return send(res, 200, { ok: true, enabled: config.enabled });
      }
      case 'POST /api/toys': return send(res, 200, { toys: await toy.getToys() });
      case 'POST /api/test/game': {
        const { key } = await body(req) as { key: string };
        const r = (config.gameEvents as Record<string, { action: Config['gameEvents']['my_riichi']['action'] }>)[key];
        if (!r) return send(res, 400, { error: 'unknown event' });
        toy.play(r.action, `test: ${key}`);
        return send(res, 200, { ok: true });
      }
      case 'POST /api/bookmark': return send(res, 200, { ok: reader.bookmark() });
      case 'POST /api/shutdown': {
        send(res, 200, { ok: true });
        return void shutdown('app closing');
      }
      case 'POST /api/test/twitch': handleTwitch({ source: 'twitch', user: 'TestViewer', isBroadcaster: true, ...(await body(req)) }); return send(res, 200, { ok: true });
      default: return send(res, 404, { error: 'not found' });
    }
  } catch (e) {
    send(res, 500, { error: (e as Error).message });
  }
});

const home = `http://localhost:${config.port}/`;
server.on('error', async (e: NodeJS.ErrnoException) => {
  if (e.code === 'EADDRINUSE') {
    console.log(`Port ${config.port} is already in use. The app is probably already running.`);
    showUi(home, true, true);
  } else console.error('Server error:', e);
  await pauseIfPackaged();
  process.exit(1);
});

server.listen(config.port, '127.0.0.1', () => {
  console.log(`Mahjong Soul × Lovense ${VERSION}`);
  console.log(`  Settings: ${home}`);
  console.log(`  Data:     ${DATA_DIR}`);
  showUi(home, config.openBrowserOnStart);
  reader.start();
  syncTwitch();
  toy.sync();
  setInterval(() => toy.sync(), 3000);
});

process.on('uncaughtException', (e) => console.error('[error]', e));
process.on('unhandledRejection', (e) => console.error('[error]', e));

// Stop the toy when the app closes (window closed, console closed, Ctrl+C).
let closing = false;
async function shutdown(label: string) {
  if (closing) return;
  closing = true;
  reader.stop();
  await toy.stopAll(label).catch(() => {});
  setTimeout(() => process.exit(0), 200);
}
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGBREAK'] as const) process.on(sig, () => void shutdown('app closing'));

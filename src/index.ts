import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { DATA_DIR, HINTS, loadConfig, saveConfig, type Config, type GameKey } from './config.js';
import { USERSCRIPT, VERSION, openBrowser, pauseIfPackaged, readAsset } from './runtime.js';
import { Lovense } from './lovense.js';
import { forGame, forTwitch } from './triggers.js';

let config: Config = loadConfig();
const toy = new Lovense(() => config);

const GAME_ORIGINS = ['https://game.mahjongsoul.com', 'https://mahjongsoul.game.yo-star.com', 'https://game.maj-soul.com', 'https://game.maj-soul.net'];
const localOrigins = () => [`http://localhost:${config.port}`, `http://127.0.0.1:${config.port}`];

// ---------------- Game events from the userscript ----------------
const gameIn = new WebSocketServer({ noServer: true });
let lastGameEvent = '';
gameIn.on('connection', (ws) => {
  console.log('[game] game source connected (userscript or screen reader)');
  ws.on('message', (raw) => {
    try {
      const e = JSON.parse(String(raw));
      if (e?.source !== 'mahjongsoul') return;
      lastGameEvent = `${String(e.type).replace('_', ' ')} (${e.via === 'screen' ? 'screen reader' : 'userscript'})`;
      const t = forGame(config, e);
      if (t) toy.play(t.action, t.label);
    } catch { /* ignore */ }
  });
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
    switch (`${req.method} ${url.pathname}`) {
      case 'GET /': return file(res, 'settings.html', 'text/html; charset=utf-8');
      case 'GET /ui.js': return file(res, 'ui.js', 'text/javascript; charset=utf-8');
      case `GET /${USERSCRIPT}`: return file(res, USERSCRIPT, 'text/javascript; charset=utf-8');
      case 'GET /api/config': return send(res, 200, { config, hints: HINTS });
      case 'POST /api/config':
        config = saveConfig(await body(req));
        syncTwitch();
        return send(res, 200, { ok: true, config });
      case 'GET /api/status': return send(res, 200, {
        version: VERSION, dataDir: DATA_DIR,
        enabled: config.enabled,
        lovense: { lastError: toy.lastError, lastOk: toy.lastOk, busy: toy.busy, queue: toy.queueLength },
        gameClients: gameIn.clients.size, lastGameEvent,
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
        const { key } = await body(req) as { key: GameKey };
        const r = config.gameEvents[key];
        if (!r) return send(res, 400, { error: 'unknown event' });
        toy.play(r.action, `test: ${key}`);
        return send(res, 200, { ok: true });
      }
      case 'POST /api/test/twitch': handleTwitch({ source: 'twitch', user: 'TestViewer', isBroadcaster: true, ...(await body(req)) }); return send(res, 200, { ok: true });
      default: return send(res, 404, { error: 'not found' });
    }
  } catch (e) {
    send(res, 500, { error: (e as Error).message });
  }
});

server.on('upgrade', (req, socket, head) => {
  const path = new URL(req.url ?? '/', 'http://localhost').pathname;
  const origin = req.headers.origin;
  if (path !== '/game' || (origin && !GAME_ORIGINS.includes(origin))) return socket.destroy();
  gameIn.handleUpgrade(req, socket, head, (ws) => gameIn.emit('connection', ws, req));
});

const home = `http://localhost:${config.port}/`;
server.on('error', async (e: NodeJS.ErrnoException) => {
  if (e.code === 'EADDRINUSE') {
    console.log(`Port ${config.port} is already in use. The app is probably already running, so opening ${home}`);
    openBrowser(home);
  } else console.error('Server error:', e);
  await pauseIfPackaged();
  process.exit(1);
});

server.listen(config.port, '127.0.0.1', () => {
  console.log(`Mahjong Soul × Lovense ${VERSION}  (keep this window open while playing)`);
  console.log(`  Settings: ${home}`);
  console.log(`  Data:     ${DATA_DIR}`);
  if (config.openBrowserOnStart) openBrowser(home);
  syncTwitch();
});

process.on('uncaughtException', (e) => console.error('[error]', e));
process.on('unhandledRejection', (e) => console.error('[error]', e));

// Stop the toy if the app is closed (SIGHUP/SIGBREAK = console window closed on Windows).
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGBREAK'] as const) {
  process.on(sig, async () => { await toy.stopAll('app closing').catch(() => {}); process.exit(0); });
}

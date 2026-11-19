import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { dataDir } from './runtime.js';
import { EVENT_KEYS } from './screen/keys.js';

export const DATA_DIR = dataDir('MahjongSoulLovense');
const CONFIG_PATH = resolve(DATA_DIR, 'config.json');

export type ActionType = 'vibrate' | 'preset' | 'pattern' | 'stop';
export interface Action {
  type: ActionType;
  function: string;   // Vibrate, Rotate, Pump, Thrusting, Fingering, Suction, Depth, Oscillate, All
  strength: number;   // 0-20
  seconds: number;
  preset: string;     // pulse, wave, fireworks, earthquake
  pattern: string;    // "20;0;20;0" strengths, one step per patternStepMs
  patternStepMs: number;
}

export const act = (type: ActionType, strength: number, seconds: number, extra: Partial<Action> = {}): Action => ({
  type, function: 'Vibrate', strength, seconds, preset: 'pulse', pattern: '', patternStepMs: 300, ...extra,
});
const rule = (enabled: boolean, action: Action) => ({ enabled, action });

export const DEFAULT_CONFIG = {
  port: 7702,
  openBrowserOnStart: true,
  enabled: true,
  lovense: {
    host: '127.0.0.1',
    port: 20010,
    https: false,
    toy: '',
    platform: 'Mahjong Soul Bridge',
  },
  safety: {
    maxStrength: 20,
    maxSeconds: 30,
    queueMode: 'queue' as 'queue' | 'override' | 'ignore',
    maxQueue: 10,
  },
  gameEvents: {
    game_mode: rule(false, act('vibrate', 3, 1)),
    game_start: rule(false, act('vibrate', 4, 2)),
    round_start: rule(false, act('vibrate', 3, 1)),
    my_riichi: rule(true, act('vibrate', 7, 3)),
    opponent_riichi: rule(false, act('vibrate', 3, 2)),
    my_call: rule(false, act('vibrate', 3, 1)),
    my_win_ron: rule(true, act('preset', 14, 5, { preset: 'fireworks' })),
    my_win_tsumo: rule(true, act('preset', 16, 6, { preset: 'earthquake' })),
    my_yakuman: rule(true, act('vibrate', 20, 15)),
    dealt_in: rule(true, act('pattern', 14, 4, { pattern: '20;0;20;0;20;0' })),
    opponent_tsumo: rule(true, act('vibrate', 8, 2)),
    opponent_ron_other: rule(false, act('vibrate', 3, 1)),
    draw: rule(false, act('vibrate', 5, 2)),
    game_end_1: rule(true, act('preset', 18, 10, { preset: 'fireworks' })),
    game_end_2: rule(false, act('vibrate', 8, 4)),
    game_end_3: rule(false, act('vibrate', 10, 5)),
    game_end_4: rule(true, act('pattern', 18, 8, { pattern: '20;10;20;10;5;20' })),
    took_lead: rule(false, act('preset', 10, 4, { preset: 'wave' })),
    lost_lead: rule(false, act('vibrate', 9, 3)),
  },
  twitch: {
    enabled: false,
    url: 'ws://127.0.0.1:7701/events',
    stopCommand: '!stop',
    bits: {
      enabled: true,
      tiers: [
        { minBits: 1, action: act('vibrate', 5, 2) },
        { minBits: 100, action: act('vibrate', 10, 5) },
        { minBits: 500, action: act('preset', 16, 10, { preset: 'earthquake' }) },
      ],
    },
    subs: rule(true, act('preset', 12, 5, { preset: 'wave' })),
    resubs: rule(true, act('preset', 12, 5, { preset: 'wave' })),
    giftSubs: { enabled: true, secondsPerSub: 2, action: act('vibrate', 12, 2) },
    follows: rule(false, act('vibrate', 4, 1)),
    raids: rule(true, act('preset', 15, 8, { preset: 'fireworks' })),
    redeems: [{ enabled: true, rewardTitle: 'Buzz the streamer', action: act('vibrate', 10, 5) }],
    chatCommands: [{ enabled: false, trigger: '!buzz', cooldownSec: 60, modsOnly: false, action: act('vibrate', 6, 2) }],
  },
};

export type Config = typeof DEFAULT_CONFIG;
export type GameKey = keyof Config['gameEvents'];

const ACTION_HINTS = {
  type: { options: [{ value: 'vibrate', label: 'Constant' }, { value: 'preset', label: 'Preset pattern' }, { value: 'pattern', label: 'Custom pattern' }, { value: 'stop', label: 'Stop' }] },
  function: { label: 'Function', options: ['Vibrate', 'Rotate', 'Pump', 'Thrusting', 'Fingering', 'Suction', 'Depth', 'Oscillate', 'All'] },
  strength: { label: 'Strength (0–20)', min: 0, max: 20, step: 1 },
  seconds: { min: 1, max: 600, step: 1 },
  preset: { label: 'Preset (for Preset type)', options: ['pulse', 'wave', 'fireworks', 'earthquake'] },
  pattern: { label: 'Pattern (for Custom type)', placeholder: '20;0;15;0', help: 'Strengths 0–20 separated by ;. Leave blank to use Strength.' },
  patternStepMs: { label: 'Pattern step (ms)', min: 100, step: 50 },
};

export const HINTS: Record<string, unknown> = {
  port: { help: 'Restart the app after changing.' },
  openBrowserOnStart: { label: 'Open in browser when run on its own', help: 'Only used when the server runs without the app window.' },
  enabled: { label: 'Master switch', help: 'Turn everything off without losing settings.' },
  lovense: { label: 'Lovense connection', help: 'Open Lovense Remote → Game Mode (or Lovense Connect) and copy the IP and port it shows.' },
  'lovense.https': { label: 'Use HTTPS', help: 'Needed when the app shows an HTTPS port (host looks like 192-168-1-5.lovense.club).' },
  'lovense.toy': { label: 'Toy ID', help: 'Blank = all connected toys. Click "Find toys" to see IDs.' },
  'lovense.platform': { label: 'Platform name', help: 'Sent as the X-platform header.' },
  'safety.maxStrength': { label: 'Max strength cap', min: 0, max: 20, step: 1 },
  'safety.maxSeconds': { label: 'Max seconds per action', min: 1, max: 600 },
  'safety.queueMode': { label: 'When busy', options: [{ value: 'queue', label: 'Queue it' }, { value: 'override', label: 'Replace current' }, { value: 'ignore', label: 'Ignore new' }] },
  gameEvents: { label: 'Game events', help: 'What the toy does for each event the screen reader sees. "My" means your seat. Lead changes come from the live score reading.' },
  twitch: { label: 'Twitch triggers', help: 'Needs mahjong-soul-twitch running with forwarding on. That app owns the Twitch login; this one only listens.' },
  'twitch.url': { label: 'Twitch app events URL' },
  'twitch.stopCommand': { help: 'Broadcaster or mods can type this to stop the toy and clear the queue.' },
  'twitch.bits.tiers': { help: 'The highest tier the cheer reaches is used.', template: { minBits: 1000, action: act('vibrate', 20, 15) } },
  'twitch.giftSubs.secondsPerSub': { help: 'Duration = this × number of gifted subs (capped by safety).' },
  'twitch.redeems': { label: 'Channel point redeems', help: 'Reward title must match exactly (case-insensitive).', template: { enabled: true, rewardTitle: 'New reward', action: act('vibrate', 8, 3) } },
  'twitch.chatCommands': { template: { enabled: true, trigger: '!vibe', cooldownSec: 60, modsOnly: false, action: act('vibrate', 6, 2) } },
};
const LEAD_LABELS: Record<string, string> = { took_lead: 'Took the lead (now 1st)', lost_lead: 'Lost the lead' };
for (const { key, label } of EVENT_KEYS) HINTS[`gameEvents.${key}`] = { label };
for (const [key, label] of Object.entries(LEAD_LABELS)) HINTS[`gameEvents.${key}`] = { label };
for (const [k, v] of Object.entries(ACTION_HINTS)) {
  HINTS[`gameEvents.*.action.${k}`] = v;
  HINTS[`twitch.*.action.${k}`] = v;
  HINTS[`twitch.bits.tiers.[].action.${k}`] = v;
  HINTS[`twitch.redeems.[].action.${k}`] = v;
  HINTS[`twitch.chatCommands.[].action.${k}`] = v;
}

function merge<T>(base: T, over: unknown): T {
  if (Array.isArray(base)) {
    if (!Array.isArray(over)) return base;
    const tpl = base[0];
    return (tpl && typeof tpl === 'object' ? over.map((x) => merge(tpl, x)) : over) as T;
  }
  if (base && typeof base === 'object') {
    const out: Record<string, unknown> = {};
    const o = (over && typeof over === 'object' ? over : {}) as Record<string, unknown>;
    for (const k of Object.keys(base)) out[k] = merge((base as Record<string, unknown>)[k], o[k]);
    return out as T;
  }
  return (over !== undefined && typeof over === typeof base ? over : base) as T;
}

export function loadConfig(): Config {
  if (!existsSync(CONFIG_PATH)) return structuredClone(DEFAULT_CONFIG);
  try { return merge(DEFAULT_CONFIG, JSON.parse(readFileSync(CONFIG_PATH, 'utf8'))); }
  catch (e) { console.error('config.json is invalid, using defaults:', e); return structuredClone(DEFAULT_CONFIG); }
}

export function saveConfig(cfg: unknown): Config {
  const merged = merge(DEFAULT_CONFIG, cfg);
  writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 2));
  return merged;
}

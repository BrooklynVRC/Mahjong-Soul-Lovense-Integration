// Maps incoming game / Twitch events to the configured toy actions.
import type { Action, Config, GameKey } from './config.js';

/** Candidate game-event keys in priority order; the first enabled one is played. */
export function gameKeys(e: any): GameKey[] {
  switch (e?.type) {
    case 'game_start': return ['game_start'];
    case 'round_start': return e.iAmDealer ? ['my_dealer_round'] : [];
    case 'riichi': return [e.isMe ? 'my_riichi' : 'opponent_riichi'];
    case 'call': return e.isMe ? ['my_call'] : [];
    case 'win':
      if (e.isMe) return e.yakuman ? ['my_yakuman', e.method === 'tsumo' ? 'my_win_tsumo' : 'my_win_ron'] : [e.method === 'tsumo' ? 'my_win_tsumo' : 'my_win_ron'];
      if (e.dealtInByMe) return ['dealt_in'];
      return [e.method === 'tsumo' ? 'opponent_tsumo' : 'opponent_ron_other'];
    case 'draw': return [e.iAmTenpai ? 'draw_tenpai' : 'draw_noten'];
    case 'game_end': return e.myPlace >= 1 && e.myPlace <= 4 ? [`game_end_${e.myPlace}` as GameKey] : [];
  }
  return [];
}

export function forGame(cfg: Config, e: any): { label: string; action: Action } | null {
  for (const k of gameKeys(e)) {
    const r = cfg.gameEvents[k];
    if (r?.enabled) return { label: `game: ${k}`, action: r.action };
  }
  return null;
}

const lastUse = new Map<string, number>();

export type TwitchResult = { label: string; action: Action } | { stop: true; label: string } | null;

export function forTwitch(cfg: Config, e: any, now = Date.now()): TwitchResult {
  const t = cfg.twitch;
  const who = e.user ?? 'someone';
  switch (e?.type) {
    case 'chat': {
      const word = String(e.message ?? '').trim().split(/\s+/)[0]?.toLowerCase();
      if (!word) return null;
      if (t.stopCommand && word === t.stopCommand.toLowerCase() && (e.isMod || e.isBroadcaster)) return { stop: true, label: `${who} used ${t.stopCommand}` };
      const c = t.chatCommands.find((x) => x.enabled && x.trigger.toLowerCase() === word);
      if (!c) return null;
      if (c.modsOnly && !e.isMod && !e.isBroadcaster) return null;
      const key = 'cmd:' + word;
      if (!e.isBroadcaster && now - (lastUse.get(key) ?? 0) < c.cooldownSec * 1000) return null;
      lastUse.set(key, now);
      return { label: `${who}: ${word}`, action: c.action };
    }
    case 'bits': {
      if (!t.bits.enabled) return null;
      const tier = [...t.bits.tiers].sort((a, b) => b.minBits - a.minBits).find((x) => (e.amount ?? 0) >= x.minBits);
      return tier ? { label: `${who} cheered ${e.amount} bits`, action: tier.action } : null;
    }
    case 'sub': return t.subs.enabled ? { label: `${who} subscribed`, action: t.subs.action } : null;
    case 'resub': return t.resubs.enabled ? { label: `${who} resubscribed (${e.amount} months)`, action: t.resubs.action } : null;
    case 'gift':
      return t.giftSubs.enabled ? { label: `${who} gifted ${e.amount} subs`, action: { ...t.giftSubs.action, seconds: t.giftSubs.secondsPerSub * (e.amount ?? 1) } } : null;
    case 'follow': return t.follows.enabled ? { label: `${who} followed`, action: t.follows.action } : null;
    case 'raid': return t.raids.enabled ? { label: `${who} raided (${e.amount})`, action: t.raids.action } : null;
    case 'redeem': {
      const r = t.redeems.find((x) => x.enabled && x.rewardTitle.trim().toLowerCase() === String(e.rewardTitle ?? '').trim().toLowerCase());
      return r ? { label: `${who} redeemed "${e.rewardTitle}"`, action: r.action } : null;
    }
  }
  return null;
}

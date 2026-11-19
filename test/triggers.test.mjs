// Run with: npm test  (package.json runs node --import tsx so the .ts sources load)
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { DEFAULT_CONFIG } = await import('../src/config.ts');
const { forGame, forTwitch } = await import('../src/triggers.ts');
const { EVENT_KEYS } = await import('../src/screen/keys.ts');
const { Lovense } = await import('../src/lovense.ts');

const cfg = () => structuredClone(DEFAULT_CONFIG);

test('every screen event has a toy rule', () => {
  const c = cfg();
  for (const { key } of EVENT_KEYS) assert.ok(c.gameEvents[key], key);
  assert.ok(c.gameEvents.took_lead && c.gameEvents.lost_lead);
});

test('game keys play their rule only when enabled', () => {
  const c = cfg();
  assert.equal(forGame(c, 'my_riichi').label, 'game: my_riichi');
  c.gameEvents.my_riichi.enabled = false;
  assert.equal(forGame(c, 'my_riichi'), null);
  assert.equal(forGame(c, 'not_a_key'), null);
});

test('bits use highest tier reached', () => {
  assert.equal(forTwitch(cfg(), { type: 'bits', amount: 250 }).action.strength, 10);
  assert.equal(forTwitch(cfg(), { type: 'bits', amount: 999 }).action.preset, 'earthquake');
});

test('stop command needs mod/broadcaster', () => {
  assert.equal(forTwitch(cfg(), { type: 'chat', message: '!stop', isMod: false }), null);
  assert.ok(forTwitch(cfg(), { type: 'chat', message: '!stop', isMod: true }).stop);
});

test('chat command cooldown', () => {
  const c = cfg(); c.twitch.chatCommands[0].enabled = true;
  assert.ok(forTwitch(c, { type: 'chat', message: '!buzz now' }, 1_000_000));
  assert.equal(forTwitch(c, { type: 'chat', message: '!buzz' }, 1_010_000), null);
  assert.ok(forTwitch(c, { type: 'chat', message: '!buzz' }, 1_070_000));
});

test('safety caps clamp strength and duration', () => {
  const c = cfg(); c.safety.maxStrength = 10; c.safety.maxSeconds = 5;
  const l = new Lovense(() => c);
  const r = l.buildRequest({ type: 'vibrate', function: 'Vibrate', strength: 20, seconds: 60, preset: '', pattern: '', patternStepMs: 300 });
  assert.equal(r.body.action, 'Vibrate:10');
  assert.equal(r.seconds, 5);
  const p = l.buildRequest({ type: 'pattern', function: 'Rotate', strength: 5, seconds: 3, preset: '', pattern: '20;0;15', patternStepMs: 200 });
  assert.equal(p.body.rule, 'V:1;F:r;S:200#');
  assert.equal(p.body.strength, '10;0;10');
});

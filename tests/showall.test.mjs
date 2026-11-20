import assert from "node:assert/strict";
import test from "node:test";
import {applyKey, featureOf, idleState, isTurnChange, turnDuration, wantsAll} from "../scripts/showall.mjs";

test("hold: on while pressed, off when released", () => {
  let s = applyKey(idleState(), "hold", "down");
  assert.equal(wantsAll(s), true);
  assert.equal(featureOf(s), "showAllHeld");
  s = applyKey(s, "hold", "up");
  assert.equal(wantsAll(s), false);
});

test("toggle: press on, press off, release does nothing", () => {
  let s = applyKey(idleState(), "toggle", "down");
  assert.equal(wantsAll(s), true);
  assert.equal(featureOf(s), "showAllToggled");
  s = applyKey(s, "toggle", "up");
  assert.equal(wantsAll(s), true);
  s = applyKey(s, "toggle", "down");
  assert.equal(wantsAll(s), false);
});

test("the turn alone shows, and a held key keeps it on", () => {
  const s = {...idleState(), turn: true};
  assert.equal(wantsAll(s), true);
  assert.equal(featureOf(s), "turnTooltips");
  const held = applyKey(s, "hold", "down");
  assert.equal(wantsAll({...held, turn: false}), true);
});

test("turn duration", () => {
  assert.equal(turnDuration(4), 4000);
  assert.equal(turnDuration("x"), 4000);
  assert.equal(turnDuration(0), 4000);
  assert.equal(turnDuration(99), 30000);
});

test("turn change", () => {
  assert.equal(isTurnChange({turn: 2}), true);
  assert.equal(isTurnChange({round: 2, turn: 0}), true);
  assert.equal(isTurnChange({scene: "x"}), false);
  assert.equal(isTurnChange(null), false);
});

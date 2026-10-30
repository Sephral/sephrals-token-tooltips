import assert from "node:assert/strict";
import test from "node:test";
import {GAP, MARGIN, onScreen, placeTooltip} from "../scripts/placement.mjs";

const viewport = {width: 1000, height: 800};
const size = {width: 200, height: 100};

test("right of the token, centered on its height", () => {
  const p = placeTooltip({left: 100, top: 300, width: 100, height: 100}, size, viewport, "right");
  assert.deepEqual(p, {left: 200 + GAP, top: 300, side: "right"});
});

test("flips to the left when the right side has no room", () => {
  const p = placeTooltip({left: 800, top: 300, width: 100, height: 100}, size, viewport, "right");
  assert.equal(p.side, "left");
  assert.equal(p.left, 800 - GAP - 200);
});

test("above flips below at the top edge, below flips above at the bottom", () => {
  assert.equal(placeTooltip({left: 400, top: 20, width: 100, height: 100}, size, viewport, "above").side, "below");
  assert.equal(placeTooltip({left: 400, top: 680, width: 100, height: 100}, size, viewport, "below").side, "above");
  const above = placeTooltip({left: 400, top: 400, width: 100, height: 100}, size, viewport, "above");
  assert.deepEqual(above, {left: 350, top: 400 - GAP - 100, side: "above"});
});

test("stays inside the window", () => {
  const p = placeTooltip({left: -50, top: -40, width: 60, height: 60}, size, viewport, "above");
  assert.ok(p.left >= MARGIN && p.top >= MARGIN);
  const huge = placeTooltip({left: 0, top: 0, width: 1000, height: 800}, size, viewport, "right");
  assert.ok(huge.left <= viewport.width - size.width - MARGIN);
});

test("a token counts as on screen while any part of it is inside the window", () => {
  const viewport = {width: 1600, height: 1000};
  assert.equal(onScreen({left: 100, top: 100, width: 100, height: 100}, viewport), true);
  assert.equal(onScreen({left: -90, top: 100, width: 100, height: 100}, viewport), true);
  assert.equal(onScreen({left: 1599, top: 999, width: 100, height: 100}, viewport), true);
  assert.equal(onScreen({left: -100, top: 100, width: 100, height: 100}, viewport), false);
  assert.equal(onScreen({left: 1600, top: 100, width: 100, height: 100}, viewport), false);
  assert.equal(onScreen({left: 2800, top: 1250, width: 100, height: 100}, viewport), false);
  assert.equal(onScreen({left: 100, top: -300, width: 100, height: 100}, viewport), false);
});

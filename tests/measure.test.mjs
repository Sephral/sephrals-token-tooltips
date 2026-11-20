import assert from "node:assert/strict";
import test from "node:test";
import {buildRows, formatDistance, formatElevation, formatValue} from "../scripts/format.mjs";
import {MAX_CELLS, elevationOf, flatOffsets, nearestMeasure, pickOrigin, rectGap, roundDistance, unitsFromPixels}
  from "../scripts/measure.mjs";
import {PRESETS, dnd5eCover, pf2eCover} from "../scripts/presets.mjs";
import {FALLBACK, fieldsFor} from "../scripts/fields.mjs";

const t = key => `[${key}]`;

test("the gap between two frames is zero when they touch or overlap", () => {
  const a = {x: 0, y: 0, width: 100, height: 100};
  assert.equal(rectGap(a, {x: 100, y: 0, width: 100, height: 100}), 0);
  assert.equal(rectGap(a, {x: 50, y: 50, width: 100, height: 100}), 0);
  assert.equal(rectGap(a, {x: 300, y: 0, width: 100, height: 100}), 200);
  assert.equal(rectGap(a, {x: 130, y: 140, width: 100, height: 100}), 50);
});

test("grid offsets lose their level and their duplicates", () => {
  assert.deepEqual(flatOffsets([{i: 1, j: 2, k: 0}, {i: 1, j: 2, k: 1}, {i: 1, j: 3, k: 0}]), [{i: 1, j: 2}, {i: 1, j: 3}]);
  assert.deepEqual(flatOffsets(undefined), []);
  assert.ok(MAX_CELLS >= 16);
});

test("the nearest spaces of two tokens decide the distance", () => {
  // Square grid of 5 ft, Chebyshev steps like the core grid with diagonals counted as one step
  const cell = ({i, j}) => ({i, j});
  const measure = (a, b) => Math.max(Math.abs(a.i - b.i), Math.abs(a.j - b.j)) * 5;
  const small = [cell({i: 0, j: 0})];
  const adjacent = [cell({i: 0, j: 1})];
  const large = [0, 1].flatMap(i => [4, 5].map(j => cell({i, j})));
  assert.equal(nearestMeasure(small, adjacent, measure), 5);
  assert.equal(nearestMeasure(small, large, measure), 20);
  assert.equal(nearestMeasure([], large, measure), null);
});

test("pixels turn into scene units and round to one decimal", () => {
  assert.equal(unitsFromPixels(150, 100, 5), 7.5);
  assert.equal(unitsFromPixels(150, 0, 5), 0);
  assert.equal(roundDistance(7.4999), 7.5);
  assert.equal(roundDistance(30), 30);
});

test("the origin is a controlled token that is not the target, else the character, else a neighbour for the preview", () => {
  const a = {id: "a"};
  const b = {id: "b"};
  const c = {id: "c"};
  assert.equal(pickOrigin({controlled: [a, b], target: a, character: c}), b);
  assert.equal(pickOrigin({controlled: [a], target: a, character: c}), c);
  assert.equal(pickOrigin({controlled: [], target: c, character: c}), null);
  assert.equal(pickOrigin({controlled: [], target: c, character: c, others: [c, b]}), b);
  assert.equal(pickOrigin({controlled: [], target: a}), null);
});

test("elevation with its difference, nothing on level ground", () => {
  assert.deepEqual(elevationOf(10, 5), {value: 10, diff: 5});
  assert.deepEqual(elevationOf(0, 15), {value: 0, diff: -15});
  assert.deepEqual(elevationOf(10, null), {value: 10, diff: null});
  assert.deepEqual(elevationOf(10, 10), {value: 10, diff: null});
  assert.equal(elevationOf(0, 0), null);
  assert.equal(elevationOf(0, null), null);
});

test("distance and elevation as text", () => {
  assert.deepEqual(formatDistance({value: 35, units: "ft"}), {kind: "text", text: "35 ft"});
  assert.deepEqual(formatDistance({value: 2.5, units: ""}), {kind: "text", text: "2.5"});
  assert.equal(formatDistance({value: null}), null);
  assert.deepEqual(formatElevation({value: 10, units: "ft", diff: 5}), {kind: "text", text: "10 ft (+5)"});
  assert.deepEqual(formatElevation({value: 0, units: "ft", diff: -15}), {kind: "text", text: "0 ft (-15)"});
  assert.deepEqual(formatElevation({value: 10, units: "m", diff: null}), {kind: "text", text: "10 m"});
  assert.deepEqual(formatValue({type: "distance", config: {}}, {value: 5, units: "ft"}, "exact", t), {kind: "text", text: "5 ft"});
});

test("every preset offers distance and elevation, off by default, and reads from the helpers of the environment", () => {
  for ( const preset of Object.values(PRESETS) ) {
    for ( const id of ["tokenDistance", "tokenElevation"] ) {
      const field = preset.fields.find(f => f.id === id);
      assert.ok(field, `${preset.id}: ${id}`);
      assert.equal(field.defaults.enabled, false);
      assert.equal(field.defaults.audience, "everyone");
      assert.equal(field.needsOrigin, true);
    }
    const distance = preset.fields.find(f => f.id === "tokenDistance");
    const env = {distanceTo: token => ({value: token.d, units: "ft"})};
    assert.deepEqual(distance.read({token: {d: 30}, env}), {value: 30, units: "ft"});
    assert.equal(distance.read({token: {}, env: {}}), null);
  }
});

test("a field that is off stays out of the tooltip until it is ticked, and follows the audience rules", () => {
  const fields = fieldsFor("dnd5e", {});
  const distance = fields.find(f => f.id === "tokenDistance");
  assert.equal(distance.config.enabled, false);
  const on = {...distance, config: {...distance.config, enabled: true}};
  const viewer = {isGM: false, isOwner: false, disposition: -1, party: false};
  const rows = viewer2 => buildRows([on], {viewer: viewer2, read: () => ({value: 20, units: "ft"}), t}).rows;
  assert.equal(rows(viewer).length, 1);
  assert.equal(rows(viewer)[0].text, "20 ft");
  // Everyone sees it, but not for secret tokens
  assert.equal(rows({...viewer, disposition: -2}).length, 0);
  // Narrowed to the GM, it goes for players
  const gmOnly = {...on, config: {...on.config, audience: "gm"}};
  assert.equal(buildRows([gmOnly], {viewer, read: () => ({value: 20, units: "ft"}), t}).rows.length, 0);
  assert.equal(buildRows([gmOnly], {viewer: {...viewer, isGM: true}, read: () => ({value: 20, units: "ft"}), t}).rows.length, 1);
  assert.equal(FALLBACK.enabled, true);
});

test("dnd5e cover: the status of the system, the largest first", () => {
  const env = {choiceName: (source, key) => `${source}:${key}`};
  const actor = statuses => ({statuses: new Set(statuses)});
  assert.equal(dnd5eCover({actor: actor([]), env}), null);
  assert.equal(dnd5eCover({actor: actor(["coverHalf"]), env}), "CONFIG.DND5E.statusEffects:coverHalf");
  assert.equal(dnd5eCover({actor: actor(["coverHalf", "coverThreeQuarters"]), env}), "CONFIG.DND5E.statusEffects:coverThreeQuarters");
  assert.equal(dnd5eCover({actor: actor(["coverTotal"]), env}), "CONFIG.DND5E.statusEffects:coverTotal");
  assert.equal(dnd5eCover({actor: {}, env}), null);
  assert.equal(PRESETS.dnd5e.fields.find(f => f.id === "tokenCover").defaults.enabled, false);
});

test("pf2e cover: the effect with the slug effect-cover; other systems have no cover field", () => {
  assert.equal(pf2eCover({actor: {itemTypes: {effect: [{slug: "effect-cover"}]}}}), true);
  assert.equal(pf2eCover({actor: {itemTypes: {effect: [{slug: "effect-raise-a-shield"}]}}}), null);
  assert.equal(pf2eCover({actor: {}}), null);
  for ( const id of ["swade", "crucible", "generic", "daggerheart"] ) {
    assert.ok(!PRESETS[id].fields.some(f => f.id === "tokenCover"), id);
  }
});

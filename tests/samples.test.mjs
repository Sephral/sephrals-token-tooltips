import assert from "node:assert/strict";
import test from "node:test";
import {fieldsFor} from "../scripts/fields.mjs";
import {buildExport, parseImport, planImport} from "../scripts/transfer.mjs";
import {changeOf, changeWord, floaterFor, stateOf} from "../scripts/floaters.mjs";
import {STATES, actorData, floaterCases, importFile, viewerFor} from "../scripts/sample-data.mjs";
import {resolveForm} from "../scripts/visibility.mjs";

const cast = [
  {id: "ari", name: "Ari", img: "a.webp", side: "party", role: "fighter"},
  {id: "troll", name: "Troll", img: "t.webp", side: "foe"}
];

test("every member of the cast has a state with hit points inside the maximum", () => {
  for ( const [id, state] of Object.entries(STATES) ) {
    assert.ok(state.hp >= 0 && state.hp <= state.max, id);
    assert.ok(state.ac > 0, id);
  }
});

test("dnd5e actors: heroes are characters with a class, foes are creatures with a challenge rating", () => {
  const hero = actorData(cast[0], "dnd5e");
  assert.equal(hero.type, "character");
  assert.equal(hero.system.attributes.hp.value, 31);
  assert.equal(hero.items[0].system.levels, 5);
  const foe = actorData(cast[1], "dnd5e");
  assert.equal(foe.type, "npc");
  assert.equal(foe.system.details.cr, 5);
  assert.equal(foe.items.length, 0);
});

test("other systems get an actor of their first type with plain hit points", () => {
  const data = actorData(cast[1], "pf2e", ["npc", "character"]);
  assert.equal(data.type, "npc");
  assert.equal(data.system.attributes.hp.max, 84);
});

test("a player owns one hero, the foes are seen by their disposition, the GM owns everything", () => {
  assert.deepEqual(viewerFor(cast[0], "player"), {isGM: false, isOwner: true, disposition: 1, party: true});
  assert.deepEqual(viewerFor({id: "mira", side: "party"}, "player"), {isGM: false, isOwner: false, disposition: 1, party: true});
  assert.deepEqual(viewerFor(cast[1], "player"), {isGM: false, isOwner: false, disposition: -1, party: false});
  assert.equal(viewerFor(cast[1], "gm").isGM, true);
  // with the default hit point form a stranger sees a hostile foe only described
  const config = {audience: "everyone", forms: {party: "exact", friendly: "exact", neutral: "descriptive", hostile: "descriptive", secret: "hidden"}};
  assert.equal(resolveForm(config, viewerFor(cast[1], "player"), {describable: true}), "descriptive");
  assert.equal(resolveForm(config, viewerFor(cast[0], "player"), {describable: true}), "exact");
});

test("the floating numbers cover damage and healing in every size, exact and described", () => {
  const words = new Set();
  for ( const item of floaterCases() ) {
    assert.ok(item.max > 0 && item.before !== item.after);
    const change = changeOf(stateOf({value: item.before, max: item.max}), stateOf({value: item.after, max: item.max}));
    const exact = floaterFor("exact", change, {word: key => key});
    const described = floaterFor("descriptive", change, {word: key => key});
    assert.match(exact.text, /^[−+]\d+$/);
    words.add(described.text);
  }
  assert.deepEqual([...words].sort(), ["badly", "brutal", "down", "healFull", "healMuch", "healSlight", "healSome", "hurt", "scratch"].sort());
  assert.equal(changeWord({delta: -2, max: 84, after: 82}), "scratch");
});

test("the import file reads, and the plan shows changes, a new field, unknown and unusable fields", () => {
  const current = fieldsFor("dnd5e", {});
  const exported = JSON.parse(JSON.stringify(buildExport({presetId: "dnd5e", systemId: "dnd5e", fields: current})));
  const parsed = parseImport(importFile(exported));
  assert.equal(parsed.ok, true);
  assert.equal(parsed.preset, "pf2e");
  assert.equal(parsed.dropped, 1);
  assert.equal(parsed.custom.length, 1);
  const plan = planImport({systemId: "dnd5e", presetId: "dnd5e", current, imported: parsed, mode: "merge"});
  const kinds = new Set(plan.changes.map(c => c.kind));
  assert.ok(kinds.has("changed") && kinds.has("added") && kinds.has("order"));
  assert.deepEqual(plan.unknown, ["fieldOfAnotherSystem"]);
  const replace = planImport({systemId: "dnd5e", presetId: "dnd5e", current, imported: parsed, mode: "replace"});
  assert.ok(replace.fields.length > 0);
});

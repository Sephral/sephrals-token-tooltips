import assert from "node:assert/strict";
import test from "node:test";
import {customReader, dnd5eSenses, dnd5eSpeeds, dnd5eSpellDc, getPath, pf2eSpeeds, presetFor, PRESETS, swadePaces,
  swadeToughness} from "../scripts/presets.mjs";

const env = {effectsOf: actor => actor?.fx ?? [], barOf: (token, bar) => token?.[bar] ?? null};
const field = (preset, id) => PRESETS[preset].fields.find(f => f.id === id);
const read = (preset, id, actor, token = {}) => {
  const f = field(preset, id);
  return f.read ? f.read({actor, token, env}) : getPath(actor, f.path);
};

test("every preset has a name and an effects field and unique ids", () => {
  for ( const preset of Object.values(PRESETS) ) {
    const ids = preset.fields.map(f => f.id);
    assert.equal(new Set(ids).size, ids.length, preset.id);
    assert.ok(ids.includes("name") && ids.includes("effects"), preset.id);
    for ( const f of preset.fields ) assert.ok(f.read || f.path || (f.type === "name"), `${preset.id}.${f.id}`);
  }
});

test("systems without a preset use the token bars", () => {
  assert.equal(presetFor("worldbuilding").id, "generic");
  assert.equal(presetFor("dnd5e").id, "dnd5e");
});

test("dnd5e: hit points with the temporary maximum, temp HP only above zero, AC, CR", () => {
  const actor = {type: "npc", system: {attributes: {hp: {value: 12, max: 20, effectiveMax: 25, temp: 0},
    ac: {value: 15}, movement: {walk: 30, fly: 60, hover: true, swim: 0, units: "ft"}},
  skills: {prc: {passive: 13}}, details: {cr: 0.25}}};
  assert.deepEqual(read("dnd5e", "hp", actor), {value: 12, max: 25});
  assert.equal(read("dnd5e", "tempHp", actor), null);
  actor.system.attributes.hp.temp = 5;
  assert.equal(read("dnd5e", "tempHp", actor), 5);
  assert.equal(read("dnd5e", "ac", actor), 15);
  assert.equal(read("dnd5e", "passive", actor), 13);
  assert.equal(read("dnd5e", "cr", actor), 0.25);
  assert.deepEqual(field("dnd5e", "cr").actorTypes, ["npc"]);
});

test("dnd5e speeds: hovering flight, units, no zero speeds", () => {
  const actor = {system: {attributes: {movement: {walk: 30, fly: 60, hover: true, swim: 0, burrow: 5, units: "m"}}}};
  assert.deepEqual(dnd5eSpeeds({actor}), [{type: "walk", value: 30, units: "m"}, {type: "hover", value: 60, units: "m"},
    {type: "burrow", value: 5, units: "m"}]);
  assert.equal(dnd5eSpeeds({actor: {system: {}}}), null);
});

test("pf2e: land speed and other speeds, modifiers with a sign", () => {
  const actor = {system: {attributes: {speed: {value: 25, total: 30, otherSpeeds: [{type: "fly", total: 40}, {type: "swim", value: 0}]}},
    perception: {mod: 7}, saves: {will: {mod: -1}}}};
  assert.deepEqual(pf2eSpeeds({actor}), [{type: "walk", value: 30, units: "ft"}, {type: "fly", value: 40, units: "ft"}]);
  assert.equal(read("pf2e", "perception", actor), "+7");
  assert.equal(read("pf2e", "will", actor), "-1");
  assert.equal(read("pf2e", "reflex", actor), null);
});

test("pf2e 8: speeds per movement type without travel, perception and saves as value", () => {
  const actor = {system: {movement: {speeds: {land: {value: 25}, fly: {value: 30}, swim: null, travel: {value: 25}}},
    perception: {value: 4}, saves: {fortitude: {value: 5}}}};
  assert.deepEqual(pf2eSpeeds({actor}), [{type: "walk", value: 25, units: "ft"}, {type: "fly", value: 30, units: "ft"}]);
  assert.equal(read("pf2e", "perception", actor), "+4");
  assert.equal(read("pf2e", "fortitude", actor), "+5");
  assert.equal(pf2eSpeeds({actor: {system: {movement: {speeds: {land: null}}}}}), null);
});

test("swade: pace in SWADE 6 and SWADE 5, toughness with armor, wounds and fatigue", () => {
  assert.deepEqual(swadePaces({actor: {system: {pace: {ground: 6, fly: 12, swim: 0}}}}),
    [{type: "walk", value: 6}, {type: "fly", value: 12}]);
  assert.deepEqual(swadePaces({actor: {system: {pace: {ground: {value: 8}}}}}), [{type: "walk", value: 8}]);
  assert.deepEqual(swadePaces({actor: {system: {stats: {speed: {value: 6, adjusted: 5}}}}}), [{type: "walk", value: 5}]);
  assert.equal(swadePaces({actor: {system: {}}}), null);
  assert.equal(swadeToughness({actor: {system: {stats: {toughness: {value: 8, armor: 2}}}}}), "8 (2)");
  assert.equal(swadeToughness({actor: {system: {stats: {toughness: {value: 5, armor: 0}}}}}), "5");
  assert.deepEqual(read("swade", "wounds", {system: {wounds: {value: 1, max: 3}}}), {value: 1, max: 3});
  assert.equal(field("swade", "fatigue").describe, false);
});

test("crucible: pools only when the actor has them", () => {
  const actor = {system: {resources: {health: {value: 20, max: 30}, wounds: {value: 0, max: 0}, morale: {value: 5, max: 10}}}};
  assert.deepEqual(read("crucible", "health", actor), {value: 20, max: 30});
  assert.equal(read("crucible", "wounds", actor), null);
  assert.equal(read("crucible", "madness", actor), null);
  assert.equal(read("crucible", "physical", {system: {defenses: {physical: {total: 14}}}}), 14);
  assert.equal(read("crucible", "level", {system: {advancement: {level: 3}}}), 3);
});

test("generic: the token bars through Foundry, effects through the helper", () => {
  const token = {bar1: {value: 3, max: 7, label: "HP"}};
  assert.deepEqual(read("generic", "bar1", {}, token), {value: 3, max: 7, label: "HP"});
  assert.equal(read("generic", "bar2", {}, token), null);
  assert.deepEqual(read("generic", "effects", {fx: [{name: "Prone"}]}), [{name: "Prone"}]);
});

test("custom readers: actor paths, token paths, numbers wrapped for resources", () => {
  const actor = {system: {mana: {value: 2, max: 5}, gold: 12}};
  const token = {elevation: 10};
  assert.deepEqual(customReader("system.mana", "resource")({actor, token}), {value: 2, max: 5});
  assert.deepEqual(customReader("actor.system.gold", "count")({actor, token}), {value: 12});
  assert.equal(customReader("token.elevation", "number")({actor, token}), 10);
  assert.equal(customReader("system.missing.deep", "text")({actor, token}), undefined);
});

test("PF2e loot actors and the party count as things without a tooltip, creatures do not", () => {
  assert.deepEqual(PRESETS.pf2e.objectTypes, ["loot", "party"]);
  for ( const id of ["dnd5e", "swade", "crucible", "generic"] ) assert.equal(PRESETS[id].objectTypes, undefined);
});

test("values often needed in play are fields that start switched off", () => {
  const off = {dnd5e: ["passiveInsight", "passiveInvestigation", "spellDc", "inspiration", "senses"],
    pf2e: ["heroPoints", "focusPoints", "classDc"], swade: ["runDie", "powerPoints", "rank"],
    crucible: ["actionPoints", "focus", "heroism"]};
  for ( const [preset, ids] of Object.entries(off) ) {
    for ( const id of ids ) {
      const f = field(preset, id);
      assert.ok(f, `${preset}.${id}`);
      assert.equal(f.defaults.enabled, false, `${preset}.${id}`);
      assert.ok(["gm", "owner", "everyone"].includes(f.defaults.audience));
      if ( id !== "senses" ) assert.ok(f.path, `${preset}.${id} names its path, so the shortlist leaves it out`);
    }
  }
  // Counters are no health: no description, numbers instead of a bar
  for ( const [preset, id] of [["pf2e", "heroPoints"], ["pf2e", "focusPoints"], ["swade", "powerPoints"], ["crucible", "heroism"]] ) {
    assert.equal(field(preset, id).describe, false);
    assert.equal(field(preset, id).defaults.display, "number");
  }
});

test("dnd5e: passive Insight and Investigation, spell DC only for casters, inspiration, senses", () => {
  const actor = {type: "character", system: {skills: {ins: {passive: 14}, inv: {passive: 11}},
    attributes: {spellcasting: "", spell: {dc: 9}, inspiration: true,
      senses: {darkvision: 60, blindsight: 0, tremorsense: 10, truesight: 0, units: "ft", special: ""}}}};
  assert.equal(read("dnd5e", "passiveInsight", actor), 14);
  assert.equal(read("dnd5e", "passiveInvestigation", actor), 11);
  assert.equal(read("dnd5e", "spellDc", actor), null);
  actor.system.attributes.spellcasting = "int";
  assert.equal(dnd5eSpellDc({actor}), 9);
  assert.equal(read("dnd5e", "inspiration", actor), true);
  assert.deepEqual(field("dnd5e", "inspiration").actorTypes, ["character"]);
  assert.deepEqual(dnd5eSenses({actor}), [{type: "darkvision", value: 60, units: "ft"}, {type: "tremorsense", value: 10, units: "ft"}]);
  assert.equal(dnd5eSenses({actor: {system: {attributes: {senses: {darkvision: 0}}}}}), null);
  // dnd5e 5.3 and newer keep the ranges in senses.ranges
  assert.deepEqual(dnd5eSenses({actor: {system: {attributes: {senses: {ranges: {blindsight: 30}, units: "m"}}}}}),
    [{type: "blindsight", value: 30, units: "m"}]);
});

test("pf2e, swade, crucible: pools only with a maximum, class DC, running die, rank", () => {
  const pc = {system: {resources: {heroPoints: {value: 1, max: 3}, focus: {value: 0, max: 0}},
    attributes: {classDC: {value: 17, dc: 17}}}};
  assert.deepEqual(read("pf2e", "heroPoints", pc), {value: 1, max: 3});
  assert.equal(read("pf2e", "focusPoints", pc), null);
  pc.system.resources.focus = {value: 1, max: 2, cap: 3};
  assert.deepEqual(read("pf2e", "focusPoints", pc), {value: 1, max: 2});
  assert.equal(read("pf2e", "classDc", pc), 17);
  const hero = {system: {pace: {running: {die: 8, mod: 0}}, powerPoints: {general: {value: 0, max: 0}}, advances: {rank: "Novice"}}};
  assert.equal(read("swade", "runDie", hero), 8);
  assert.equal(read("swade", "powerPoints", hero), null);
  assert.equal(read("swade", "rank", hero), "Novice");
  const crucible = {system: {resources: {action: {value: 4, max: 6}, focus: {value: 2, max: 2}, heroism: {value: 0, max: 0}}}};
  assert.deepEqual(read("crucible", "actionPoints", crucible), {value: 4, max: 6});
  assert.deepEqual(read("crucible", "focus", crucible), {value: 2, max: 2});
  assert.equal(read("crucible", "heroism", crucible), null);
});

test("custom readers name keys through the system when they know where", () => {
  const actor = {system: {traits: {size: "med", dr: {value: new Set(["fire"])}}}};
  const env = {choiceName: (source, key) => `${source}:${key}`};
  assert.equal(customReader("system.traits.size", "text", "SIZES")({actor, token: {}, env}), "SIZES:med");
  assert.deepEqual(customReader("system.traits.dr.value", "list", "DAMAGE")({actor, token: {}, env}), ["DAMAGE:fire"]);
  assert.equal(customReader("system.traits.size", "text")({actor, token: {}, env}), "med");
});

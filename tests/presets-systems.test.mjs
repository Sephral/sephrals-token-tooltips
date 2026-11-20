import assert from "node:assert/strict";
import test from "node:test";
import {SOURCES, __test__ as floaters} from "../scripts/floaters.mjs";
import {dolmenwoodHp, dolmenwoodSpeed, getPath, daggerheartThresholds, presetFor, PRESETS, shadowdarkMove}
  from "../scripts/presets.mjs";
import {buildRows} from "../scripts/format.mjs";
import {activeFields, fieldsFor} from "../scripts/fields.mjs";

/*
 * The shapes below follow the data models of the system releases the paths were checked against:
 * Daggerheart 2.12.9 (module/data/actor), Call of Cthulhu 7 9.2 (models/actor/global-system.js), Shadowdark 4.1.1
 * (src/models), Project FU 5.0.0-rc.3 and 4.16.3 (module/documents/actors), Shadowrun 6 Eden 4.0.11 (template.json,
 * module/documents/actor.js), Dolmenwood 2.3.0 (module/data-models.mjs) and RQG 6.1.1 (rqg-actor).
 */

const env = {choiceName: (source, key) => `${source}:${key}`, effectsOf: () => [], barOf: () => null};
const field = (preset, id) => PRESETS[preset].fields.find(f => f.id === id);
const read = (preset, id, actor, token = {}) => {
  const f = field(preset, id);
  return f.read ? f.read({actor, token, env}) : getPath(actor, f.path);
};

test("the new systems have presets named after their system ids", () => {
  for ( const id of ["daggerheart", "CoC7", "shadowdark", "projectfu", "shadowrun6-eden", "dolmenwood", "rqg"] ) {
    assert.equal(presetFor(id).id, id);
  }
  assert.equal(presetFor("coc7").id, "generic");
});

test("daggerheart: marked hit points and stress count up, hope and armor are resources", () => {
  const actor = {type: "character", system: {
    resources: {hitPoints: {value: 2, max: 6}, stress: {value: 1, max: 6}, hope: {value: 3, max: 6}, armor: {value: 2, max: 4}},
    evasion: 11, levelData: {level: {current: 3}}, damageThresholds: {major: 7, severe: 14}}};
  assert.deepEqual(read("daggerheart", "hp", actor), {value: 2, max: 6});
  assert.equal(field("daggerheart", "hp").type, "count");
  assert.deepEqual(read("daggerheart", "stress", actor), {value: 1, max: 6});
  assert.deepEqual(read("daggerheart", "hope", actor), {value: 3, max: 6});
  assert.deepEqual(read("daggerheart", "armor", actor), {value: 2, max: 4});
  assert.equal(read("daggerheart", "evasion", actor), 11);
  assert.equal(read("daggerheart", "level", actor), 3);
  assert.equal(read("daggerheart", "thresholds", actor), "7 / 14");
  assert.deepEqual(field("daggerheart", "evasion").actorTypes, ["character", "companion"]);
  assert.equal(field("daggerheart", "thresholds").defaults.enabled, false);
});

test("daggerheart adversaries: difficulty and tier for the GM, no pool without a maximum", () => {
  const actor = {type: "adversary", system: {resources: {hitPoints: {value: 0, max: 5}, stress: {value: 0, max: 0}},
    difficulty: 14, tier: 2, damageThresholds: {major: 8, severe: 15}}};
  assert.deepEqual(read("daggerheart", "hp", actor), {value: 0, max: 5});
  assert.equal(read("daggerheart", "stress", actor), null);
  assert.equal(read("daggerheart", "hope", actor), null);
  assert.equal(read("daggerheart", "difficulty", actor), 14);
  assert.equal(field("daggerheart", "difficulty").defaults.audience, "gm");
  assert.equal(daggerheartThresholds({actor}), "8 / 15");
  assert.equal(daggerheartThresholds({actor: {system: {}}}), null);
  assert.deepEqual(PRESETS.daggerheart.objectTypes, ["party"]);
});

test("coc7: the attributes of characters, non-player characters and creatures", () => {
  const actor = {type: "character", system: {attribs: {hp: {value: 9, max: 11, auto: true}, mp: {value: 12, max: 14},
    san: {value: 55, max: 99}, lck: {value: 50}, mov: {value: 8, type: "walk"}, build: {value: 0}, db: {value: "0"},
    armor: {value: "1d4", notes: false}}}};
  assert.deepEqual(read("CoC7", "hp", actor), {value: 9, max: 11});
  assert.deepEqual(read("CoC7", "mp", actor), {value: 12, max: 14});
  assert.deepEqual(read("CoC7", "san", actor), {value: 55, max: 99});
  assert.equal(read("CoC7", "luck", actor), 50);
  assert.equal(read("CoC7", "mov", actor), 8);
  assert.equal(read("CoC7", "armor", actor), "1d4");
  assert.equal(read("CoC7", "build", actor), 0);
  assert.equal(read("CoC7", "damageBonus", actor), "0");
  assert.deepEqual(PRESETS.CoC7.objectTypes, ["container"]);
  // A creature has no sanity: the value is null, the row stays out
  const creature = {type: "creature", system: {attribs: {hp: {value: null, max: null}, san: {value: null, max: 99}}}};
  const rows = buildRows(activeFields(fieldsFor("CoC7", {}), "creature").map(f => ({...f, config: {...f.config, audience: "gm"}})), {
    viewer: {isGM: true, isOwner: true, disposition: -1}, read: f => (f.read ? f.read({actor: creature, token: {}, env}) : null),
    t: key => key}).rows;
  assert.ok(!rows.some(row => ["hp", "san"].includes(row.id)));
});

test("shadowdark: hit points, armor class, level, luck token and the movement band of monsters", () => {
  const player = {type: "Player", system: {attributes: {ac: {value: 14}, hp: {value: 6, max: 9}}, level: {value: 3, xp: 4},
    luck: {remaining: 0, available: true}}};
  assert.deepEqual(read("shadowdark", "hp", player), {value: 6, max: 9});
  assert.equal(read("shadowdark", "ac", player), 14);
  assert.equal(read("shadowdark", "level", player), 3);
  assert.equal(read("shadowdark", "luck", player), true);
  assert.deepEqual(field("shadowdark", "luck").actorTypes, ["Player"]);
  const npc = {type: "NPC", system: {attributes: {ac: {value: 11}, hp: {value: 4, max: 4}}, level: {value: 1}, move: "near"}};
  assert.equal(read("shadowdark", "move", npc), "CONFIG.SHADOWDARK.NPC_MOVES:near");
  assert.equal(shadowdarkMove({actor: {system: {move: "none"}}, env}), null);
  assert.deepEqual(field("shadowdark", "move").actorTypes, ["NPC"]);
  assert.deepEqual(PRESETS.shadowdark.objectTypes, ["Light"]);
});

test("project fu: resources with their prepared maximum, derived defenses, fabula points", () => {
  const actor = {type: "character", system: {level: {value: 10},
    resources: {hp: {value: 30, max: 55, inCrisis: false}, mp: {value: 40, max: 50}, ip: {value: 6, max: 6},
      fp: {value: 3}, zenit: {value: 120}},
    derived: {def: {value: 9}, mdef: {value: 10}, init: {value: 12}}}};
  assert.deepEqual(read("projectfu", "hp", actor), {value: 30, max: 55});
  assert.deepEqual(read("projectfu", "mp", actor), {value: 40, max: 50});
  assert.deepEqual(read("projectfu", "ip", actor), {value: 6, max: 6});
  assert.equal(read("projectfu", "def", actor), 9);
  assert.equal(read("projectfu", "mdef", actor), 10);
  assert.equal(read("projectfu", "fp", actor), 3);
  assert.equal(read("projectfu", "zenit", actor), 120);
  assert.equal(read("projectfu", "init", actor), 12);
  assert.equal(read("projectfu", "level", actor), 10);
  assert.equal(read("projectfu", "crisis", actor), false);
  actor.system.resources.hp.inCrisis = true;
  assert.equal(read("projectfu", "crisis", actor), true);
  assert.deepEqual(PRESETS.projectfu.objectTypes, ["party", "stash"]);
  assert.deepEqual(field("projectfu", "fp").actorTypes, ["character"]);
});

test("shadowrun 6: the monitors hold the boxes that are left, edge and the defense rating", () => {
  const actor = {type: "Player", system: {physical: {base: 9, value: 7, dmg: 2, max: 9}, stun: {value: 9, dmg: 0, max: 9},
    edge: {value: 2, max: 3}, defenserating: {physical: {pool: 5}}, initiative: {physical: {pool: 10}}}};
  assert.deepEqual(read("shadowrun6-eden", "physical", actor), {value: 7, max: 9});
  assert.deepEqual(read("shadowrun6-eden", "stun", actor), {value: 9, max: 9});
  assert.deepEqual(read("shadowrun6-eden", "edge", actor), {value: 2, max: 3});
  assert.equal(read("shadowrun6-eden", "defense", actor), 5);
  assert.equal(read("shadowrun6-eden", "initiative", actor), 10);
  assert.deepEqual(PRESETS["shadowrun6-eden"].objectTypes, ["host"]);
  // A vehicle has no monitors
  assert.equal(read("shadowrun6-eden", "physical", {system: {}}), null);
});

test("dolmenwood: the maximum, armor class and speed with the effects of items, else the base values", () => {
  const adventurer = {type: "Adventurer", system: {level: 3, hp: {value: 8, max: 10}, ac: 10, speed: 40,
    final: {hp: {max: 12}, ac: 13, speed: 30}}};
  assert.deepEqual(read("dolmenwood", "hp", adventurer), {value: 8, max: 12});
  assert.equal(read("dolmenwood", "ac", adventurer), 13);
  assert.deepEqual(read("dolmenwood", "speed", adventurer), [{type: "walk", value: 30, units: "ft"}]);
  assert.equal(read("dolmenwood", "level", adventurer), 3);
  const bare = {type: "Creature", system: {level: 1, hp: {value: 4, max: 4}, ac: 12, speed: 40}};
  assert.deepEqual(dolmenwoodHp({actor: bare}), {value: 4, max: 4});
  assert.equal(read("dolmenwood", "ac", bare), 12);
  assert.deepEqual(dolmenwoodSpeed({actor: bare}), [{type: "walk", value: 40, units: "ft"}]);
  assert.equal(dolmenwoodHp({actor: {system: {}}}), null);
  assert.equal(dolmenwoodSpeed({actor: {system: {speed: 0}}}), null);
  assert.deepEqual(PRESETS.dolmenwood.objectTypes, ["Vehicle"]);
});

test("rqg: hit points, magic points, hero points and the movement with load", () => {
  const actor = {type: "character", system: {attributes: {hitPoints: {value: 12, max: 14}, magicPoints: {value: 9, max: 13},
    heroPoints: 1, move: {currentLocomotion: "walk", walk: {value: 8, carryingFactor: 1}, value: 8, equipped: 6, travel: 8}}}};
  assert.deepEqual(read("rqg", "hp", actor), {value: 12, max: 14});
  assert.deepEqual(read("rqg", "mp", actor), {value: 9, max: 13});
  assert.equal(read("rqg", "heroPoints", actor), 1);
  assert.equal(read("rqg", "move", actor), 6);
  delete actor.system.attributes.move.equipped;
  assert.equal(read("rqg", "move", actor), 8);
});

test("each new preset has a health source whose field exists, floating numbers only where the system floats none", () => {
  const ids = ["daggerheart", "CoC7", "shadowdark", "projectfu", "shadowrun6-eden", "dolmenwood", "rqg"];
  for ( const id of ids ) {
    const source = floaters.sourceFor(id);
    assert.ok(PRESETS[id].fields.some(f => f.id === source.field), id);
  }
  // Shadowdark floats the plain signed change, the others that float something are left alone
  assert.equal(SOURCES.shadowdark.own, "plain");
  assert.equal(floaters.replacesOwn("replace", SOURCES.shadowdark), true);
  for ( const id of ["daggerheart", "projectfu"] ) {
    assert.equal(floaters.drawsOwn("missing", SOURCES[id]), false);
    assert.equal(floaters.replacesOwn("replace", SOURCES[id]), false);
  }
  for ( const id of ["CoC7", "shadowrun6-eden", "dolmenwood", "rqg"] ) assert.equal(floaters.drawsOwn("missing", SOURCES[id]), true);
  assert.equal(SOURCES.daggerheart.worse, "up");
});

test("every field of the new presets reads without error from an empty actor", () => {
  for ( const id of ["daggerheart", "CoC7", "shadowdark", "projectfu", "shadowrun6-eden", "dolmenwood", "rqg"] ) {
    for ( const f of PRESETS[id].fields ) {
      if ( f.type === "name" ) continue;
      assert.doesNotThrow(() => read(id, f.id, {system: {}}, {}), `${id}.${f.id}`);
    }
  }
});

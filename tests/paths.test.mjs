import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";
import {customDefinition, fieldsFor, sanitizeCustom} from "../scripts/fields.mjs";
import {entryLabel, flattenPaths, formatOf, groupEntries, isResource, normalizePath, previewValue, searchEntries,
  shortlistFor, suggestLabel, takenPaths, topGroup} from "../scripts/paths.mjs";
import {CUSTOM_FORMATS, PRESETS, nameKeys} from "../scripts/presets.mjs";
import {GROUPS, SHORTLISTS, choicesFor, shortlistOf} from "../scripts/shortlists.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const en = JSON.parse(await readFile(path.join(root, "lang/en.json"), "utf8"));
const get = (obj, key) => key.split(".").reduce((o, k) => o?.[k], obj);

test("the full list: leaves as paths, resources as one entry, lists not followed", () => {
  const data = {
    attributes: {hp: {value: 7, max: 12, temp: 0, bonuses: {level: ""}}, ac: {value: 15}, inspiration: true},
    traits: {dr: {value: new Set(["fire"])}, tags: ["a", "b"]},
    details: {alignment: null, cr: 0.25},
    _hidden: 1,
    method() {}
  };
  const list = flattenPaths(data);
  const byPath = Object.fromEntries(list.map(e => [e.path, e]));
  assert.equal(byPath["system.attributes.hp"].format, "resource");
  assert.ok(!byPath["system.attributes.hp.value"] && !byPath["system.attributes.hp.max"], "value and max fold into the resource");
  assert.equal(byPath["system.attributes.hp.temp"].format, "number");
  assert.equal(byPath["system.attributes.hp.bonuses.level"].format, "text");
  assert.equal(byPath["system.attributes.ac.value"].value, 15);
  assert.equal(byPath["system.attributes.inspiration"].format, "text");
  assert.equal(byPath["system.traits.dr.value"].format, "list");
  assert.equal(byPath["system.traits.tags"].format, "list");
  assert.ok(!Object.keys(byPath).some(p => p.startsWith("system.traits.tags.")), "arrays are not followed");
  assert.equal(byPath["system.details.alignment"].value, null);
  assert.ok(!byPath["system._hidden"] && !byPath["system.method"]);
});

test("the full list leaves out documents, maps and loops, and stops at its depth and limit", () => {
  const actor = {documentName: "Actor", uuid: "Actor.x", name: "Back reference"};
  class HitDice {
    constructor() {
      this.actor = actor;
      this.classes = new Set();
    }
    get value() { return 3; }
    get max() { return 5; }
  }
  const data = {hd: new HitDice(), items: new Map([["a", 1]]), deep: {a: {b: {c: {d: 1}}}}};
  data.self = data;
  const list = flattenPaths(data, {depth: 3});
  const paths = list.map(e => e.path);
  assert.ok(paths.includes("system.hd"), "a resource with getters counts");
  assert.ok(!paths.some(p => p.startsWith("system.hd.actor")), "no document");
  assert.ok(!paths.includes("system.items"), "no map");
  assert.ok(!paths.some(p => p.startsWith("system.self")), "no loop");
  assert.ok(!paths.includes("system.deep.a.b.c.d"), "depth");
  assert.equal(flattenPaths({a: 1, b: 2, c: 3}, {limit: 2}).length, 2);
  // A shim of an old place (dnd5e senses.darkvision) is a getter of the object itself and stays out unread
  const senses = {ranges: {darkvision: 60}, units: "ft"};
  let warned = false;
  Object.defineProperty(senses, "darkvision", {get() { warned = true; return this.ranges.darkvision; }, enumerable: true});
  const sensePaths = flattenPaths({senses}).map(e => e.path);
  assert.ok(sensePaths.includes("system.senses.ranges.darkvision") && !sensePaths.includes("system.senses.darkvision"));
  assert.equal(warned, false);
  assert.deepEqual(flattenPaths(null), []);
});

test("resources need a number value and maximum, formats follow the value", () => {
  assert.equal(isResource({value: 1, max: 3}), true);
  assert.equal(isResource({value: "1", max: 3}), false);
  assert.equal(isResource({value: 1}), false);
  assert.equal(isResource([1, 2]), false);
  assert.equal(formatOf(4), "number");
  assert.equal(formatOf("x"), "text");
  assert.equal(formatOf(true), "text");
  assert.equal(formatOf(new Set()), "list");
  assert.equal(formatOf({value: 1, max: 2}), "resource");
});

test("labels made from paths", () => {
  assert.equal(suggestLabel("system.currency.gp"), "GP");
  assert.equal(suggestLabel("system.skills.ste.passive"), "STE passive");
  assert.equal(suggestLabel("system.attributes.senses.darkvision"), "Darkvision");
  assert.equal(suggestLabel("system.bennies.value"), "Bennies");
  assert.equal(suggestLabel("system.details.xp.value"), "XP");
  assert.equal(suggestLabel("actor.system.resources.heroPoints"), "Hero points");
  assert.equal(suggestLabel("token.elevation"), "Elevation");
  assert.equal(suggestLabel(""), "");
});

test("labels of shortlist entries: the first known key, keys in the data, else a label from the path", () => {
  const texts = {"SYS.New": "New text", "STT.Path.modifier": "{name} modifier", "SYS.Str": "Strength"};
  const i18n = {has: key => key in texts, t: (key, data) => texts[key].replace(/\{(\w+)\}/g, (m, k) => data?.[k] ?? m)};
  assert.equal(entryLabel({path: "system.a", label: ["SYS.Old", "SYS.New"]}, i18n), "New text");
  assert.equal(entryLabel({path: "system.a", label: "SYS.New"}, i18n), "New text");
  assert.equal(entryLabel({path: "system.abilities.str.mod", label: {key: "STT.Path.modifier", data: {name: "SYS.Str"}}}, i18n),
    "Strength modifier");
  assert.equal(entryLabel({path: "system.currency.gp", label: "SYS.Gone"}, i18n), "GP");
});

test("short value texts for the lists", () => {
  assert.equal(previewValue(12), "12");
  assert.equal(previewValue(null), "");
  assert.equal(previewValue(new Set(["fire", "cold"])), "fire, cold");
  assert.equal(previewValue([{label: "Darkvision"}, {name: "Scent"}]), "Darkvision, Scent");
  assert.equal(previewValue({value: 3, max: 8}), "3 / 8");
  assert.equal(previewValue("<p>Long   text</p>"), "Long text");
  assert.equal(previewValue("x".repeat(80), 10).length, 10);
});

test("search: every word in the path, label or value, any case", () => {
  const entries = [{path: "system.currency.gp", label: "Gold", text: "15"},
    {path: "system.attributes.senses.darkvision", label: "Darkvision", text: "60"},
    {path: "system.traits.dr.value", label: "Damage Resistances", text: "fire"}];
  assert.deepEqual(searchEntries(entries, "gold").map(e => e.label), ["Gold"]);
  assert.deepEqual(searchEntries(entries, "SENSES 60").map(e => e.label), ["Darkvision"]);
  assert.deepEqual(searchEntries(entries, "fire").map(e => e.label), ["Damage Resistances"]);
  assert.deepEqual(searchEntries(entries, "gold fire"), []);
  assert.equal(searchEntries(entries, "  ").length, 3);
});

test("groups in their order, others after them", () => {
  const groups = groupEntries([{g: "traits"}, {g: "often"}, {g: "zzz"}, {g: "often"}], e => e.g);
  assert.deepEqual(groups.map(g => [g.group, g.entries.length]), [["often", 2], ["traits", 1], ["zzz", 1]]);
  assert.equal(topGroup("system.attributes.hp"), "attributes");
  assert.equal(topGroup("actor.system.currency.gp"), "currency");
});

test("paths are compared without actor. and the shortlist leaves out what already is a field", () => {
  assert.equal(normalizePath(" actor.system.currency.gp "), "system.currency.gp");
  const fields = fieldsFor("dnd5e", {dnd5e: {custom: [{id: "custom-gold01", label: "Gold", path: "system.currency.gp",
    format: "number"}]}});
  const taken = takenPaths(fields);
  assert.ok(taken.has("system.currency.gp") && taken.has("system.skills.ins.passive"));
  const list = shortlistFor("dnd5e", fields).map(e => e.path);
  assert.ok(!list.includes("system.currency.gp"));
  assert.ok(list.includes("system.currency.sp"));
  assert.equal(shortlistFor("dnd5e", []).length, shortlistOf("dnd5e").length);
  assert.deepEqual(shortlistFor("worldbuilding", []), []);
});

test("every shortlist: clean paths, known formats and groups, own texts that exist, nothing a preset field shows", () => {
  for ( const [id, list] of Object.entries(SHORTLISTS) ) {
    const paths = list.map(e => e.path);
    assert.equal(new Set(paths).size, paths.length, `${id}: a path twice`);
    if ( list.length ) assert.equal(list[0].group, "often", `${id}: the list starts with the values often needed in play`);
    const preset = new Set((PRESETS[id]?.fields ?? []).map(f => f.path).filter(Boolean));
    for ( const entry of list ) {
      const name = `${id} ${entry.path}`;
      assert.ok(sanitizeCustom({id: "custom-x1", label: "X", path: entry.path, format: entry.format}), name);
      assert.ok(CUSTOM_FORMATS.includes(entry.format), name);
      assert.ok(GROUPS.includes(entry.group), name);
      assert.ok(!preset.has(entry.path), `${name} is a preset field`);
      const specs = [entry.label].flat().map(l => (typeof l === "object" ? l.key : l));
      for ( const key of specs.filter(k => k.startsWith("STT.")) ) assert.equal(typeof get(en, key), "string", key);
    }
  }
});

test("own fields on a path the shortlist knows name their keys like the system", () => {
  assert.equal(choicesFor("dnd5e", "system.traits.dr.value"), "CONFIG.DND5E.damageTypes");
  assert.equal(choicesFor("dnd5e", "actor.system.traits.size"), "CONFIG.DND5E.actorSizes");
  assert.equal(choicesFor("dnd5e", "system.currency.gp"), null);
  assert.equal(choicesFor("generic", "system.traits.dr.value"), null);
  const names = {fire: "Fire", cold: "Cold"};
  const env = {choiceName: (source, key) => (source === "CONFIG.DND5E.damageTypes" ? (names[key] ?? key) : key)};
  const field = customDefinition({id: "custom-res001", label: "Res", path: "system.traits.dr.value", format: "list"}, "dnd5e");
  assert.deepEqual(field.read({actor: {system: {traits: {dr: {value: new Set(["fire", "acid"])}}}}, token: {}, env}),
    ["Fire", "acid"]);
  // Without the preset the keys stay
  const plain = customDefinition({id: "custom-res001", label: "Res", path: "system.traits.dr.value", format: "list"});
  assert.deepEqual([...plain.read({actor: {system: {traits: {dr: {value: new Set(["fire"])}}}}, token: {}, env})], ["fire"]);
  assert.equal(nameKeys("med", key => key.toUpperCase()), "MED");
  assert.equal(nameKeys(5, key => key), 5);
});

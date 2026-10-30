import assert from "node:assert/strict";
import test from "node:test";
import {FALLBACK, activeFields, fieldsFor, moveField, newCustomId, normalizeConfig, sanitizeCustom, storedFor, toStored}
  from "../scripts/fields.mjs";

test("a configuration keeps valid values and falls back for the rest", () => {
  const defaults = {enabled: true, audience: "everyone", display: "both",
    forms: {friendly: "exact", neutral: "descriptive", hostile: "descriptive", secret: "hidden"}};
  // Defaults without a party form (another module's field) show the party like friendly tokens
  assert.deepEqual(normalizeConfig(undefined, defaults), {...defaults, forms: {party: "exact", ...defaults.forms}});
  const config = normalizeConfig({enabled: false, audience: "nobody", display: "bar", forms: {hostile: "exact", secret: "x"}},
    defaults);
  assert.deepEqual(config, {enabled: false, audience: "everyone", display: "bar",
    forms: {party: "exact", friendly: "exact", neutral: "descriptive", hostile: "exact", secret: "hidden"}});
  assert.deepEqual(normalizeConfig({}), FALLBACK);
});

test("the party form is stored on its own and falls back to the field's default", () => {
  const defaults = {enabled: true, audience: "everyone", display: "both",
    forms: {party: "exact", friendly: "hidden", neutral: "hidden", hostile: "hidden", secret: "hidden"}};
  assert.equal(normalizeConfig({forms: {party: "descriptive"}}, defaults).forms.party, "descriptive");
  assert.equal(normalizeConfig({forms: {party: "nonsense"}}, defaults).forms.party, "exact");
  // A configuration stored before the party form existed keeps the field's party default
  assert.equal(normalizeConfig({forms: {friendly: "hidden"}}, defaults).forms.party, "exact");
});

test("custom fields need an id, a label and a clean path", () => {
  assert.deepEqual(sanitizeCustom({id: "custom-abc123", label: " Mana ", path: "system.mana", format: "resource"}),
    {id: "custom-abc123", label: "Mana", path: "system.mana", format: "resource"});
  assert.equal(sanitizeCustom({id: "custom-abc123", label: "", path: "system.mana"}), null);
  assert.equal(sanitizeCustom({id: "custom-abc123", label: "X", path: "system.mana; alert(1)"}), null);
  assert.equal(sanitizeCustom({id: "hp", label: "X", path: "system.hp"}), null);
  assert.equal(sanitizeCustom({id: "custom-a1", label: "X", path: "a.b", format: "weird"}).format, "text");
  assert.equal(sanitizeCustom({id: "custom-a1", label: "x".repeat(60), path: "a"}).label.length, 40);
});

test("new custom ids never repeat a taken one", () => {
  let n = 0;
  const random = () => [0.1, 0.1, 0.2][n++];
  const first = newCustomId([], () => 0.1);
  assert.match(first, /^custom-[a-z0-9]{6}$/);
  assert.notEqual(newCustomId([first], random), first);
});

test("the field list follows the stored order, adds new fields at the end and keeps the defaults", () => {
  const stored = {dnd5e: {order: ["ac", "hp", "gone"], fields: {hp: {audience: "owner"}},
    custom: [{id: "custom-mana01", label: "Mana", path: "system.mana", format: "resource"}]}};
  const extra = [{id: "ext", type: "text", label: "Ext", systems: ["dnd5e"], read: () => "x", defaults: FALLBACK},
    {id: "pf", type: "text", label: "PF", systems: ["pf2e"], read: () => "x", defaults: FALLBACK}];
  const fields = fieldsFor("dnd5e", stored, extra);
  const ids = fields.map(f => f.id);
  assert.deepEqual(ids.slice(0, 2), ["ac", "hp"]);
  assert.ok(ids.includes("ext") && ids.includes("custom-mana01") && !ids.includes("pf") && !ids.includes("gone"));
  assert.equal(fields.find(f => f.id === "hp").config.audience, "owner");
  assert.equal(fields.find(f => f.id === "speed").config.audience, "everyone");
  const mana = fields.find(f => f.id === "custom-mana01");
  assert.equal(mana.type, "resource");
  assert.deepEqual(mana.read({actor: {system: {mana: {value: 1, max: 4}}}, token: {}}), {value: 1, max: 4});
});

test("systems without a preset store under the generic preset", () => {
  const fields = fieldsFor("worldbuilding", {generic: {order: ["bar2", "bar1"]}});
  assert.deepEqual(fields.slice(0, 2).map(f => f.id), ["bar2", "bar1"]);
});

test("active fields: switched on and meant for the actor's type", () => {
  const fields = fieldsFor("dnd5e", {dnd5e: {fields: {ac: {enabled: false}}}});
  const npc = activeFields(fields, "npc").map(f => f.id);
  const pc = activeFields(fields, "character").map(f => f.id);
  assert.ok(!npc.includes("ac") && npc.includes("cr") && !npc.includes("level"));
  assert.ok(pc.includes("level") && !pc.includes("cr"));
});

test("storing and reading again gives the same list", () => {
  const stored = {dnd5e: {order: ["hp", "name"], fields: {hp: {display: "number"}},
    custom: [{id: "custom-gold01", label: "Gold", path: "system.currency.gp", format: "number"}]}};
  const fields = fieldsFor("dnd5e", stored);
  const again = fieldsFor("dnd5e", {dnd5e: toStored(fields)});
  assert.deepEqual(again.map(f => [f.id, f.config]), fields.map(f => [f.id, f.config]));
  assert.deepEqual(storedFor({dnd5e: toStored(fields)}, "dnd5e").custom,
    [{id: "custom-gold01", label: "Gold", path: "system.currency.gp", format: "number"}]);
});

test("moving a field one step, not past the ends", () => {
  assert.deepEqual(moveField(["a", "b", "c"], "b", -1), ["b", "a", "c"]);
  assert.deepEqual(moveField(["a", "b", "c"], "b", 1), ["a", "c", "b"]);
  assert.deepEqual(moveField(["a", "b", "c"], "a", -1), ["a", "b", "c"]);
  assert.deepEqual(moveField(["a", "b", "c"], "x", 1), ["a", "b", "c"]);
});

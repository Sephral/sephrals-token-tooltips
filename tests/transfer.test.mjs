import assert from "node:assert/strict";
import test from "node:test";
import {fieldsFor, toStored} from "../scripts/fields.mjs";
import {FILE_FORMAT, buildExport, configChanges, diffFields, exportName, parseImport, planImport}
  from "../scripts/transfer.mjs";

const custom = (id, label = "Gold", path = "system.currency.gp") => ({id, label, path, format: "number"});
const world = stored => fieldsFor("dnd5e", {dnd5e: stored});
const exported = fields => JSON.parse(JSON.stringify(buildExport({presetId: "dnd5e", systemId: "dnd5e", moduleVersion: "1.0.4",
  fields, now: new Date("2026-11-20T10:00:00Z")})));

test("the export holds the field set with its own fields, and a file name with the day", () => {
  const fields = world({order: ["hp", "name", "custom-gold01"], fields: {hp: {audience: "gm"}}, custom: [custom("custom-gold01")]});
  const data = exported(fields);
  assert.equal(data.module, "sephrals-token-tooltips");
  assert.equal(data.kind, "fields");
  assert.equal(data.format, FILE_FORMAT);
  assert.equal(data.preset, "dnd5e");
  assert.equal(data.exported, "2026-11-20T10:00:00.000Z");
  assert.equal(data.fields.hp.audience, "gm");
  assert.deepEqual(data.custom, [custom("custom-gold01")]);
  assert.deepEqual(data.order.slice(0, 3), ["hp", "name", "custom-gold01"]);
  assert.equal(exportName("shadowrun6-eden", new Date("2026-11-20T10:00:00Z")), "token-tooltips-shadowrun6-eden-2026-11-20.json");
});

test("a file that is not ours, not JSON, from a newer layout or empty is refused with a reason", () => {
  assert.equal(parseImport("{nope").reason, "json");
  assert.equal(parseImport("[]").reason, "module");
  assert.equal(parseImport(JSON.stringify({module: "other", kind: "fields"})).reason, "module");
  assert.equal(parseImport(JSON.stringify({module: "sephrals-token-tooltips", kind: "fields", format: 99, fields: {a: {}}})).reason, "format");
  assert.equal(parseImport(JSON.stringify({module: "sephrals-token-tooltips", kind: "fields", format: 1, fields: {}})).reason, "empty");
  assert.equal(parseImport(JSON.stringify({module: "sephrals-token-tooltips", kind: "fields", format: 1})).reason, "empty");
});

test("a good file is read back, unusable own fields are dropped and counted", () => {
  const data = exported(world({custom: [custom("custom-gold01")]}));
  data.custom.push({id: "hp", label: "Bad", path: "system.x"}, {id: "custom-bad", label: "", path: "a"});
  const parsed = parseImport(JSON.stringify(data));
  assert.equal(parsed.ok, true);
  assert.equal(parsed.preset, "dnd5e");
  assert.deepEqual(parsed.custom, [custom("custom-gold01")]);
  assert.equal(parsed.dropped, 2);
});

test("a round trip changes nothing", () => {
  const current = world({order: ["hp", "name"], fields: {hp: {audience: "owner"}, ac: {enabled: false}}, custom: [custom("custom-gold01")]});
  const parsed = parseImport(JSON.stringify(exported(current)));
  for ( const mode of ["merge", "replace"] ) {
    const plan = planImport({systemId: "dnd5e", presetId: "dnd5e", current, imported: parsed, mode});
    assert.deepEqual(plan.changes, [], mode);
    assert.deepEqual(toStored(plan.fields), toStored(current), mode);
    assert.deepEqual(plan.unknown, []);
  }
});

test("merge keeps what the file does not mention, replace takes the file as it is", () => {
  const source = world({order: ["name", "hp", "custom-gold01"], fields: {hp: {audience: "gm"}, speed: {enabled: false}},
    custom: [custom("custom-gold01")]});
  const parsed = parseImport(JSON.stringify(exported(source)));
  // The window: ac switched off, an own field of its own
  const current = world({fields: {ac: {enabled: false}, hp: {audience: "owner"}}, custom: [custom("custom-mine01", "Mine", "system.mine")]});

  const merge = planImport({systemId: "dnd5e", presetId: "dnd5e", current, imported: parsed, mode: "merge"});
  const merged = Object.fromEntries(merge.fields.map(f => [f.id, f]));
  assert.equal(merged.hp.config.audience, "gm");
  assert.equal(merged.speed.config.enabled, false);
  assert.ok(merged["custom-gold01"] && merged["custom-mine01"]);
  assert.deepEqual(merge.fields.map(f => f.id).slice(0, 2), ["name", "hp"]);
  const kinds = merge.changes.map(c => `${c.kind}:${c.id ?? ""}`);
  assert.ok(kinds.includes("changed:hp") && kinds.includes("changed:speed") && kinds.includes("added:custom-gold01"));
  assert.ok(!kinds.some(k => k.startsWith("removed")));

  // The file knows ac as on (its default): merge takes the file's value for it too
  assert.equal(merged.ac.config.enabled, true);

  const replace = planImport({systemId: "dnd5e", presetId: "dnd5e", current, imported: parsed, mode: "replace"});
  const replaced = Object.fromEntries(replace.fields.map(f => [f.id, f]));
  assert.ok(replaced["custom-gold01"]);
  assert.ok(!replaced["custom-mine01"]);
  assert.ok(replace.changes.some(c => (c.kind === "removed") && (c.id === "custom-mine01")));
  assert.equal(replaced.hp.config.audience, "gm");
});

test("merge: a field the file does not mention keeps the window's setting", () => {
  const parsed = parseImport(JSON.stringify({module: "sephrals-token-tooltips", kind: "fields", format: 1, preset: "dnd5e",
    order: ["hp"], fields: {hp: {audience: "gm"}}, custom: []}));
  const current = world({fields: {ac: {enabled: false}}});
  const merge = planImport({systemId: "dnd5e", presetId: "dnd5e", current, imported: parsed, mode: "merge"});
  assert.equal(merge.fields.find(f => f.id === "ac").config.enabled, false);
  assert.equal(merge.fields[0].id, "hp");
  const replace = planImport({systemId: "dnd5e", presetId: "dnd5e", current, imported: parsed, mode: "replace"});
  assert.equal(replace.fields.find(f => f.id === "ac").config.enabled, true);
  assert.deepEqual(merge.changes.filter(c => c.kind === "changed").map(c => c.id), ["hp"]);
});

test("merge gives an own field with a taken id but another meaning an id of its own", () => {
  const current = world({custom: [custom("custom-same01", "Mine", "system.mine")]});
  const parsed = parseImport(JSON.stringify({module: "sephrals-token-tooltips", kind: "fields", format: 1, preset: "dnd5e",
    order: ["custom-same01"], fields: {"custom-same01": {audience: "everyone"}}, custom: [custom("custom-same01", "Gold")]}));
  const merge = planImport({systemId: "dnd5e", presetId: "dnd5e", current, imported: parsed, mode: "merge",
    random: () => 0.5});
  const list = merge.fields.filter(f => f.custom);
  assert.equal(list.length, 2);
  assert.deepEqual(list.map(f => f.label).sort(), ["Gold", "Mine"]);
  const gold = list.find(f => f.label === "Gold");
  assert.notEqual(gold.id, "custom-same01");
  assert.equal(gold.config.audience, "everyone");
  assert.equal(list.find(f => f.label === "Mine").config.audience, "owner");
});

test("fields of the file that this system does not have are counted and skipped", () => {
  const parsed = parseImport(JSON.stringify({module: "sephrals-token-tooltips", kind: "fields", format: 1, preset: "pf2e",
    order: ["hp", "heroPoints", "bogus"], fields: {hp: {audience: "gm"}, bogus: {enabled: false}, classDc: {enabled: true}}, custom: []}));
  const plan = planImport({systemId: "dnd5e", presetId: "dnd5e", current: world({}), imported: parsed, mode: "merge"});
  assert.deepEqual(plan.unknown, ["bogus", "classDc"]);
  assert.ok(!plan.fields.some(f => f.id === "bogus"));
});

test("changes name what differs: show, audience, look and the forms only where they count", () => {
  const [hp] = world({}).filter(f => f.id === "hp");
  const other = (patch, audience) => ({...hp, config: {...hp.config, ...patch, audience: audience ?? hp.config.audience,
    forms: {...hp.config.forms, ...patch.forms}}});
  assert.deepEqual(configChanges(hp, other({enabled: false})), ["enabled"]);
  assert.deepEqual(configChanges(hp, other({display: "bar"})), ["display"]);
  assert.deepEqual(configChanges(hp, other({forms: {hostile: "hidden"}})), ["forms.hostile"]);
  // Narrowed to the GM, the forms are no longer used
  assert.deepEqual(configChanges(hp, other({forms: {hostile: "hidden"}}, "gm")), ["audience", "forms.hostile"]);
  const gmBoth = {...hp, config: {...hp.config, audience: "gm"}};
  assert.deepEqual(configChanges(gmBoth, other({forms: {hostile: "hidden"}}, "gm")), []);
  assert.deepEqual(diffFields([hp], [hp]), []);
});

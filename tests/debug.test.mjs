import assert from "node:assert/strict";
import test from "node:test";

// The parts of Foundry the registration and the state touch
const menus = new Map();
const hooks = [];
const values = {fieldConfig: {dnd5e: {order: ["hp", "name"], fields: {hp: {audience: "owner"}},
  custom: [{id: "custom-mana01", label: "Mana", path: "system.mana", format: "resource"}]}}};
globalThis.Hooks = {on: name => hooks.push(name), callAll: () => {}};
globalThis.foundry = {applications: {api: {ApplicationV2: class {}}}};
globalThis.document = {createElement: () => ({})};
globalThis.game = {
  user: {id: "gm", isGM: true},
  system: {id: "dnd5e"},
  modules: new Map(),
  i18n: {localize: key => key, format: (key, data) => `${key} ${JSON.stringify(data)}`},
  settings: {
    registerMenu: (module, key, data) => menus.set(`${module}.${key}`, data),
    get: (module, key) => structuredClone(values[key])
  }
};

const {MODULE_ID} = await import("../scripts/config.mjs");
const {describeState, registerDebug} = await import("../scripts/debug.mjs");
const {registerField} = await import("../scripts/registry.mjs");

test("the debug file button and the module's part are registered, without the raw field setting", () => {
  registerDebug();
  const menu = menus.get(`${MODULE_ID}.debugFile`);
  assert.equal(menu.label, "STT.DEBUG.Save");
  assert.equal(menu.restricted, true);
  const provider = globalThis.sephralsDebugFiles.providers.get(MODULE_ID);
  assert.equal(provider.label(), "STT.DEBUG.Entry");
  assert.deepEqual(provider.omitSettings, ["fieldConfig"]);
  assert.equal(provider.message, undefined);
  assert.deepEqual(hooks, ["getChatMessageContextOptions"]);
});

test("the state names the preset, the configured fields and registered ones, no token values", () => {
  registerField({id: "aura", label: "Aura", type: "text", read: () => "glow", systems: ["dnd5e"]});
  const state = describeState();
  assert.equal(state.preset, "dnd5e");
  assert.deepEqual(state.fields.slice(0, 2).map(f => f.id), ["hp", "name"]);
  assert.equal(state.fields.find(f => f.id === "hp").audience, "owner");
  assert.equal(state.fields.find(f => f.id === "custom-mana01").path, "system.mana");
  assert.ok(state.fields.some(f => (f.id === "aura") && f.external));
  assert.deepEqual(state.registered, [{id: "aura", type: "text", systems: ["dnd5e"]}]);
  assert.deepEqual(Object.keys(state.overlay), ["hovered", "shownAll", "pressed", "layer"]);
});

test("registered fields need a clean, unused id and something to read", () => {
  assert.throws(() => registerField({id: "aura", label: "Again", read: () => 1}), /exists already/);
  assert.throws(() => registerField({id: "hp", label: "HP", read: () => 1}), /exists already/);
  assert.throws(() => registerField({id: "bad id", label: "X", read: () => 1}), /id/);
  assert.throws(() => registerField({id: "nothing", label: "X"}), /read function or a path/);
  const field = registerField({id: "gold", label: "Gold", type: "weird", path: "system.currency.gp"});
  assert.equal(field.type, "text");
  assert.equal(field.config, undefined);
  const called = registerField({id: "mood", label: "Mood", read: (actor, token) => `${actor.name}/${token.name}`});
  assert.equal(called.read({actor: {name: "A"}, token: {name: "T"}}), "A/T");
});

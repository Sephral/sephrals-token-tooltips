import assert from "node:assert/strict";
import test from "node:test";
import {dispositionKey, isObjectPile, nameVisible, resolveForm, seesAsOwner, tooltipAllowed} from "../scripts/visibility.mjs";

const HEALTH = {audience: "everyone", forms: {friendly: "exact", neutral: "descriptive", hostile: "descriptive", secret: "hidden"}};
const gm = {isGM: true, isOwner: true, disposition: -1};
const owner = {isGM: false, isOwner: true, disposition: -1};
const other = d => ({isGM: false, isOwner: false, disposition: d});

test("disposition numbers map to their keys", () => {
  assert.equal(dispositionKey(1), "friendly");
  assert.equal(dispositionKey(0), "neutral");
  assert.equal(dispositionKey(-1), "hostile");
  assert.equal(dispositionKey(-2), "secret");
  assert.equal(dispositionKey(7), "neutral");
});

test("the GM always sees the exact value, even of a GM only field", () => {
  assert.equal(resolveForm({audience: "gm"}, gm), "exact");
  assert.equal(resolveForm(HEALTH, gm, {describable: true}), "exact");
});

test("owners see fields for owners and everyone exactly, GM only fields not at all", () => {
  assert.equal(resolveForm({audience: "gm"}, owner), null);
  assert.equal(resolveForm({audience: "owner"}, owner), "exact");
  assert.equal(resolveForm(HEALTH, owner, {describable: true}), "exact");
});

test("observers see a token like its owners, limited permission like everyone else", () => {
  const LEVELS = {INHERIT: -1, NONE: 0, LIMITED: 1, OBSERVER: 2, OWNER: 3};
  assert.equal(seesAsOwner(LEVELS.OWNER, LEVELS), true);
  assert.equal(seesAsOwner(LEVELS.OBSERVER, LEVELS), true);
  assert.equal(seesAsOwner(LEVELS.LIMITED, LEVELS), false);
  assert.equal(seesAsOwner(LEVELS.NONE, LEVELS), false);
  assert.equal(seesAsOwner(LEVELS.INHERIT, LEVELS), false);
  assert.equal(seesAsOwner(undefined, LEVELS), false);
  // An observer of a hostile token: exact HP and the fields for owners (AC), its name whatever the token's display
  const observer = {isGM: false, isOwner: seesAsOwner(LEVELS.OBSERVER, LEVELS), disposition: -1};
  const limited = {isGM: false, isOwner: seesAsOwner(LEVELS.LIMITED, LEVELS), disposition: -1};
  assert.equal(resolveForm(HEALTH, observer, {describable: true}), "exact");
  assert.equal(resolveForm({audience: "owner"}, observer), "exact");
  assert.equal(resolveForm({audience: "gm"}, observer), null);
  assert.equal(nameVisible({displayName: 0, ...observer}, {NONE: 0, HOVER: 30, ALWAYS: 50}), true);
  assert.equal(resolveForm(HEALTH, limited, {describable: true}), "descriptive");
  assert.equal(resolveForm({audience: "owner"}, limited), null);
});

test("everyone else follows the form of the token's disposition", () => {
  assert.equal(resolveForm({audience: "owner"}, other(1)), null);
  assert.equal(resolveForm(HEALTH, other(1), {describable: true}), "exact");
  assert.equal(resolveForm(HEALTH, other(0), {describable: true}), "descriptive");
  assert.equal(resolveForm(HEALTH, other(-1), {describable: true}), "descriptive");
  assert.equal(resolveForm(HEALTH, other(-2), {describable: true}), null);
});

test("tokens of player characters use the party form for the other players, whatever their disposition", () => {
  const forms = {audience: "everyone", forms: {...HEALTH.forms, party: "descriptive"}};
  const party = d => ({...other(d), party: true});
  assert.equal(resolveForm(forms, party(1), {describable: true}), "descriptive");
  assert.equal(resolveForm(forms, party(-1), {describable: true}), "descriptive");
  assert.equal(resolveForm({...forms, forms: {...forms.forms, party: "hidden"}}, party(1), {describable: true}), null);
  assert.equal(resolveForm({...forms, forms: {...forms.forms, party: "exact"}}, party(0), {describable: true}), "exact");
  // Owners, observers and the GM of a party member still see it exactly; a field for owners stays theirs
  assert.equal(resolveForm(forms, {...owner, party: true}, {describable: true}), "exact");
  assert.equal(resolveForm(forms, {...gm, party: true}, {describable: true}), "exact");
  assert.equal(resolveForm({audience: "owner", forms: forms.forms}, party(1)), null);
  // Friendly NPCs keep the friendly form
  assert.equal(resolveForm(forms, other(1), {describable: true}), "exact");
});

test("a description of a field without one shows nothing instead of the number", () => {
  assert.equal(resolveForm(HEALTH, other(-1), {describable: false}), null);
});

test("unknown audiences count as GM only", () => {
  assert.equal(resolveForm({audience: "players"}, other(1)), null);
  assert.equal(resolveForm(undefined, other(1)), null);
});

test("names follow the token's own name display for everyone else", () => {
  const modes = {NONE: 0, CONTROL: 10, OWNER_HOVER: 20, HOVER: 30, OWNER: 40, ALWAYS: 50};
  assert.equal(nameVisible({displayName: 0, isOwner: false, isGM: true}, modes), true);
  assert.equal(nameVisible({displayName: 0, isOwner: true, isGM: false}, modes), true);
  assert.equal(nameVisible({displayName: 20, isOwner: false, isGM: false}, modes), false);
  assert.equal(nameVisible({displayName: 30, isOwner: false, isGM: false}, modes), true);
  assert.equal(nameVisible({displayName: 40, isOwner: false, isGM: false}, modes), false);
  assert.equal(nameVisible({displayName: 50, isOwner: false, isGM: false}, modes), true);
});

test("hidden tokens only for the GM, invisible tokens for nobody", () => {
  assert.equal(tooltipAllowed({hidden: true, isGM: true, visible: true}), true);
  assert.equal(tooltipAllowed({hidden: true, isGM: false, visible: true}), false);
  assert.equal(tooltipAllowed({hidden: false, isGM: false, visible: false}), false);
  assert.equal(tooltipAllowed({hidden: false, isGM: true, visible: false}), false);
  assert.equal(tooltipAllowed({hidden: false, isGM: false, visible: true}), true);
});

test("heaps, chests and vaults of Item Piles get no tooltip, merchants and ordinary actors do", () => {
  assert.equal(isObjectPile({enabled: true, type: "pile"}), true);
  assert.equal(isObjectPile({enabled: true}), true);
  assert.equal(isObjectPile({enabled: true, type: "container"}), true);
  assert.equal(isObjectPile({enabled: true, type: "vault"}), true);
  assert.equal(isObjectPile({enabled: true, type: "merchant"}), false);
  assert.equal(isObjectPile({enabled: false, type: "pile"}), false);
  assert.equal(isObjectPile(undefined), false);
});

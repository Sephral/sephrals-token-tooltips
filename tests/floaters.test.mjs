import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {__test__} from "../scripts/floaters.mjs";
import {resolveForm} from "../scripts/visibility.mjs";
import {PRESETS} from "../scripts/presets.mjs";

const {SOURCES, parseOwnText, stateOf, changeOf, changeWord, floaterFor, drawsOwn, replacesOwn, sourceFor, QUIET_KEYS} = __test__;
const word = key => `<${key}>`;
const lang = name => JSON.parse(readFileSync(new URL(`../lang/${name}.json`, import.meta.url), "utf8"));

test("every preset has a health source whose field exists in the preset", () => {
  for ( const [id, preset] of Object.entries(PRESETS) ) {
    const source = sourceFor(id);
    assert.ok(preset.fields.some(f => f.id === source.field), `${id}: ${source.field}`);
  }
  assert.equal(sourceFor("unknown-system"), SOURCES.generic);
});

test("the system's own numbers are read as amounts", () => {
  assert.deepEqual(parseOwnText("−12", "plain"), {amount: -12});
  assert.deepEqual(parseOwnText("+5", "plain"), {amount: 5});
  assert.deepEqual(parseOwnText("-3", "plain"), {amount: -3});
  assert.equal(parseOwnText("Concentration", "plain"), null);
  assert.equal(parseOwnText("-3 Morale", "plain"), null);
  assert.equal(parseOwnText("12", "plain"), null);
  assert.equal(parseOwnText("-3", null), null);
});

test("Crucible numbers count only behind the name of the health pool", () => {
  assert.deepEqual(parseOwnText("−12 Health", "health", "Health"), {amount: -12});
  assert.deepEqual(parseOwnText("+4 health", "health", "Health"), {amount: 4});
  assert.equal(parseOwnText("−2 Morale", "health", "Health"), null);
  assert.equal(parseOwnText("−12", "health", "Health"), null);
  assert.equal(parseOwnText("−12 Health", "health", ""), null);
});

test("a state is read from a resource, a bare number or a bar", () => {
  assert.deepEqual(stateOf({value: 7, max: 20}, 3), {value: 7, max: 20, temp: 3});
  assert.deepEqual(stateOf({value: "7"}), {value: 7, max: null, temp: 0});
  assert.deepEqual(stateOf(4), {value: 4, max: null, temp: 0});
  assert.equal(stateOf(null), null);
  assert.equal(stateOf({value: null}), null);
});

test("a change adds temporary hit points and turns for counts where more is worse", () => {
  const a = {value: 10, max: 20, temp: 0};
  assert.equal(changeOf(a, {...a, value: 4})?.delta, -6);
  assert.equal(changeOf(a, {...a, value: 14})?.delta, 4);
  assert.equal(changeOf(a, {...a, temp: 5})?.delta, 5);
  assert.equal(changeOf({value: 10, max: 20, temp: 5}, {value: 10, max: 20, temp: 0})?.delta, -5);
  assert.equal(changeOf(a, {...a, max: 25}), null);
  assert.equal(changeOf(a, null), null);
  // Wounds: one wound more is damage
  assert.equal(changeOf({value: 0, max: 3, temp: 0}, {value: 1, max: 3, temp: 0}, "up")?.delta, -1);
});

test("the words follow the size of the blow", () => {
  assert.equal(changeWord({delta: -1, max: 40, after: 30}), "scratch");
  assert.equal(changeWord({delta: -8, max: 40, after: 20}), "hurt");
  assert.equal(changeWord({delta: -14, max: 40, after: 20}), "badly");
  assert.equal(changeWord({delta: -30, max: 40, after: 5}), "brutal");
  assert.equal(changeWord({delta: -3, max: 40, after: 0}), "down");
  assert.equal(changeWord({delta: -5, max: 40, after: -2}), "down");
  assert.equal(changeWord({delta: -1}), "hurt");
  assert.equal(changeWord({delta: 2, max: 40, after: 20}), "healSlight");
  assert.equal(changeWord({delta: 8, max: 40, after: 20}), "healSome");
  assert.equal(changeWord({delta: 20, max: 40, after: 30}), "healMuch");
  assert.equal(changeWord({delta: 3, max: 40, after: 40}), "healFull");
  assert.equal(changeWord({delta: 1}), "healSome");
  // Wounds never read as "down" and never as fully healed
  assert.equal(changeWord({delta: -1, max: 3, after: 3, worse: "up"}), "badly");
  assert.equal(changeWord({delta: 1, max: 3, after: 0, worse: "up"}), "healMuch");
});

test("exact numbers carry the sign and scale with the blow, described ones show the word", () => {
  const change = changeOf({value: 20, max: 40, temp: 0}, {value: 8, max: 40, temp: 0});
  const exact = floaterFor("exact", change, {word});
  assert.equal(exact.text, "−12");
  assert.equal(exact.fill, "#e0463a");
  assert.ok(exact.fontSize > 16 && exact.fontSize < 48);
  const described = floaterFor("descriptive", change, {word});
  assert.equal(described.text, "<badly>");
  const healed = floaterFor("exact", changeOf({value: 8, max: 40, temp: 0}, {value: 14, max: 40, temp: 0}), {word});
  assert.equal(healed.text, "+6");
  assert.equal(healed.fill, "#4cc26a");
  assert.equal(floaterFor(null, change, {word}), null);
  // Wounds: a wound gained is "+1 Wounds" in red
  const wounds = changeOf({value: 0, max: 3, temp: 0}, {value: 1, max: 3, temp: 0}, "up");
  const gained = floaterFor("exact", wounds, {worse: "up", label: "Wounds", word});
  assert.equal(gained.text, "+1 Wounds");
  assert.equal(gained.fill, "#e0463a");
  // A wound removed is "−1 Wounds" in green
  const removed = floaterFor("exact", changeOf({value: 1, max: 3, temp: 0}, {value: 0, max: 3, temp: 0}, "up"), {worse: "up", label: "Wounds", word});
  assert.equal(removed.text, "−1 Wounds");
  assert.equal(removed.fill, "#4cc26a");
});

test("each audience gets its form from the rules of the health field", () => {
  const config = {audience: "everyone", forms: {party: "exact", friendly: "exact", neutral: "descriptive", hostile: "descriptive", secret: "hidden"}};
  const change = changeOf({value: 30, max: 40, temp: 0}, {value: 20, max: 40, temp: 0});
  const textFor = viewer => floaterFor(resolveForm(config, viewer, {describable: true}), change, {word})?.text ?? null;
  assert.equal(textFor({isGM: true, isOwner: false, disposition: -1}), "−10");
  assert.equal(textFor({isGM: false, isOwner: true, disposition: 1}), "−10");
  assert.equal(textFor({isGM: false, isOwner: false, disposition: -1}), "<hurt>");
  assert.equal(textFor({isGM: false, isOwner: false, disposition: 1, party: true}), "−10");
  assert.equal(textFor({isGM: false, isOwner: false, disposition: -2}), null);
  const gmOnly = {...config, audience: "gm"};
  assert.equal(resolveForm(gmOnly, {isGM: false, isOwner: true, disposition: 1}, {describable: true}), null);
});

test("the mode decides who floats a number", () => {
  assert.equal(replacesOwn("replace", SOURCES.dnd5e), true);
  assert.equal(replacesOwn("missing", SOURCES.dnd5e), false);
  assert.equal(replacesOwn("replace", SOURCES.swade), false);
  assert.equal(drawsOwn("replace", SOURCES.swade), true);
  assert.equal(drawsOwn("missing", SOURCES.generic), true);
  assert.equal(drawsOwn("off", SOURCES.generic), false);
  assert.equal(drawsOwn("replace", SOURCES.dnd5e), false);
  assert.equal(drawsOwn("missing", SOURCES.pf2e), false);
  assert.ok(QUIET_KEYS.has("x"));
});

test("every description has a text in both languages", () => {
  const keys = ["scratch", "hurt", "badly", "brutal", "down", "healSlight", "healSome", "healMuch", "healFull"];
  for ( const name of ["en", "de"] ) {
    const texts = lang(name).STT.Floater;
    for ( const key of keys ) assert.ok(texts[key], `${name}: ${key}`);
    assert.deepEqual(Object.keys(texts).sort(), [...keys].sort());
    // Every word the module can choose is among them
    const used = new Set([-1, -8, -14, -30, 2, 8, 20].map(d => changeWord({delta: d, max: 40, after: 20})));
    for ( const key of used ) assert.ok(texts[key]);
  }
});

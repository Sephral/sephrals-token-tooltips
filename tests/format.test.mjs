import assert from "node:assert/strict";
import test from "node:test";
import {buildRows, describable, formatCount, formatCr, formatDie, formatEffects, formatList, formatModifier,
  formatMovement, formatResource, formatValue, healthWord, toNumber} from "../scripts/format.mjs";

const t = key => `[${key}]`;

test("numbers from strings, nothing from empty values", () => {
  assert.equal(toNumber("12"), 12);
  assert.equal(toNumber(""), null);
  assert.equal(toNumber(null), null);
  assert.equal(toNumber(true), null);
  assert.equal(toNumber("abc"), null);
});

test("health words at their thresholds", () => {
  assert.equal(healthWord(1), "unhurt");
  assert.equal(healthWord(0.51), "wounded");
  assert.equal(healthWord(0.5), "bloodied");
  assert.equal(healthWord(0.26), "bloodied");
  assert.equal(healthWord(0.25), "critical");
  assert.equal(healthWord(0.01), "critical");
  assert.equal(healthWord(0), "down");
  assert.equal(healthWord(-0.5), "down");
});

test("a resource as bar, numbers or both", () => {
  assert.deepEqual(formatResource({value: 15, max: 30}, "exact", "both"),
    {kind: "bar", pct: 50, tone: "poor", text: "15 / 30"});
  assert.deepEqual(formatResource({value: 15, max: 30}, "exact", "bar"), {kind: "bar", pct: 50, tone: "poor", text: ""});
  assert.deepEqual(formatResource({value: 30, max: 30}, "exact", "number"), {kind: "text", text: "30 / 30", tone: "good"});
  assert.equal(formatResource({value: 40, max: 30}, "exact", "both").pct, 100);
  assert.equal(formatResource({value: -5, max: 30}, "exact", "both").pct, 0);
});

test("a described resource gives only the word", () => {
  assert.deepEqual(formatResource({value: 7, max: 30}, "descriptive"), {kind: "word", word: "critical", tone: "bad"});
  assert.deepEqual(formatResource({value: 0, max: 30}, "descriptive"), {kind: "word", word: "down", tone: "down"});
});

test("a resource without a maximum is a plain number, and never described", () => {
  assert.deepEqual(formatResource({value: 12, max: 0}, "exact"), {kind: "text", text: "12"});
  assert.equal(formatResource({value: 12}, "descriptive"), null);
  assert.equal(formatResource({value: null, max: 3}, "exact"), null);
});

test("a count grows worse and is never described as down", () => {
  assert.deepEqual(formatCount({value: 1, max: 3}, "exact"), {kind: "text", text: "1 / 3"});
  assert.deepEqual(formatCount(2, "exact"), {kind: "text", text: "2"});
  assert.equal(formatCount({value: 0, max: 3}, "descriptive").word, "unhurt");
  assert.equal(formatCount({value: 1, max: 3}, "descriptive").word, "wounded");
  assert.equal(formatCount({value: 2, max: 3}, "descriptive").word, "bloodied");
  assert.equal(formatCount({value: 3, max: 3}, "descriptive").word, "critical");
  assert.equal(formatCount({value: 5, max: 3}, "descriptive").word, "critical");
  assert.equal(formatCount({value: 1}, "descriptive"), null);
  assert.equal(formatCount({value: 0, max: 0}, "descriptive").word, "unhurt");
  assert.equal(formatCount({value: 1, max: 0}, "descriptive").word, "critical");
  assert.deepEqual(formatCount({value: 0, max: 0}, "exact"), {kind: "text", text: "0"});
});

test("speeds: walking first and without a label", () => {
  const out = formatMovement([{type: "fly", value: 60, units: "ft"}, {type: "walk", value: 30, units: "ft"},
    {type: "swim", value: 0}], type => type.toUpperCase());
  assert.deepEqual(out, {kind: "text", text: "30 ft, FLY 60 ft"});
  assert.equal(formatMovement([], () => ""), null);
  assert.deepEqual(formatMovement([{type: "walk", value: 6}], () => ""), {kind: "text", text: "6"});
});

test("effects once each, with or without a picture", () => {
  const out = formatEffects([{name: "Prone", img: "p.svg"}, {name: "Prone", img: "p.svg"}, {name: " "}, {name: "Bless"}]);
  assert.deepEqual(out, {kind: "icons", items: [{name: "Prone", img: "p.svg"}, {name: "Bless", img: null}]});
  assert.equal(formatEffects([]), null);
});

test("challenge ratings as fractions", () => {
  assert.equal(formatCr(0.125), "1/8");
  assert.equal(formatCr(0.25), "1/4");
  assert.equal(formatCr(0.5), "1/2");
  assert.equal(formatCr(3), "3");
  assert.equal(formatCr(null), null);
});

test("lists from arrays, sets and objects", () => {
  assert.deepEqual(formatList(new Set(["fire", "cold"])), {kind: "text", text: "fire, cold"});
  assert.deepEqual(formatList([{name: "A"}, {label: "B"}, ""]), {kind: "text", text: "A, B"});
  assert.equal(formatList([]), null);
});

test("token bars: a resource with a maximum, else a number only shown exactly", () => {
  const field = {type: "bar", config: {display: "number"}};
  assert.deepEqual(formatValue(field, {value: 4, max: 8}, "exact", t), {kind: "text", text: "4 / 8", tone: "poor"});
  assert.deepEqual(formatValue(field, {value: 4}, "exact", t), {kind: "text", text: "4"});
  assert.equal(formatValue(field, {value: 4}, "descriptive", t), null);
});

test("unknown movement types keep their name", () => {
  const out = formatValue({type: "movement"}, [{type: "walk", value: 25, units: "ft"}, {type: "travel", value: 10, units: "ft"}],
    "exact", key => key);
  assert.equal(out.text, "25 ft, travel 10 ft");
});

test("only count, resource and bar fields can be described, unless switched off", () => {
  assert.equal(describable({type: "resource"}), true);
  assert.equal(describable({type: "count", describe: false}), false);
  assert.equal(describable({type: "number"}), false);
});

test("rows follow the forms, skip empty values and collect read errors", () => {
  const fields = [
    {id: "name", type: "name", config: {audience: "everyone", forms: {hostile: "exact"}}},
    {id: "hp", type: "resource", label: "HP", icon: "fa-heart",
      config: {audience: "everyone", display: "both", forms: {hostile: "descriptive"}}},
    {id: "ac", type: "number", label: "AC", config: {audience: "owner", forms: {}}},
    {id: "speed", type: "number", label: "Speed", config: {audience: "everyone", forms: {hostile: "exact"}}},
    {id: "broken", type: "number", label: "Broken", config: {audience: "everyone", forms: {hostile: "exact"}}}
  ];
  const values = {hp: {value: 10, max: 40}, ac: 15, speed: null};
  const read = field => {
    if ( field.id === "broken" ) throw new Error("nope");
    return values[field.id];
  };
  const viewer = {isGM: false, isOwner: false, disposition: -1};
  const {rows, errors} = buildRows(fields, {viewer, read, t});
  assert.deepEqual(rows, [{id: "hp", label: "HP", icon: "fa-heart", form: "descriptive", kind: "word", word: "critical",
    tone: "bad", text: "[STT.Health.critical]"}]);
  assert.deepEqual(errors, ["broken"]);
  const asGM = buildRows(fields.slice(0, 4), {viewer: {isGM: true, isOwner: true, disposition: -1}, read, t});
  assert.deepEqual(asGM.rows.map(r => `${r.id}:${r.form}`), ["hp:exact", "ac:exact"]);
});

test("a token bar row is named after its attribute", () => {
  const fields = [{id: "bar1", type: "bar", label: "Bar 1", config: {audience: "everyone", forms: {friendly: "exact"}}}];
  const {rows} = buildRows(fields, {viewer: {isGM: false, isOwner: false, disposition: 1},
    read: () => ({value: 3, max: 9, label: "Health"}), t, labelOf: f => f.label});
  assert.equal(rows[0].label, "Health");
});

test("modifiers with their sign, dice sizes, yes and no, endless numbers", () => {
  assert.equal(formatModifier(2), "+2");
  assert.equal(formatModifier("-1"), "-1");
  assert.equal(formatModifier(0), "0");
  assert.equal(formatModifier(null), null);
  assert.equal(formatDie(6), "d6");
  assert.equal(formatDie({sides: 8, modifier: 1}), "d8+1");
  assert.equal(formatDie({sides: 4, modifier: -2}), "d4-2");
  assert.equal(formatDie("d12"), "d12");
  assert.equal(formatDie(0), null);
  assert.deepEqual(formatValue({type: "modifier"}, 3, "exact", t), {kind: "text", text: "+3"});
  assert.deepEqual(formatValue({type: "die"}, {sides: 6, modifier: 0}, "exact", t), {kind: "text", text: "d6"});
  assert.deepEqual(formatValue({type: "text"}, true, "exact", t), {kind: "text", text: "[STT.Value.yes]"});
  assert.equal(formatValue({type: "text"}, false, "exact", t), null);
  assert.equal(formatValue({type: "number"}, true, "exact", t), null);
  assert.deepEqual(formatValue({type: "number"}, Infinity, "exact", t), {kind: "text", text: "∞"});
  assert.deepEqual(formatValue({type: "number"}, -Infinity, "exact", t), {kind: "text", text: "-∞"});
});

test("senses like speeds, with their own names", () => {
  const tt = key => ({"STT.Sense.darkvision": "darkvision"})[key] ?? key;
  assert.deepEqual(formatValue({type: "senses"}, [{type: "darkvision", value: 60, units: "ft"},
    {type: "echo", value: 10, units: "ft"}], "exact", tt), {kind: "text", text: "darkvision 60 ft, echo 10 ft"});
});

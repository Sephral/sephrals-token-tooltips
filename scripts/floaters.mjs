/**
 * Floating numbers: when a token's hit points change, a number floats up from the token. Each client decides for
 * itself what its user sees, following the rules of the health field of the tooltips (audience, form per token
 * disposition, party form): the exact number, a description such as "a scratch" or "badly hurt", or nothing. The GM and
 * the owners see exact numbers when the audience includes them. Nothing travels over a socket.
 *
 * Two ways in, because the systems differ:
 * - D&D 5e, Pathfinder 2e and Crucible float their own numbers on every client, always exact. There the module changes
 *   the text on its way to the screen (replace mode): exact stays as it is, described becomes the description, hidden
 *   drops it. No second number appears.
 * - Savage Worlds and systems without their own numbers (token bars) get a number from the module, found by
 *   comparing the health of a token before and after each update.
 * The setting chooses: replace, only where the system shows none ("missing"), or off. Foundry's own switch for
 * scrolling status text (core) applies to both, since the module uses the same call.
 */

import {MODULE_ID, setting, t} from "./config.mjs";
import {thingToken, viewerOf} from "./content.mjs";
import {describable, toNumber} from "./format.mjs";
import {getPath, presetFor} from "./presets.mjs";
import {readField} from "./reader.mjs";
import {currentFields} from "./registry.mjs";
import {countFeature} from "./usage.mjs";
import {resolveForm, tooltipAllowed} from "./visibility.mjs";

/** The choices of the setting. */
export const MODES = ["replace", "missing", "off"];

/**
 * The health of each preset: the field whose rules decide who sees what, the path of temporary hit points, whether a
 * higher value is worse (wounds) and what the system floats itself. own: "plain" is a signed number, "health" a signed
 * number followed by the name of the health pool (Crucible), null: the system floats nothing. leave: the system floats
 * texts of its own that cannot be read as amounts, the module floats nothing and changes nothing.
 */
export const SOURCES = {
  dnd5e: {field: "hp", temp: "system.attributes.hp.temp", own: "plain"},
  pf2e: {field: "hp", temp: "system.attributes.hp.temp", own: "plain"},
  crucible: {field: "health", own: "health"},
  swade: {field: "wounds", worse: "up", own: null},
  // Shadowdark floats the signed change of its hit points like dnd5e does
  shadowdark: {field: "hp", own: "plain"},
  // Systems that float texts of their own which this module cannot read as an amount: it leaves them alone (leave)
  daggerheart: {field: "hp", worse: "up", own: null, leave: true},
  projectfu: {field: "hp", own: null, leave: true},
  // Systems whose code floats nothing (checked in their releases): the module floats the hit points
  CoC7: {field: "hp", own: null},
  "shadowrun6-eden": {field: "physical", own: null},
  dolmenwood: {field: "hp", own: null},
  rqg: {field: "hp", own: null},
  generic: {field: "bar1", own: null}
};

/** Colors of the numbers. */
export const COLORS = {damage: "#e0463a", heal: "#4cc26a"};

/**
 * The health source of a preset.
 * @param {string} presetId
 * @returns {object}
 */
export function sourceFor(presetId) {
  return SOURCES[presetId] ?? SOURCES.generic;
}

/**
 * A text a system floats for a health change, read as an amount: "-12", "+5" or, in Crucible, "-12 Health" (the
 * name of the pool must match, so morale and the like stay untouched). The minus of Foundry's signedString is U+2212.
 * @param {*} text
 * @param {string|null} kind        "plain" or "health"
 * @param {string} [poolName]       The name of the health pool (kind "health")
 * @returns {{amount: number}|null}  amount: negative for damage
 */
export function parseOwnText(text, kind, poolName="") {
  const match = /^\s*([+\-−–])\s?(\d+)\s*(.*?)\s*$/.exec(String(text ?? ""));
  if ( !match || !kind ) return null;
  if ( kind === "health" ) {
    if ( !poolName || (match[3].toLowerCase() !== String(poolName).toLowerCase()) ) return null;
  }
  else if ( match[3] ) return null;
  const amount = Number(match[2]);
  return {amount: match[1] === "+" ? amount : -amount};
}

/**
 * The health of a token read from its field: {value, max?, temp?}, or null when it cannot be read.
 * @param {*} raw          What the field reader returned
 * @param {number} [temp]  Temporary hit points
 * @returns {{value: number, max: number|null, temp: number}|null}
 */
export function stateOf(raw, temp=0) {
  const value = toNumber(raw && (typeof raw === "object") ? raw.value : raw);
  if ( value === null ) return null;
  const max = toNumber(raw && (typeof raw === "object") ? raw.max : null);
  return {value, max, temp: toNumber(temp) ?? 0};
}

/**
 * What changed between two states. Temporary hit points count with the rest, like the systems do.
 * @param {object|null} before
 * @param {object|null} after
 * @param {"down"|"up"} [worse="down"]   "up" when a higher value is worse (wounds)
 * @returns {{delta: number, before: object, after: object}|null}   delta: negative for damage, positive for healing
 */
export function changeOf(before, after, worse="down") {
  if ( !before || !after ) return null;
  const total = (after.value + after.temp) - (before.value + before.temp);
  if ( !total ) return null;
  return {delta: worse === "up" ? -total : total, before, after};
}

/**
 * The words for a change in the size of the blow: damage by its share of the maximum, down when it ends at zero;
 * healing by its share, fully healed when it reaches the maximum. Without a maximum (wounds, a bar without one) a
 * blow is plain "hurt" and healing plain "better".
 * @param {{delta: number, max?: number|null, after?: number, worse?: string}} data
 * @returns {"scratch"|"hurt"|"badly"|"brutal"|"down"|"healSlight"|"healSome"|"healMuch"|"healFull"}
 */
export function changeWord({delta, max=null, after=null, worse="down"}) {
  const share = max > 0 ? Math.abs(delta) / max : null;
  if ( delta < 0 ) {
    if ( (worse !== "up") && (after !== null) && (after <= 0) ) return "down";
    if ( share === null ) return "hurt";
    if ( share <= 0.1 ) return "scratch";
    if ( share <= 0.25 ) return "hurt";
    if ( share <= 0.5 ) return "badly";
    return "brutal";
  }
  if ( share === null ) return "healSome";
  if ( (worse !== "up") && (after !== null) && (after >= max) ) return "healFull";
  if ( share <= 0.1 ) return "healSlight";
  if ( share <= 0.25 ) return "healSome";
  return "healMuch";
}

/**
 * The floating text for one viewer.
 * @param {"exact"|"descriptive"|null} form   From resolveForm
 * @param {{delta: number, before: object, after: object}} change
 * @param {object} options
 * @param {string} [options.worse]        "up" when a higher value is worse
 * @param {string} [options.label]        Added to exact numbers of counts (wounds)
 * @param {Function} options.word         (key) => the localized description
 * @returns {{text: string, fill: string, fontSize: number}|null}
 */
export function floaterFor(form, change, {worse="down", label="", word}) {
  if ( !form || !change ) return null;
  const heal = change.delta > 0;
  const fill = heal ? COLORS.heal : COLORS.damage;
  const max = change.after.max ?? change.before.max;
  if ( form === "descriptive" ) {
    return {text: word(changeWord({delta: change.delta, max, after: change.after.value, worse})), fill, fontSize: 24};
  }
  // Wounds read as they come: a wound gained is "+1 Wounds", in red
  const amount = worse === "up" ? -change.delta : change.delta;
  const sign = amount < 0 ? "−" : "+";
  const share = max > 0 ? Math.min(1, Math.abs(change.delta) / max) : 0.25;
  return {text: `${sign}${Math.abs(amount)}${label ? ` ${label}` : ""}`, fill, fontSize: Math.round(16 + (32 * share))};
}

/**
 * Whether a state change of a token may float at all, as far as the settings go.
 * @param {string} mode       The setting
 * @param {object} source     SOURCES entry
 * @returns {boolean}         Numbers from the module itself (not the system's own)
 */
export function drawsOwn(mode, source) {
  return (mode !== "off") && !source.own && !source.leave;
}

/**
 * Whether the module changes the numbers the system floats.
 * @param {string} mode
 * @param {object} source
 * @returns {boolean}
 */
export function replacesOwn(mode, source) {
  return (mode === "replace") && !!source.own;
}

/* -------------------------------------------- */
/*  In Foundry                                  */
/* -------------------------------------------- */

/** Health of each token of the viewed scene as last seen, by token id. */
const known = new Map();

/** Set while the module floats a text itself, so the interception lets it pass. */
let inside = false;

/** The original createScrollingText, once the interception is in place. */
let original = null;

/** @returns {string} */
function mode() {
  const value = setting("floaters");
  return MODES.includes(value) ? value : "replace";
}

/** @returns {object} */
function source() {
  return sourceFor(presetFor(game.system.id).id);
}

/**
 * The health field of this world, configured, with the rules the tooltip uses.
 * @param {object} src
 * @returns {object|null}
 */
function healthField(src) {
  const field = currentFields().find(f => f.id === src.field);
  if ( !field ) return null;
  return field;
}

/**
 * The form the current user sees the health of a token in. A field the GM switched off is not meant for players.
 * @param {TokenDocument} doc
 * @param {object} field
 * @returns {"exact"|"descriptive"|null}
 */
function formFor(doc, field) {
  const config = field.config.enabled ? field.config : {...field.config, audience: "gm"};
  return resolveForm(config, viewerOf(doc), {describable: describable(field)});
}

/**
 * Read the health of a token.
 * @param {TokenDocument} doc
 * @param {object} src
 * @param {object} field
 * @returns {object|null}
 */
function readState(doc, src, field) {
  try {
    const raw = readField(field, doc);
    return stateOf(raw, src.temp ? getPath(doc.actor, src.temp) : 0);
  } catch(err) {
    return null;
  }
}

/**
 * The name of the health pool a system floats behind its numbers (Crucible).
 * @returns {string}
 */
function poolName() {
  const label = globalThis.SYSTEM?.RESOURCES?.health?.label;
  return label ? game.i18n.localize(label) : "";
}

/**
 * The token a floating text belongs to: the one whose frame holds the point, the nearest center first.
 * @param {{x: number, y: number}} origin
 * @returns {Token|null}
 */
function tokenAt(origin) {
  let best = null;
  let bestDistance = Infinity;
  for ( const token of canvas.tokens?.placeables ?? [] ) {
    const frame = token.bounds;
    const slack = Math.min(frame.width, frame.height) * 0.25;
    if ( !((origin.x >= frame.x - slack) && (origin.x <= frame.right + slack) && (origin.y >= frame.y - slack)
      && (origin.y <= frame.bottom + slack)) ) continue;
    const distance = Math.hypot(token.center.x - origin.x, token.center.y - origin.y);
    if ( distance < bestDistance ) {
      best = token;
      bestDistance = distance;
    }
  }
  return best;
}

/**
 * Float a text from a token without the interception looking at it.
 * @param {Token} token
 * @param {string} text
 * @param {object} style
 */
function float(token, text, {fill, fontSize}) {
  inside = true;
  try {
    canvas.interface.createScrollingText(token.center, text, {anchor: CONST.TEXT_ANCHOR_POINTS.TOP, fontSize, fill,
      stroke: 0x000000, strokeThickness: 4, jitter: 0.25});
  } finally {
    inside = false;
  }
}

/**
 * The interception: a number the system floats for hit points is passed on, turned into a description or dropped,
 * following the rules of the health field.
 */
function intercept(origin, content, options={}) {
  const pass = () => original.call(this, origin, content, options);
  try {
    if ( inside || !canvas?.ready ) return pass();
    const src = source();
    if ( !replacesOwn(mode(), src) ) return pass();
    const parsed = parseOwnText(content, src.own, poolName());
    if ( !parsed ) return pass();
    const token = tokenAt(origin);
    const field = healthField(src);
    if ( !token || !field || thingToken(token.document) ) return pass();
    const form = formFor(token.document, field);
    countFeature(MODULE_ID, "floaterRules");
    if ( form === "exact" ) return pass();
    if ( !form ) return Promise.resolve();
    // The system has changed the health already: the state now is the state after the blow
    const now = readState(token.document, src, field);
    if ( !now ) return Promise.resolve();
    const was = {...now, value: now.value - parsed.amount, temp: now.temp};
    const floater = floaterFor("descriptive", changeOf(was, now), {word: key => t(`STT.Floater.${key}`)});
    if ( !floater ) return Promise.resolve();
    return original.call(this, origin, floater.text, {...options, fontSize: Math.min(options.fontSize ?? 32, 36)});
  } catch(err) {
    console.warn(`${MODULE_ID} | The floating number could not be adapted`, err);
    return pass();
  }
}

/**
 * A token may have changed health: compare with what was seen and float the difference.
 * @param {TokenDocument} doc
 */
function track(doc) {
  if ( !canvas?.ready || !doc || (doc.parent !== canvas.scene) ) return;
  const src = source();
  const field = healthField(src);
  if ( !field ) return;
  const state = readState(doc, src, field);
  const before = known.get(doc.id);
  if ( state ) known.set(doc.id, state);
  else known.delete(doc.id);
  if ( !drawsOwn(mode(), src) || !before || !state ) return;
  const change = changeOf(before, state, src.worse);
  if ( !change ) return;
  const token = doc.object;
  if ( !token?.visible || thingToken(doc) ) return;
  if ( !tooltipAllowed({hidden: doc.hidden, isGM: game.user.isGM, visible: true}) ) return;
  const form = formFor(doc, field);
  const floater = floaterFor(form, change, {worse: src.worse, word: key => t(`STT.Floater.${key}`),
    label: src.worse === "up" ? game.i18n.localize(field.label) : ""});
  if ( !floater ) return;
  float(token, floater.text, floater);
  countFeature(MODULE_ID, "floaterShown");
}

/** Take the health of every token of the viewed scene. */
function seed() {
  known.clear();
  if ( !canvas?.ready ) return;
  const src = source();
  const field = healthField(src);
  if ( !field ) return;
  for ( const doc of canvas.scene.tokens ) {
    const state = readState(doc, src, field);
    if ( state ) known.set(doc.id, state);
  }
}

/** Keys of a token update that cannot change health. */
const QUIET_KEYS = new Set(["x", "y", "elevation", "rotation", "level", "sort", "_id", "hidden", "lockRotation"]);

/**
 * Install the interception and the hooks. Called once when the game is ready.
 */
export function registerFloaters() {
  const Interface = foundry.canvas?.groups?.InterfaceCanvasGroup;
  if ( Interface?.prototype?.createScrollingText && !original ) {
    original = Interface.prototype.createScrollingText;
    Interface.prototype.createScrollingText = intercept;
  }
  Hooks.on("canvasReady", seed);
  Hooks.on("createToken", doc => {
    if ( doc.parent === canvas?.scene ) setTimeout(() => track(doc), 0);
  });
  Hooks.on("deleteToken", doc => known.delete(doc.id));
  Hooks.on("updateActor", actor => {
    if ( !canvas?.ready ) return;
    const docs = actor.isToken ? [actor.token] : actor.getActiveTokens(false, true);
    for ( const doc of docs ) track(doc);
  });
  Hooks.on("updateToken", (doc, changes) => {
    if ( Object.keys(changes ?? {}).every(key => QUIET_KEYS.has(key)) ) return;
    track(doc);
  });
  seed();
}

/**
 * Whether the interception is in place (self-test).
 * @returns {boolean}
 */
export function interceptionInstalled() {
  return !!original && (foundry.canvas?.groups?.InterfaceCanvasGroup?.prototype?.createScrollingText === intercept);
}

export const __test__ = {QUIET_KEYS, SOURCES, MODES, COLORS, sourceFor, parseOwnText, stateOf, changeOf, changeWord, floaterFor,
  drawsOwn, replacesOwn};

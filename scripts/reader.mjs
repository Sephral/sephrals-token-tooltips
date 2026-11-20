/**
 * Reads the values of the fields from a token, with the few Foundry helpers the presets need.
 */

import {MAX_CELLS, elevationOf as elevationInfo, flatOffsets, nearestMeasure, pickOrigin, rectGap, roundDistance,
  unitsFromPixels} from "./measure.mjs";
import {getPath} from "./presets.mjs";

/**
 * The effects and conditions Foundry draws on a token: v14 asks each effect whether it shows an icon, v13 draws the
 * temporary effects. Systems such as PF2e add their own entries to the temporary effects, those count too.
 * @param {Actor} actor
 * @returns {Array<{name: string, img: string}>}
 */
export function effectsOf(actor) {
  if ( !actor ) return [];
  const SHOW = CONST.ACTIVE_EFFECT_SHOW_ICON;
  const temporary = [...(actor.temporaryEffects ?? [])];
  let list;
  if ( SHOW ) {
    list = [...(actor.appliedEffects ?? [])].filter(e => (e.showIcon === SHOW.ALWAYS)
      || ((e.showIcon === SHOW.CONDITIONAL) && e.isTemporary));
    // Entries a system adds that are no effects of the actor (they know no icon setting)
    for ( const effect of temporary ) if ( (effect.showIcon === undefined) && !list.includes(effect) ) list.push(effect);
  }
  else list = temporary;
  return list.filter(e => e?.img && !e.disabled).map(e => ({name: e.name, img: e.img}));
}

/**
 * The label of a token bar from the path of its attribute: "attributes.hp" becomes "HP", "resources.health" "Health".
 * @param {string} attribute
 * @returns {string}
 */
export function barLabel(attribute) {
  const last = String(attribute ?? "").split(".").filter(Boolean).at(-1) ?? "";
  if ( !last ) return "";
  if ( last.length <= 3 ) return last.toUpperCase();
  return last.charAt(0).toUpperCase() + last.slice(1).replace(/([a-z])([A-Z])/g, "$1 $2");
}

/**
 * The attribute a token shows as one of its bars.
 * @param {TokenDocument} token
 * @param {"bar1"|"bar2"} bar
 * @returns {{value: number, max?: number, label: string}|null}
 */
export function barOf(token, bar) {
  const data = token?.getBarAttribute?.(bar);
  if ( !data || (data.value === null) || (data.value === undefined) ) return null;
  return {value: data.value, max: data.type === "bar" ? data.max : undefined, label: barLabel(data.attribute)};
}

/**
 * The name a system keeps for a key, such as "fire" in CONFIG.DND5E.damageTypes: a text or translation key, or an
 * entry with a label or name. Unknown keys stay as they are.
 * @param {string} source   Where the names are, from the global scope ("CONFIG.DND5E.damageTypes")
 * @param {string} key
 * @returns {string}
 */
export function choiceName(source, key) {
  const entry = foundry.utils.getProperty(globalThis, source)?.[key];
  const text = typeof entry === "string" ? entry : (entry?.label ?? entry?.name);
  return (typeof text === "string") && text ? game.i18n.localize(text) : key;
}

/**
 * The token distances and elevation are measured from, see pickOrigin.
 * @param {TokenDocument} doc
 * @param {boolean} [preview=false]   The field window: any other token will do
 * @returns {TokenDocument|null}
 */
export function originOf(doc, preview=false) {
  if ( !canvas?.ready || (doc?.parent !== canvas.scene) ) return null;
  const tokens = canvas.tokens.placeables;
  const character = game.user.character;
  const own = character ? (tokens.find(t => t.actor?.id === character.id)?.document ?? null) : null;
  let others = [];
  if ( preview ) {
    const center = doc.object?.center;
    others = tokens.filter(t => t.document.actor && (t.id !== doc.id)).map(t => t.document);
    if ( center ) {
      const gap = d => Math.hypot(d.object.center.x - center.x, d.object.center.y - center.y);
      others.sort((a, b) => gap(a) - gap(b));
    }
  }
  return pickOrigin({controlled: canvas.tokens.controlled.map(t => t.document), target: doc, character: own, others});
}

/**
 * The rectangle of a token in pixels.
 * @param {TokenDocument} doc
 * @returns {{x: number, y: number, width: number, height: number}}
 */
function rectOf(doc) {
  const size = canvas.grid.size;
  return {x: doc.x, y: doc.y, width: doc.width * size, height: doc.height * size};
}

/**
 * The grid spaces a token occupies, as the core grid has them (Foundry 13 and 14). Empty on a gridless scene.
 * @param {TokenDocument} doc
 * @returns {Array<{i: number, j: number}>}
 */
function cellsOf(doc) {
  if ( canvas.grid.isGridless || (typeof doc.getOccupiedGridSpaceOffsets !== "function") ) return [];
  const cells = flatOffsets(doc.getOccupiedGridSpaceOffsets());
  if ( cells.length <= MAX_CELLS ) return cells;
  const center = canvas.grid.getOffset(doc.object?.center ?? {x: doc.x, y: doc.y});
  return [{i: center.i, j: center.j}];
}

/**
 * The distance between two tokens of the viewed scene in scene units, from the edge of one to the edge of the other:
 * from space to space on a grid (core's rules for diagonals), the gap between the frames without a grid.
 * @param {TokenDocument} a
 * @param {TokenDocument} b
 * @returns {number|null}
 */
export function measureBetween(a, b) {
  const grid = canvas.grid;
  const cellsA = cellsOf(a);
  const cellsB = cellsOf(b);
  if ( cellsA.length && cellsB.length ) {
    const measure = (p, q) => grid.measurePath([grid.getCenterPoint(p), grid.getCenterPoint(q)]).distance;
    const value = nearestMeasure(cellsA, cellsB, measure);
    return value === null ? null : roundDistance(value);
  }
  const scene = canvas.scene;
  return roundDistance(unitsFromPixels(rectGap(rectOf(a), rectOf(b)), scene.grid.size, scene.grid.distance));
}

/**
 * The distance from the user's token to another one, for the field.
 * @param {TokenDocument} doc
 * @param {boolean} [preview=false]
 * @returns {{value: number, units: string}|null}
 */
export function distanceTo(doc, preview=false) {
  const from = originOf(doc, preview);
  if ( !from ) return null;
  const value = measureBetween(from, doc);
  return value === null ? null : {value, units: canvas.scene.grid.units ?? ""};
}

/**
 * The elevation of a token and its difference to the user's token, for the field.
 * @param {TokenDocument} doc
 * @param {boolean} [preview=false]
 * @returns {{value: number, diff: number|null, units: string}|null}
 */
export function elevationOfToken(doc, preview=false) {
  const from = originOf(doc, preview);
  const info = elevationInfo(doc.elevation, from ? from.elevation : null);
  return info ? {...info, units: canvas?.scene?.grid?.units ?? ""} : null;
}

/** The helpers readers may use. */
export const ENV = {effectsOf, barOf, choiceName, distanceTo: doc => distanceTo(doc),
  elevationOf: doc => elevationOfToken(doc)};

/** The helpers for the field window's preview: distances count from the nearest other token. */
const PREVIEW_ENV = {...ENV, distanceTo: doc => distanceTo(doc, true), elevationOf: doc => elevationOfToken(doc, true)};

/**
 * Read one field from a token.
 * @param {object} field             The field definition
 * @param {TokenDocument} token
 * @param {object} [options]
 * @param {boolean} [options.preview=false]   The preview of the field window
 * @returns {*}
 */
export function readField(field, token, {preview=false}={}) {
  const actor = token?.actor ?? null;
  if ( field.read ) return field.read({actor, token, env: preview ? PREVIEW_ENV : ENV});
  return getPath(actor, field.path);
}

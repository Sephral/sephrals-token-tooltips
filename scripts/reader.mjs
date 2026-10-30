/**
 * Reads the values of the fields from a token, with the few Foundry helpers the presets need.
 */

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

/** The helpers readers may use. */
export const ENV = {effectsOf, barOf, choiceName};

/**
 * Read one field from a token.
 * @param {object} field             The field definition
 * @param {TokenDocument} token
 * @returns {*}
 */
export function readField(field, token) {
  const actor = token?.actor ?? null;
  if ( field.read ) return field.read({actor, token, env: ENV});
  return getPath(actor, field.path);
}

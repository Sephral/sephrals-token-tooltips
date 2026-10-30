/**
 * Fields other modules add through the API, and the field list of this world.
 */

import {MODULE_ID, setting} from "./config.mjs";
import {fieldsFor, normalizeConfig} from "./fields.mjs";
import {presetFor} from "./presets.mjs";

/** The types a field from another module can have. */
export const API_TYPES = ["number", "text", "resource", "count", "list", "movement", "effects"];

/** Fields registered by other modules. */
const registered = [];

/**
 * Add a field from another module. It appears in the field list of the matching systems and can be configured like
 * the others.
 * @param {object} data
 * @param {string} data.id                 Unique id, letters, digits, "-" and "_"
 * @param {string} data.label              Text or translation key
 * @param {string} [data.type="text"]      One of API_TYPES
 * @param {Function} [data.read]           (actor, tokenDocument) => value
 * @param {string} [data.path]             A path on the actor, when there is no read function
 * @param {string[]} [data.systems]        Game systems the field is for (all when empty)
 * @param {string} [data.icon]             Font Awesome classes
 * @param {object} [data.defaults]         {enabled, audience, forms, display}
 * @returns {object}                       The registered definition
 */
export function registerField(data) {
  const id = String(data?.id ?? "");
  if ( !/^[A-Za-z0-9_-]+$/.test(id) ) throw new Error(`${MODULE_ID} | registerField needs an id of letters, digits, - and _`);
  if ( registered.some(f => f.id === id) || presetFor(game.system.id).fields.some(f => f.id === id) ) {
    throw new Error(`${MODULE_ID} | A field with the id "${id}" exists already`);
  }
  if ( (typeof data.read !== "function") && (typeof data.path !== "string") ) {
    throw new Error(`${MODULE_ID} | registerField needs a read function or a path`);
  }
  const read = data.read;
  const field = {
    id,
    type: API_TYPES.includes(data.type) ? data.type : "text",
    label: String(data.label ?? id),
    icon: typeof data.icon === "string" ? data.icon : "fa-solid fa-puzzle-piece",
    systems: Array.isArray(data.systems) ? data.systems.map(String) : [],
    path: typeof data.path === "string" ? data.path : undefined,
    read: read ? ({actor, token}) => read(actor, token) : undefined,
    defaults: normalizeConfig(data.defaults),
    external: true
  };
  registered.push(field);
  Hooks.callAll(`${MODULE_ID}.fieldsChanged`);
  return field;
}

/**
 * The fields other modules registered.
 * @returns {object[]}
 */
export function registeredFields() {
  return [...registered];
}

/**
 * The field list of this world: the preset of the system, registered fields and the GM's own, configured.
 * @returns {object[]}
 */
export function currentFields() {
  return fieldsFor(game.system.id, setting("fieldConfig"), registered);
}

/**
 * The field list of the active preset: the preset's fields, fields other modules registered and the GM's own fields,
 * in the GM's order and with the GM's settings. Pure functions: the caller passes the stored configuration.
 */

import {CUSTOM_FORMATS, customReader, presetFor} from "./presets.mjs";
import {choicesFor} from "./shortlists.mjs";
import {AUDIENCES, FORM_KEYS, FORMS} from "./visibility.mjs";

/** How a resource is shown to those who see it exactly. */
export const DISPLAYS = ["both", "bar", "number"];

/** The configuration a field gets when it brings none. */
export const FALLBACK = {enabled: true, audience: "owner", display: "both",
  forms: {party: "exact", friendly: "exact", neutral: "hidden", hostile: "hidden", secret: "hidden"}};

/**
 * A clean configuration of one field: unknown values fall back to the field's defaults. A field whose defaults have no
 * party form (registered by another module) shows the party like friendly tokens.
 * @param {object} [raw]        What is stored
 * @param {object} [defaults]   The field's defaults
 * @returns {{enabled: boolean, audience: string, forms: object, display: string}}
 */
export function normalizeConfig(raw, defaults=FALLBACK) {
  const base = {...FALLBACK, ...defaults, forms: {...FALLBACK.forms, ...defaults?.forms}};
  if ( !defaults?.forms?.party ) base.forms.party = base.forms.friendly;
  const forms = {};
  for ( const key of FORM_KEYS ) {
    const value = raw?.forms?.[key];
    forms[key] = FORMS.includes(value) ? value : base.forms[key];
  }
  return {
    enabled: typeof raw?.enabled === "boolean" ? raw.enabled : base.enabled,
    audience: AUDIENCES.includes(raw?.audience) ? raw.audience : base.audience,
    forms,
    display: DISPLAYS.includes(raw?.display) ? raw.display : base.display
  };
}

/**
 * A clean custom field, or null when it cannot be used.
 * @param {object} raw   {id, label, path, format}
 * @returns {{id: string, label: string, path: string, format: string}|null}
 */
export function sanitizeCustom(raw) {
  const id = String(raw?.id ?? "");
  const label = String(raw?.label ?? "").trim().slice(0, 40);
  const path = String(raw?.path ?? "").trim();
  const format = CUSTOM_FORMATS.includes(raw?.format) ? raw.format : "text";
  if ( !/^custom-[a-z0-9]+$/.test(id) || !label || !/^[A-Za-z0-9_.-]+$/.test(path) ) return null;
  return {id, label, path, format};
}

/**
 * A new id for a custom field that is not in use yet.
 * @param {string[]} taken
 * @param {Function} [random=Math.random]
 * @returns {string}
 */
export function newCustomId(taken, random=Math.random) {
  for ( ;; ) {
    const id = `custom-${Math.floor(random() * 36 ** 6).toString(36).padStart(6, "0")}`;
    if ( !taken.includes(id) ) return id;
  }
}

/**
 * The field definition of a custom field. A path the preset's shortlist knows names its keys (damage types, sizes)
 * the way the system does.
 * @param {{id: string, label: string, path: string, format: string}} custom
 * @param {string} [presetId="generic"]
 * @returns {object}
 */
export function customDefinition(custom, presetId="generic") {
  return {id: custom.id, type: custom.format, label: custom.label, plainLabel: true, custom: true, path: custom.path,
    icon: "fa-solid fa-tag", read: customReader(custom.path, custom.format, choicesFor(presetId, custom.path)),
    defaults: FALLBACK};
}

/**
 * The stored configuration of one preset, cleaned.
 * @param {object} stored   The whole stored configuration (by preset id)
 * @param {string} presetId
 * @returns {{order: string[], fields: object, custom: object[]}}
 */
export function storedFor(stored, presetId) {
  const entry = stored?.[presetId] ?? {};
  return {
    order: Array.isArray(entry.order) ? entry.order.filter(id => typeof id === "string") : [],
    fields: (entry.fields && (typeof entry.fields === "object")) ? entry.fields : {},
    custom: Array.isArray(entry.custom) ? entry.custom.map(sanitizeCustom).filter(Boolean) : []
  };
}

/**
 * The fields of a preset in the GM's order, each with its configuration.
 * @param {string} systemId     The game system
 * @param {object} stored       The whole stored configuration
 * @param {object[]} [registered]   Fields other modules registered: {id, systems?, ...definition}
 * @returns {object[]}          Definitions with `config`
 */
export function fieldsFor(systemId, stored, registered=[]) {
  const preset = presetFor(systemId);
  const own = storedFor(stored, preset.id);
  const extra = registered.filter(f => !f.systems?.length || f.systems.includes(systemId) || f.systems.includes(preset.id));
  const all = [...preset.fields, ...extra, ...own.custom.map(custom => customDefinition(custom, preset.id))];
  const byId = new Map();
  for ( const field of all ) if ( !byId.has(field.id) ) byId.set(field.id, field);
  const order = [...own.order.filter(id => byId.has(id)), ...[...byId.keys()].filter(id => !own.order.includes(id))];
  return order.map(id => {
    const field = byId.get(id);
    return {...field, config: normalizeConfig(own.fields[id], field.defaults)};
  });
}

/**
 * The fields that show for an actor: switched on and meant for its type.
 * @param {object[]} fields
 * @param {string} [actorType]
 * @returns {object[]}
 */
export function activeFields(fields, actorType) {
  return fields.filter(f => f.config.enabled && (!f.actorTypes?.length || f.actorTypes.includes(actorType)));
}

/**
 * The stored form of a preset's field list, as the configuration window saves it.
 * @param {object[]} fields   Definitions with `config`, in order
 * @returns {{order: string[], fields: object, custom: object[]}}
 */
export function toStored(fields) {
  const result = {order: fields.map(f => f.id), fields: {}, custom: []};
  for ( const field of fields ) {
    result.fields[field.id] = normalizeConfig(field.config, field.defaults);
    if ( field.custom ) result.custom.push(sanitizeCustom({id: field.id, label: field.label, path: field.path, format: field.type}));
  }
  result.custom = result.custom.filter(Boolean);
  return result;
}

/**
 * Move a field one step up or down.
 * @param {string[]} order
 * @param {string} id
 * @param {number} step   -1 up, +1 down
 * @returns {string[]}
 */
export function moveField(order, id, step) {
  const list = [...order];
  const index = list.indexOf(id);
  const target = index + step;
  if ( (index < 0) || (target < 0) || (target >= list.length) ) return list;
  [list[index], list[target]] = [list[target], list[index]];
  return list;
}

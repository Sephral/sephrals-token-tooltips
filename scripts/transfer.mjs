/**
 * Export and import of the field set: what the file holds, how it is read back and what an import changes. Pure
 * functions without Foundry, the window passes the field list and shows the result.
 */

import {fieldsFor, newCustomId, normalizeConfig, sanitizeCustom, toStored} from "./fields.mjs";
import {FORM_KEYS} from "./visibility.mjs";

/** The id of the module that writes the files, and the version of their layout. */
export const FILE_MODULE = "sephrals-token-tooltips";
export const FILE_FORMAT = 1;

/** The ways an import can combine the file with the fields of the window. */
export const MODES = ["merge", "replace"];

/**
 * The content of an export file: the field set of the system the window shows.
 * @param {object} data
 * @param {string} data.presetId
 * @param {string} data.systemId
 * @param {string} [data.moduleVersion]
 * @param {object[]} data.fields   The field list of the window (definitions with config), in order
 * @param {Date} [data.now]
 * @returns {object}
 */
export function buildExport({presetId, systemId, moduleVersion="", fields, now=new Date()}) {
  return {module: FILE_MODULE, kind: "fields", format: FILE_FORMAT, moduleVersion, system: systemId, preset: presetId,
    exported: now.toISOString(), ...toStored(fields)};
}

/**
 * The name of an export file.
 * @param {string} presetId
 * @param {Date} [now]
 * @returns {string}
 */
export function exportName(presetId, now=new Date()) {
  const day = now.toISOString().slice(0, 10);
  return `token-tooltips-${String(presetId).replace(/[^A-Za-z0-9_-]/g, "")}-${day}.json`;
}

/**
 * Read the text of an import file. A file that is not ours, from a newer layout or without fields is refused with a
 * reason; unusable own fields in it are dropped and counted.
 * @param {string} text
 * @returns {{ok: true, preset: string, order: string[], fields: object, custom: object[], dropped: number}
 *   |{ok: false, reason: "json"|"module"|"format"|"empty"}}
 */
export function parseImport(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch(err) {
    return {ok: false, reason: "json"};
  }
  if ( !data || (typeof data !== "object") || (data.module !== FILE_MODULE) || (data.kind !== "fields") ) {
    return {ok: false, reason: "module"};
  }
  if ( Number(data.format) !== FILE_FORMAT ) return {ok: false, reason: "format"};
  const rawFields = (data.fields && (typeof data.fields === "object") && !Array.isArray(data.fields)) ? data.fields : null;
  const order = Array.isArray(data.order) ? data.order.filter(id => typeof id === "string") : [];
  if ( !rawFields || !Object.keys(rawFields).length ) return {ok: false, reason: "empty"};
  const rawCustom = Array.isArray(data.custom) ? data.custom : [];
  const custom = rawCustom.map(sanitizeCustom).filter(Boolean);
  return {ok: true, preset: String(data.preset ?? ""), order, fields: rawFields, custom, dropped: rawCustom.length - custom.length};
}

/**
 * What an import would make of the field list.
 * @param {object} options
 * @param {string} options.systemId
 * @param {string} options.presetId
 * @param {object[]} options.current            The field list of the window (definitions with config), in order
 * @param {{order: string[], fields: object, custom: object[]}} options.imported   See parseImport
 * @param {"merge"|"replace"} options.mode      Merge keeps what the file does not mention, replace takes the file as it is
 * @param {object[]} [options.registered]       Fields other modules registered
 * @param {Function} [options.random]           For new ids of own fields
 * @returns {{fields: object[], changes: object[], unknown: string[]}}
 */
export function planImport({systemId, presetId, current, imported, mode, registered=[], random=Math.random}) {
  const before = toStored(current);
  let stored;
  if ( mode === "replace" ) {
    stored = {order: imported.order, fields: imported.fields, custom: imported.custom};
  }
  else {
    // An own field of the file with the id of another own field of the window gets an id of its own
    const taken = [...before.order, ...imported.order];
    const sameField = (a, b) => (a.label === b.label) && (a.path === b.path) && (a.format === b.format);
    const renamed = new Map();
    const custom = [...before.custom];
    for ( const entry of imported.custom ) {
      const have = custom.find(c => c.id === entry.id);
      if ( !have ) custom.push(entry);
      else if ( !sameField(have, entry) ) {
        const id = newCustomId(taken, random);
        taken.push(id);
        renamed.set(entry.id, id);
        custom.push({...entry, id});
      }
    }
    const rename = id => renamed.get(id) ?? id;
    const fields = {...before.fields};
    for ( const [id, config] of Object.entries(imported.fields) ) fields[rename(id)] = config;
    const order = [...imported.order.map(rename), ...before.order.filter(id => !imported.order.map(rename).includes(id))];
    stored = {order, fields, custom};
  }
  const result = fieldsFor(systemId, {[presetId]: stored}, registered);
  const known = new Set(result.map(f => f.id));
  const unknown = Object.keys(imported.fields).filter(id => !known.has(id) && !imported.custom.some(c => c.id === id));
  return {fields: result, changes: diffFields(current, result), unknown};
}

/**
 * Compare two field lists.
 * @param {object[]} before   Definitions with config
 * @param {object[]} after
 * @returns {Array<{kind: "added"|"removed"|"changed"|"order", id?: string, field?: object, what?: string[]}>}
 */
export function diffFields(before, after) {
  const changes = [];
  const was = new Map(before.map(f => [f.id, f]));
  const now = new Map(after.map(f => [f.id, f]));
  for ( const field of after ) {
    const old = was.get(field.id);
    if ( !old ) {
      changes.push({kind: "added", id: field.id, field});
      continue;
    }
    const what = configChanges(old, field);
    if ( what.length ) changes.push({kind: "changed", id: field.id, field, before: old, what});
  }
  for ( const field of before ) if ( !now.has(field.id) ) changes.push({kind: "removed", id: field.id, field});
  const orderBefore = before.map(f => f.id).filter(id => now.has(id));
  const orderAfter = after.map(f => f.id).filter(id => was.has(id));
  if ( orderBefore.join() !== orderAfter.join() ) changes.push({kind: "order"});
  return changes;
}

/**
 * Each changed setting of a changed field with its value before and after, for the import preview.
 * @param {{field: object, before?: object, what: string[]}} change
 * @returns {Array<{key: string, from: string|boolean, to: string|boolean}>}
 */
export function changeDetails(change) {
  if ( !change?.before || !change.field ) return (change?.what ?? []).map(key => ({key, from: null, to: null}));
  const x = normalizeConfig(change.before.config, change.before.defaults);
  const y = normalizeConfig(change.field.config, change.field.defaults);
  return change.what.map(key => {
    if ( key.startsWith("forms.") ) return {key, from: x.forms[key.slice(6)], to: y.forms[key.slice(6)]};
    return {key, from: x[key], to: y[key]};
  });
}

/**
 * What differs between the configuration of two versions of a field: "enabled", "audience", "display" and the forms
 * (only when the field is for everyone on either side, otherwise they are not used).
 * @param {object} a   Definition with config
 * @param {object} b
 * @returns {string[]}
 */
export function configChanges(a, b) {
  const x = normalizeConfig(a.config, a.defaults);
  const y = normalizeConfig(b.config, b.defaults);
  const what = [];
  if ( x.enabled !== y.enabled ) what.push("enabled");
  if ( x.audience !== y.audience ) what.push("audience");
  if ( (x.audience === "everyone") || (y.audience === "everyone") ) {
    for ( const key of FORM_KEYS ) if ( x.forms[key] !== y.forms[key] ) what.push(`forms.${key}`);
  }
  if ( x.display !== y.display ) what.push("display");
  return what;
}

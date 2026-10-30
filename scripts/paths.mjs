/**
 * Help for the data path of an own field: the shortlist of common values of the preset, the full list of every value
 * of an actor, search and labels. Pure functions without Foundry: the caller passes the data and a localize function.
 */

import {GROUPS, shortlistOf} from "./shortlists.mjs";

/**
 * A path as a custom field reads it: trimmed and without a leading "actor.".
 * @param {string} path
 * @returns {string}
 */
export function normalizePath(path) {
  return String(path ?? "").trim().replace(/^actor\./, "");
}

/**
 * The paths fields of the list already show (preset fields with a path and own fields).
 * @param {object[]} fields
 * @returns {Set<string>}
 */
export function takenPaths(fields) {
  return new Set((fields ?? []).filter(f => typeof f.path === "string").map(f => normalizePath(f.path)));
}

/**
 * The shortlist of a preset without the values that already are a field.
 * @param {string} presetId
 * @param {object[]} fields
 * @returns {object[]}
 */
export function shortlistFor(presetId, fields) {
  const taken = takenPaths(fields);
  return shortlistOf(presetId).filter(entry => !taken.has(entry.path));
}

/**
 * Whether a value is a resource: an object with a current value and a maximum, both numbers.
 * @param {*} value
 * @returns {boolean}
 */
export function isResource(value) {
  if ( !value || (typeof value !== "object") || Array.isArray(value) ) return false;
  return (typeof value.value === "number") && (typeof value.max === "number");
}

/**
 * Whether an object is a Foundry document (an actor a value points back to): the full list never follows those.
 * @param {object} value
 * @returns {boolean}
 */
function isDocument(value) {
  try {
    return (typeof value.documentName === "string") && (typeof value.uuid === "string");
  } catch(err) {
    return false;
  }
}

/**
 * The format a value suggests for a custom field.
 * @param {*} value
 * @returns {"number"|"text"|"list"|"resource"}
 */
export function formatOf(value) {
  if ( typeof value === "number" ) return "number";
  if ( (value instanceof Set) || Array.isArray(value) ) return "list";
  if ( isResource(value) ) return "resource";
  return "text";
}

/**
 * Every value of an object as a data path: numbers, texts, yes/no and empty values, lists (arrays and sets, not
 * followed further) and resources (an object with value and max, offered as one entry instead of its two numbers).
 * Keys starting with "_", functions, maps, documents the data points back to and getters of the object itself (shims
 * for old places of a value that warn when read) stay out.
 * @param {object} data                The data, usually actor.system
 * @param {object} [options]
 * @param {string} [options.prefix="system"]
 * @param {number} [options.depth=8]   How deep to follow objects
 * @param {number} [options.limit=2500] At most this many entries
 * @returns {Array<{path: string, format: string, value: *}>}
 */
export function flattenPaths(data, {prefix="system", depth=8, limit=2500}={}) {
  const out = [];
  const seen = new WeakSet();
  const walk = (object, path, level) => {
    if ( seen.has(object) ) return;
    seen.add(object);
    const resource = isResource(object);
    for ( const key of Object.keys(object) ) {
      if ( out.length >= limit ) return;
      if ( key.startsWith("_") ) continue;
      if ( resource && ((key === "value") || (key === "max")) ) continue;
      // A getter of the object itself is a shim for an old place of a value (it warns when read), not data
      if ( Object.getOwnPropertyDescriptor(object, key)?.get ) continue;
      let value;
      try {
        value = object[key];
      } catch(err) {
        continue;
      }
      if ( typeof value === "function" ) continue;
      const full = `${path}.${key}`;
      if ( (value === null) || (value === undefined) || (typeof value !== "object") ) {
        out.push({path: full, format: formatOf(value), value: value ?? null});
        continue;
      }
      if ( (value instanceof Set) || Array.isArray(value) ) {
        out.push({path: full, format: "list", value});
        continue;
      }
      if ( (value instanceof Map) || isDocument(value) ) continue;
      if ( isResource(value) ) out.push({path: full, format: "resource", value});
      if ( level < depth ) walk(value, full, level + 1);
    }
  };
  if ( data && (typeof data === "object") ) walk(data, prefix, 1);
  return out;
}

/** Last parts of a path that say little on their own: the label takes the part before them as well. */
const VAGUE = new Set(["value", "total", "mod", "passive", "dc", "max", "min", "base", "bonus", "temp", "die", "sides",
  "current", "score", "label", "name", "level"]);

/**
 * A word of a path as a label part: short words in capitals (hp, gp), others with a capital letter and spaces between
 * the words of camelCase.
 * @param {string} word
 * @returns {string}
 */
function nice(word) {
  if ( word.length <= 3 ) return word.toUpperCase();
  const spaced = word.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[-_]/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

/**
 * A label made from a path: "system.currency.gp" is "GP", "system.skills.ste.passive" "STE passive".
 * @param {string} path
 * @returns {string}
 */
export function suggestLabel(path) {
  const parts = normalizePath(path).split(".").filter(Boolean).filter(p => !["system", "token"].includes(p));
  if ( !parts.length ) return "";
  if ( (parts.length > 1) && (parts.at(-1) === "value") ) parts.pop();
  const last = parts.at(-1);
  if ( (parts.length > 1) && VAGUE.has(last) ) return `${nice(parts.at(-2))} ${last.toLowerCase()}`.slice(0, 40);
  return nice(last).slice(0, 40);
}

/**
 * The text of a label spec of a shortlist entry: the first key the game knows, or {key, data} with its data
 * localized, or a label made from the path.
 * @param {{label: *, path: string}} entry
 * @param {object} i18n
 * @param {Function} i18n.has       (key) => boolean
 * @param {Function} i18n.t         (key, data?) => text
 * @returns {string}
 */
export function entryLabel(entry, {has, t}) {
  const spec = entry.label;
  if ( spec && (typeof spec === "object") && !Array.isArray(spec) ) {
    if ( !has(spec.key) ) return suggestLabel(entry.path);
    const data = Object.fromEntries(Object.entries(spec.data ?? {}).map(([k, v]) => [k,
      ((typeof v === "string") && has(v)) ? t(v) : v]));
    return t(spec.key, data);
  }
  const keys = Array.isArray(spec) ? spec : [spec];
  const known = keys.find(key => (typeof key === "string") && has(key));
  return known ? t(known) : suggestLabel(entry.path);
}

/**
 * A short text of a raw value for the lists: numbers and texts as they are, lists joined, resources as value / max.
 * @param {*} value
 * @param {number} [max=60]
 * @returns {string}
 */
export function previewValue(value, max=60) {
  let text;
  if ( (value === null) || (value === undefined) ) text = "";
  else if ( (value instanceof Set) || Array.isArray(value) ) {
    text = [...value].map(v => ((v && (typeof v === "object")) ? (v.label ?? v.name ?? v.slug ?? "…") : String(v))).join(", ");
  }
  else if ( isResource(value) ) text = `${value.value} / ${value.max}`;
  else if ( typeof value === "object" ) text = "…";
  else text = String(value);
  text = text.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/**
 * The group of a path in the full list: its first part after the prefix ("attributes" for system.attributes.hp).
 * @param {string} path
 * @returns {string}
 */
export function topGroup(path) {
  const parts = normalizePath(path).split(".");
  return (["system", "token"].includes(parts[0]) ? parts[1] : parts[0]) ?? "";
}

/**
 * Entries in groups, in the order of the given group keys (others after them in the order they come).
 * @param {object[]} entries
 * @param {Function} groupOf       (entry) => group key
 * @param {string[]} [order]
 * @returns {Array<{group: string, entries: object[]}>}
 */
export function groupEntries(entries, groupOf, order=GROUPS) {
  const map = new Map();
  for ( const key of order ) map.set(key, []);
  for ( const entry of entries ) {
    const key = groupOf(entry);
    if ( !map.has(key) ) map.set(key, []);
    map.get(key).push(entry);
  }
  return [...map].filter(([, list]) => list.length).map(([group, list]) => ({group, entries: list}));
}

/**
 * The entries that match a search: every word of the query is found in the path, the label or the value text.
 * @param {Array<{path: string, label?: string, text?: string}>} entries
 * @param {string} query
 * @returns {object[]}
 */
export function searchEntries(entries, query) {
  const words = String(query ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  if ( !words.length ) return entries;
  return entries.filter(entry => {
    const haystack = `${entry.path} ${entry.label ?? ""} ${entry.text ?? ""}`.toLowerCase();
    return words.every(word => haystack.includes(word));
  });
}

/**
 * Turns read values into the rows of a tooltip. Pure functions without Foundry: the caller passes a localize function
 * and the values it read from the token.
 */

import {resolveForm} from "./visibility.mjs";

/** The field types that know a description form. */
export const DESCRIBABLE = new Set(["resource", "count", "bar"]);

/**
 * Whether a field has a description form.
 * @param {{type: string, describe?: boolean}} field
 * @returns {boolean}
 */
export function describable(field) {
  return DESCRIBABLE.has(field.type) && (field.describe !== false);
}

/**
 * A number from a value that may be a string, or null.
 * @param {*} value
 * @returns {number|null}
 */
export function toNumber(value) {
  if ( (value === null) || (value === undefined) || (value === "") || (typeof value === "boolean") ) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

/**
 * The health word for the share of health left: unhurt at full, wounded above half, bloodied at or below half,
 * critical at a quarter or less, down at zero.
 * @param {number} fraction   Health left, 0 to 1
 * @returns {"unhurt"|"wounded"|"bloodied"|"critical"|"down"}
 */
export function healthWord(fraction) {
  if ( fraction >= 1 ) return "unhurt";
  if ( fraction > 0.5 ) return "wounded";
  if ( fraction > 0.25 ) return "bloodied";
  if ( fraction > 0 ) return "critical";
  return "down";
}

/**
 * The color tone for the share of health left.
 * @param {number} fraction
 * @returns {"good"|"fair"|"poor"|"bad"|"down"}
 */
export function healthTone(fraction) {
  const word = healthWord(fraction);
  return {unhurt: "good", wounded: "fair", bloodied: "poor", critical: "bad", down: "down"}[word];
}

/**
 * Format a challenge rating: 0.125 → 1/8, 0.25 → 1/4, 0.5 → 1/2, others as they are.
 * @param {*} value
 * @returns {string|null}
 */
export function formatCr(value) {
  const number = toNumber(value);
  if ( number === null ) return null;
  const fractions = {0.125: "1/8", 0.25: "1/4", 0.5: "1/2"};
  return fractions[number] ?? String(number);
}

/**
 * A value with current and maximum (health, a token bar): exact as numbers and/or a bar, or described with a word.
 * @param {{value: *, max?: *}} data
 * @param {"exact"|"descriptive"} form
 * @param {"number"|"bar"|"both"} display
 * @returns {object|null}   Row content: {kind, text?, pct?, tone?, word?}
 */
export function formatResource(data, form, display="both") {
  const value = toNumber(data?.value);
  if ( value === null ) return null;
  const max = toNumber(data?.max);
  if ( !max || (max <= 0) ) return form === "exact" ? {kind: "text", text: String(value)} : null;
  const fraction = Math.max(0, Math.min(1, value / max));
  const tone = healthTone(value / max);
  if ( form === "descriptive" ) return {kind: "word", word: healthWord(value / max), tone};
  const text = `${value} / ${max}`;
  if ( display === "number" ) return {kind: "text", text, tone};
  return {kind: "bar", pct: Math.round(fraction * 100), tone, text: display === "both" ? text : ""};
}

/**
 * A count that grows when things get worse (wounds, fatigue, madness): exact as numbers, or described. The
 * description never says "down": a full count does not always mean out of the fight. With a maximum of zero any count
 * is described as the worst.
 * @param {{value: *, max?: *}} data
 * @param {"exact"|"descriptive"} form
 * @returns {object|null}
 */
export function formatCount(data, form) {
  const value = toNumber(data?.value ?? data);
  if ( value === null ) return null;
  const max = toNumber(data?.max);
  if ( form === "descriptive" ) {
    if ( max === null ) return null;
    // A maximum of zero (Savage Worlds extras): any count at all is the worst
    const left = max > 0 ? 1 - (value / max) : (value > 0 ? 0 : 1);
    const word = left >= 1 ? "unhurt" : (left > 0.5 ? "wounded" : (left > 0 ? "bloodied" : "critical"));
    return {kind: "word", word, tone: {unhurt: "good", wounded: "fair", bloodied: "poor", critical: "bad"}[word]};
  }
  return {kind: "text", text: max ? `${value} / ${max}` : String(value)};
}

/**
 * Speeds as one line: the walking speed first without a label, the others with theirs.
 * @param {Array<{type: string, value: number, units?: string}>} speeds
 * @param {Function} labelOf   Label for a movement type
 * @returns {object|null}
 */
export function formatMovement(speeds, labelOf) {
  const list = (Array.isArray(speeds) ? speeds : []).filter(s => toNumber(s?.value) > 0);
  if ( !list.length ) return null;
  list.sort((a, b) => ((a.type === "walk") ? -1 : (b.type === "walk") ? 1 : 0));
  const parts = list.map(s => {
    const amount = [toNumber(s.value), s.units].filter(v => (v !== null) && (v !== undefined) && (v !== "")).join(" ");
    return s.type === "walk" ? amount : `${labelOf(s.type)} ${amount}`;
  });
  return {kind: "text", text: parts.join(", ")};
}

/**
 * Effects and conditions as icons with their names, each name once.
 * @param {Array<{name: string, img?: string}>} effects
 * @returns {object|null}
 */
export function formatEffects(effects) {
  const seen = new Set();
  const items = [];
  for ( const effect of Array.isArray(effects) ? effects : [] ) {
    const name = String(effect?.name ?? "").trim();
    if ( !name || seen.has(name) ) continue;
    seen.add(name);
    items.push({name, img: effect.img || null});
  }
  return items.length ? {kind: "icons", items} : null;
}

/**
 * A modifier with its sign: +2, 0, -1.
 * @param {*} value
 * @returns {string|null}
 */
export function formatModifier(value) {
  const number = toNumber(value);
  if ( number === null ) return null;
  return number > 0 ? `+${number}` : String(number);
}

/**
 * A die size: 8 becomes d8, {sides: 8, modifier: 1} d8+1 (Savage Worlds traits).
 * @param {*} value
 * @returns {string|null}
 */
export function formatDie(value) {
  if ( (typeof value === "string") && /^d\d+/i.test(value.trim()) ) return value.trim();
  const sides = toNumber((value && (typeof value === "object")) ? value.sides : value);
  if ( !sides || (sides < 2) ) return null;
  const modifier = toNumber(value?.modifier) ?? 0;
  return `d${sides}${modifier ? formatModifier(modifier) : ""}`;
}

/**
 * A list of words (custom list fields).
 * @param {*} value   Array, Set or a single value
 * @returns {object|null}
 */
export function formatList(value) {
  const list = (value instanceof Set) ? [...value] : (Array.isArray(value) ? value : [value]);
  const words = list.map(v => (typeof v === "object" ? (v?.name ?? v?.label ?? "") : v)).map(v => String(v ?? "").trim())
    .filter(Boolean);
  return words.length ? {kind: "text", text: words.join(", ")} : null;
}

/**
 * Format one value by the type of its field.
 * @param {object} field     The field definition with its configuration
 * @param {*} value          The value read from the token
 * @param {"exact"|"descriptive"} form
 * @param {Function} t       Localize function (key) => text
 * @returns {object|null}
 */
export function formatValue(field, value, form, t) {
  if ( (value === null) || (value === undefined) ) return null;
  const labelOf = group => type => {
    const key = `STT.${group}.${type}`;
    const text = t(key);
    return text === key ? type : text;
  };
  switch ( field.type ) {
    case "resource": return formatResource(value, form, field.config?.display ?? "both");
    case "bar": {
      // A token bar: a resource when it has a maximum, otherwise a plain value
      if ( toNumber(value?.max) > 0 ) return formatResource(value, form, field.config?.display ?? "both");
      const number = toNumber(value?.value ?? value);
      return (number === null) || (form !== "exact") ? null : {kind: "text", text: String(number)};
    }
    case "count": return formatCount(value, form);
    case "movement": return formatMovement(value, labelOf("Move"));
    case "senses": return formatMovement(value, labelOf("Sense"));
    case "effects": return formatEffects(value);
    case "cr": {
      const text = formatCr(value);
      return text === null ? null : {kind: "text", text};
    }
    case "list": return formatList(value);
    case "number": {
      // Crucible keeps an immunity as an infinite resistance
      if ( Math.abs(value) === Infinity ) return {kind: "text", text: value > 0 ? "∞" : "-∞"};
      const number = toNumber(value);
      return number === null ? null : {kind: "text", text: String(number)};
    }
    case "modifier": {
      const text = formatModifier(value);
      return text === null ? null : {kind: "text", text};
    }
    case "die": {
      const text = formatDie(value);
      return text === null ? null : {kind: "text", text};
    }
    default: {
      // A yes/no value says yes, and nothing when it is no
      if ( typeof value === "boolean" ) return value ? {kind: "text", text: t("STT.Value.yes")} : null;
      const text = (typeof value === "object") ? null : String(value).trim();
      return text ? {kind: "text", text} : null;
    }
  }
}

/**
 * Build the rows of a tooltip.
 * @param {object[]} fields   Enabled fields in order, each {id, type, label, icon, config}
 * @param {object} context
 * @param {{isGM: boolean, isOwner: boolean, disposition: number}} context.viewer
 * @param {Function} context.read      (field) => value, may throw
 * @param {Function} context.t         Localize function
 * @param {Function} [context.labelOf] (field) => label text
 * @returns {{rows: object[], errors: string[]}}
 */
export function buildRows(fields, {viewer, read, t, labelOf}) {
  const rows = [];
  const errors = [];
  for ( const field of fields ) {
    if ( field.type === "name" ) continue;
    const form = resolveForm(field.config, viewer, {describable: describable(field)});
    if ( !form ) continue;
    let value;
    try {
      value = read(field);
    } catch(err) {
      errors.push(field.id);
      continue;
    }
    const content = formatValue(field, value, form, t);
    if ( !content ) continue;
    if ( content.kind === "word" ) content.text = t(`STT.Health.${content.word}`);
    // A token bar names the attribute it shows
    const label = ((field.type === "bar") && value?.label) ? value.label : (labelOf ? labelOf(field) : field.label);
    rows.push({id: field.id, label, icon: field.icon ?? null, form, ...content});
  }
  return {rows, errors};
}

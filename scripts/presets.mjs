/**
 * The fields each game system shows, with their data paths and default visibility. Pure data and readers that only
 * touch plain properties, so the tests can run them on fake actors. Readers get {actor, token, env}; env holds the
 * few Foundry helpers a reader may need (effects of an actor, a token's bar attribute).
 */

/**
 * Read a dotted path from an object.
 * @param {object} object
 * @param {string} path
 * @returns {*}
 */
export function getPath(object, path) {
  if ( !object || !path ) return undefined;
  return String(path).split(".").reduce((o, key) => ((o === null) || (o === undefined) ? undefined : o[key]), object);
}

/** Forms for everyone else: the exact value for every disposition except secret. */
const EXACT = {party: "exact", friendly: "exact", neutral: "exact", hostile: "exact", secret: "hidden"};

/** Forms for everyone else: exact for the party and friends, described for the rest, nothing for secret tokens. */
const HEALTH = {party: "exact", friendly: "exact", neutral: "descriptive", hostile: "descriptive", secret: "hidden"};

/** Forms for everyone else when the audience is smaller: nothing (used as the starting point if widened). */
const NONE = {party: "exact", friendly: "exact", neutral: "hidden", hostile: "hidden", secret: "hidden"};

/**
 * Default configuration of a field.
 * @param {string} audience
 * @param {object} forms
 * @param {boolean} [enabled=true]
 * @returns {object}
 */
const defaults = (audience, forms, enabled=true, display="both") => ({enabled, audience, forms: {...forms}, display});

/* -------------------------------------------- */
/*  Fields every preset shares                  */
/* -------------------------------------------- */

const NAME = {id: "name", type: "name", label: "STT.Field.name", icon: "fa-solid fa-id-badge",
  defaults: defaults("everyone", EXACT)};
const EFFECTS = {id: "effects", type: "effects", label: "STT.Field.effects", icon: "fa-solid fa-bolt",
  read: ({actor, env}) => env.effectsOf(actor), defaults: defaults("everyone", EXACT)};

/**
 * A resource {value, max} from a path, or null.
 * @param {string} path
 * @returns {Function}
 */
const resourceAt = path => ({actor}) => {
  const data = getPath(actor, path);
  if ( !data || (typeof data !== "object") ) return null;
  return {value: data.value, max: data.effectiveMax ?? data.max};
};

/**
 * A number from a path that hides when it is zero (temporary hit points).
 * @param {string} path
 * @returns {Function}
 */
const positiveAt = path => ({actor}) => {
  const value = Number(getPath(actor, path));
  return value > 0 ? value : null;
};

/**
 * A pool {value, max} from a path that only counts when the actor has it: a maximum above zero (focus points of a
 * creature without focus spells stay out).
 * @param {string} path
 * @returns {Function}
 */
const poolAt = path => ({actor}) => {
  const pool = getPath(actor, path);
  return (pool && (typeof pool === "object") && (Number(pool.max) > 0)) ? {value: pool.value, max: pool.max} : null;
};

/* -------------------------------------------- */
/*  D&D 5e                                      */
/* -------------------------------------------- */

/** dnd5e movement types in the order they are listed. */
const DND5E_MOVES = ["walk", "fly", "swim", "climb", "burrow"];

/**
 * dnd5e speeds: system.attributes.movement holds a number per type, the units and whether flying is hovering.
 * @param {{actor: object}} data
 * @returns {Array<{type: string, value: number, units: string}>|null}
 */
export function dnd5eSpeeds({actor}) {
  const movement = getPath(actor, "system.attributes.movement");
  if ( !movement ) return null;
  const units = movement.units ?? "ft";
  return DND5E_MOVES.map(type => ({type: ((type === "fly") && movement.hover) ? "hover" : type,
    value: Number(movement[type]) || 0, units})).filter(s => s.value > 0);
}

/** dnd5e senses in the order they are listed. */
const DND5E_SENSES = ["darkvision", "blindsight", "tremorsense", "truesight"];

/**
 * dnd5e senses: system.attributes.senses holds a range per sense in its ranges (dnd5e 5.3 and newer, the old places
 * warn) or directly (older versions), and the units.
 * @param {{actor: object}} data
 * @returns {Array<{type: string, value: number, units: string}>|null}
 */
export function dnd5eSenses({actor}) {
  const senses = getPath(actor, "system.attributes.senses");
  if ( !senses || (typeof senses !== "object") ) return null;
  const units = senses.units ?? "ft";
  const ranges = (senses.ranges && (typeof senses.ranges === "object")) ? senses.ranges : senses;
  const list = DND5E_SENSES.map(type => ({type, value: Number(ranges[type]) || 0, units})).filter(s => s.value > 0);
  return list.length ? list : null;
}

/**
 * The spell save DC of a dnd5e actor that casts spells (a spellcasting ability is set): dnd5e works out a DC for
 * every actor, also for fighters.
 * @param {{actor: object}} data
 * @returns {number|null}
 */
export function dnd5eSpellDc({actor}) {
  if ( !getPath(actor, "system.attributes.spellcasting") ) return null;
  const dc = Number(getPath(actor, "system.attributes.spell.dc"));
  return Number.isFinite(dc) && (dc > 0) ? dc : null;
}

const DND5E = {
  id: "dnd5e",
  fields: [
    NAME,
    {id: "hp", type: "resource", label: "STT.Field.hp", icon: "fa-solid fa-heart",
      read: resourceAt("system.attributes.hp"), defaults: defaults("everyone", HEALTH)},
    {id: "tempHp", type: "number", label: "STT.Field.tempHp", icon: "fa-solid fa-heart-circle-plus",
      read: positiveAt("system.attributes.hp.temp"), defaults: defaults("owner", NONE)},
    {id: "ac", type: "number", label: "STT.Field.ac", icon: "fa-solid fa-shield-halved",
      path: "system.attributes.ac.value", defaults: defaults("owner", NONE)},
    {id: "speed", type: "movement", label: "STT.Field.speed", icon: "fa-solid fa-person-running",
      read: dnd5eSpeeds, defaults: defaults("everyone", EXACT)},
    {id: "passive", type: "number", label: "STT.Field.passivePerception", icon: "fa-solid fa-eye",
      path: "system.skills.prc.passive", defaults: defaults("owner", NONE)},
    // Often needed in play, off until the GM ticks them
    {id: "passiveInsight", type: "number", label: "STT.Field.passiveInsight", icon: "fa-solid fa-lightbulb",
      path: "system.skills.ins.passive", defaults: defaults("owner", NONE, false)},
    {id: "passiveInvestigation", type: "number", label: "STT.Field.passiveInvestigation",
      icon: "fa-solid fa-magnifying-glass", path: "system.skills.inv.passive", defaults: defaults("owner", NONE, false)},
    {id: "spellDc", type: "number", label: "STT.Field.spellDc", icon: "fa-solid fa-wand-sparkles",
      path: "system.attributes.spell.dc", read: dnd5eSpellDc, defaults: defaults("owner", NONE, false)},
    {id: "inspiration", type: "text", label: "STT.Field.inspiration", icon: "fa-solid fa-sun", actorTypes: ["character"],
      path: "system.attributes.inspiration", defaults: defaults("everyone", NONE, false)},
    {id: "senses", type: "senses", label: "STT.Field.senses", icon: "fa-solid fa-moon", read: dnd5eSenses,
      defaults: defaults("owner", NONE, false)},
    {id: "level", type: "number", label: "STT.Field.level", icon: "fa-solid fa-star", actorTypes: ["character"],
      path: "system.details.level", defaults: defaults("owner", NONE)},
    {id: "cr", type: "cr", label: "STT.Field.cr", icon: "fa-solid fa-skull", actorTypes: ["npc"],
      path: "system.details.cr", defaults: defaults("gm", NONE)},
    EFFECTS
  ]
};

/* -------------------------------------------- */
/*  Pathfinder 2e                               */
/* -------------------------------------------- */

/** PF2e 8 movement types in the order they are listed (travel speed stays out). */
const PF2E_MOVES = [["land", "walk"], ["fly", "fly"], ["swim", "swim"], ["climb", "climb"], ["burrow", "burrow"]];

/**
 * PF2e speeds: PF2e 8 keeps one entry per type in system.movement.speeds, PF2e 7 the land speed in
 * system.attributes.speed and the others in its list otherSpeeds.
 * @param {{actor: object}} data
 * @returns {Array<{type: string, value: number, units: string}>|null}
 */
export function pf2eSpeeds({actor}) {
  const amount = s => Number(s?.total ?? s?.value) || 0;
  const speeds = getPath(actor, "system.movement.speeds");
  if ( speeds && (typeof speeds === "object") ) {
    const list = PF2E_MOVES.map(([key, type]) => ({type, value: amount(speeds[key]), units: "ft"})).filter(s => s.value > 0);
    return list.length ? list : null;
  }
  const speed = getPath(actor, "system.attributes.speed");
  if ( !speed ) return null;
  const list = [{type: "walk", value: amount(speed), units: "ft"}];
  for ( const other of Array.isArray(speed.otherSpeeds) ? speed.otherSpeeds : [] ) {
    list.push({type: other.type ?? other.slug ?? "other", value: amount(other), units: "ft"});
  }
  const found = list.filter(s => s.value > 0);
  return found.length ? found : null;
}

/**
 * A modifier shown with its sign (+7, -1), from the first of several paths that holds a number: the actor's own
 * statistic (PF2e 7 and 8), else the prepared data (PF2e 8 calls it value, PF2e 7 NPCs mod).
 * @param {...string} paths
 * @returns {Function}
 */
const modifierAt = (...paths) => ({actor}) => {
  for ( const path of paths ) {
    const value = getPath(actor, path);
    if ( (value === null) || (value === undefined) || (value === "") || !Number.isFinite(Number(value)) ) continue;
    return Number(value) >= 0 ? `+${Number(value)}` : String(Number(value));
  }
  return null;
};

const PF2E = {
  id: "pf2e",
  // Loot piles and merchants (and the party) are things, not creatures: no tooltip, instead of "Level 0"
  objectTypes: ["loot", "party"],
  fields: [
    NAME,
    {id: "hp", type: "resource", label: "STT.Field.hp", icon: "fa-solid fa-heart",
      read: resourceAt("system.attributes.hp"), defaults: defaults("everyone", HEALTH)},
    {id: "tempHp", type: "number", label: "STT.Field.tempHp", icon: "fa-solid fa-heart-circle-plus",
      read: positiveAt("system.attributes.hp.temp"), defaults: defaults("owner", NONE)},
    {id: "ac", type: "number", label: "STT.Field.ac", icon: "fa-solid fa-shield-halved",
      path: "system.attributes.ac.value", defaults: defaults("owner", NONE)},
    {id: "speed", type: "movement", label: "STT.Field.speed", icon: "fa-solid fa-person-running",
      read: pf2eSpeeds, defaults: defaults("everyone", EXACT)},
    {id: "perception", type: "text", label: "STT.Field.perception", icon: "fa-solid fa-eye",
      read: modifierAt("perception.mod", "system.perception.value", "system.perception.mod"), defaults: defaults("owner", NONE)},
    {id: "fortitude", type: "text", label: "STT.Field.fortitude", icon: "fa-solid fa-dumbbell",
      read: modifierAt("saves.fortitude.mod", "system.saves.fortitude.value", "system.saves.fortitude.mod"), defaults: defaults("owner", NONE, false)},
    {id: "reflex", type: "text", label: "STT.Field.reflex", icon: "fa-solid fa-person-running",
      read: modifierAt("saves.reflex.mod", "system.saves.reflex.value", "system.saves.reflex.mod"), defaults: defaults("owner", NONE, false)},
    {id: "will", type: "text", label: "STT.Field.will", icon: "fa-solid fa-brain",
      read: modifierAt("saves.will.mod", "system.saves.will.value", "system.saves.will.mod"), defaults: defaults("owner", NONE, false)},
    {id: "level", type: "number", label: "STT.Field.level", icon: "fa-solid fa-star",
      path: "system.details.level.value", defaults: defaults("gm", NONE)},
    // Often needed in play, off until the GM ticks them
    {id: "heroPoints", type: "resource", describe: false, label: "STT.Field.heroPoints", icon: "fa-solid fa-medal",
      actorTypes: ["character"], path: "system.resources.heroPoints", read: poolAt("system.resources.heroPoints"),
      defaults: defaults("owner", NONE, false, "number")},
    {id: "focusPoints", type: "resource", describe: false, label: "STT.Field.focusPoints", icon: "fa-solid fa-hand-sparkles",
      path: "system.resources.focus", read: poolAt("system.resources.focus"), defaults: defaults("owner", NONE, false, "number")},
    {id: "classDc", type: "number", label: "STT.Field.classDc", icon: "fa-solid fa-bullseye",
      path: "system.attributes.classDC.value", defaults: defaults("owner", NONE, false)},
    EFFECTS
  ]
};

/* -------------------------------------------- */
/*  Savage Worlds Adventure Edition             */
/* -------------------------------------------- */

/**
 * SWADE pace: SWADE 6 keeps one pace per mode in system.pace, SWADE 5 the ground pace in system.stats.speed.
 * @param {{actor: object}} data
 * @returns {Array<{type: string, value: number}>|null}
 */
export function swadePaces({actor}) {
  const pace = getPath(actor, "system.pace");
  const list = [];
  if ( pace && (typeof pace === "object") ) {
    for ( const type of ["ground", "fly", "swim", "burrow"] ) {
      const value = Number(pace[type]?.value ?? pace[type]) || 0;
      if ( value > 0 ) list.push({type: type === "ground" ? "walk" : type, value});
    }
  }
  if ( !list.length ) {
    const speed = Number(getPath(actor, "system.stats.speed.adjusted") ?? getPath(actor, "system.stats.speed.value"));
    if ( speed > 0 ) list.push({type: "walk", value: speed});
  }
  return list.length ? list : null;
}

/**
 * SWADE toughness with the armor part in brackets, as the sheet shows it: 8 (2).
 * @param {{actor: object}} data
 * @returns {string|null}
 */
export function swadeToughness({actor}) {
  const toughness = getPath(actor, "system.stats.toughness");
  const value = Number(toughness?.value);
  if ( !Number.isFinite(value) ) return null;
  const armor = Number(toughness.armor) || 0;
  return armor ? `${value} (${armor})` : String(value);
}

const SWADE = {
  id: "swade",
  fields: [
    NAME,
    {id: "wounds", type: "count", label: "STT.Field.wounds", icon: "fa-solid fa-droplet",
      read: ({actor}) => getPath(actor, "system.wounds") ?? null, defaults: defaults("everyone", HEALTH)},
    {id: "fatigue", type: "count", describe: false, label: "STT.Field.fatigue", icon: "fa-solid fa-bed",
      read: ({actor}) => getPath(actor, "system.fatigue") ?? null, defaults: defaults("owner", NONE)},
    {id: "parry", type: "number", label: "STT.Field.parry", icon: "fa-solid fa-shield-halved",
      path: "system.stats.parry.value", defaults: defaults("owner", NONE)},
    {id: "toughness", type: "text", label: "STT.Field.toughness", icon: "fa-solid fa-shield",
      read: swadeToughness, defaults: defaults("owner", NONE)},
    {id: "pace", type: "movement", label: "STT.Field.pace", icon: "fa-solid fa-person-running",
      read: swadePaces, defaults: defaults("everyone", EXACT)},
    {id: "bennies", type: "number", label: "STT.Field.bennies", icon: "fa-solid fa-coins",
      path: "system.bennies.value", defaults: defaults("owner", NONE)},
    // Often needed in play, off until the GM ticks them
    {id: "runDie", type: "die", label: "STT.Field.runDie", icon: "fa-solid fa-dice-d6",
      path: "system.pace.running.die", defaults: defaults("owner", NONE, false)},
    {id: "powerPoints", type: "resource", describe: false, label: "STT.Field.powerPoints",
      icon: "fa-solid fa-wand-magic-sparkles", path: "system.powerPoints.general",
      read: poolAt("system.powerPoints.general"), defaults: defaults("owner", NONE, false, "number")},
    {id: "rank", type: "text", label: "STT.Field.rank", icon: "fa-solid fa-ranking-star",
      path: "system.advances.rank", defaults: defaults("owner", NONE, false)},
    EFFECTS
  ]
};

/* -------------------------------------------- */
/*  Crucible                                    */
/* -------------------------------------------- */

/**
 * A Crucible pool that only counts when the actor has it (wounds and madness need a maximum above zero).
 * @param {string} key
 * @returns {Function}
 */
const cruciblePool = key => ({actor}) => {
  const pool = getPath(actor, `system.resources.${key}`);
  return (pool && (Number(pool.max) > 0)) ? {value: pool.value, max: pool.max} : null;
};

const CRUCIBLE = {
  id: "crucible",
  fields: [
    NAME,
    {id: "health", type: "resource", label: "STT.Field.health", icon: "fa-solid fa-heart",
      read: cruciblePool("health"), defaults: defaults("everyone", HEALTH)},
    {id: "wounds", type: "count", label: "STT.Field.wounds", icon: "fa-solid fa-droplet",
      read: cruciblePool("wounds"), defaults: defaults("owner", NONE)},
    {id: "morale", type: "resource", label: "STT.Field.morale", icon: "fa-solid fa-brain",
      read: cruciblePool("morale"), defaults: defaults("everyone", HEALTH)},
    {id: "madness", type: "count", label: "STT.Field.madness", icon: "fa-solid fa-hurricane",
      read: cruciblePool("madness"), defaults: defaults("owner", NONE)},
    {id: "physical", type: "number", label: "STT.Field.physical", icon: "fa-solid fa-shield-halved",
      path: "system.defenses.physical.total", defaults: defaults("owner", NONE)},
    {id: "fortitude", type: "number", label: "STT.Field.fortitude", icon: "fa-solid fa-dumbbell",
      path: "system.defenses.fortitude.total", defaults: defaults("owner", NONE, false)},
    {id: "reflex", type: "number", label: "STT.Field.reflex", icon: "fa-solid fa-person-running",
      path: "system.defenses.reflex.total", defaults: defaults("owner", NONE, false)},
    {id: "willpower", type: "number", label: "STT.Field.willpower", icon: "fa-solid fa-brain",
      path: "system.defenses.willpower.total", defaults: defaults("owner", NONE, false)},
    {id: "stride", type: "number", label: "STT.Field.stride", icon: "fa-solid fa-person-running",
      path: "system.movement.stride", defaults: defaults("everyone", EXACT)},
    {id: "level", type: "number", label: "STT.Field.level", icon: "fa-solid fa-star",
      path: "system.advancement.level", defaults: defaults("gm", NONE)},
    // Often needed in play, off until the GM ticks them
    {id: "actionPoints", type: "resource", describe: false, label: "STT.Field.actionPoints", icon: "fa-solid fa-bolt",
      path: "system.resources.action", read: cruciblePool("action"), defaults: defaults("owner", NONE, false, "number")},
    {id: "focus", type: "resource", describe: false, label: "STT.Field.focus", icon: "fa-solid fa-hand-sparkles",
      path: "system.resources.focus", read: cruciblePool("focus"), defaults: defaults("owner", NONE, false, "number")},
    {id: "heroism", type: "resource", describe: false, label: "STT.Field.heroism", icon: "fa-solid fa-medal",
      path: "system.resources.heroism", read: cruciblePool("heroism"), defaults: defaults("owner", NONE, false, "number")},
    EFFECTS
  ]
};

/* -------------------------------------------- */
/*  Any other system                            */
/* -------------------------------------------- */

/**
 * A token bar of any system: the attribute the token shows as bar 1 or bar 2.
 * @param {string} bar   "bar1" or "bar2"
 * @returns {Function}
 */
const tokenBar = bar => ({token, env}) => env.barOf(token, bar);

const GENERIC = {
  id: "generic",
  fields: [
    NAME,
    {id: "bar1", type: "bar", label: "STT.Field.bar1", icon: "fa-solid fa-heart", read: tokenBar("bar1"),
      defaults: defaults("everyone", HEALTH)},
    {id: "bar2", type: "bar", label: "STT.Field.bar2", icon: "fa-solid fa-circle-half-stroke", read: tokenBar("bar2"),
      defaults: defaults("owner", NONE)},
    EFFECTS
  ]
};

/** All presets by system id. */
export const PRESETS = {dnd5e: DND5E, pf2e: PF2E, swade: SWADE, crucible: CRUCIBLE, generic: GENERIC};

/**
 * The preset of a game system; systems without their own use the generic one.
 * @param {string} systemId
 * @returns {{id: string, fields: object[]}}
 */
export function presetFor(systemId) {
  return PRESETS[systemId] ?? GENERIC;
}

/** The formats a custom field can have. */
export const CUSTOM_FORMATS = ["number", "modifier", "text", "resource", "count", "list", "die"];

/**
 * Keys turned into names: each key of a list (or a single key) becomes the name the system keeps for it.
 * @param {*} value
 * @param {Function} nameOf   (key) => name
 * @returns {*}
 */
export function nameKeys(value, nameOf) {
  if ( (value instanceof Set) || Array.isArray(value) ) {
    return [...value].map(entry => ((typeof entry === "string") ? nameOf(entry) : entry));
  }
  return typeof value === "string" ? nameOf(value) : value;
}

/**
 * A reader for a custom field: a path on the actor, or on the token when it starts with "token.".
 * @param {string} path
 * @param {string} format
 * @param {string|null} [choices]   Where the system keeps the names of the keys the value holds (see shortlists.mjs)
 * @returns {Function}
 */
export function customReader(path, format, choices=null) {
  const clean = String(path ?? "").trim().replace(/^actor\./, "");
  return ({actor, token, env}) => {
    let value = clean.startsWith("token.") ? getPath(token, clean.slice(6)) : getPath(actor, clean);
    if ( choices && env?.choiceName ) value = nameKeys(value, key => env.choiceName(choices, key));
    if ( ((format === "resource") || (format === "count")) && (value !== null) && (typeof value !== "object") ) {
      return {value};
    }
    return value;
  };
}

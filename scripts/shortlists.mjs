/**
 * Common values per preset for the GM's own fields: data paths the preset's fields do not show, grouped, each with its
 * format and a label. Pure data, checked against the actor data of dnd5e 5.3.3 and 6.0.6, PF2e 7.12.2 and 8.6.1,
 * SWADE 5.2.6 and 6.0.4 and Crucible 0.11.2.
 *
 * A label is a translation key, a list of keys (the first one the game knows wins, so a key that one version of the
 * system renamed still finds a text) or {key, data} for a key of this module whose data may hold keys too. A label the
 * game does not know at all falls back to a name made from the path.
 * choices: where the system keeps the names of the keys a value holds, from the global scope, so the tooltip shows
 * "Fire" instead of "fire".
 */

/** The groups in the order the picker lists them. */
export const GROUPS = ["often", "resources", "spells", "defenses", "abilities", "currency", "progression", "traits"];

/**
 * One entry of a shortlist.
 * @param {string} group
 * @param {string} path
 * @param {string} format     One of CUSTOM_FORMATS
 * @param {string|string[]|{key: string, data: object}} label
 * @param {string} [choices]
 * @returns {{group: string, path: string, format: string, label: *, choices?: string}}
 */
const entry = (group, path, format, label, choices) => ({group, path, format, label, ...(choices ? {choices} : {})});

/* -------------------------------------------- */
/*  D&D 5e                                      */
/* -------------------------------------------- */

const DND5E_ABILITIES = ["Str", "Dex", "Con", "Int", "Wis", "Cha"];
const DND5E_SENSES = ["Darkvision", "Blindsight", "Tremorsense", "Truesight"];
const DND5E_COINS = ["PP", "GP", "EP", "SP", "CP"];

const DND5E = [
  entry("often", "system.attributes.exhaustion", "number", "DND5E.Exhaustion"),
  entry("often", "system.attributes.init.total", "modifier", ["DND5E.InitiativeBonus", "DND5E.Initiative"]),
  entry("often", "system.attributes.spell.attack", "modifier", "DND5E.SpellAttackBonus"),
  ...DND5E_SENSES.map(name => entry("often", `system.attributes.senses.ranges.${name.toLowerCase()}`, "number",
    `DND5E.Sense${name}`)),
  entry("resources", "system.attributes.hd", "resource", "DND5E.HitDice"),
  entry("resources", "system.attributes.death.success", "number", "STT.Path.deathSuccesses"),
  entry("resources", "system.attributes.death.failure", "number", "STT.Path.deathFailures"),
  entry("resources", "system.resources.legact", "resource", "DND5E.LegendaryAction.LabelPl"),
  entry("resources", "system.resources.legres", "resource", "DND5E.LegendaryResistance.LabelPl"),
  entry("resources", "system.resources.primary", "resource", "DND5E.ResourcePrimary"),
  entry("resources", "system.resources.secondary", "resource", "DND5E.ResourceSecondary"),
  entry("resources", "system.resources.tertiary", "resource", "DND5E.ResourceTertiary"),
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map(level => entry("spells", `system.spells.spell${level}`, "resource",
    {key: "STT.Path.spellSlots", data: {level}})),
  entry("spells", "system.spells.pact", "resource", "DND5E.SpellSlotsPact"),
  entry("spells", "system.attributes.spellcasting", "text", "STT.Path.spellAbility", "CONFIG.DND5E.abilities"),
  entry("defenses", "system.traits.dr.value", "list", ["DND5E.DamRes", "DND5E.TRAIT.Damage.Resistance.title"],
    "CONFIG.DND5E.damageTypes"),
  entry("defenses", "system.traits.di.value", "list", ["DND5E.DamImm", "DND5E.TRAIT.Damage.Immunity.title"],
    "CONFIG.DND5E.damageTypes"),
  entry("defenses", "system.traits.dv.value", "list", ["DND5E.DamVuln", "DND5E.TRAIT.Damage.Vulnerability.title"],
    "CONFIG.DND5E.damageTypes"),
  entry("defenses", "system.traits.ci.value", "list", ["DND5E.ConImm", "DND5E.TRAIT.Condition.Immunity.title"],
    "CONFIG.DND5E.conditionTypes"),
  entry("abilities", "system.attributes.prof", "modifier", "DND5E.ProficiencyBonus"),
  ...DND5E_ABILITIES.map(name => entry("abilities", `system.abilities.${name.toLowerCase()}.value`, "number",
    `DND5E.Ability${name}`)),
  ...DND5E_ABILITIES.map(name => entry("abilities", `system.abilities.${name.toLowerCase()}.mod`, "modifier",
    {key: "STT.Path.modifier", data: {name: `DND5E.Ability${name}`}})),
  ...DND5E_COINS.map(coin => entry("currency", `system.currency.${coin.toLowerCase()}`, "number", `DND5E.Currency${coin}`)),
  entry("progression", "system.details.xp.value", "number", "DND5E.ExperiencePoints.Label"),
  entry("traits", "system.details.type.value", "text", "DND5E.CreatureType", "CONFIG.DND5E.creatureTypes"),
  entry("traits", "system.traits.size", "text", "DND5E.Size", "CONFIG.DND5E.actorSizes"),
  entry("traits", "system.details.alignment", "text", "DND5E.Alignment"),
  entry("traits", "system.traits.languages.labels.languages", "list", "DND5E.Languages")
];

/* -------------------------------------------- */
/*  Pathfinder 2e                               */
/* -------------------------------------------- */

const PF2E_ABILITIES = ["Str", "Dex", "Con", "Int", "Wis", "Cha"];
const PF2E_SAVES = ["fortitude", "reflex", "will"];

const PF2E = [
  entry("often", "system.perception.dc", "number", "PF2E.Check.DC.Specific.perception"),
  entry("often", "system.skills.stealth.dc", "number", "PF2E.Check.DC.Specific.stealth"),
  entry("often", "system.perception.senses", "list", ["PF2E.Actor.Creature.Sense.Plural", "PF2E.Senses"]),
  entry("often", "system.attributes.shield.hp", "resource", ["PF2E.Actor.Creature.Shield.HitPoints.Value",
    "STT.Path.shieldHp"]),
  entry("often", "system.attributes.shield.raised", "text", "STT.Path.shieldRaised"),
  entry("resources", "system.resources.investiture", "resource", "PF2E.Actor.Resource.Investiture"),
  entry("resources", "system.resources.mythicPoints", "resource", "PF2E.Actor.Resource.MythicPoints"),
  ...PF2E_SAVES.map(save => entry("defenses", `system.saves.${save}.dc`, "number", `PF2E.Check.DC.Specific.${save}`)),
  entry("defenses", "system.attributes.shield.ac", "number", "STT.Path.shieldBonus"),
  entry("defenses", "system.attributes.shield.hardness", "number", "PF2E.HardnessLabel"),
  entry("defenses", "system.attributes.resistances", "list", "PF2E.ResistancesLabel"),
  entry("defenses", "system.attributes.weaknesses", "list", "PF2E.WeaknessesLabel"),
  entry("defenses", "system.attributes.immunities", "list", "PF2E.ImmunitiesLabel"),
  ...PF2E_ABILITIES.map(name => entry("abilities", `system.abilities.${name.toLowerCase()}.mod`, "modifier",
    `PF2E.Ability${name}`)),
  entry("abilities", "system.details.keyability.value", "text", "PF2E.Actor.Character.Attribute.Key", "CONFIG.PF2E.abilities"),
  entry("progression", "system.details.xp.value", "number", "PF2E.Encounter.XP"),
  entry("traits", "system.traits.value", "list", "PF2E.Traits", "CONFIG.PF2E.creatureTraits"),
  entry("traits", "system.traits.rarity", "text", "PF2E.Rarity", "CONFIG.PF2E.rarityTraits"),
  entry("traits", "system.traits.size.value", "text", "PF2E.Size", "CONFIG.PF2E.actorSizes"),
  entry("traits", "system.details.languages.value", "list", "PF2E.Actor.Creature.Language.Plural", "CONFIG.PF2E.languages"),
  entry("traits", "system.details.ancestry.name", "text", "TYPES.Item.ancestry"),
  entry("traits", "system.details.heritage.name", "text", "PF2E.Heritage"),
  entry("traits", "system.details.class.name", "text", "TYPES.Item.class"),
  entry("traits", "system.details.deity.value", "text", "PF2E.Deity")
];

/* -------------------------------------------- */
/*  Savage Worlds Adventure Edition             */
/* -------------------------------------------- */

const SWADE_ATTRIBUTES = [["agility", "Agi"], ["smarts", "Sma"], ["spirit", "Spr"], ["strength", "Str"], ["vigor", "Vig"]];

const SWADE = [
  entry("often", "system.details.conviction.value", "number", "SWADE.Conv"),
  entry("often", "system.stats.size", "number", "SWADE.Size"),
  entry("often", "system.stats.scale", "modifier", "SWADE.Scale"),
  entry("resources", "system.wounds.max", "number", "SWADE.WoundsMax"),
  entry("resources", "system.details.encumbrance", "resource", "SWADE.CarryWeight"),
  ...SWADE_ATTRIBUTES.map(([key, name]) => entry("abilities", `system.attributes.${key}.die`, "die", `SWADE.Attr${name}`)),
  entry("currency", "system.details.currency", "number", "SWADE.Currency"),
  entry("currency", "system.details.wealth.die", "die", "SWADE.WealthDie.Label"),
  entry("progression", "system.advances.value", "number", "SWADE.Adv"),
  entry("traits", "system.details.archetype", "text", "SWADE.Archetype"),
  entry("traits", "system.details.species.name", "text", "SWADE.Ancestry")
];

/* -------------------------------------------- */
/*  Crucible                                    */
/* -------------------------------------------- */

const CRUCIBLE_ABILITIES = ["strength", "toughness", "dexterity", "intellect", "presence", "wisdom"];
const CRUCIBLE_DAMAGE = ["acid", "bludgeoning", "cold", "corruption", "electricity", "fire", "piercing", "poison",
  "psychic", "radiant", "slashing", "void"];
const capital = word => word.charAt(0).toUpperCase() + word.slice(1);

const CRUCIBLE = [
  entry("often", "system.training.awareness.passive", "number", {key: "STT.Path.passive",
    data: {name: "TRAINING.LABELS.awareness"}}),
  entry("often", "system.movement.engagement", "number", "ACTOR.FIELDS.movement.engagement.label"),
  entry("often", "system.defenses.armor.total", "number", "DEFENSES.Armor"),
  entry("often", "system.defenses.dodge.total", "number", "DEFENSES.Dodge"),
  entry("resources", "system.capacity", "resource", "ACTOR.LABELS.Capacity"),
  entry("defenses", "system.defenses.parry.total", "number", "DEFENSES.Parry"),
  entry("defenses", "system.defenses.block.total", "number", "DEFENSES.Block"),
  ...CRUCIBLE_DAMAGE.map(type => entry("defenses", `system.resistances.${type}.total`, "number",
    {key: "STT.Path.resistance", data: {name: `DAMAGE.${capital(type)}`}})),
  ...CRUCIBLE_ABILITIES.map(key => entry("abilities", `system.abilities.${key}.value`, "number", `ABILITIES.${capital(key)}`)),
  entry("currency", "system.currency", "number", "ACTOR.LABELS.Currency"),
  entry("progression", "system.advancement.milestones", "number", "ACTOR.GROUP.TABS.milestones"),
  entry("progression", "system.advancement.threat", "number", "STT.Path.threat"),
  entry("traits", "system.movement.size", "number", "ACTOR.FIELDS.movement.size.label"),
  entry("traits", "system.details.ancestry.name", "text", "TYPES.Item.ancestry"),
  entry("traits", "system.details.background.name", "text", "TYPES.Item.background"),
  entry("traits", "system.details.archetype.name", "text", "TYPES.Item.archetype"),
  entry("traits", "system.details.taxonomy.name", "text", "TYPES.Item.taxonomy"),
  entry("traits", "system.details.languages", "list", "STT.Path.languages", "crucible.CONFIG.languages"),
  entry("traits", "system.details.knowledge", "list", "SKILL.CATEGORY.KNOWLEDGE.label", "crucible.CONFIG.knowledge")
];

/** The shortlists by preset id. Systems without a preset have none: their GM picks from the full list. */
export const SHORTLISTS = {dnd5e: DND5E, pf2e: PF2E, swade: SWADE, crucible: CRUCIBLE, generic: []};

/**
 * The shortlist of a preset.
 * @param {string} presetId
 * @returns {object[]}
 */
export function shortlistOf(presetId) {
  return [...(SHORTLISTS[presetId] ?? [])];
}

/**
 * Where the system keeps the names of the keys a path holds, when the shortlist knows it.
 * @param {string} presetId
 * @param {string} path
 * @returns {string|null}
 */
export function choicesFor(presetId, path) {
  const clean = String(path ?? "").trim().replace(/^actor\./, "");
  return (SHORTLISTS[presetId] ?? []).find(e => e.path === clean)?.choices ?? null;
}

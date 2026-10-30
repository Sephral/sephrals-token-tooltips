/**
 * Who sees which value. Pure rules without Foundry, so the tests can run them.
 *
 * Every field has an audience (GM only, GM with owners and observers, everyone) and, for everyone else, a form per
 * token disposition: the exact value, a description (health words instead of numbers) or nothing. The GM and the
 * owners of a token always see the exact value when the audience includes them. Observers count as owners: they can
 * open the whole sheet anyway. Limited permission counts as everyone else. Tokens of player characters (an actor with a
 * player owner) have their own form for the other players, "party", whatever their disposition.
 */

/** The audiences of a field, from the smallest to the largest. */
export const AUDIENCES = ["gm", "owner", "everyone"];

/** How a viewer who does not own the token sees a value. */
export const FORMS = ["exact", "descriptive", "hidden"];

/** Token dispositions by their key, with Foundry's numbers (CONST.TOKEN_DISPOSITIONS). */
export const DISPOSITIONS = {secret: -2, hostile: -1, neutral: 0, friendly: 1};

/** The disposition keys in the order the configuration shows them. */
export const DISPOSITION_KEYS = ["friendly", "neutral", "hostile", "secret"];

/** The keys of the forms a field has for everyone else: party members first, then the dispositions. */
export const FORM_KEYS = ["party", ...DISPOSITION_KEYS];

/**
 * Whether a user sees a token like its owner: with Owner or Observer permission (an observer can open the whole sheet
 * anyway). Limited and no permission count as everyone else.
 * @param {number} level                    The user's permission level of the token (CONST.DOCUMENT_OWNERSHIP_LEVELS)
 * @param {Record<string, number>} levels   CONST.DOCUMENT_OWNERSHIP_LEVELS
 * @returns {boolean}
 */
export function seesAsOwner(level, levels) {
  return Number(level) >= levels.OBSERVER;
}

/**
 * The key of a token disposition number.
 * @param {number} disposition
 * @returns {"friendly"|"neutral"|"hostile"|"secret"}
 */
export function dispositionKey(disposition) {
  const entry = Object.entries(DISPOSITIONS).find(([, value]) => value === Number(disposition));
  return entry ? entry[0] : "neutral";
}

/**
 * The form in which a viewer sees one field of one token.
 * @param {{audience?: string, forms?: Record<string, string>}} config   The field configuration
 * @param {{isGM: boolean, isOwner: boolean, disposition: number, party?: boolean}} viewer The viewer and the token's
 *                                            disposition; isOwner is true for owners and observers (see seesAsOwner),
 *                                            party for a token of a player character (it uses the party form)
 * @param {object} [options]
 * @param {boolean} [options.describable=false]   Whether the field has a description form
 * @returns {"exact"|"descriptive"|null}           null: the viewer does not see the field
 */
export function resolveForm(config, viewer, {describable=false}={}) {
  const audience = AUDIENCES.includes(config?.audience) ? config.audience : "gm";
  if ( viewer.isGM ) return "exact";
  if ( audience === "gm" ) return null;
  if ( viewer.isOwner ) return "exact";
  if ( audience === "owner" ) return null;
  const form = config?.forms?.[viewer.party ? "party" : dispositionKey(viewer.disposition)];
  if ( form === "exact" ) return "exact";
  if ( (form === "descriptive") && describable ) return "descriptive";
  return null;
}

/**
 * Whether a viewer may see a token's name, following the token's own name display (CONST.TOKEN_DISPLAY_MODES).
 * Owners, observers and the GM always see it; everyone else only when the token shows its name to all on hover or always.
 * @param {{displayName: number, isOwner: boolean, isGM: boolean}} data
 * @param {Record<string, number>} modes   CONST.TOKEN_DISPLAY_MODES
 * @returns {boolean}
 */
export function nameVisible({displayName, isOwner, isGM}, modes) {
  if ( isGM || isOwner ) return true;
  return (displayName === modes.HOVER) || (displayName === modes.ALWAYS);
}

/**
 * Whether a viewer gets a tooltip for a token at all: never for a token the viewer cannot see, and hidden tokens only
 * for the GM. Secret tokens follow the forms of the fields (by default they show nothing to non-owners).
 * @param {{hidden: boolean, isGM: boolean, visible: boolean}} token
 * @returns {boolean}
 */
export function tooltipAllowed({hidden, isGM, visible}) {
  if ( visible === false ) return false;
  return isGM || !hidden;
}

/** The kinds of Item Piles piles that are things and not creatures: heaps of loot, chests, vaults. */
export const OBJECT_PILE_TYPES = ["pile", "container", "vault"];

/**
 * Whether a token is a heap, chest or vault of the Item Piles module. Those are actors of a creature type (in dnd5e a
 * character), so their stats would read as zero hit points, AC 10 and level 0; they get no tooltip. Merchants and
 * other piles that stand for a person keep theirs.
 * @param {{enabled?: boolean, type?: string}|undefined} data   The pile data (flags "item-piles".data)
 * @returns {boolean}
 */
export function isObjectPile(data) {
  return !!data?.enabled && OBJECT_PILE_TYPES.includes(data.type ?? "pile");
}

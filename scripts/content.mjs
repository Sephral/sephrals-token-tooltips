/**
 * What a tooltip of a token shows to the user looking at it, and its markup.
 */

import {esc, fieldLabel, setting, t} from "./config.mjs";
import {activeFields} from "./fields.mjs";
import {buildRows} from "./format.mjs";
import {presetFor} from "./presets.mjs";
import {readField} from "./reader.mjs";
import {isObjectPile, nameVisible, resolveForm, seesAsOwner, tooltipAllowed} from "./visibility.mjs";

/**
 * The viewer of a token: the current user, or someone else for the preview. Observers see the token like its owners.
 * The token's permission is its actor's (TokenDocument#getUserLevel). A token of a player character is a party member.
 * @param {TokenDocument} token
 * @returns {{isGM: boolean, isOwner: boolean, disposition: number, party: boolean}}
 */
export function viewerOf(token) {
  const level = token.getUserLevel?.(game.user) ?? (token.isOwner ? CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER : 0);
  return {isGM: game.user.isGM, isOwner: !!token.isOwner || seesAsOwner(level, CONST.DOCUMENT_OWNERSHIP_LEVELS),
    disposition: token.disposition, party: !!token.actor?.hasPlayerOwner};
}

/**
 * Whether a token is a heap, chest or vault of Item Piles, which gets no tooltip. Item Piles reads its data from the
 * token of an unlinked actor and from the actor of a linked one; getProperty also works when the module is off.
 * @param {TokenDocument} doc
 * @returns {boolean}
 */
export function objectPileToken(doc) {
  const source = doc?.actorLink ? doc.actor : doc;
  return isObjectPile(foundry.utils.getProperty(source ?? {}, "flags.item-piles.data"));
}

/**
 * Whether a token stands for a thing that gets no tooltip: a heap or chest of Item Piles, or an actor type the
 * system's preset counts as a thing (PF2e loot).
 * @param {TokenDocument} doc
 * @returns {boolean}
 */
export function thingToken(doc) {
  if ( objectPileToken(doc) ) return true;
  const type = doc?.actor?.type;
  return !!type && !!presetFor(game.system.id).objectTypes?.includes(type);
}

/**
 * The content of a token's tooltip, or null when this viewer gets none.
 * @param {Token} token                  The token on the canvas
 * @param {object} options
 * @param {object[]} options.fields      The field list (configured)
 * @param {object} [options.viewer]      Another viewer (preview)
 * @param {boolean} [options.preview]    Skip the canvas visibility (preview of any token)
 * @returns {{name: string|null, rows: object[], errors: string[]}|null}
 */
export function tooltipData(token, {fields, viewer, preview=false}) {
  const doc = token?.document;
  if ( !doc ) return null;
  viewer ??= viewerOf(doc);
  if ( !preview && !tooltipAllowed({hidden: doc.hidden, isGM: viewer.isGM, visible: token.visible}) ) return null;
  if ( thingToken(doc) ) return null;
  const active = activeFields(fields, doc.actor?.type);
  const nameField = active.find(f => f.type === "name");
  let name = null;
  if ( nameField && resolveForm(nameField.config, viewer) ) {
    const allowed = !setting("respectNames") || nameVisible({displayName: doc.displayName, isOwner: viewer.isOwner,
      isGM: viewer.isGM}, CONST.TOKEN_DISPLAY_MODES);
    if ( allowed ) name = doc.name;
  }
  const {rows, errors} = doc.actor ? buildRows(active, {viewer, read: field => readField(field, doc), t, labelOf: fieldLabel})
    : {rows: [], errors: []};
  if ( !name && !rows.length ) return null;
  return {name, rows, errors};
}

/**
 * The value part of a row.
 * @param {object} row
 * @returns {string}
 */
function valueMarkup(row) {
  switch ( row.kind ) {
    case "bar": return `<span class="stt-bar"><span class="stt-bar-fill" style="width: ${row.pct}%"></span></span>`
      + `${row.text ? `<span class="stt-value">${esc(row.text)}</span>` : ""}`;
    case "icons": return `<span class="stt-effects">${row.items.map(item => `<span class="stt-effect">`
      + `${item.img ? `<img src="${esc(item.img)}" alt="">` : ""}<span>${esc(item.name)}</span></span>`).join("")}</span>`;
    default: return `<span class="stt-value">${esc(row.text)}</span>`;
  }
}

/**
 * The inner markup of a tooltip.
 * @param {{name: string|null, rows: object[]}} data
 * @returns {string}
 */
export function tooltipMarkup(data) {
  const name = data.name ? `<div class="stt-name">${esc(data.name)}</div>` : "";
  const rows = data.rows.map(row => {
    const icon = row.icon ? `<i class="${esc(row.icon)}" inert></i>` : "";
    const label = row.kind === "icons" ? "" : `<span class="stt-label">${icon}${esc(row.label)}</span>`;
    return `<div class="stt-row" data-field="${esc(row.id)}" data-kind="${esc(row.kind)}"`
      + `${row.tone ? ` data-tone="${esc(row.tone)}"` : ""}>${label}${valueMarkup(row)}</div>`;
  }).join("");
  return `${name}${rows ? `<div class="stt-rows">${rows}</div>` : ""}`;
}

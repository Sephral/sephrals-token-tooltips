/**
 * The tooltips on the screen: one for the hovered token after a short delay, and one per visible token while the
 * "show all" key is held. Plain HTML above the canvas, positioned from the token's bounds, redrawn when the view pans
 * or the token changes.
 */

import {MODULE_ID, setting} from "./config.mjs";
import {tooltipData, tooltipMarkup} from "./content.mjs";
import {onScreen, placeTooltip} from "./placement.mjs";
import {applyKey, featureOf, idleState, isTurnChange, turnDuration, wantsAll} from "./showall.mjs";
import {currentFields} from "./registry.mjs";
import {countFeature} from "./usage.mjs";

/** The layer that holds every tooltip. */
let layer = null;

/** The tooltip of the hovered token: {tokenId, element}. */
const hovered = {tokenId: null, element: null, timer: null};

/** Tooltips while the key is held, by token id. */
const all = new Map();

/** A mouse button is down on the canvas (dragging, measuring, selecting): no tooltips meanwhile. */
let pressed = false;

/** Counted once per session (usage statistics). */
const counted = {shown: false, showAllHeld: false, showAllToggled: false, turnTooltips: false, distance: false,
  tracker: false};

/** The fields that read from the user's own token: their tooltips follow the selection and the moves of that token. */
let originUsed = false;

/** Where the token the distances count from was when the tooltips were last redrawn for it. */
let lastOrigin = "";

/** The ids of the fields that count for "distanceShown". */
const DISTANCE_FIELDS = ["tokenDistance", "tokenElevation", "tokenCover"];

/** The tooltip of a combatant in the combat tracker: the row the pointer is on and its tooltip. */
const tracker = {row: null, app: null, tokenId: null, element: null, timer: null};

/** The tracker elements that already listen, and the tracker each belongs to. */
const trackerRoots = new WeakMap();

/** The sources that switch all tooltips on, see showall.mjs. */
let state = idleState();

/** The timer of the turn tooltips, and the small note shown while the toggled key keeps all tooltips on. */
let turnTimer = null;
let indicator = null;

/** Redraws waiting for the next frame. */
let frame = null;

/**
 * The measured size of each tooltip, so that moving it (the view pans) writes styles without reading the layout.
 * Measured again after its content changed.
 * @type {WeakMap<HTMLElement, {width: number, height: number}>}
 */
const sizes = new WeakMap();

/* -------------------------------------------- */
/*  Layer and elements                          */
/* -------------------------------------------- */

/**
 * The layer above the canvas, created on first use.
 * @returns {HTMLElement}
 */
function ensureLayer() {
  if ( layer?.isConnected ) return layer;
  layer = document.createElement("div");
  layer.id = "stt-layer";
  layer.setAttribute("aria-hidden", "true");
  document.body.append(layer);
  return layer;
}

/** The layer of the tracker's tooltip: above the interface, because it opens beside the sidebar. */
let trackerLayer = null;

function ensureTrackerLayer() {
  if ( trackerLayer?.isConnected ) return trackerLayer;
  trackerLayer = document.createElement("div");
  trackerLayer.id = "stt-layer-tracker";
  trackerLayer.setAttribute("aria-hidden", "true");
  document.body.append(trackerLayer);
  return trackerLayer;
}

/**
 * Where the tracker's tooltip may open: the row's height, but beside the whole sidebar (with its tab buttons) or the
 * popped out tracker window, so it never lies over Foundry's buttons.
 * @param {HTMLElement} row
 * @returns {{left: number, top: number, width: number, height: number}}
 */
function trackerAnchor(row) {
  const box = row.getBoundingClientRect();
  const host = row.closest("#sidebar, #ui-right, .application")?.getBoundingClientRect();
  const left = host ? Math.min(box.left, host.left) : box.left;
  const right = host ? Math.max(box.right, host.right) : box.right;
  return {left, top: box.top, width: right - left, height: box.height};
}

/**
 * A new, empty tooltip element in the module's look.
 * @returns {HTMLElement}
 */
function createElement() {
  const element = document.createElement("div");
  element.className = "stt-tooltip";
  ensureLayer().append(element);
  return element;
}

/**
 * The token on the canvas, if it is still drawn.
 * @param {string} id
 * @returns {Token|undefined}
 */
function tokenOf(id) {
  return id ? canvas?.tokens?.get(id) : undefined;
}

/**
 * A point of the map on the screen. Computed from the stage's pivot, scale and position: during the "canvasPan" hook
 * the stage's world transform still holds the old view until the next frame is drawn.
 * @param {{x: number, y: number}} point
 * @returns {{x: number, y: number}}
 */
function toScreen(point) {
  const stage = canvas.stage;
  return {x: ((point.x - stage.pivot.x) * stage.scale.x) + stage.position.x,
    y: ((point.y - stage.pivot.y) * stage.scale.y) + stage.position.y};
}

/**
 * The token's rectangle on the screen.
 * @param {Token} token
 * @returns {{left: number, top: number, width: number, height: number}}
 */
export function screenRect(token) {
  const b = token.bounds;
  const a = toScreen({x: b.x, y: b.y});
  const c = toScreen({x: b.x + b.width, y: b.y + b.height});
  return {left: a.x, top: a.y, width: c.x - a.x, height: c.y - a.y};
}

/**
 * Fill an element with a token's tooltip and put it next to the token. Returns false when there is nothing to show.
 * @param {HTMLElement} element
 * @param {Token} token
 * @param {object[]} fields
 * @param {object} [options]
 * @param {boolean} [options.place=true]   Put it next to the token now (false: the caller places many at once)
 * @returns {boolean}
 */
function fill(element, token, fields, {place=true, anchor=null}={}) {
  const data = tooltipData(token, {fields});
  if ( !data ) {
    element.hidden = true;
    return false;
  }
  originUsed = fields.some(f => f.config.enabled && f.needsOrigin);
  if ( !counted.distance && data.rows.some(row => DISTANCE_FIELDS.includes(row.id)) ) {
    counted.distance = true;
    countFeature(MODULE_ID, "distanceShown");
  }
  element.dataset.sttTheme = setting("theme");
  element.dataset.size = setting("size");
  element.dataset.tokenId = token.id;
  element.innerHTML = tooltipMarkup(data);
  element.hidden = false;
  sizes.delete(element);
  if ( place ) position(element, token, anchor);
  return true;
}

/**
 * The size of a tooltip on the screen, measured once per content.
 * @param {HTMLElement} element
 * @returns {{width: number, height: number}}
 */
function sizeOf(element) {
  let size = sizes.get(element);
  if ( !size || !size.width ) {
    size = {width: element.offsetWidth, height: element.offsetHeight};
    if ( size.width ) sizes.set(element, size);
  }
  return size;
}

/**
 * Put an element next to its token, or hide it while the token is off the screen.
 * @param {HTMLElement} element
 * @param {Token} token
 */
function position(element, token, anchor=null) {
  const rect = anchor ? anchor() : screenRect(token);
  const viewport = {width: window.innerWidth, height: window.innerHeight};
  const offscreen = !onScreen(rect, viewport);
  element.classList.toggle("stt-offscreen", offscreen);
  if ( offscreen ) return;
  const size = sizeOf(element);
  const {left, top, side} = placeTooltip(rect, size, viewport, setting("position"));
  // A transform moves the tooltip without a new layout of the page (many move at once while the view pans)
  element.style.transform = `translate(${left}px, ${top}px)`;
  element.dataset.side = side;
}

/* -------------------------------------------- */
/*  The hovered token                           */
/* -------------------------------------------- */

/**
 * Hook "hoverToken": start the delay, or hide when the pointer left.
 * @param {Token} token
 * @param {boolean} isHovered
 */
export function onHoverToken(token, isHovered) {
  clearTimeout(hovered.timer);
  if ( !isHovered ) {
    if ( hovered.tokenId === token.id ) hide();
    return;
  }
  if ( !setting("enabled") || pressed ) return;
  hovered.timer = setTimeout(() => show(token.id), Math.max(0, Number(setting("delay")) || 0));
}

/**
 * Show the tooltip of a token that is still hovered.
 * @param {string} tokenId
 */
function show(tokenId) {
  const token = tokenOf(tokenId);
  if ( !token?.hover || pressed || hudOpenFor(token) || all.has(tokenId) ) return;
  // Core highlights the token of a hovered combatant: the tooltip then sits next to the row (see below)
  if ( tracker.row && setting("trackerTooltip") ) return;
  hovered.element ??= createElement();
  hovered.tokenId = tokenId;
  if ( !fill(hovered.element, token, currentFields()) ) {
    hovered.tokenId = null;
    return;
  }
  if ( !counted.shown ) {
    counted.shown = true;
    countFeature(MODULE_ID, "tooltipSession");
  }
}

/**
 * Hide the tooltip of the hovered token.
 */
export function hide() {
  clearTimeout(hovered.timer);
  hovered.tokenId = null;
  if ( hovered.element ) hovered.element.hidden = true;
}

/**
 * Whether the token HUD is open on a token.
 * @param {Token} token
 * @returns {boolean}
 */
function hudOpenFor(token) {
  const hud = canvas.hud?.token;
  return !!hud?.rendered && (hud.object === token);
}

/* -------------------------------------------- */
/*  All visible tokens                          */
/* -------------------------------------------- */

/**
 * Show the tooltips of all visible tokens (the key is held).
 */
export function showAll() {
  if ( !setting("enabled") || !canvas?.ready ) return;
  hide();
  const fields = currentFields();
  // Fill all first, then measure all, then place all: one layout instead of one per token
  const added = [];
  for ( const token of canvas.tokens.placeables ) {
    if ( !token.visible || all.has(token.id) ) continue;
    const element = createElement();
    element.classList.add("stt-compact");
    if ( fill(element, token, fields, {place: false}) ) {
      all.set(token.id, element);
      added.push([element, token]);
    }
    else element.remove();
  }
  for ( const [element] of added ) sizeOf(element);
  for ( const [element, token] of added ) position(element, token);
  const feature = featureOf(state);
  if ( all.size && feature && !counted[feature] ) {
    counted[feature] = true;
    countFeature(MODULE_ID, feature);
  }
}

/**
 * Show or hide all tooltips to match the sources that want them, and the note of the toggled key.
 */
function sync() {
  if ( wantsAll(state) ) showAll();
  else hideAll();
  updateIndicator();
}

/**
 * The small note at the bottom of the screen while the toggled key keeps all tooltips on.
 */
function updateIndicator() {
  if ( !state.toggled ) {
    indicator?.remove();
    indicator = null;
    return;
  }
  if ( indicator?.isConnected ) return;
  indicator = document.createElement("div");
  indicator.className = "stt-indicator";
  indicator.setAttribute("role", "status");
  indicator.textContent = game.i18n.localize("STT.Keys.indicator");
  ensureLayer().append(indicator);
}

/**
 * The "show all" key was pressed or released.
 * @param {"down"|"up"} phase
 */
export function onKey(phase) {
  state = applyKey(state, setting("showAllMode"), phase);
  sync();
}

/**
 * Hook "updateCombat": at the start of a turn the GM sees all tooltips for a few seconds.
 * @param {Combat} combat
 * @param {object} changes
 */
export function onCombatTurn(combat, changes) {
  if ( !game.user.isGM || !setting("turnTooltips") || !setting("enabled") || !isTurnChange(changes) ) return;
  if ( !combat.started || !combat.active || !canvas?.ready ) return;
  if ( combat.scene && (combat.scene.id !== canvas.scene?.id) ) return;
  clearTimeout(turnTimer);
  // The tokens of the new turn are redrawn first
  turnTimer = setTimeout(() => {
    state = {...state, turn: true};
    sync();
    turnTimer = setTimeout(() => {
      turnTimer = null;
      state = {...state, turn: false};
      sync();
    }, turnDuration(setting("turnSeconds")));
  }, 150);
}

/**
 * Remove the tooltips of all tokens (the key was released).
 */
export function hideAll() {
  for ( const element of all.values() ) element.remove();
  all.clear();
}

/* -------------------------------------------- */
/*  Keeping up with the canvas                  */
/* -------------------------------------------- */

/**
 * Put every shown tooltip next to its token again (the view moved or a token moved).
 */
export function reposition() {
  if ( !canvas?.ready ) return;
  const token = tokenOf(hovered.tokenId);
  if ( token && hovered.element && !hovered.element.hidden ) position(hovered.element, token);
  for ( const [id, element] of all ) {
    const other = tokenOf(id);
    if ( other ) position(element, other);
    else {
      element.remove();
      all.delete(id);
    }
  }
}

/**
 * Redraw the content of the shown tooltips on the next frame (a value changed).
 */
export function refresh() {
  if ( frame ) return;
  frame = requestAnimationFrame(() => {
    frame = null;
    if ( !canvas?.ready ) return;
    const fields = currentFields();
    const token = tokenOf(hovered.tokenId);
    if ( hovered.element && !hovered.element.hidden ) {
      if ( !token?.hover ) hide();
      else if ( !fill(hovered.element, token, fields) ) hovered.tokenId = null;
    }
    refreshTracker(fields);
    const changed = [];
    for ( const [id, element] of all ) {
      const other = tokenOf(id);
      if ( !other || !fill(element, other, fields, {place: false}) ) {
        element.remove();
        all.delete(id);
      }
      else changed.push([element, other]);
    }
    for ( const [element] of changed ) sizeOf(element);
    for ( const [element, other] of changed ) position(element, other);
  });
}

/**
 * Whether a changed document belongs to a token with a tooltip on the screen.
 * @param {Actor|null} actor
 * @param {string|null} tokenId
 * @returns {boolean}
 */
export function concerns(actor, tokenId) {
  const ids = [hovered.tokenId, tracker.tokenId, ...all.keys()].filter(Boolean);
  if ( tokenId && ids.includes(tokenId) ) return true;
  if ( !actor ) return false;
  return ids.some(id => {
    const token = tokenOf(id);
    return token && ((token.actor === actor) || (token.actor?.id === actor.id));
  });
}

/**
 * Hook "refreshToken": a token with a tooltip moved or changed its look.
 * @param {Token} token
 */
export function onRefreshToken(token) {
  followOrigin(token);
  const isHovered = (token.id === hovered.tokenId) && hovered.element && !hovered.element.hidden;
  const compact = all.get(token.id);
  if ( !isHovered && !compact ) return;
  if ( !token.visible ) {
    if ( token.id === hovered.tokenId ) hide();
    compact?.remove();
    all.delete(token.id);
    return;
  }
  // Foundry drops the hover state without a "hoverToken" hook when it releases a token (for example after a player
  // lost the permission to control it); the pointer may be elsewhere by now
  if ( isHovered && !token.hover ) hide();
  // Only this token's tooltips: holding Alt also makes Foundry highlight (and refresh) every token at once
  else if ( isHovered ) position(hovered.element, token);
  if ( compact ) position(compact, token);
}

/**
 * The token distances count from moved (it animates for a while, its document follows): redraw the tooltips that
 * read from it, once per new position.
 * @param {Token} token
 */
function followOrigin(token) {
  if ( !originUsed || !token.controlled || !(hovered.tokenId || tracker.tokenId || all.size) ) return;
  const key = `${token.id}:${token.document.x}:${token.document.y}:${token.document.elevation}`;
  if ( key === lastOrigin ) return;
  lastOrigin = key;
  refresh();
}

/**
 * Hook "destroyToken": the token was deleted or drawn anew. Foundry forgets its hover state without a "hoverToken"
 * hook, so its tooltip goes too.
 * @param {Token} token
 */
export function onDestroyToken(token) {
  // The copy that follows the pointer while a token is dragged has the token's id
  if ( token.isPreview ) return;
  if ( token.id === hovered.tokenId ) hide();
  const compact = all.get(token.id);
  if ( compact && !tokenOf(token.id) ) {
    compact.remove();
    all.delete(token.id);
  }
}

/**
 * Pointer handling: hide while a button is held on the canvas (dragging, measuring, selecting).
 */
export function watchPointer() {
  document.addEventListener("pointerdown", event => {
    if ( !(event.target instanceof HTMLCanvasElement) ) return;
    pressed = true;
    hide();
  }, {capture: true});
  const release = () => { pressed = false; };
  document.addEventListener("pointerup", release, {capture: true});
  document.addEventListener("pointercancel", release, {capture: true});
  window.addEventListener("blur", () => {
    pressed = false;
    hide();
    // A held key is lost with the focus, a toggled key and the turn tooltips stay
    state = {...state, held: false};
    if ( !wantsAll(state) ) hideAll();
  });
}

/**
 * Clear everything (the canvas is torn down, the module was switched off).
 */
export function clear() {
  hideTracker();
  clearTimeout(turnTimer);
  turnTimer = null;
  state = idleState();
  updateIndicator();
  hide();
  hideAll();
}

/**
 * The state for the debug file.
 * @returns {object}
 */
export function overlayState() {
  return {hovered: hovered.tokenId, shownAll: all.size, pressed, layer: !!layer?.isConnected,
    tracker: {listening: !!tracker.app, tooltip: tracker.tokenId}};
}

/* -------------------------------------------- */
/*  The combat tracker                          */
/* -------------------------------------------- */

/**
 * Hook "renderCombatTracker": the entries of the tracker show the tooltip of their token. The tracker element stays
 * across redraws, so it gets its listeners once. A tracker without these elements (a replacement of the core tracker)
 * simply never fires them.
 * @param {Application} app
 * @param {HTMLElement} html
 */
export function onRenderTracker(app, html) {
  try {
    const root = html instanceof HTMLElement ? html : (html?.[0] instanceof HTMLElement ? html[0] : app?.element);
    if ( !(root instanceof HTMLElement) ) return;
    trackerRoots.set(root, app);
    if ( root.dataset.sttTracker ) return;
    root.dataset.sttTracker = "1";
    root.addEventListener("pointerover", event => onTrackerOver(event, root), {passive: true});
    root.addEventListener("pointerout", event => onTrackerOut(event), {passive: true});
    // The entry under the pointer is gone after a redraw
    if ( tracker.row && !tracker.row.isConnected ) hideTracker();
  } catch(err) {
    console.warn(`${MODULE_ID} | The combat tracker could not get tooltips`, err);
  }
}

/**
 * The pointer moved onto an element of the tracker.
 * @param {PointerEvent} event
 * @param {HTMLElement} root
 */
function onTrackerOver(event, root) {
  const row = event.target?.closest?.(".combatant[data-combatant-id]");
  if ( !row || (row === tracker.row) ) return;
  hideTracker();
  tracker.row = row;
  tracker.app = trackerRoots.get(root) ?? null;
  if ( !setting("trackerTooltip") || !setting("enabled") || pressed ) return;
  tracker.timer = setTimeout(() => showTracker(row), Math.max(0, Number(setting("delay")) || 0));
}

/**
 * The pointer left an element of the tracker.
 * @param {PointerEvent} event
 */
function onTrackerOut(event) {
  const row = tracker.row;
  if ( !row ) return;
  const to = event.relatedTarget;
  if ( (to instanceof Element) && row.contains(to) ) return;
  hideTracker();
}

/**
 * The token of a combatant row, when it is drawn on the viewed scene.
 * @param {HTMLElement} row
 * @returns {Token|null}
 */
function trackerToken(row) {
  const combat = tracker.app?.viewed ?? game.combat;
  const combatant = combat?.combatants?.get(row.dataset.combatantId);
  if ( !combatant || (combatant.hidden && !game.user.isGM) ) return null;
  return combatant.token?.object ?? null;
}

/**
 * Show the tooltip of the combatant the pointer rests on, next to its row.
 * @param {HTMLElement} row
 */
function showTracker(row) {
  tracker.timer = null;
  if ( (tracker.row !== row) || !row.isConnected || pressed || !canvas?.ready ) return;
  const token = trackerToken(row);
  if ( !token ) return;
  if ( !tracker.element ) {
    tracker.element = createElement();
    ensureTrackerLayer().append(tracker.element);
  }
  tracker.tokenId = token.id;
  const rect = () => trackerAnchor(row);
  if ( !fill(tracker.element, token, currentFields(), {anchor: rect}) ) {
    tracker.tokenId = null;
    return;
  }
  if ( !counted.tracker ) {
    counted.tracker = true;
    countFeature(MODULE_ID, "trackerTooltip");
  }
}

/**
 * Hide the tooltip of the tracker and forget the row.
 */
function hideTracker() {
  clearTimeout(tracker.timer);
  tracker.timer = null;
  tracker.row = null;
  tracker.tokenId = null;
  if ( tracker.element ) tracker.element.hidden = true;
}

/**
 * Redraw the tracker's tooltip (a value changed).
 * @param {object[]} fields
 */
function refreshTracker(fields) {
  if ( !tracker.element || tracker.element.hidden ) return;
  const row = tracker.row;
  const token = row?.isConnected ? trackerToken(row) : null;
  if ( !token ) {
    hideTracker();
    return;
  }
  tracker.tokenId = token.id;
  const rect = () => trackerAnchor(row);
  if ( !fill(tracker.element, token, fields, {anchor: rect}) ) tracker.tokenId = null;
}

/**
 * Whether the tooltips on the screen read from the user's own token (distance, elevation).
 * @returns {boolean}
 */
export function followsOrigin() {
  return originUsed && !!(hovered.tokenId || tracker.tokenId || all.size);
}

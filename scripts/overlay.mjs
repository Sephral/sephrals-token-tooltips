/**
 * The tooltips on the screen: one for the hovered token after a short delay, and one per visible token while the
 * "show all" key is held. Plain HTML above the canvas, positioned from the token's bounds, redrawn when the view pans
 * or the token changes.
 */

import {MODULE_ID, setting} from "./config.mjs";
import {tooltipData, tooltipMarkup} from "./content.mjs";
import {onScreen, placeTooltip} from "./placement.mjs";
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
const counted = {shown: false, all: false};

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
function fill(element, token, fields, {place=true}={}) {
  const data = tooltipData(token, {fields});
  if ( !data ) {
    element.hidden = true;
    return false;
  }
  element.dataset.sttTheme = setting("theme");
  element.dataset.size = setting("size");
  element.dataset.tokenId = token.id;
  element.innerHTML = tooltipMarkup(data);
  element.hidden = false;
  sizes.delete(element);
  if ( place ) position(element, token);
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
function position(element, token) {
  const rect = screenRect(token);
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
  if ( all.size && !counted.all ) {
    counted.all = true;
    countFeature(MODULE_ID, "showAllHeld");
  }
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
  const ids = [hovered.tokenId, ...all.keys()].filter(Boolean);
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
    hideAll();
  });
}

/**
 * Clear everything (the canvas is torn down, the module was switched off).
 */
export function clear() {
  hide();
  hideAll();
}

/**
 * The state for the debug file.
 * @returns {object}
 */
export function overlayState() {
  return {hovered: hovered.tokenId, shownAll: all.size, pressed, layer: !!layer?.isConnected};
}

/**
 * Where a tooltip goes next to its token. Pure math in screen pixels.
 */

/** Space between token and tooltip, and between tooltip and the edge of the window. */
export const GAP = 10;
export const MARGIN = 6;

/**
 * Whether any part of a token is inside the window. A token off the screen (hovered through the combat tracker, or
 * one of all tokens while the key is held) gets no tooltip, instead of one pinned to the edge of the window.
 * @param {{left: number, top: number, width: number, height: number}} token   The token on screen
 * @param {{width: number, height: number}} viewport                            The window
 * @returns {boolean}
 */
export function onScreen(token, viewport) {
  return (token.left + token.width > 0) && (token.top + token.height > 0)
    && (token.left < viewport.width) && (token.top < viewport.height);
}

/**
 * The position of a tooltip.
 * @param {{left: number, top: number, width: number, height: number}} token   The token on screen
 * @param {{width: number, height: number}} size                                The tooltip
 * @param {{width: number, height: number}} viewport                            The window
 * @param {"right"|"above"|"below"} [side="right"]   The preferred side; flips when it does not fit
 * @returns {{left: number, top: number, side: string}}
 */
export function placeTooltip(token, size, viewport, side="right") {
  const fitsRight = token.left + token.width + GAP + size.width <= viewport.width - MARGIN;
  const fitsLeft = token.left - GAP - size.width >= MARGIN;
  const fitsAbove = token.top - GAP - size.height >= MARGIN;
  const fitsBelow = token.top + token.height + GAP + size.height <= viewport.height - MARGIN;
  let actual = side;
  if ( side === "right" ) actual = fitsRight || !fitsLeft ? "right" : "left";
  else if ( side === "above" ) actual = fitsAbove || !fitsBelow ? "above" : "below";
  else if ( side === "below" ) actual = fitsBelow || !fitsAbove ? "below" : "above";
  else actual = "right";

  let left;
  let top;
  if ( (actual === "right") || (actual === "left") ) {
    left = actual === "right" ? token.left + token.width + GAP : token.left - GAP - size.width;
    top = token.top + ((token.height - size.height) / 2);
  }
  else {
    left = token.left + ((token.width - size.width) / 2);
    top = actual === "above" ? token.top - GAP - size.height : token.top + token.height + GAP;
  }
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  left = clamp(left, MARGIN, Math.max(MARGIN, viewport.width - size.width - MARGIN));
  top = clamp(top, MARGIN, Math.max(MARGIN, viewport.height - size.height - MARGIN));
  return {left: Math.round(left), top: Math.round(top), side: actual};
}

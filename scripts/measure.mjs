/**
 * Distance, elevation and cover: the pure parts. The calls into Foundry's grid are in reader.mjs.
 */

/** At most this many grid spaces per token are tested pair by pair, larger tokens count by their center space. */
export const MAX_CELLS = 36;

/**
 * The shortest gap between two rectangles in pixels, zero when they touch or overlap (tokens on a gridless scene).
 * @param {{x: number, y: number, width: number, height: number}} a
 * @param {{x: number, y: number, width: number, height: number}} b
 * @returns {number}
 */
export function rectGap(a, b) {
  const dx = Math.max(0, a.x - (b.x + b.width), b.x - (a.x + a.width));
  const dy = Math.max(0, a.y - (b.y + b.height), b.y - (a.y + a.height));
  return Math.hypot(dx, dy);
}

/**
 * Grid offsets without duplicates (a token's spaces on several levels count once) and without the level index.
 * @param {Array<{i: number, j: number}>} offsets
 * @returns {Array<{i: number, j: number}>}
 */
export function flatOffsets(offsets) {
  const seen = new Set();
  const list = [];
  for ( const {i, j} of Array.isArray(offsets) ? offsets : [] ) {
    const key = `${i},${j}`;
    if ( seen.has(key) ) continue;
    seen.add(key);
    list.push({i, j});
  }
  return list;
}

/**
 * The smallest measurement between any space of one token and any space of the other. Adjacent tokens are one step
 * apart, whatever their size.
 * @param {Array<*>} from
 * @param {Array<*>} to
 * @param {Function} measure   (a, b) => distance
 * @returns {number|null}
 */
export function nearestMeasure(from, to, measure) {
  let best = null;
  for ( const a of from ) {
    for ( const b of to ) {
      const value = measure(a, b);
      if ( Number.isFinite(value) && ((best === null) || (value < best)) ) best = value;
    }
  }
  return best;
}

/**
 * Pixels on a gridless scene as scene units.
 * @param {number} pixels
 * @param {number} gridSize       Pixels per grid space
 * @param {number} gridDistance   Scene units per grid space
 * @returns {number}
 */
export function unitsFromPixels(pixels, gridSize, gridDistance) {
  return gridSize > 0 ? (pixels / gridSize) * gridDistance : 0;
}

/**
 * A measurement rounded for display: whole numbers stay whole, others get at most one decimal.
 * @param {number} value
 * @returns {number}
 */
export function roundDistance(value) {
  return Math.round(Number(value) * 10) / 10;
}

/**
 * The token distances and elevation are measured from: the first controlled token other than the target, else the
 * user's character, else (only for the field preview) the token nearest to the target.
 * @param {object} options
 * @param {Array<{id: string}>} options.controlled   Controlled tokens
 * @param {{id: string}} options.target
 * @param {{id: string}|null} [options.character]    The token of the user's character on this scene
 * @param {Array<{id: string}>} [options.others]     Preview only: candidates, nearest first
 * @returns {object|null}
 */
export function pickOrigin({controlled=[], target, character=null, others=[]}) {
  const other = token => token && (token.id !== target?.id);
  return controlled.find(other) ?? (other(character) ? character : null) ?? others.find(other) ?? null;
}

/**
 * The elevation of a token and its difference to another token's.
 * @param {number} elevation
 * @param {number|null} [from]    The elevation of the other token
 * @returns {{value: number, diff: number|null}|null}   null when the token is on the ground and so is the other one
 */
export function elevationOf(elevation, from=null) {
  const value = Number(elevation) || 0;
  const diff = (from === null) || (from === undefined) ? null : roundDistance(value - (Number(from) || 0));
  if ( !value && !diff ) return null;
  return {value: roundDistance(value), diff: diff || null};
}

/**
 * When "show all" is on: pure rules, no Foundry. Three sources can switch all tooltips on (the held key, the toggled
 * key, the start of a combat turn); they show while at least one of them is on.
 */

/** The number of seconds the turn tooltips stay when the setting is missing or out of range. */
export const TURN_SECONDS_DEFAULT = 4;

/** The state with every source off. */
export function idleState() {
  return {held: false, toggled: false, turn: false};
}

/**
 * The state after the key was pressed or released.
 * @param {{held: boolean, toggled: boolean, turn: boolean}} state
 * @param {"hold"|"toggle"} mode
 * @param {"down"|"up"} phase
 * @returns {{held: boolean, toggled: boolean, turn: boolean}}
 */
export function applyKey(state, mode, phase) {
  if ( mode === "toggle" ) {
    if ( phase === "down" ) return {...state, toggled: !state.toggled};
    return state;
  }
  return {...state, held: phase === "down"};
}

/**
 * Whether the tooltips of all tokens show.
 * @param {{held: boolean, toggled: boolean, turn: boolean}} state
 * @returns {boolean}
 */
export function wantsAll(state) {
  return !!(state.held || state.toggled || state.turn);
}

/**
 * The source to count for usage statistics.
 * @param {{held: boolean, toggled: boolean, turn: boolean}} state
 * @returns {"showAllHeld"|"showAllToggled"|"turnTooltips"|null}
 */
export function featureOf(state) {
  if ( state.held ) return "showAllHeld";
  if ( state.toggled ) return "showAllToggled";
  if ( state.turn ) return "turnTooltips";
  return null;
}

/**
 * The milliseconds the turn tooltips stay.
 * @param {*} seconds
 * @returns {number}
 */
export function turnDuration(seconds) {
  const value = Number(seconds);
  return Math.round((Number.isFinite(value) && value > 0 ? Math.min(value, 30) : TURN_SECONDS_DEFAULT) * 1000);
}

/**
 * Whether a combat update is the start of a turn: the turn or the round changed.
 * @param {object} changes
 * @returns {boolean}
 */
export function isTurnChange(changes) {
  return !!changes && (("turn" in changes) || ("round" in changes));
}

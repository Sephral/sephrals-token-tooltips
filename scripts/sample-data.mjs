/**
 * Made-up data of the sample windows (api.samples, see sample-windows.mjs): the shared cast with the hit points, armor
 * and conditions of a fight in progress, the floating numbers of a few blows, and the file an import would read. Pure
 * functions without Foundry, so the tests can run them.
 */

/** What each member of the cast shows in the tooltip: hit points now and at most, armor, speed, level or challenge. */
export const STATES = {
  ari: {hp: 31, max: 44, ac: 18, walk: 30, level: 5, status: []},
  mira: {hp: 28, max: 28, ac: 12, walk: 30, level: 5, status: []},
  tovin: {hp: 14, max: 36, ac: 17, walk: 25, level: 5, status: ["poisoned"]},
  sela: {hp: 6, max: 32, ac: 15, walk: 35, level: 5, status: ["prone"]},
  troll: {hp: 50, max: 84, ac: 15, walk: 30, cr: 5, status: []},
  bandit1: {hp: 4, max: 16, ac: 12, walk: 30, cr: 0.125, status: ["prone"]},
  bandit2: {hp: 16, max: 16, ac: 12, walk: 30, cr: 0.125, status: []},
  wolf: {hp: 22, max: 22, ac: 13, walk: 40, cr: 0.25, status: []}
};

/**
 * The data of an unsaved actor for one member of the cast, in the shape of the game system (D&D 5e in detail, other
 * systems get an actor of their first type with plain hit points).
 * @param {{id: string, name: string, img: string, side: string}} member   From sampleCast()
 * @param {string} systemId
 * @param {string[]} types   The actor types of the system
 * @returns {object}
 */
export function actorData(member, systemId, types = []) {
  const state = STATES[member.id] ?? STATES.ari;
  const party = member.side === "party";
  if ( systemId === "dnd5e" ) {
    const system = {
      attributes: {hp: {value: state.hp, max: state.max}, ac: {calc: "flat", flat: state.ac}, movement: {walk: state.walk, units: "ft"}},
      abilities: {wis: {value: 14}},
      skills: {prc: {value: 1}}
    };
    if ( !party ) system.details = {cr: state.cr};
    const items = party ? [{name: member.role ?? "Fighter", type: "class", system: {levels: state.level}}] : [];
    return {name: member.name, img: member.img, type: party ? "character" : "npc", system, items};
  }
  return {name: member.name, img: member.img, type: types[0] ?? "character",
    system: {attributes: {hp: {value: state.hp, max: state.max}}}, items: []};
}

/**
 * Who looks, for the player's samples: a player owns one hero, the other heroes are party members to them, the foes are
 * seen by their disposition.
 * @param {{id: string, side: string}} member
 * @param {"gm"|"player"} role
 * @returns {{isGM: boolean, isOwner: boolean, disposition: number, party: boolean}}
 */
export function viewerFor(member, role) {
  const party = member.side === "party";
  const disposition = party ? 1 : -1;
  if ( role === "gm" ) return {isGM: true, isOwner: true, disposition, party};
  return {isGM: false, isOwner: member.id === "ari", disposition, party};
}

/**
 * The blows of the floating numbers sample: who, the hit points before and after, and the maximum.
 * @returns {Array<{id: string, before: number, after: number, max: number}>}
 */
export function floaterCases() {
  return [
    {id: "troll", before: 84, after: 82, max: 84},
    {id: "wolf", before: 22, after: 17, max: 22},
    {id: "bandit1", before: 16, after: 9, max: 16},
    {id: "troll", before: 82, after: 50, max: 84},
    {id: "sela", before: 32, after: 12, max: 32},
    {id: "bandit1", before: 9, after: 0, max: 16},
    {id: "mira", before: 23, after: 28, max: 28},
    {id: "ari", before: 31, after: 40, max: 44},
    {id: "ari", before: 40, after: 42, max: 44},
    {id: "sela", before: 6, after: 26, max: 32},
    {id: "tovin", before: 30, after: 36, max: 36}
  ];
}

/**
 * The text of an export file as somebody else's setup: some fields switched, a new own field, an unknown field and an
 * own field that cannot be used.
 * @param {object} data   buildExport of the current fields (parsed)
 * @returns {string}
 */
export function importFile(data) {
  const copy = JSON.parse(JSON.stringify(data));
  const fields = copy.fields ?? {};
  const first = id => (id in fields ? id : null);
  const ac = first("ac");
  if ( ac ) fields[ac] = {...fields[ac], enabled: true, audience: "everyone",
    forms: {party: "exact", friendly: "exact", neutral: "descriptive", hostile: "hidden", secret: "hidden"}};
  const hp = first("hp");
  if ( hp ) fields[hp] = {...fields[hp], display: "bar"};
  const speed = first("speed");
  if ( speed ) fields[speed] = {...fields[speed], enabled: false};
  fields["fieldOfAnotherSystem"] = {enabled: true, audience: "gm"};
  copy.custom = [{id: "custom-sample1", label: "Dexterity", path: "system.abilities.dex.value", format: "number"},
    {id: "custom-broken", label: "", path: "no path here", format: "text"}];
  fields["custom-sample1"] = {enabled: true, audience: "owner"};
  copy.order = [...(copy.order ?? []).filter(id => id !== "ac"), "custom-sample1"];
  copy.order.splice(1, 0, "ac");
  copy.preset = "pf2e";
  return JSON.stringify(copy);
}

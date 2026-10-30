/**
 * Self-test: the parts of Foundry the tooltips use, the field list of this system read from a real token, and a test
 * tooltip drawn and removed again.
 */

import {MODULE_ID, TESTED_VERSIONS, esc, fieldLabel, setting, t} from "./config.mjs";
import {thingToken, tooltipData, tooltipMarkup} from "./content.mjs";
import {activeFields} from "./fields.mjs";
import {presetFor} from "./presets.mjs";
import {readField} from "./reader.mjs";
import {currentFields} from "./registry.mjs";

/**
 * The token the test reads: the selected one, else the first with an actor on the viewed scene. Things without a
 * tooltip (heaps and chests of Item Piles, PF2e loot) are passed over.
 * @returns {Token|null}
 */
function sampleToken() {
  if ( !canvas?.ready ) return null;
  const usable = token => !!token.actor && !thingToken(token.document);
  return canvas.tokens.controlled.find(usable) ?? canvas.tokens.placeables.find(usable) ?? null;
}

/**
 * Draw a tooltip for a token off screen and measure it.
 * @param {Token} token
 * @param {object[]} fields
 * @returns {boolean}
 */
function drawWorks(token, fields) {
  const data = tooltipData(token, {fields, viewer: {isGM: true, isOwner: true, disposition: token.document.disposition},
    preview: true});
  if ( !data ) return false;
  const element = document.createElement("div");
  element.className = "stt-tooltip";
  element.style.cssText = "position: fixed; left: -2000px; top: 0;";
  element.innerHTML = tooltipMarkup(data);
  document.body.append(element);
  const ok = (element.offsetWidth > 20) && (element.offsetHeight > 10);
  element.remove();
  return ok;
}

/**
 * Run all checks.
 * @returns {Promise<{problems: string[], checks: number, notes: string[]}>}
 */
async function checkAll() {
  const problems = [];
  const notes = [];
  let checks = 0;
  const check = (ok, key, data) => {
    checks++;
    if ( !ok ) problems.push(game.i18n.has(key) ? t(key, data) : key);
  };
  const TokenClass = CONFIG.Token?.objectClass;
  check(typeof TokenClass?.prototype?._onHoverIn === "function", "STT.SELFTEST.Hover");
  check(typeof canvas?.clientCoordinatesFromCanvas === "function", "STT.SELFTEST.Canvas");
  check(!!CONST.TOKEN_DISPLAY_MODES && !!CONST.TOKEN_DISPOSITIONS, "STT.SELFTEST.Constants");
  for ( const key of ["fieldConfig", "enabled", "delay", "position"] ) {
    check(game.settings.settings.has(`${MODULE_ID}.${key}`), "STT.SELFTEST.Storage", {key});
  }
  const keys = ["STT.Fields.title", "STT.Health.bloodied", "STT.Field.effects", "STT.Choice.everyone"];
  const missing = keys.filter(key => !game.i18n.has(key));
  check(!missing.length, "STT.SELFTEST.Texts", {keys: missing.join(", ")});

  const preset = presetFor(game.system.id);
  if ( preset.id === "generic" ) notes.push(t("STT.SELFTEST.Generic", {system: game.system.title}));
  const fields = currentFields();
  const token = sampleToken();
  if ( token ) {
    const failed = [];
    for ( const field of activeFields(fields, token.actor?.type) ) {
      if ( field.type === "name" ) continue;
      try {
        readField(field, token.document);
      } catch(err) {
        failed.push(fieldLabel(field));
      }
    }
    check(!failed.length, "STT.SELFTEST.Read", {fields: failed.join(", "), token: token.document.name});
    check(drawWorks(token, fields), "STT.SELFTEST.Draw", {token: token.document.name});
  }
  else notes.push(t("STT.SELFTEST.NoToken"));
  if ( !setting("enabled") ) notes.push(t("STT.SELFTEST.Disabled"));
  return {problems, checks, notes};
}

/**
 * Run the self-test and report the result.
 * @param {object} [options]
 * @param {boolean} [options.report=true]
 * @returns {Promise<{problems: string[], checks: number, notes: string[]}>}
 */
export async function runSelfTest({report=true}={}) {
  const result = await checkAll();
  const {problems, checks, notes} = result;
  const summary = problems.length ? t("STT.SELFTEST.Problems", {problems: problems.length, checks})
    : t("STT.SELFTEST.Passed", {checks});
  if ( problems.length ) ui.notifications.warn(summary, {permanent: true});
  else ui.notifications.info(summary);
  if ( report ) {
    const system = game.system.id;
    const versions = t("STT.SELFTEST.Version", {current: game.version, tested: TESTED_VERSIONS.core,
      system: `${game.system.title} ${game.system.version}`, systemTested: TESTED_VERSIONS[system] ?? "?"});
    let content = `<h3>${esc(t("STT.SELFTEST.Title"))}</h3><p>${esc(summary)}</p><p><small>${esc(versions)}</small></p>`;
    if ( problems.length ) content += `<ul>${problems.map(p => `<li>${esc(p)}</li>`).join("")}</ul>`;
    if ( notes.length ) content += `<p><small>${notes.map(esc).join("<br>")}</small></p>`;
    await ChatMessage.implementation.create({content, whisper: [game.user.id], speaker: {alias: game.modules.get(MODULE_ID).title}});
  }
  return result;
}

/**
 * Tell the GM once when Foundry or the system is newer than the versions the module was verified against.
 */
export function noticeNewVersions() {
  if ( !game.user.isGM ) return;
  const newer = [];
  if ( foundry.utils.isNewerVersion(game.version, TESTED_VERSIONS.core) ) newer.push(`Foundry ${game.version}`);
  const tested = TESTED_VERSIONS[game.system.id];
  if ( tested && foundry.utils.isNewerVersion(game.system.version, tested) ) newer.push(`${game.system.title} ${game.system.version}`);
  if ( !newer.length ) return;
  const signature = newer.join(", ");
  if ( game.settings.get(MODULE_ID, "acknowledgedVersions") === signature ) return;
  game.settings.set(MODULE_ID, "acknowledgedVersions", signature);
  ui.notifications.info(t("STT.SELFTEST.NewVersions", {versions: signature}), {permanent: true});
}

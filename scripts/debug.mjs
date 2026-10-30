/**
 * Token Tooltips' part of the debug file of Sephral's modules: the preset of the system, the configured fields and
 * the state of the tooltips on the screen. No token values: only ids, counts and the configuration.
 */

import {MODULE_ID, t} from "./config.mjs";
import {registerDebugMenu, registerDebugProvider} from "./debug-file.mjs";
import {overlayState} from "./overlay.mjs";
import {presetFor} from "./presets.mjs";
import {currentFields, registeredFields} from "./registry.mjs";

/**
 * Run one part and keep its error instead, so one broken reading does not cost the rest.
 * @param {Function} fn
 * @returns {*}
 */
function attempt(fn) {
  try {
    return fn();
  } catch(err) {
    return {error: String(err?.message ?? err)};
  }
}

/**
 * What the tooltips know right now.
 * @returns {object}
 */
export function describeState() {
  return {
    system: game.system?.id ?? null,
    preset: attempt(() => presetFor(game.system.id).id),
    fields: attempt(() => currentFields().map(f => ({id: f.id, type: f.type, enabled: f.config.enabled,
      audience: f.config.audience, forms: f.config.forms, display: f.config.display, custom: !!f.custom,
      external: !!f.external, path: f.custom ? f.path : undefined}))),
    registered: attempt(() => registeredFields().map(f => ({id: f.id, type: f.type, systems: f.systems}))),
    overlay: attempt(() => overlayState())
  };
}

/**
 * The button in the settings and the module's part of the file. Call in "init".
 */
export function registerDebug() {
  registerDebugMenu(MODULE_ID, {name: "STT.DEBUG.Title", label: "STT.DEBUG.Save", hint: "STT.DEBUG.Hint"});
  registerDebugProvider({
    moduleId: MODULE_ID,
    label: () => t("STT.DEBUG.Entry"),
    notice: file => t("STT.DEBUG.Saved", {file}),
    recent: () => ({details: describeState()}),
    // The field configuration is described above in readable form
    omitSettings: ["fieldConfig"]
  });
}

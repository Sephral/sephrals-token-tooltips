/**
 * Settings of the module. Like in every Sephral module, all options appear in Foundry's settings dialog under this
 * module, starting with the module language.
 */

import {MODULE_ID, isShown} from "./config.mjs";
import {FOLLOW_FOUNDRY, applyModuleLanguage} from "./language.mjs";
import {runSelfTest} from "./selftest.mjs";

/**
 * The settings of the module, in the order they appear in the settings dialog.
 * @type {Record<string, object>}
 */
export const SETTINGS = {
  uiLanguage: {type: String, default: FOLLOW_FOUNDRY, scope: "client", onChange: "language", choices: {
    [FOLLOW_FOUNDRY]: "STT.LANGUAGE.default", de: "STT.LANGUAGE.de", en: "STT.LANGUAGE.en"}},
  theme: {type: String, default: "signature", scope: "client", onChange: "redraw", choices: {
    signature: "STT.SETTINGS.theme.signature", foundry: "STT.SETTINGS.theme.foundry"}},
  enabled: {type: Boolean, default: true, scope: "client", onChange: "redraw"},
  delay: {type: Number, default: 350, scope: "client", range: {min: 0, max: 1500, step: 50}},
  position: {type: String, default: "right", scope: "client", onChange: "redraw", choices: {
    right: "STT.SETTINGS.position.right", above: "STT.SETTINGS.position.above", below: "STT.SETTINGS.position.below"}},
  size: {type: String, default: "normal", scope: "client", onChange: "redraw", choices: {
    small: "STT.SETTINGS.size.small", normal: "STT.SETTINGS.size.normal", large: "STT.SETTINGS.size.large"}},
  respectNames: {type: Boolean, default: true, onChange: "redraw"}
};

/**
 * Register all settings of the module and its menus.
 * @param {{language: Function, redraw: Function, fields: Function, openFields: Function}} handlers
 */
export function registerSettings(handlers) {
  openFieldsMenu = handlers.openFields;
  for ( const [key, def] of Object.entries(SETTINGS) ) {
    game.settings.register(MODULE_ID, key, {
      name: `STT.SETTINGS.${key}.name`,
      hint: `STT.SETTINGS.${key}.hint`,
      scope: def.scope ?? "world",
      config: true,
      type: def.range ? new foundry.data.fields.NumberField({...def.range, initial: def.default}) : def.type,
      choices: def.choices,
      default: def.default,
      onChange: def.onChange ? value => handlers[def.onChange]?.(value) : undefined
    });
  }

  // The field configuration of the GM, by preset
  game.settings.register(MODULE_ID, "fieldConfig", {scope: "world", config: false, type: Object, default: {},
    onChange: value => handlers.fields?.(value)});
  game.settings.register(MODULE_ID, "acknowledgedVersions", {scope: "client", config: false, type: String, default: ""});

  game.settings.registerMenu(MODULE_ID, "fields", {
    name: "STT.Fields.title",
    label: "STT.Fields.menuLabel",
    hint: "STT.Fields.menuHint",
    icon: "fa-solid fa-list-check",
    type: FieldsMenu,
    restricted: true
  });
  game.settings.registerMenu(MODULE_ID, "selfTest", {
    name: "STT.SELFTEST.Title",
    label: "STT.SELFTEST.Run",
    hint: "STT.SELFTEST.Hint",
    icon: "fa-solid fa-stethoscope",
    type: TooltipSelfTestMenu,
    restricted: true
  });
}

/** Opens the field configuration for the menu button. */
let openFieldsMenu = () => {};

/** The menu button which opens the field configuration (the one window, not a second copy of it). */
class FieldsMenu extends foundry.applications.api.ApplicationV2 {
  /** @override */
  async render() {
    await openFieldsMenu();
    return this;
  }
}

/** The menu button which runs the self-test. Foundry only accepts application classes as menus. */
class TooltipSelfTestMenu extends foundry.applications.api.ApplicationV2 {
  /** @override */
  async render() {
    if ( game.user.isGM ) await runSelfTest();
    return this;
  }
}

/**
 * Switch the module strings when the user picks another module language, then redraw.
 * @param {string} value
 * @param {Function} redraw
 */
export function changeLanguage(value, redraw) {
  applyModuleLanguage(value).then(() => {
    const app = foundry.applications.instances.get("stt-fields");
    if ( isShown(app) ) app.render({window: {title: app.title}});
    redraw();
    if ( game.settings.sheet?.rendered ) game.settings.sheet.render();
  });
}

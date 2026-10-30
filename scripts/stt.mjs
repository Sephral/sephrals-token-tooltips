import {MODULE_ID, setting} from "./config.mjs";
import {registerDebug} from "./debug.mjs";
import {saveDebugFile} from "./debug-file.mjs";
import {openFields, refreshPreview} from "./fields-app.mjs";
import {applyModuleLanguage} from "./language.mjs";
import {clear, concerns, hideAll, onDestroyToken, onHoverToken, onRefreshToken, refresh, reposition, showAll,
  watchPointer} from "./overlay.mjs";
import {currentFields, registerField, registeredFields} from "./registry.mjs";
import {noticeNewVersions, runSelfTest} from "./selftest.mjs";
import {changeLanguage, registerSettings} from "./settings.mjs";
import {registerUsage} from "./usage.mjs";

Hooks.once("init", () => {
  registerSettings({
    language: value => changeLanguage(value, redraw),
    redraw,
    fields: () => {
      clear();
      refreshPreview();
    },
    openFields
  });
  // Counted only on the active GM's client, like every Sephral module
  registerUsage(MODULE_ID, {
    features: ["tooltipSession", "showAllHeld", "fieldsSaved", "customField"],
    settings: ["theme", "enabled", "position", "size", "respectNames"]
  });
  game.keybindings.register(MODULE_ID, "showAll", {
    name: "STT.Keys.showAll",
    hint: "STT.Keys.showAllHint",
    editable: [{key: "AltLeft"}, {key: "AltRight"}],
    onDown: () => {
      showAll();
      return false;
    },
    onUp: () => {
      hideAll();
      return false;
    },
    precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL
  });
  registerDebug();

  Hooks.on("hoverToken", onHoverToken);
  Hooks.on("refreshToken", onRefreshToken);
  Hooks.on("destroyToken", onDestroyToken);
  Hooks.on("canvasPan", reposition);
  Hooks.on("canvasTearDown", clear);
  Hooks.on("renderTokenHUD", clear);
  Hooks.on("controlToken", refreshPreview);
  Hooks.on("updateActor", actor => changed(actor));
  Hooks.on("updateToken", token => changed(token.actor, token.id));
  for ( const action of ["create", "update", "delete"] ) {
    Hooks.on(`${action}ActiveEffect`, effect => changed(actorOf(effect)));
    Hooks.on(`${action}Item`, item => changed(actorOf(item)));
  }
  Hooks.on(`${MODULE_ID}.fieldsChanged`, () => refresh());

  game.modules.get(MODULE_ID).api = {
    /** Add a field from another module: {id, label, type, read(actor, token) or path, systems?, icon?, defaults?}. */
    registerField,
    /** The configured fields of this world, in order. */
    fields: currentFields,
    /** The fields other modules registered. */
    registeredFields,
    /** Open the field configuration (GM). */
    openConfig: openFields,
    /** Redraw the tooltips on the screen. */
    refresh,
    /** Check the module (GM). */
    runSelfTest,
    /** Save the debug file of Sephral's modules (GM): about one chat message, or without an id the latest state. */
    saveDebugFile: messageId => saveDebugFile(messageId ?? null, {moduleId: MODULE_ID})
  };
});

/** Applying a fixed module language loads its file; the rest of "ready" waits for it. */
let languageReady = Promise.resolve();

Hooks.once("i18nInit", () => {
  languageReady = applyModuleLanguage(setting("uiLanguage"));
});

Hooks.once("ready", async () => {
  await languageReady;
  watchPointer();
  noticeNewVersions();
});

/**
 * The actor an effect or item belongs to.
 * @param {ActiveEffect|Item} document
 * @returns {Actor|null}
 */
function actorOf(document) {
  const parent = document?.parent;
  if ( !parent ) return null;
  return parent.documentName === "Actor" ? parent : (parent.parent?.documentName === "Actor" ? parent.parent : null);
}

/**
 * A value of a token changed: redraw its tooltip and the preview.
 * @param {Actor|null} actor
 * @param {string} [tokenId]
 */
function changed(actor, tokenId=null) {
  if ( concerns(actor, tokenId) ) refresh();
  refreshPreview();
}

/** Redraw after a setting changed: the tooltips build anew on the next hover. */
function redraw() {
  clear();
  refreshPreview();
}

// Sample windows (api.samples, contract in samples.mjs): tooltips of a made-up party and its foes as the GM and as a
// player see them, all tooltips at once, the floating numbers, and the field window with a sample token. Everything is
// rendered by the module's own code from actors and tokens that exist only in memory: no token is placed, no actor
// created, nothing saved. Buttons that would change, save or export something only say that they do nothing.
import {esc, setting, t} from "./config.mjs";
import {tooltipData, tooltipMarkup} from "./content.mjs";
import {FieldConfig} from "./fields-app.mjs";
import {changeOf, floaterFor, stateOf} from "./floaters.mjs";
import {currentFields, registeredFields} from "./registry.mjs";
import {fieldsFor} from "./fields.mjs";
import {buildExport, parseImport, planImport} from "./transfer.mjs";
import {presetFor} from "./presets.mjs";
import {STATES, actorData, floaterCases, importFile, viewerFor} from "./sample-data.mjs";
import {blockedForm, closeSample, markSample, openSampleDialog, openSampleHtml, sampleActions, sampleCast, sampleId} from "./samples.mjs";

const MODULE_ID = "sephrals-token-tooltips";

// Actions of the field window that only look or change the working copy in memory (saving, export and import say that
// they do nothing).
const LOOKING = ["moveUp", "moveDown", "removeField", "addField", "resetFields", "togglePicker", "pickerTab", "pickPath"];

/* -------------------------------------------- */
/*  Actors and tokens in memory                 */
/* -------------------------------------------- */

/** A condition of the game as an effect of an actor, with the name and picture the game gives it. */
function statusEffect(id) {
  const status = CONFIG.statusEffects?.find(s => s.id === id);
  if ( !status ) return null;
  return {name: game.i18n.localize(status.name ?? status.label ?? id), img: status.img ?? status.icon, statuses: [id]};
}

/**
 * The tokens of the cast as the tooltip code reads them: an unsaved actor and an object with the members of a
 * TokenDocument that it needs. Nothing is created.
 * @returns {Map<string, {id: string, visible: boolean, actor: Actor, document: object, member: object}>}
 */
export function sampleTokens() {
  const ActorClass = getDocumentClass("Actor");
  const types = game.system.documentTypes?.Actor ?? [];
  const tokens = new Map();
  for ( const member of sampleCast() ) {
    const data = actorData(member, game.system.id, Array.isArray(types) ? types : Object.keys(types));
    data.effects = (STATES[member.id]?.status ?? []).map(statusEffect).filter(Boolean);
    const actor = new ActorClass(data);
    const attribute = game.system.primaryTokenAttribute ?? "attributes.hp";
    const document = {
      id: `sample-${member.id}`, name: member.name, actor, parent: null, object: null, actorLink: member.side === "party",
      disposition: member.side === "party" ? 1 : -1, hidden: false, elevation: 0, flags: {},
      displayName: CONST.TOKEN_DISPLAY_MODES.HOVER, isOwner: false, bar1: {attribute}, bar2: {attribute: null},
      getUserLevel: () => 0,
      getBarAttribute(bar) {
        const path = this[bar]?.attribute;
        const value = path ? foundry.utils.getProperty(actor.system, path) : null;
        if ( !value || (typeof value !== "object") ) return null;
        return {type: "bar", attribute: path, value: value.value, max: value.max, editable: true};
      }
    };
    tokens.set(member.id, {id: document.id, visible: true, actor, document, member});
  }
  return tokens;
}

/* -------------------------------------------- */
/*  Tooltips                                    */
/* -------------------------------------------- */

/** The tooltip of a sample token for a viewer, as the markup of the module gives it, or an empty note. */
function tooltipElement(token, role, fields) {
  const viewer = viewerFor(token.member, role);
  const data = tooltipData(token, {fields, viewer, preview: true});
  const element = document.createElement("div");
  element.className = "stt-tooltip";
  element.dataset.sttTheme = setting("theme");
  element.dataset.size = "normal";
  element.innerHTML = data ? tooltipMarkup(data) : `<div class="stt-empty">${esc(t("STT.Fields.nothing"))}</div>`;
  return element;
}

/**
 * The window body: the heroes and the foes, each with the tooltip a viewer gets.
 * @param {"gm"|"player"} role
 * @param {object} [options]
 * @param {boolean} [options.compact]   The look of all tooltips at once
 * @param {string} [options.note]       A line above the tooltips
 * @param {boolean} [options.indicator] The note of the toggled key
 * @returns {HTMLElement}
 */
function tooltipsBody(role, {compact = false, note = "", indicator = false} = {}) {
  const tokens = sampleTokens();
  const fields = currentFields();
  const root = document.createElement("div");
  root.className = "stt-sample-tooltips";
  if ( indicator ) {
    const pill = document.createElement("p");
    pill.className = "stt-sample-indicator";
    pill.textContent = t("STT.Keys.indicator");
    root.append(pill);
  }
  if ( note ) {
    const line = document.createElement("p");
    line.className = "stt-sample-note";
    line.textContent = note;
    root.append(line);
  }
  for ( const side of ["party", "foe"] ) {
    const heading = document.createElement("h4");
    heading.textContent = t(side === "party" ? "STT.Disposition.party" : "STT.Disposition.hostile");
    const grid = document.createElement("div");
    grid.className = "stt-sample-grid";
    for ( const token of tokens.values() ) {
      if ( token.member.side !== side ) continue;
      const element = tooltipElement(token, role, fields);
      if ( compact ) element.classList.add("stt-compact");
      grid.append(element);
    }
    root.append(heading, grid);
  }
  return root;
}

/* -------------------------------------------- */
/*  Floating numbers                            */
/* -------------------------------------------- */

/** The floating numbers of a few blows, exact (GM and owners) and described (everyone else), on a dark ground. */
function floatersBody() {
  const names = new Map(sampleCast().map(member => [member.id, member.name]));
  const root = document.createElement("div");
  root.className = "stt-sample-floaters";
  const head = document.createElement("div");
  head.className = "stt-sample-floater-row stt-sample-floater-head";
  for ( const text of ["", t("STT.Choice.exact"), t("STT.Choice.descriptive")] ) {
    const cell = document.createElement("span");
    cell.textContent = text;
    head.append(cell);
  }
  root.append(head);
  const word = key => t(`STT.Floater.${key}`);
  for ( const item of floaterCases() ) {
    const change = changeOf(stateOf({value: item.before, max: item.max}), stateOf({value: item.after, max: item.max}));
    const row = document.createElement("div");
    row.className = "stt-sample-floater-row";
    const who = document.createElement("span");
    who.className = "stt-sample-floater-who";
    who.textContent = names.get(item.id) ?? item.id;
    row.append(who);
    for ( const form of ["exact", "descriptive"] ) {
      const floater = floaterFor(form, change, {word});
      const cell = document.createElement("span");
      cell.className = "stt-sample-floater";
      cell.textContent = floater.text;
      cell.style.color = floater.fill;
      cell.style.fontSize = `${floater.fontSize}px`;
      row.append(cell);
    }
    root.append(row);
  }
  return root;
}

/* -------------------------------------------- */
/*  The field window                            */
/* -------------------------------------------- */

/** The field window over a sample token: the preview and the picker read it, nothing is saved. */
class SampleFieldConfig extends FieldConfig {
  constructor(token, key) {
    super({id: sampleId(MODULE_ID, key), actions: sampleActions(FieldConfig, LOOKING), form: {handler: blockedForm}});
    this.sampleToken = token;
    markSample(this);
  }
}

async function openFieldWindow(key, {picker = null} = {}) {
  await closeSample(sampleId(MODULE_ID, key));
  const app = new SampleFieldConfig(sampleTokens().get("troll"), key);
  await app.render({force: true});
  if ( picker ) {
    app.element.querySelector("[data-action=togglePicker]")?.click();
    if ( picker === "all" ) app.element.querySelector("[data-action=pickerTab][data-tab=all]")?.click();
  }
  return app;
}

/** The question before an import: the changes a file with somebody else's setup would make. */
function importQuestion() {
  const preset = presetFor(game.system.id);
  const current = fieldsFor(game.system.id, setting("fieldConfig") ?? {}, registeredFields());
  const exported = JSON.parse(JSON.stringify(buildExport({presetId: preset.id, systemId: game.system.id,
    moduleVersion: game.modules.get(MODULE_ID)?.version ?? "", fields: current})));
  const parsed = parseImport(importFile(exported));
  const plans = Object.fromEntries(["merge", "replace"].map(mode => [mode, planImport({systemId: game.system.id,
    presetId: preset.id, current, imported: parsed, mode, registered: registeredFields()})]));
  return {content: () => FieldConfig.importContent(plans, parsed, preset.id), plans};
}

/* -------------------------------------------- */
/*  The entries                                 */
/* -------------------------------------------- */

/**
 * The sample windows of the module (api.samples).
 * @returns {{id: string, label: string, group: string, open: () => Promise<object>}[]}
 */
export function sampleWindows() {
  const L = key => game.i18n.localize(`STT.Sample.${key}`);
  const tips = L("GroupTooltips");
  const fields = L("GroupFields");
  const html = (id, label, group, body, width) => ({id, label, group,
    open: () => openSampleHtml({moduleId: MODULE_ID, id, title: label, body, width, classes: ["stt-sample"]})});
  return [
    html("gm", L("Gm"), tips, () => tooltipsBody("gm", {note: L("GmNote")}), 900),
    html("player", L("Player"), tips, () => tooltipsBody("player", {note: L("PlayerNote")}), 900),
    html("all", L("All"), tips, () => tooltipsBody("gm", {compact: true, indicator: true}), 900),
    html("floaters", L("Floaters"), tips, floatersBody, 460),
    {id: "fields", label: L("Fields"), group: fields, open: () => openFieldWindow("fields")},
    {id: "fields-picker", label: L("Picker"), group: fields, open: () => openFieldWindow("fields-picker", {picker: "common"})},
    {id: "fields-picker-all", label: L("PickerAll"), group: fields,
      open: () => openFieldWindow("fields-picker-all", {picker: "all"})},
    {id: "import", label: L("Import"), group: fields, open: () => {
      const {content, plans} = importQuestion();
      return openSampleDialog({moduleId: MODULE_ID, id: "import", title: t("STT.Transfer.title"), content, width: 520,
        buttons: [
          {label: t("STT.Transfer.apply"), icon: "fa-solid fa-check", default: true},
          {label: t("STT.Transfer.cancel"), icon: "fa-solid fa-xmark"}
        ],
        render: (event, dialog) => {
          dialog.element.classList.add("stt-app", "stt-import");
          FieldConfig.wireImport(dialog, plans);
        }});
    }},
    {id: "reset", label: t("STT.Fields.reset"), group: fields, open: () => openSampleDialog({moduleId: MODULE_ID, id: "reset",
      title: t("STT.Fields.reset"), content: () => `<p>${esc(t("STT.Fields.resetConfirm"))}</p>`, width: 400,
      buttons: [
        {label: t("STT.Fields.reset"), icon: "fa-solid fa-rotate-left", default: true},
        {label: t("STT.Transfer.cancel"), icon: "fa-solid fa-xmark"}
      ]})}
  ];
}

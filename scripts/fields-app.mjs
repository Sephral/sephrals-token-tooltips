/**
 * The field configuration (GM): which values the tooltip shows, in which order, who sees them and how, plus own
 * fields from a data path. A live preview shows a selected token as the GM, its owner (or an observer) and another
 * player see it. The data path of an own field comes from a picker (the common values of the system or every value of
 * the preview token), from the browser's suggestions or typed by hand, with the value of the preview token below it.
 */

import {MODULE_ID, TEMPLATES, addSettingsGear, esc, fieldLabel, isShown, setting, t} from "./config.mjs";
import {tooltipData, tooltipMarkup} from "./content.mjs";
import {DISPLAYS, customDefinition, fieldsFor, moveField, newCustomId, sanitizeCustom, toStored} from "./fields.mjs";
import {describable, formatValue} from "./format.mjs";
import {entryLabel, flattenPaths, groupEntries, normalizePath, previewValue, searchEntries, shortlistFor, suggestLabel,
  takenPaths, topGroup} from "./paths.mjs";
import {CUSTOM_FORMATS, getPath, presetFor} from "./presets.mjs";
import {ENV} from "./reader.mjs";
import {currentFields, registeredFields} from "./registry.mjs";
import {shortlistOf} from "./shortlists.mjs";
import {countFeature} from "./usage.mjs";
import {AUDIENCES, DISPOSITIONS, FORM_KEYS, FORMS} from "./visibility.mjs";

/** At most this many values in the picker at once (search narrows the rest). */
const PICKER_ROWS = 600;

const {ApplicationV2, HandlebarsApplicationMixin, DialogV2} = foundry.applications.api;

export class FieldConfig extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @override */
  static DEFAULT_OPTIONS = {
    id: "stt-fields",
    classes: ["stt-app", "stt-fields"],
    tag: "form",
    window: {title: "STT.Fields.title", icon: "fa-solid fa-message", resizable: true},
    position: {width: 1384, height: 700},
    form: {handler: FieldConfig.#onSubmit, submitOnChange: false, closeOnSubmit: false},
    actions: {
      moveUp: FieldConfig.#onMoveUp,
      moveDown: FieldConfig.#onMoveDown,
      removeField: FieldConfig.#onRemove,
      addField: FieldConfig.#onAdd,
      resetFields: FieldConfig.#onReset,
      togglePicker: FieldConfig.#onTogglePicker,
      pickerTab: FieldConfig.#onPickerTab,
      pickPath: FieldConfig.#onPickPath
    }
  };

  /** @override */
  static PARTS = {main: {template: `${TEMPLATES}/fields.hbs`, scrollable: [".stt-field-list"]}};

  /** The working copy of the field list, saved with the save button. */
  #fields = currentFields();

  /** The disposition the "other player" preview uses ("" = the token's own, "party" = a party member). */
  #previewDisposition = "";

  /** What the GM entered for a new own field, kept across redraws. */
  #draft = {label: "", path: "", format: CUSTOM_FORMATS[0]};

  /** The picker of data paths: open, its tab ("common" or "all") and the search. */
  #picker = {open: false, tab: "common", query: ""};

  /** The values the picker lists right now. */
  #pickerRows = [];

  /** The token and actor the browser's path suggestions were made for. */
  #suggestionsFor = null;

  /** @override */
  get title() {
    return t("STT.Fields.title");
  }

  /** @override */
  async _prepareContext() {
    const preset = presetFor(game.system.id);
    const choices = keys => Object.fromEntries(keys.map(key => [key, t(`STT.Choice.${key}`)]));
    const last = this.#fields.length - 1;
    const fields = this.#fields.map((field, index) => {
      const forms = describable(field) ? FORMS : FORMS.filter(f => f !== "descriptive");
      const hasDisplay = ["resource", "bar"].includes(field.type);
      return {
        id: field.id,
        label: fieldLabel(field),
        icon: field.icon ?? "fa-solid fa-circle",
        type: t(`STT.Type.${field.type}`),
        custom: !!field.custom,
        external: !!field.external,
        path: field.path ?? "",
        types: field.actorTypes?.join(", ") ?? "",
        config: field.config,
        everyone: field.config.audience === "everyone",
        audienceChoices: choices(AUDIENCES),
        formChoices: choices(forms),
        forms: FORM_KEYS.map(key => ({key, value: field.config.forms[key], label: t(`STT.Disposition.${key}`)})),
        hasDisplay,
        displayChoices: choices(DISPLAYS),
        first: index === 0,
        last: index === last
      };
    });
    return {
      preset: t(`STT.Preset.${preset.id}`),
      system: game.system.title,
      fields,
      formats: Object.fromEntries(CUSTOM_FORMATS.map(f => [f, t(`STT.Type.${f}`)])),
      draft: this.#draft,
      dispositions: [{key: "", label: t("STT.Fields.ownDisposition")},
        ...FORM_KEYS.map(key => ({key, label: t(`STT.Disposition.${key}`)}))],
      previewDisposition: this.#previewDisposition
    };
  }

  /** @override */
  async _renderFrame(options) {
    const frame = await super._renderFrame(options);
    addSettingsGear(frame);
    return frame;
  }

  /** @override */
  _onFirstRender(context, options) {
    super._onFirstRender(context, options);
    // The form element stays across redraws, so it gets the listeners once
    this.element.addEventListener("change", event => this.#onChange(event));
    this.element.addEventListener("input", event => this.#onInput(event));
    this.element.addEventListener("keydown", event => this.#onKeyDown(event));
    // A click in the window outside the picker closes it (clicks on the scene keep it open to select a token)
    this.element.addEventListener("pointerdown", event => {
      if ( !this.#picker.open ) return;
      if ( event.target.closest(".stt-picker, [data-action=togglePicker]") ) return;
      this.#setPicker(false);
    });
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    this.element.dataset.sttTheme = setting("theme");
    this.#suggestionsFor = null;
    this.#setPicker(this.#picker.open);
    this.updatePreview();
  }

  /**
   * Take the values of the form into the working copy.
   * @param {Event} event
   */
  #onChange(event) {
    const target = event.target;
    if ( target.name === "previewDisposition" ) {
      this.#previewDisposition = target.value;
      this.updatePreview();
      return;
    }
    if ( target.closest(".stt-add") ) return;
    const before = this.#fields.map(f => f.config.audience).join();
    this.#readForm();
    if ( this.#fields.map(f => f.config.audience).join() !== before ) this.render();
    else this.updatePreview();
  }

  /** Read the configuration of every field from the form. */
  #readForm() {
    const elements = this.element.elements ?? this.element.querySelector("form")?.elements;
    if ( !elements ) return;
    const value = name => elements.namedItem(name);
    for ( const field of this.#fields ) {
      const enabled = value(`${field.id}.enabled`);
      if ( enabled ) field.config.enabled = enabled.checked;
      const audience = value(`${field.id}.audience`);
      if ( audience ) field.config.audience = audience.value;
      for ( const key of FORM_KEYS ) {
        const form = value(`${field.id}.forms.${key}`);
        if ( form ) field.config.forms[key] = form.value;
      }
      const display = value(`${field.id}.display`);
      if ( display ) field.config.display = display.value;
    }
  }

  /**
   * The token the preview shows: the selected one, else the first token with an actor on the scene.
   * @returns {Token|null}
   */
  static previewToken() {
    if ( !canvas?.ready ) return null;
    return canvas.tokens.controlled[0] ?? canvas.tokens.placeables.find(t => t.actor) ?? null;
  }

  /** Draw the three preview tooltips. */
  updatePreview() {
    const box = this.element?.querySelector(".stt-preview");
    if ( !box ) return;
    const token = FieldConfig.previewToken();
    const name = box.querySelector(".stt-preview-token");
    if ( name ) name.textContent = token ? token.document.name : t("STT.Fields.noToken");
    const chosen = this.#previewDisposition;
    const disposition = DISPOSITIONS[chosen] ?? token?.document.disposition;
    const party = chosen ? chosen === "party" : !!token?.actor?.hasPlayerOwner;
    const viewers = {
      gm: {isGM: true, isOwner: true, disposition, party},
      owner: {isGM: false, isOwner: true, disposition, party},
      other: {isGM: false, isOwner: false, disposition, party}
    };
    for ( const [key, viewer] of Object.entries(viewers) ) {
      const slot = box.querySelector(`[data-viewer="${key}"] .stt-tooltip`);
      if ( !slot ) continue;
      const data = token ? tooltipData(token, {fields: this.#fields, viewer, preview: true}) : null;
      slot.dataset.sttTheme = setting("theme");
      slot.dataset.size = "normal";
      slot.innerHTML = data ? tooltipMarkup(data) : `<div class="stt-empty">${esc(t("STT.Fields.nothing"))}</div>`;
    }
    this.#updateSuggestions(token);
    this.#updatePathValue();
    if ( this.#picker.open ) this.#renderPicker({keepScroll: true});
  }

  /* -------------------------------------------- */
  /*  Data path of an own field                   */
  /* -------------------------------------------- */

  /**
   * Inputs of the add row: keep what the GM entered, show the value of the path, search the picker.
   * @param {Event} event
   */
  #onInput(event) {
    const target = event.target;
    if ( !target.closest?.(".stt-add") ) return;
    if ( target.name === "pickerSearch" ) {
      this.#picker.query = target.value;
      this.#renderPicker();
      return;
    }
    if ( target.name === "customLabel" ) this.#draft.label = target.value;
    else if ( target.name === "customPath" ) this.#draft.path = target.value;
    else if ( target.name === "customFormat" ) this.#draft.format = target.value;
    if ( ["customPath", "customFormat"].includes(target.name) ) this.#updatePathValue();
  }

  /**
   * Keys in the add row: Enter adds the field (it would save the whole form otherwise) or, in the search, picks the
   * first value. Escape closes the picker.
   * @param {KeyboardEvent} event
   */
  #onKeyDown(event) {
    const target = event.target;
    if ( !target.closest?.(".stt-add") ) return;
    if ( (event.key === "Escape") && this.#picker.open ) {
      event.preventDefault();
      event.stopPropagation();
      this.#setPicker(false);
      this.element.querySelector("[data-action=togglePicker]")?.focus();
      return;
    }
    if ( (event.key !== "Enter") || (target.tagName !== "INPUT") ) return;
    event.preventDefault();
    if ( target.name === "pickerSearch" ) {
      if ( this.#pickerRows.length ) this.#pick(this.#pickerRows[0]);
    }
    else if ( ["customLabel", "customPath"].includes(target.name) ) FieldConfig.#onAdd.call(this);
  }

  /**
   * The value of a path on a token as the tooltip would show it.
   * @param {string} path
   * @param {string} format
   * @param {Token|null} token
   * @returns {{raw: *, text: string|null}|null}   null: the token has no value there
   */
  #valueOn(path, format, token) {
    const actor = token?.actor;
    const clean = normalizePath(path);
    if ( !actor || !clean ) return null;
    const raw = clean.startsWith("token.") ? getPath(token.document, clean.slice(6)) : getPath(actor, clean);
    if ( raw === undefined ) return null;
    let content = null;
    try {
      const field = customDefinition({id: "custom-preview", label: "-", path: clean, format}, presetFor(game.system.id).id);
      const value = field.read({actor, token: token.document, env: ENV});
      content = formatValue({...field, config: {display: "number"}}, value, "exact", t);
    } catch(err) {
      content = null;
    }
    return {raw, text: content?.text ?? null};
  }

  /** The line under the path: the value of the preview token there, or that it has none. */
  #updatePathValue() {
    const line = this.element?.querySelector(".stt-path-value");
    if ( !line ) return;
    const path = normalizePath(this.#draft.path);
    line.hidden = !path;
    line.classList.remove("missing");
    if ( !path ) return;
    const token = FieldConfig.previewToken();
    if ( !token?.actor ) {
      line.textContent = t("STT.Picker.noPreviewToken");
      return;
    }
    const name = token.document.name;
    const found = this.#valueOn(path, this.#draft.format, token);
    if ( !found ) {
      line.textContent = t("STT.Picker.notFound", {name});
      line.classList.add("missing");
    }
    else if ( found.text === null ) {
      line.textContent = t("STT.Picker.noFit", {name, value: previewValue(found.raw) || "-",
        format: t(`STT.Type.${this.#draft.format}`)});
      line.classList.add("missing");
    }
    else line.textContent = t("STT.Picker.valueAt", {name, value: found.text});
  }

  /**
   * The browser's suggestions for the path: the common values and every value of the preview token.
   * @param {Token|null} token
   */
  #updateSuggestions(token) {
    const list = this.element?.querySelector("#stt-fields-paths");
    if ( !list ) return;
    const key = token?.actor ? `${token.id}.${token.actor.id}` : "";
    if ( this.#suggestionsFor === key ) return;
    this.#suggestionsFor = key;
    const i18n = {has: k => game.i18n.has(k), t};
    const options = new Map();
    for ( const entry of shortlistOf(presetFor(game.system.id).id) ) options.set(entry.path, entryLabel(entry, i18n));
    if ( token?.actor ) {
      for ( const entry of flattenPaths(token.actor.system) ) {
        if ( !options.has(entry.path) ) options.set(entry.path, previewValue(entry.value, 30));
      }
    }
    list.innerHTML = [...options].map(([path, label]) => `<option value="${esc(path)}"${label ? ` label="${esc(label)}"` : ""}>`)
      .join("");
  }

  /**
   * Open or close the picker.
   * @param {boolean} open
   */
  #setPicker(open) {
    this.#picker.open = open;
    const panel = this.element?.querySelector(".stt-picker");
    const button = this.element?.querySelector(".stt-pick-open");
    if ( !panel ) return;
    panel.hidden = !open;
    button?.setAttribute("aria-expanded", String(open));
    button?.classList.toggle("active", open);
    if ( !open ) return;
    // As high as the room above the add row allows
    const main = this.element.querySelector(".stt-fields-main");
    const box = this.element.querySelector(".stt-add");
    if ( main && box ) {
      const room = box.getBoundingClientRect().top - main.getBoundingClientRect().top - 20;
      panel.style.maxHeight = `${Math.max(180, Math.min(460, Math.round(room)))}px`;
    }
    const search = panel.querySelector("[name=pickerSearch]");
    if ( search && (search.value !== this.#picker.query) ) search.value = this.#picker.query;
    this.#renderPicker();
  }

  /**
   * The rows of the picker's current tab, before the search.
   * @returns {object[]|null}   null: the full list without a token
   */
  #pickerSource() {
    const token = FieldConfig.previewToken();
    const preset = presetFor(game.system.id);
    const i18n = {has: k => game.i18n.has(k), t};
    if ( this.#picker.tab === "common" ) {
      return shortlistFor(preset.id, this.#fields).map(entry => {
        const found = token?.actor ? this.#valueOn(entry.path, entry.format, token) : null;
        return {path: entry.path, format: entry.format, label: entryLabel(entry, i18n), group: entry.group,
          text: found?.text ?? (found ? previewValue(found.raw) : ""), missing: !!token?.actor && !found};
      });
    }
    if ( !token?.actor ) return null;
    const known = new Map(shortlistOf(preset.id).map(entry => [entry.path, entry]));
    const taken = takenPaths(this.#fields);
    return flattenPaths(token.actor.system).map(entry => {
      const short = known.get(entry.path);
      return {path: entry.path, format: short?.format ?? entry.format, group: topGroup(entry.path),
        label: short ? entryLabel(short, i18n) : suggestLabel(entry.path), text: previewValue(entry.value),
        used: taken.has(entry.path)};
    });
  }

  /**
   * Draw the picker's tabs and list.
   * @param {object} [options]
   * @param {boolean} [options.keepScroll=false]
   */
  #renderPicker({keepScroll=false}={}) {
    const panel = this.element?.querySelector(".stt-picker");
    if ( !panel || panel.hidden ) return;
    const tab = this.#picker.tab;
    for ( const button of panel.querySelectorAll("[data-action=pickerTab]") ) {
      const active = button.dataset.tab === tab;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
    }
    const listBox = panel.querySelector(".stt-picker-list");
    const note = panel.querySelector(".stt-picker-note");
    const scroll = keepScroll ? listBox.scrollTop : 0;
    const source = this.#pickerSource();
    const token = FieldConfig.previewToken();
    note.textContent = tab === "all" ? (token?.actor ? t("STT.Picker.valuesOf", {name: token.document.name}) : "")
      : (source?.length ? "" : t("STT.Picker.noCommon"));
    note.hidden = !note.textContent;
    if ( !source ) {
      this.#pickerRows = [];
      listBox.innerHTML = `<p class="stt-picker-empty">${esc(t("STT.Picker.noToken"))}</p>`;
      return;
    }
    const found = searchEntries(source, this.#picker.query);
    this.#pickerRows = found.slice(0, PICKER_ROWS);
    const index = new Map(this.#pickerRows.map((row, i) => [row, i]));
    const groups = groupEntries(this.#pickerRows, row => row.group, tab === "common" ? undefined : []);
    const groupName = key => (tab === "common" ? t(`STT.Group.${key}`) : key);
    let html = groups.map(({group, entries}) => `<section class="stt-pick-group"><h4>${esc(groupName(group))}</h4>`
      + entries.map(row => `<button type="button" class="stt-pick${row.used ? " used" : ""}${row.missing ? " missing" : ""}"`
        + ` data-action="pickPath" data-index="${index.get(row)}">`
        + `<span class="stt-pick-label">${esc(row.label)}</span>`
        + `<code class="stt-pick-path">${esc(row.path)}</code>`
        + `<span class="stt-pick-value">${esc(row.text || "-")}</span>`
        + `<span class="stt-pick-format">${row.used ? esc(t("STT.Picker.inUse")) : esc(t(`STT.Type.${row.format}`))}</span>`
        + `</button>`).join("") + `</section>`).join("");
    if ( !found.length ) html = `<p class="stt-picker-empty">${esc(t("STT.Picker.nothing"))}</p>`;
    else if ( found.length > PICKER_ROWS ) {
      html += `<p class="stt-picker-empty">${esc(t("STT.Picker.more", {count: found.length - PICKER_ROWS}))}</p>`;
    }
    listBox.innerHTML = html;
    listBox.scrollTop = scroll;
  }

  /**
   * Take a value of the picker: its path, a label to change at will and its format.
   * @param {{path: string, label: string, format: string}} row
   */
  #pick(row) {
    if ( !row ) return;
    this.#draft = {label: String(row.label ?? "").slice(0, 40), path: row.path,
      format: CUSTOM_FORMATS.includes(row.format) ? row.format : "text"};
    const box = this.element.querySelector(".stt-add");
    box.querySelector("[name=customLabel]").value = this.#draft.label;
    box.querySelector("[name=customPath]").value = this.#draft.path;
    box.querySelector("[name=customFormat]").value = this.#draft.format;
    this.#setPicker(false);
    this.#updatePathValue();
    const label = box.querySelector("[name=customLabel]");
    label.focus();
    label.select();
  }

  /** @this {FieldConfig} */
  static #onTogglePicker() {
    this.#setPicker(!this.#picker.open);
    if ( this.#picker.open ) this.element.querySelector(".stt-picker [name=pickerSearch]")?.focus();
  }

  /** @this {FieldConfig} */
  static #onPickerTab(event, target) {
    this.#picker.tab = target.dataset.tab === "all" ? "all" : "common";
    this.#renderPicker();
  }

  /** @this {FieldConfig} */
  static #onPickPath(event, target) {
    this.#pick(this.#pickerRows[Number(target.closest("[data-index]")?.dataset.index)]);
  }

  /**
   * The index of the field of a clicked button.
   * @param {HTMLElement} target
   * @returns {string|undefined}
   */
  static #fieldId(target) {
    return target.closest("[data-field-id]")?.dataset.fieldId;
  }

  /** @this {FieldConfig} */
  static #onMoveUp(event, target) {
    this.#move(FieldConfig.#fieldId(target), -1);
  }

  /** @this {FieldConfig} */
  static #onMoveDown(event, target) {
    this.#move(FieldConfig.#fieldId(target), 1);
  }

  /**
   * Move a field and redraw.
   * @param {string} id
   * @param {number} step
   */
  #move(id, step) {
    this.#readForm();
    const order = moveField(this.#fields.map(f => f.id), id, step);
    this.#fields = order.map(fid => this.#fields.find(f => f.id === fid));
    this.render();
  }

  /** @this {FieldConfig} */
  static #onRemove(event, target) {
    this.#readForm();
    const id = FieldConfig.#fieldId(target);
    this.#fields = this.#fields.filter(f => !(f.custom && (f.id === id)));
    this.render();
  }

  /** @this {FieldConfig} */
  static #onAdd() {
    this.#readForm();
    const box = this.element.querySelector(".stt-add");
    const custom = sanitizeCustom({
      id: newCustomId(this.#fields.map(f => f.id)),
      label: box.querySelector("[name=customLabel]").value,
      path: normalizePath(box.querySelector("[name=customPath]").value),
      format: box.querySelector("[name=customFormat]").value
    });
    if ( !custom ) {
      ui.notifications.warn(t("STT.Fields.invalidCustom"));
      return;
    }
    const field = customDefinition(custom, presetFor(game.system.id).id);
    this.#fields.push({...field, config: {...field.defaults, forms: {...field.defaults.forms}}});
    this.#draft = {label: "", path: "", format: custom.format};
    this.#setPicker(false);
    countFeature(MODULE_ID, "customField");
    this.render();
  }

  /** @this {FieldConfig} */
  static async #onReset() {
    const yes = await DialogV2.confirm({
      window: {title: t("STT.Fields.reset")},
      content: `<p>${esc(t("STT.Fields.resetConfirm"))}</p>`,
      rejectClose: false
    });
    if ( !yes ) return;
    this.#fields = fieldsFor(game.system.id, {}, registeredFields());
    this.render();
  }

  /** @this {FieldConfig} */
  static async #onSubmit() {
    this.#readForm();
    const preset = presetFor(game.system.id);
    const stored = foundry.utils.deepClone(setting("fieldConfig") ?? {});
    stored[preset.id] = toStored(this.#fields);
    await game.settings.set(MODULE_ID, "fieldConfig", stored);
    countFeature(MODULE_ID, "fieldsSaved");
    ui.notifications.info(t("STT.Fields.saved"));
  }
}

/**
 * Open the field configuration (GM).
 * @returns {Promise<FieldConfig>|undefined}
 */
export function openFields() {
  if ( !game.user.isGM ) return;
  const app = foundry.applications.instances.get("stt-fields") ?? new FieldConfig();
  if ( isShown(app) ) {
    app.bringToFront();
    return Promise.resolve(app);
  }
  return app.render({force: true});
}

/**
 * Redraw the preview when the selection or a value changed.
 */
export function refreshPreview() {
  const app = foundry.applications.instances.get("stt-fields");
  if ( isShown(app) ) app.updatePreview();
}

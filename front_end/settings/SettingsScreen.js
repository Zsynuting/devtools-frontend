/*
 * Copyright (C) 2013 Google Inc. All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are
 * met:
 *
 *     * Redistributions of source code must retain the above copyright
 * notice, this list of conditions and the following disclaimer.
 *     * Redistributions in binary form must reproduce the above
 * copyright notice, this list of conditions and the following disclaimer
 * in the documentation and/or other materials provided with the
 * distribution.
 *     * Neither the name of Google Inc. nor the names of its
 * contributors may be used to endorse or promote products derived from
 * this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
 * A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 * OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
 * LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
 * THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */


import * as Common from '../common/common.js';
import * as Components from '../components/components.js';
import * as Host from '../host/host.js';
import * as i18n from '../i18n/i18n.js';
import {ls} from '../platform/platform.js';
import * as Root from '../root/root.js';
import * as UI from '../ui/ui.js';

import {KeybindsSettingsTab} from './KeybindsSettingsTab.js';  // eslint-disable-line no-unused-vars

export const UIStrings = {
  /**
  *@description Name of the Settings view
  */
  settings: 'Settings',
  /**
  *@description Text for keyboard shortcuts
  */
  shortcuts: 'Shortcuts',
  /**
  *@description Text in Settings Screen of the Settings
  */
  preferences: 'Preferences',
  /**
  *@description Text of button in Settings Screen of the Settings
  */
  restoreDefaultsAndReload: 'Restore defaults and reload',
  /**
  *@description Text in Settings Screen of the Settings
  */
  experiments: 'Experiments',
  /**
  *@description Message shown in the experiments panel to warn users about any possible unstable features.
  */
  theseExperimentsCouldBeUnstable:
      'These experiments could be unstable or unreliable and may require you to restart DevTools.',
  /**
  *@description Message text content in Settings Screen of the Settings
  */
  theseExperimentsAreParticularly: 'These experiments are particularly unstable. Enable at your own risk.',
  /**
  *@description Warning text content in Settings Screen of the Settings
  */
  warning: 'WARNING:',
  /**
  *@description Message to display if a setting change requires a reload of DevTools
  */
  oneOrMoreSettingsHaveChanged: 'One or more settings have changed which requires a reload to take effect.',
};
const str_ = i18n.i18n.registerUIStrings('settings/SettingsScreen.js', UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(undefined, str_);

/** @type {!SettingsScreen} */
let settingsScreenInstance;

/**
 * @implements {UI.View.ViewLocationResolver}
 */
export class SettingsScreen extends UI.Widget.VBox {
  /**
   * @private
   */
  constructor() {
    super(true);
    this.registerRequiredCSS('settings/settingsScreen.css', {enableLegacyPatching: true});

    this.contentElement.classList.add('settings-window-main');
    this.contentElement.classList.add('vbox');

    const settingsLabelElement = document.createElement('div');
    const settingsTitleElement =
        UI.Utils
            .createShadowRootWithCoreStyles(
                settingsLabelElement,
                {cssFile: 'settings/settingsScreen.css', enableLegacyPatching: true, delegatesFocus: undefined})
            .createChild('div', 'settings-window-title');

    UI.ARIAUtils.markAsHeading(settingsTitleElement, 1);
    settingsTitleElement.textContent = i18nString(UIStrings.settings);

    this._tabbedLocation = UI.ViewManager.ViewManager.instance().createTabbedLocation(
        () => SettingsScreen._revealSettingsScreen(), 'settings-view');
    const tabbedPane = this._tabbedLocation.tabbedPane();
    tabbedPane.leftToolbar().appendToolbarItem(new UI.Toolbar.ToolbarItem(settingsLabelElement));
    tabbedPane.setShrinkableTabs(false);
    tabbedPane.makeVerticalTabLayout();
    const keyBindsView = UI.ViewManager.ViewManager.instance().view('keybinds');
    if (keyBindsView) {
      keyBindsView.widget().then(widget => {
        this._keybindsTab = /** @type {!KeybindsSettingsTab} */ (widget);
      });
    }
    tabbedPane.show(this.contentElement);
    tabbedPane.selectTab('preferences');
    tabbedPane.addEventListener(UI.TabbedPane.Events.TabInvoked, this._tabInvoked, this);
    this._reportTabOnReveal = false;
  }

  /**
   * @param {{forceNew: ?boolean}} opts
   */
  static instance(opts = {forceNew: null}) {
    const {forceNew} = opts;
    if (!settingsScreenInstance || forceNew) {
      settingsScreenInstance = new SettingsScreen();
    }

    return settingsScreenInstance;
  }

  /**
   * @return {!SettingsScreen}
   */
  static _revealSettingsScreen() {
    const settingsScreen = SettingsScreen.instance();
    if (settingsScreen.isShowing()) {
      return settingsScreen;
    }

    settingsScreen._reportTabOnReveal = true;
    const dialog = new UI.Dialog.Dialog();
    dialog.contentElement.tabIndex = -1;
    dialog.addCloseButton();
    dialog.setOutsideClickCallback(() => {});
    dialog.setPointerEventsBehavior(UI.GlassPane.PointerEventsBehavior.PierceGlassPane);
    dialog.setOutsideTabIndexBehavior(UI.Dialog.OutsideTabIndexBehavior.PreserveMainViewTabIndex);
    settingsScreen.show(dialog.contentElement);
    dialog.setEscapeKeyCallback(settingsScreen._onEscapeKeyPressed.bind(settingsScreen));

    // UI.Dialog extends GlassPane and overrides the `show` method with a wider
    // accepted type. However, TypeScript uses the supertype declaration to
    // determine the full type, which requires a `!Document`.
    // @ts-ignore
    dialog.show();

    return settingsScreen;
  }

  /**
   * @param {!ShowSettingsScreenOptions=} options
   */
  static async _showSettingsScreen(options = {name: undefined, focusTabHeader: undefined}) {
    const {name, focusTabHeader} = options;
    const settingsScreen = SettingsScreen._revealSettingsScreen();

    settingsScreen._selectTab(name || 'preferences');
    const tabbedPane = settingsScreen._tabbedLocation.tabbedPane();
    await tabbedPane.waitForTabElementUpdate();
    if (focusTabHeader) {
      tabbedPane.focusSelectedTabHeader();
    } else {
      tabbedPane.focus();
    }
  }

  /**
   * @override
   * @param {string} locationName
   * @return {?UI.View.ViewLocation}
   */
  resolveLocation(locationName) {
    return this._tabbedLocation;
  }

  /**
   * @param {string} name
   */
  _selectTab(name) {
    this._tabbedLocation.tabbedPane().selectTab(name, /* userGesture */ true);
  }

  /**
   * @param {!Common.EventTarget.EventTargetEvent} event
   */
  _tabInvoked(event) {
    const eventData = /** @type {!UI.TabbedPane.EventData} */ (event.data);
    if (!eventData.isUserGesture) {
      return;
    }

    const prevTabId = eventData.prevTabId;
    const tabId = eventData.tabId;
    if (!this._reportTabOnReveal && prevTabId && prevTabId === tabId) {
      return;
    }

    this._reportTabOnReveal = false;
    this._reportSettingsPanelShown(tabId);
  }

  /**
   * @param {string} tabId
   */
  _reportSettingsPanelShown(tabId) {
    if (tabId === i18nString(UIStrings.shortcuts)) {
      Host.userMetrics.settingsPanelShown('shortcuts');
      return;
    }

    Host.userMetrics.settingsPanelShown(tabId);
  }

  /**
   * @param {!Event} event
   */
  _onEscapeKeyPressed(event) {
    if (this._tabbedLocation.tabbedPane().selectedTabId === 'keybinds' && this._keybindsTab) {
      this._keybindsTab.onEscapeKeyPressed(event);
    }
  }
}

class SettingsTab extends UI.Widget.VBox {
  /**
   * @param {string} name
   * @param {string=} id
   */
  constructor(name, id) {
    super();
    this.element.classList.add('settings-tab-container');
    if (id) {
      this.element.id = id;
    }
    const header = this.element.createChild('header');
    UI.UIUtils.createTextChild(header.createChild('h1'), name);
    this.containerElement = this.element.createChild('div', 'settings-container-wrapper')
                                .createChild('div', 'settings-tab settings-content settings-container');
  }

  /**
   *  @param {string=} name
   *  @return {!Element}
   */
  _appendSection(name) {
    const block = this.containerElement.createChild('div', 'settings-block');
    if (name) {
      UI.ARIAUtils.markAsGroup(block);
      const title = block.createChild('div', 'settings-section-title');
      title.textContent = name;
      UI.ARIAUtils.markAsHeading(title, 2);
      UI.ARIAUtils.setAccessibleName(block, name);
    }
    return block;
  }
}

export class GenericSettingsTab extends SettingsTab {
  constructor() {
    super(i18nString(UIStrings.preferences), 'preferences-tab-content');

    /** @const */
    const explicitSectionOrder = [
      '', 'Appearance', 'Sources', 'Elements', 'Network', 'Performance', 'Console', 'Extensions', 'Persistence',
      'Debugger', 'Global'
    ];

    /** @type {!Map<string, !Element>} */
    this._nameToSection = new Map();
    for (const sectionName of explicitSectionOrder) {
      this._createSectionElement(sectionName);
    }

    /** @type {!Array<!Common.Settings.SettingRegistration>} */
    const unionOfSettings = [
      // TODO(crbug.com/1134103): Remove this call when all settings are migrated
      ...Root.Runtime.Runtime.instance().extensions('setting').map(extension => {
        const category = extension.descriptor().category;
        return {
          category: category ? ls(category) : undefined,
          settingName: extension.descriptor().settingName,
          title: extension.title(),
          order: extension.descriptor().order,
          settingType: extension.descriptor().settingType || '',
          defaultValue: extension.descriptor().defaultValue,
          tags: undefined,
          isRegex: undefined,
          options: undefined,
          reloadRequired: undefined,
          storageType: undefined,
          titleMac: undefined,
          userActionCondition: undefined,
          experiment: undefined,
          condition: undefined,
        };
      }),
      ...Common.Settings.getRegisteredSettings().map(setting => {
        return {...setting, title: setting.titleMac || setting.title};
      })
    ];
    // Some settings define their initial ordering.
    unionOfSettings.sort(
        (firstSetting, secondSetting) =>
            firstSetting.order && secondSetting.order ? (firstSetting.order - secondSetting.order) : 0);
    unionOfSettings.forEach(this._addSetting.bind(this));
    Root.Runtime.Runtime.instance().extensions(UI.SettingsUI.SettingUI).forEach(this._addSettingUI.bind(this));

    this._appendSection().appendChild(
        UI.UIUtils.createTextButton(i18nString(UIStrings.restoreDefaultsAndReload), restoreAndReload));

    function restoreAndReload() {
      Common.Settings.Settings.instance().clearAll();
      Components.Reload.reload();
    }
  }

  /**
  * @param {!Common.Settings.SettingRegistration} setting
   * @return {boolean}
   */
  static isSettingVisible(setting) {
    return Boolean(setting.title && setting.category);
  }

  /**
   * @param {!Common.Settings.SettingRegistration} settingRegistration
   */
  _addSetting(settingRegistration) {
    if (!GenericSettingsTab.isSettingVisible(settingRegistration)) {
      return;
    }
    const extensionCategory = settingRegistration.category;
    if (!extensionCategory) {
      return;
    }
    const sectionElement = this._sectionElement(extensionCategory);
    if (!sectionElement) {
      return;
    }
    const setting = Common.Settings.Settings.instance().moduleSetting(settingRegistration.settingName);
    const settingControl = UI.SettingsUI.createControlForSetting(setting);
    if (settingControl) {
      sectionElement.appendChild(settingControl);
    }
  }

  /**
   * @param {!Root.Runtime.Extension} extension
   */
  _addSettingUI(extension) {
    const descriptor = extension.descriptor();
    const sectionName = descriptor['category'] || '';
    extension.instance().then(appendCustomSetting.bind(this));

    /**
     * @param {!Object} object
     * @this {GenericSettingsTab}
     */
    function appendCustomSetting(object) {
      const settingUI = /** @type {!UI.SettingsUI.SettingUI} */ (object);
      const element = settingUI.settingElement();
      if (element) {
        let sectionElement = this._sectionElement(sectionName);
        if (!sectionElement) {
          sectionElement = this._createSectionElement(sectionName);
        }
        sectionElement.appendChild(element);
      }
    }
  }

  /**
   * @param {string} sectionName
   * @return {!Element}
   */
  _createSectionElement(sectionName) {
    const uiSectionName = sectionName && i18nString(sectionName);
    const sectionElement = this._appendSection(uiSectionName);
    this._nameToSection.set(sectionName, sectionElement);
    return sectionElement;
  }

  /**
   * @param {string} sectionName
   * @return {?Element}
   */
  _sectionElement(sectionName) {
    return this._nameToSection.get(sectionName) || null;
  }
}

export class ExperimentsSettingsTab extends SettingsTab {
  constructor() {
    super(i18nString(UIStrings.experiments), 'experiments-tab-content');

    const experiments = Root.Runtime.experiments.allConfigurableExperiments().sort();
    const unstableExperiments = experiments.filter(e => e.unstable);
    const stableExperiments = experiments.filter(e => !e.unstable);
    if (stableExperiments.length) {
      const experimentsSection = this._appendSection();
      const warningMessage = i18nString(UIStrings.theseExperimentsCouldBeUnstable);
      experimentsSection.appendChild(this._createExperimentsWarningSubsection(warningMessage));
      for (const experiment of stableExperiments) {
        experimentsSection.appendChild(this._createExperimentCheckbox(experiment));
      }
    }
    if (unstableExperiments.length) {
      const experimentsSection = this._appendSection();
      const warningMessage = i18nString(UIStrings.theseExperimentsAreParticularly);
      experimentsSection.appendChild(this._createExperimentsWarningSubsection(warningMessage));
      for (const experiment of unstableExperiments) {
        // TODO(crbug.com/1161439): remove experiment duplication
        if (experiment.name !== 'blackboxJSFramesOnTimeline') {
          experimentsSection.appendChild(this._createExperimentCheckbox(experiment));
        }
      }
    }
  }

  /**
   * @param {string} warningMessage
   * @return {!Element} element
   */
  _createExperimentsWarningSubsection(warningMessage) {
    const subsection = document.createElement('div');
    const warning = subsection.createChild('span', 'settings-experiments-warning-subsection-warning');
    warning.textContent = i18nString(UIStrings.warning);
    UI.UIUtils.createTextChild(subsection, ' ');
    const message = subsection.createChild('span', 'settings-experiments-warning-subsection-message');
    message.textContent = warningMessage;
    return subsection;
  }

  /**
   * @param {*} experiment
   */
  _createExperimentCheckbox(experiment) {
    const label = UI.UIUtils.CheckboxLabel.create(i18nString(experiment.title), experiment.isEnabled());
    const input = label.checkboxElement;
    input.name = experiment.name;
    function listener() {
      experiment.setEnabled(input.checked);
      // TODO(crbug.com/1161439): remove experiment duplication
      if (experiment.name === 'ignoreListJSFramesOnTimeline') {
        Root.Runtime.experiments.setEnabled('blackboxJSFramesOnTimeline', input.checked);
      }
      Host.userMetrics.experimentChanged(experiment.name, experiment.isEnabled());
      UI.InspectorView.InspectorView.instance().displayReloadRequiredWarning(
          i18nString(UIStrings.oneOrMoreSettingsHaveChanged));
    }
    input.addEventListener('click', listener, false);

    const p = document.createElement('p');
    p.className = experiment.unstable && !experiment.isEnabled() ? 'settings-experiment-unstable' : '';
    p.appendChild(label);
    return p;
  }
}

/**
 * @implements {UI.ActionRegistration.ActionDelegate}
 */
export class ActionDelegate {
  /**
   * @override
   * @param {!UI.Context.Context} context
   * @param {string} actionId
   * @return {boolean}
   */
  handleAction(context, actionId) {
    switch (actionId) {
      case 'settings.show':
        SettingsScreen._showSettingsScreen(/** @type {!ShowSettingsScreenOptions}*/ ({focusTabHeader: true}));
        return true;
      case 'settings.documentation':
        Host.InspectorFrontendHost.InspectorFrontendHostInstance.openInNewTab(
            UI.UIUtils.addReferrerToURL('https://developers.google.com/web/tools/chrome-devtools/'));
        return true;
      case 'settings.shortcuts':
        SettingsScreen._showSettingsScreen({name: 'keybinds', focusTabHeader: true});
        return true;
    }
    return false;
  }
}

/**
 * @implements {Common.Revealer.Revealer}
 */
export class Revealer {
  /**
   * @override
   * @param {!Object} object
   * @return {!Promise<void>}
   */
  reveal(object) {
    console.assert(object instanceof Common.Settings.Setting);
    const setting = /** @type {!Common.Settings.Setting<*>} */ (object);
    let success = false;

    /** @type {!Array<!Common.Settings.SettingRegistration>} */
    const unionOfSettings = [
      // TODO(crbug.com/1134103): Remove this call when all settings are migrated
      ...Root.Runtime.Runtime.instance().extensions('setting').map(extension => {
        const category = extension.descriptor().category;
        return {
          category: category ? ls(category) : undefined,
          settingName: extension.descriptor().settingName,
          title: extension.title(),
          order: extension.descriptor().order,
          settingType: extension.descriptor().settingType || '',
          defaultValue: extension.descriptor().defaultValue,
          tags: undefined,
          isRegex: undefined,
          options: undefined,
          reloadRequired: undefined,
          storageType: undefined,
          titleMac: undefined,
          userActionCondition: undefined,
          experiment: undefined,
          condition: undefined,
        };
      }),
      ...Common.Settings.getRegisteredSettings().map(setting => {
        return {...setting, title: setting.titleMac || setting.title};
      })
    ];
    unionOfSettings.forEach(revealModuleSetting);
    Root.Runtime.Runtime.instance().extensions(UI.SettingsUI.SettingUI).forEach(revealSettingUI);
    const unionOfViews = [
      // TODO(crbug.com/1134103): Remove this call when all views are migrated
      ...Root.Runtime.Runtime.instance().extensions('view').map(extension => {
        return {
          location: extension.descriptor().location,
          settings: extension.descriptor().settings,
          id: extension.descriptor().id
        };
      }),
      ...UI.ViewManager.getRegisteredViewExtensions().map(view => {
        return {location: view.location(), settings: view.settings(), id: view.viewId()};
      }),
    ];

    unionOfViews.forEach(revealSettingsView);
    return success ? Promise.resolve() : Promise.reject();

    /**
     * @param {!Common.Settings.SettingRegistration} settingRegistration
     */
    function revealModuleSetting(settingRegistration) {
      if (!GenericSettingsTab.isSettingVisible(settingRegistration)) {
        return;
      }
      if (settingRegistration.settingName === setting.name) {
        Host.InspectorFrontendHost.InspectorFrontendHostInstance.bringToFront();
        SettingsScreen._showSettingsScreen();
        success = true;
      }
    }

    /**
     * @param {!Root.Runtime.Extension} extension
     */
    function revealSettingUI(extension) {
      const settings = extension.descriptor()['settings'];
      if (settings && settings.indexOf(setting.name) !== -1) {
        Host.InspectorFrontendHost.InspectorFrontendHostInstance.bringToFront();
        SettingsScreen._showSettingsScreen();
        success = true;
      }
    }

    /**
     * @param {!{settings: (!Array<string>|undefined), location: (?string|undefined), id: string}} extension
     */
    function revealSettingsView(extension) {
      const location = extension.location;
      if (location !== UI.ViewManager.ViewLocationValues.SETTINGS_VIEW) {
        return;
      }
      const settings = extension.settings;
      if (settings && settings.indexOf(setting.name) !== -1) {
        Host.InspectorFrontendHost.InspectorFrontendHostInstance.bringToFront();
        SettingsScreen._showSettingsScreen(
            /** @type {!ShowSettingsScreenOptions}*/ ({name: extension.id}));
        success = true;
      }
    }
  }
}

/**
 * @typedef {{
  *     name: (string|undefined),
  *     focusTabHeader: (boolean|undefined)
  * }}
  */
// @ts-ignore typedef
export let ShowSettingsScreenOptions;

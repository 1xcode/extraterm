/**
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 */

import { WebComponent } from 'extraterm-web-component-decorators';
import * as _ from 'lodash';

import { AppearanceSettingsUi } from './AppearanceSettingsUi';
import { FontInfo, GeneralConfig, GENERAL_CONFIG, ConfigKey, SYSTEM_CONFIG, SystemConfig } from '../../Config';
import { Logger, getLogger } from "extraterm-logging";
import { log } from "extraterm-logging";
import { SettingsBase } from './SettingsBase';
import * as ThemeTypes from '../../theme/Theme';
import { shell } from 'electron';
import * as WebIpc from '../WebIpc';
import { ExtensionManager } from '../extension/InternalTypes';
import { TerminalVisualConfig } from '../TerminalVisualConfig';

export const APPEARANCE_SETTINGS_TAG = "et-appearance-settings";

@WebComponent({tag: APPEARANCE_SETTINGS_TAG})
export class AppearanceSettings extends SettingsBase<AppearanceSettingsUi> {
  private _log: Logger = null;
  private _fontOptions: FontInfo[] = [];
  private _userTerminalThemeDirectory: string = null;
  private _userSyntaxThemeDirectory: string = null;
  private _extensionManager: ExtensionManager = null;
  private _terminalVisualConfig: TerminalVisualConfig = null;

  constructor() {
    super(AppearanceSettingsUi, [GENERAL_CONFIG, SYSTEM_CONFIG]);
    this._log = getLogger(APPEARANCE_SETTINGS_TAG, this);
    this._getUi().$on("openUserTerminalThemesDir", () => {
      shell.openItem(this._userTerminalThemeDirectory);
    });
    this._getUi().$on("rescanUserTerminalThemesDir", () => {
      WebIpc.rescanThemes();
    });
    this._getUi().$on("openUserSyntaxThemesDir", () => {
      shell.openItem(this._userSyntaxThemeDirectory);
    });
    this._getUi().$on("rescanUserSyntaxThemesDir", () => {
      WebIpc.rescanThemes();
    });
  }

  protected _setConfig(key: ConfigKey, config: any): void {
    if (key === SYSTEM_CONFIG) {
      const ui = this._getUi();
      const systemConfig = <SystemConfig> config;

      this._userTerminalThemeDirectory = systemConfig.userTerminalThemeDirectory;
      this._userSyntaxThemeDirectory = systemConfig.userSyntaxThemeDirectory;
      ui.currentTitleBarStyle = systemConfig.titleBarStyle;
      const newFontOptions = [...systemConfig.availableFonts];
      newFontOptions.sort( (a,b) => {
        if (a.name === b.name) {
          return 0;
        }
        return a.name < b.name ? -1 : 1;
      });
      
      if ( ! _.isEqual(this._fontOptions, newFontOptions)) {
        this._fontOptions = newFontOptions;
        ui.terminalFontOptions = newFontOptions;
      }
    }
    
    if (key === GENERAL_CONFIG) {
      const ui = this._getUi();
      const generalConfig = <GeneralConfig> config;
      ui.cursorStyle = generalConfig.cursorStyle;
      ui.cursorBlink = generalConfig.blinkingCursor;
      ui.terminalFont = generalConfig.terminalFont;
      ui.terminalFontSize = generalConfig.terminalFontSize;
      ui.themeGUI = generalConfig.themeGUI;
      ui.themeSyntax = generalConfig.themeSyntax;
      ui.themeTerminal = generalConfig.themeTerminal;
      ui.titleBarStyle = generalConfig.titleBarStyle;
      ui.showTrayIcon = generalConfig.showTrayIcon;
      ui.minimizeToTray = generalConfig.minimizeToTray;
      ui.uiScalePercent = generalConfig.uiScalePercent;
      ui.terminalMarginStyle = generalConfig.terminalMarginStyle;
    }
  }

  protected _dataChanged(): void {
    const newConfig = <GeneralConfig> this._getConfigCopy(GENERAL_CONFIG);
    const ui = this._getUi();

    newConfig.titleBarStyle = ui.titleBarStyle;
    newConfig.showTrayIcon = ui.showTrayIcon;
    newConfig.minimizeToTray = ui.minimizeToTray;
    newConfig.cursorStyle = ui.cursorStyle;
    newConfig.blinkingCursor = ui.cursorBlink;
    newConfig.terminalFont = ui.terminalFont;
    newConfig.terminalFontSize = ui.terminalFontSize;
    newConfig.themeGUI = ui.themeGUI;
    newConfig.themeSyntax = ui.themeSyntax;
    newConfig.themeTerminal = ui.themeTerminal;
    newConfig.uiScalePercent = ui.uiScalePercent;
    newConfig.terminalMarginStyle = ui.terminalMarginStyle;
    this._updateConfig(GENERAL_CONFIG, newConfig);
  }

  set themes(themes: ThemeTypes.ThemeInfo[]) {
    this._getUi().themes = themes;
  }

  set extensionManager(extensionManager: ExtensionManager) {
    this._extensionManager = extensionManager;

    this._getUi().themeTerminalFormatNames = extensionManager.getAllTerminalThemeFormats().map(pair => pair.formatName);
    this._getUi().themeSyntaxFormatNames = extensionManager.getAllSyntaxThemeFormats().map(pair => pair.formatName);
  }

  get extensionManager(): ExtensionManager {
    return this._extensionManager;
  }

  set terminalVisualConfig(terminalVisualConfig: TerminalVisualConfig) {
    this._terminalVisualConfig = terminalVisualConfig;
    this._getUi().terminalVisualConfig = terminalVisualConfig;
  }

  get terminalVisualConfig(): TerminalVisualConfig {
    return this._terminalVisualConfig;
  }
}

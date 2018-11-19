/*
 * Copyright 2014-2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

/**
 * Main.
 *
 * This file is the main entry point for the node process and the whole application.
 */
import * as SourceMapSupport from 'source-map-support';

import * as child_process from 'child_process';
import { Command } from 'commander';
import {app, BrowserWindow, ipcMain as ipc, clipboard, dialog, screen, webContents} from 'electron';
import { BulkFileState, Event, SessionConfiguration } from 'extraterm-extension-api';
import * as FontManager from 'font-manager';
import fontInfo = require('fontinfo');
import * as fs from 'fs';
import * as _ from 'lodash';
import * as path from 'path';
import * as os from 'os';

import {BulkFileStorage, BufferSizeEvent, CloseEvent} from './bulk_file_handling/BulkFileStorage';
import {CommandLineAction, SystemConfig, FontInfo, ShowTipsStrEnum, ConfigDatabase, injectConfigDatabase, ConfigKey, UserStoredConfig, GENERAL_CONFIG, SYSTEM_CONFIG, GeneralConfig, SESSION_CONFIG, COMMAND_LINE_ACTIONS_CONFIG, ConfigChangeEvent, TitleBarStyle} from '../Config';
import {FileLogWriter, Logger, getLogger, addLogWriter} from "extraterm-logging";
import { PtyManager } from './pty/PtyManager';
import * as ResourceLoader from '../ResourceLoader';
import * as ThemeTypes from '../theme/Theme';
import {ThemeManager, GlobalVariableMap} from '../theme/ThemeManager';
import * as Messages from '../WindowMessages';
import { MainExtensionManager } from './extension/MainExtensionManager';
import { EventEmitter } from '../utils/EventEmitter';
import { freezeDeep } from 'extraterm-readonly-toolbox';
import { log } from "extraterm-logging";
import { KeybindingsIOManager } from './KeybindingsIOManager';

type ThemeInfo = ThemeTypes.ThemeInfo;
type ThemeType = ThemeTypes.ThemeType;

const LOG_FINE = false;

SourceMapSupport.install();

// crashReporter.start(); // Report crashes

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the javascript object is GCed.
let mainWindow: Electron.BrowserWindow = null;

const LOG_FILENAME = "extraterm.log";
const EXTRATERM_CONFIG_DIR = "extraterm";
const MAIN_CONFIG = "extraterm.json";
const THEMES_DIRECTORY = "themes";
const USER_THEMES_DIR = "themes"
const USER_SYNTAX_THEMES_DIR = "syntax";
const USER_TERMINAL_THEMES_DIR = "terminal";
const USER_KEYBINDINGS_DIR = "keybindings";
const KEYBINDINGS_OSX = "Mac OS X bindings";
const KEYBINDINGS_PC = "PC style bindings";
const TERMINAL_FONTS_DIRECTORY = "../../resources/terminal_fonts";
const DEFAULT_TERMINALFONT = "DejaVuSansMono";

const PNG_ICON_PATH = "../../resources/logo/extraterm_small_logo_256x256.png";
const ICO_ICON_PATH = "../../resources/logo/extraterm_small_logo.ico";
const PACKAGE_JSON_PATH = "../../../package.json";

const EXTRATERM_DEVICE_SCALE_FACTOR = "--extraterm-device-scale-factor";


let themeManager: ThemeManager;
let ptyManager: PtyManager;
let configDatabase: ConfigDatabaseImpl;
let tagCounter = 1;
let titleBarStyle: TitleBarStyle = "compact";
let bulkFileStorage: BulkFileStorage = null;
let extensionManager: MainExtensionManager = null;
let packageJson: any = null;
let keybindingsIOManager: KeybindingsIOManager = null;

function main(): void {
  let failed = false;
  configDatabase = new ConfigDatabaseImpl();

  setupAppData();
  setupLogging();

  app.commandLine.appendSwitch('disable-smooth-scrolling'); // Turn off the sluggish scrolling.
  app.commandLine.appendSwitch('high-dpi-support', 'true');

  if (process.platform === "darwin") {
    setupOSX();
  }

  _log.startRecording();

  // commander assumes that the first two values in argv are 'node' and 'blah.js' and then followed by the args.
  // This is not the case when running from a packaged Electron app. Here you have first value 'appname' and then args.
  const normalizedArgv = process.argv[0].includes('extraterm') ? ["node", "extraterm", ...process.argv.slice(1)]
                            : process.argv;
  const parsedArgs = new Command("extraterm");

  // The extra fields which appear on the command object are declared in extra_commander.d.ts.
  parsedArgs.option('-c, --cygwinDir [cygwinDir]', 'Location of the cygwin directory []')
    .option('-d, --dev-tools [devTools]', 'Open the dev tools on start up')
    .option('--force-device-scale-factor []', '(This option is used by Electron)')
    .option(EXTRATERM_DEVICE_SCALE_FACTOR + ' []', '(Internal Extraterm option. Ignore)')
    .parse(normalizedArgv);

  setupExtensionManager();
  setupKeybindingsIOManager();
  setupThemeManager();
  setupConfig();

  if ( ! setupPtyManager()) {
    failed = true;
  }

  if (failed) {
    dialog.showErrorBox("Sorry, something went wrong",
      "Something went wrong while starting up Extraterm.\n" +
      "Message log is:\n" + _log.getFormattedLogMessages());
    process.exit(1);
    return;
  }
  
  _log.stopRecording();

  setupDefaultSessions();
  
  // Quit when all windows are closed.
  app.on('window-all-closed', function() {
    if (bulkFileStorage !== null) {
      bulkFileStorage.dispose();
    }
    app.quit();
  });

  // This method will be called when Electron has done everything
  // initialization and ready for creating browser windows.
  app.on('ready', () => startUpWindows(parsedArgs));
}

function setupExtensionManager(): void {
  extensionManager = new MainExtensionManager([path.join(__dirname, "../../../extensions" )]);
  extensionManager.scan();
  extensionManager.startUp();
}

function setupKeybindingsIOManager(): void {
  keybindingsIOManager = new KeybindingsIOManager(getUserKeybindingsDirectory(), extensionManager);
  keybindingsIOManager.scan();
}

function setupThemeManager(): void {
  // Themes
  const themesDir = path.join(__dirname, '../../resources', THEMES_DIRECTORY);
  themeManager = new ThemeManager({
    css: [themesDir],
    syntax: [getUserSyntaxThemeDirectory()],
    terminal: [getUserTerminalThemeDirectory()]}, extensionManager);
  injectConfigDatabase(themeManager, configDatabase);
}

function getUserTerminalThemeDirectory(): string {
  const userThemesDir = path.join(app.getPath('appData'), EXTRATERM_CONFIG_DIR, USER_THEMES_DIR);
  return path.join(userThemesDir, USER_TERMINAL_THEMES_DIR);
}

function getUserSyntaxThemeDirectory(): string {
  const userThemesDir = path.join(app.getPath('appData'), EXTRATERM_CONFIG_DIR, USER_THEMES_DIR);
  return path.join(userThemesDir, USER_SYNTAX_THEMES_DIR);
}

function getUserKeybindingsDirectory(): string {
  return path.join(app.getPath('appData'), EXTRATERM_CONFIG_DIR, USER_KEYBINDINGS_DIR);
}

function startUpWindows(parsedArgs: Command): void {
  if ( ! setupScale(parsedArgs)) {
    return;
  }
  
  setupBulkFileStorage();
  setupIpc();  
  openWindow(parsedArgs);
}

function setupScale(parsedArgs: Command): boolean {
  const deviceScaleFactor = <any>parsedArgs.extratermDeviceScaleFactor;
  const {restartNeeded, originalScaleFactor, currentScaleFactor} = setScaleFactor(deviceScaleFactor);
  if (restartNeeded) {
    return false;
  }
  const systemConfig = configDatabase.getConfigCopy(SYSTEM_CONFIG);
  systemConfig.currentScaleFactor = currentScaleFactor;
  systemConfig.originalScaleFactor = originalScaleFactor;
  configDatabase.setConfig(SYSTEM_CONFIG, systemConfig);
  return true;
}

function setupBulkFileStorage(): void {
  bulkFileStorage = new BulkFileStorage(os.tmpdir());
  bulkFileStorage.onWriteBufferSize(sendBulkFileWriteBufferSizeEvent);
  bulkFileStorage.onClose(sendBulkFileStateChangeEvent);
}

function openWindow(parsedArgs: Command): void {
  const generalConfig = <GeneralConfig> configDatabase.getConfig(GENERAL_CONFIG);
  const themeInfo = themeManager.getTheme(generalConfig.themeGUI);

  // Create the browser window.
  const options = <Electron.BrowserWindowConstructorOptions> {
    width: 1200,
    height: 600,
    "webPreferences": {
      "experimentalFeatures": true,
    },
    frame: generalConfig.titleBarStyle === "native",
    title: "Extraterm",
    backgroundColor: themeInfo.loadingBackgroundColor
  };

  // Restore the window position and size from the last session.
  const dimensions = getWindowDimensionsFromConfig(0);
  if (dimensions != null) {
    options.x = dimensions.x;
    options.y = dimensions.y;
    options.width = dimensions.width;
    options.height = dimensions.height;
  }

  if (process.platform === "win32") {
    options.icon = path.join(__dirname, ICO_ICON_PATH);
  } else if (process.platform === "linux") {
    options.icon = path.join(__dirname, PNG_ICON_PATH);
  }

  mainWindow = new BrowserWindow(options);

  if ((<any>parsedArgs).devTools) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.setMenu(null);

  // Emitted when the window is closed.

  const mainWindowWebContentsId = mainWindow.webContents.id;
  mainWindow.on("closed", () => {
    cleanUpPtyWindow(mainWindowWebContentsId);
    mainWindow = null;
  });
  
  mainWindow.on("resize", () => {
    saveWindowDimensions(0, mainWindow.getBounds());
  });
  mainWindow.on("move", () => {
    saveWindowDimensions(0, mainWindow.getBounds());
  });

  const params = "?loadingBackgroundColor=" + themeInfo.loadingBackgroundColor.replace("#", "") +
    "&loadingForegroundColor=" + themeInfo.loadingForegroundColor.replace("#", "");

  // and load the index.html of the app.
  mainWindow.loadURL(ResourceLoader.toUrl("render_process/main.html") + params);

  mainWindow.webContents.on('devtools-closed', () => {
    sendDevToolStatus(mainWindow, false);
  });
  
  mainWindow.webContents.on('devtools-opened', () => {
    sendDevToolStatus(mainWindow, true);
  });
}

function saveWindowDimensions(windowId: number, rect: Electron.Rectangle): void {
  const newGeneralConfig = configDatabase.getConfigCopy(GENERAL_CONFIG);

  if (newGeneralConfig.windowConfiguration == null) {
    newGeneralConfig.windowConfiguration = {};
  }
  newGeneralConfig.windowConfiguration[windowId] = {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height
  };
  configDatabase.setConfig(GENERAL_CONFIG, newGeneralConfig);
}

function getWindowDimensionsFromConfig(windowId: number): Electron.Rectangle {
  const generalConfig = configDatabase.getConfig(GENERAL_CONFIG);
  if (generalConfig.windowConfiguration == null) {
    return null;
  }
  const singleWindowConfig = generalConfig.windowConfiguration[windowId];
  if (singleWindowConfig == null) {
    return null;
  }
  return {
    x: singleWindowConfig.x,
    y: singleWindowConfig.y,
    width: singleWindowConfig.width,
    height: singleWindowConfig.height
  };
}

function setupLogging(): void {
  const logFilePath = path.join(app.getPath('appData'), EXTRATERM_CONFIG_DIR, LOG_FILENAME);

  if ( ! process.argv.find(item => item.startsWith(EXTRATERM_DEVICE_SCALE_FACTOR))) {
    if (fs.existsSync(logFilePath)) {
      fs.unlinkSync(logFilePath);
    }
  }

  const logWriter = new FileLogWriter(logFilePath);
  addLogWriter(logWriter);
  _log.info("Recording logs to ", logFilePath);
}

function setScaleFactor(originalFactorArg?: string): {restartNeeded: boolean, currentScaleFactor: number, originalScaleFactor: number} {
  _log.info("args", process.argv);
  const primaryDisplay = screen.getPrimaryDisplay();
  _log.info("Display scale factor is ", primaryDisplay.scaleFactor);
  if (primaryDisplay.scaleFactor !== 1 && primaryDisplay.scaleFactor !== 2) {
    const scaleFactor = primaryDisplay.scaleFactor < 1.5 ? 1 : 2;
    _log.info("argv[0]: ",process.argv[0]);

    const newArgs = process.argv.slice(1).concat(['--force-device-scale-factor=' + scaleFactor,
                      EXTRATERM_DEVICE_SCALE_FACTOR + '=' + primaryDisplay.scaleFactor]);
    // Electron's app.relaunch() doesn't work on packaged builds of Extraterm. So use spawn
    child_process.spawn(process.argv[0], newArgs, {
      cwd: process.cwd(),
      detached: true,
      env: process.env,
      stdio: "inherit"
    });

    _log.info("Restarting with scale factor ", scaleFactor);
    app.exit(0);
    return {restartNeeded: true, currentScaleFactor: primaryDisplay.scaleFactor,
      originalScaleFactor: primaryDisplay.scaleFactor};
  }

  let originalScaleFactor: number;
  _log.info("originalFactorArg:", originalFactorArg);
  if (originalFactorArg != null) {
    originalScaleFactor = Number.parseFloat(originalFactorArg);
  } else {
    originalScaleFactor = primaryDisplay.scaleFactor;
  }
  _log.info("originalScaleFactor:", originalScaleFactor);
  return {restartNeeded: false, currentScaleFactor: primaryDisplay.scaleFactor, originalScaleFactor};
}

const _log = getLogger("main");

/**
 * Extra information about the system configuration and platform.
 */
function systemConfiguration(config: GeneralConfig, systemConfig: SystemConfig): SystemConfig {
  let homeDir = app.getPath('home');
  
  const keyBindingsJSON = keybindingsIOManager.readKeybindingsJson(config.keybindingsName);

  return {
    homeDir,
    applicationVersion: packageJson.version,
    keybindingsContexts: keyBindingsJSON,
    keybindingsInfoList: keybindingsIOManager.getInfoList(),
    availableFonts: getFonts(),
    titleBarStyle,
    currentScaleFactor: systemConfig == null ? 1 : systemConfig.currentScaleFactor,
    originalScaleFactor: systemConfig == null ? 1 : systemConfig.originalScaleFactor,
    userTerminalThemeDirectory: getUserTerminalThemeDirectory(),
    userSyntaxThemeDirectory: getUserSyntaxThemeDirectory()
  };
}

function setupOSX(): void {
  child_process.execFileSync("defaults", ["write",
    "com.electron.extraterm", "ApplePressAndHoldEnabled", "-bool", "false"]);
}

//-------------------------------------------------------------------------
//
//   #####                                
//  #     #  ####  #    # ###### #  ####  
//  #       #    # ##   # #      # #    # 
//  #       #    # # #  # #####  # #      
//  #       #    # #  # # #      # #  ### 
//  #     # #    # #   ## #      # #    # 
//   #####   ####  #    # #      #  ####  
//
//-------------------------------------------------------------------------

// FIXME refactor this out into a different file and/or class.
function setupAppData(): void {
  const configDir = path.join(app.getPath('appData'), EXTRATERM_CONFIG_DIR);
  if ( ! fs.existsSync(configDir)) {
    fs.mkdirSync(configDir);
  } else {
    const statInfo = fs.statSync(configDir);
    if ( ! statInfo.isDirectory()) {
      _log.warn("Extraterm configuration path " + configDir + " is not a directory!");
      return;
    }
  }

  const userKeybindingsDir = path.join(configDir, USER_KEYBINDINGS_DIR);
  if ( ! fs.existsSync(userKeybindingsDir)) {
    fs.mkdirSync(userKeybindingsDir);
  } else {
    const statInfo = fs.statSync(userKeybindingsDir);
    if ( ! statInfo.isDirectory()) {
      _log.warn("Extraterm user keybindings path " + userKeybindingsDir + " is not a directory!");
      return;
    }
  }
  
  const userThemesDir = path.join(configDir, USER_THEMES_DIR);
  if ( ! fs.existsSync(userThemesDir)) {
    fs.mkdirSync(userThemesDir);
  } else {
    const statInfo = fs.statSync(userThemesDir);
    if ( ! statInfo.isDirectory()) {
      _log.warn("Extraterm user themes path " + userThemesDir + " is not a directory!");
      return;
    }
  }

  const userSyntaxThemesDir = path.join(userThemesDir, USER_SYNTAX_THEMES_DIR);
  if ( ! fs.existsSync(userSyntaxThemesDir)) {
    fs.mkdirSync(userSyntaxThemesDir);
  } else {
    const statInfo = fs.statSync(userSyntaxThemesDir);
    if ( ! statInfo.isDirectory()) {
      _log.warn("Extraterm user syntax themes path " + userSyntaxThemesDir + " is not a directory!");
      return;
    }
  }

  const userTerminalThemesDir = path.join(userThemesDir, USER_TERMINAL_THEMES_DIR);
  if ( ! fs.existsSync(userTerminalThemesDir)) {
    fs.mkdirSync(userTerminalThemesDir);
  } else {
    const statInfo = fs.statSync(userTerminalThemesDir);
    if ( ! statInfo.isDirectory()) {
      _log.warn("Extraterm user terminal themes path " + userTerminalThemesDir + " is not a directory!");
      return;
    }
  }
}

function isThemeType(themeInfo: ThemeInfo, themeType: ThemeType): boolean {
  if (themeInfo === null) {
    return false;
  }
  return themeInfo.type === themeType;
}

function setupConfig(): void {
  packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, PACKAGE_JSON_PATH), "UTF-8"));

  const userStoredConfig = readConfigurationFile();

  userStoredConfig.blinkingCursor = _.isBoolean(userStoredConfig.blinkingCursor) ? userStoredConfig.blinkingCursor : false;
  
  if (userStoredConfig.terminalFontSize === undefined || typeof userStoredConfig.terminalFontSize !== 'number') {
    userStoredConfig.terminalFontSize = 12;
  } else {
    userStoredConfig.terminalFontSize = Math.max(Math.min(1024, userStoredConfig.terminalFontSize), 4);
  }

  if (userStoredConfig.terminalFont === undefined || userStoredConfig.terminalFont === null) {
    userStoredConfig.terminalFont = DEFAULT_TERMINALFONT;
  }

  if ( ! isThemeType(themeManager.getTheme(userStoredConfig.themeTerminal), 'terminal')) {
    userStoredConfig.themeTerminal = ThemeTypes.FALLBACK_TERMINAL_THEME;
  }
  if ( ! isThemeType(themeManager.getTheme(userStoredConfig.themeSyntax), 'syntax')) {
    userStoredConfig.themeSyntax = ThemeTypes.FALLBACK_SYNTAX_THEME;
  }
  if (userStoredConfig.themeGUI === "default" || ! isThemeType(themeManager.getTheme(userStoredConfig.themeGUI), 'gui')) {
    userStoredConfig.themeGUI = "atomic-dark-ui";
  }

  userStoredConfig.uiScalePercent = Math.min(500, Math.max(5, userStoredConfig.uiScalePercent || 100));

  if (userStoredConfig.titleBarStyle == null) {
    userStoredConfig.titleBarStyle = "compact";
  }
  titleBarStyle = userStoredConfig.titleBarStyle;

  if (userStoredConfig.frameByDefault !== true && userStoredConfig.frameByDefault !== false) {
    userStoredConfig.frameByDefault = true;
  }

  // Validate the selected keybindings config value.
  if ( ! keybindingsIOManager.hasKeybindingsName(userStoredConfig.keybindingsName)) {
    userStoredConfig.keybindingsName = process.platform === "darwin" ? KEYBINDINGS_OSX : KEYBINDINGS_PC;
  }

  if (userStoredConfig.sessions == null) {
    configDatabase.setConfigNoWrite(SESSION_CONFIG, []);
  } else {
    configDatabase.setConfigNoWrite(SESSION_CONFIG, userStoredConfig.sessions);
  }

  if (userStoredConfig.commandLineActions == null) {
    configDatabase.setConfigNoWrite(COMMAND_LINE_ACTIONS_CONFIG, []);
  } else {
    configDatabase.setConfigNoWrite(COMMAND_LINE_ACTIONS_CONFIG, userStoredConfig.commandLineActions);
  }

  const systemConfig = systemConfiguration(userStoredConfig, null);
  configDatabase.setConfigNoWrite(SYSTEM_CONFIG, systemConfig);

  if ( ! systemConfig.availableFonts.some( (font) => font.postscriptName === userStoredConfig.terminalFont)) {
    userStoredConfig.terminalFont = DEFAULT_TERMINALFONT;
  }
  
  delete userStoredConfig.sessions;
  delete userStoredConfig.commandLineActions;
  configDatabase.setConfig(GENERAL_CONFIG, userStoredConfig);

  configDatabase.onChange((event: ConfigChangeEvent): void => {
    if (event.key === GENERAL_CONFIG) {
      //Check if the selected keybindings changed. If so update and broadcast the system config.
      const oldGeneralConfig = <GeneralConfig> event.oldConfig;
      const newGeneralConfig = <GeneralConfig> event.newConfig;
      if (newGeneralConfig != null) {
        if (oldGeneralConfig == null || oldGeneralConfig.keybindingsName !== newGeneralConfig.keybindingsName) {
          const systemConfig = <SystemConfig> configDatabase.getConfigCopy(SYSTEM_CONFIG);
          systemConfig.keybindingsContexts = keybindingsIOManager.readKeybindingsJson(newGeneralConfig.keybindingsName);
          configDatabase.setConfigNoWrite(SYSTEM_CONFIG, systemConfig);
        }
      }
    }

    broadcastConfigToWindows(event);
  });
}

function broadcastConfigToWindows(event: ConfigChangeEvent): void {
  const newConfigMsg: Messages.ConfigMessage = {
    type: Messages.MessageType.CONFIG,
    key: event.key,
    config: event.newConfig
  };
  sendMessageToAllWindows(newConfigMsg);
}

function sendMessageToAllWindows(msg: Messages.Message): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (LOG_FINE) {
      _log.debug("Broadcasting message to all windows");
    }
    window.webContents.send(Messages.CHANNEL_NAME, msg);
  }
}

/**
 * Read the configuration.
 * 
 * @returns The configuration object.
 */
function readConfigurationFile(): UserStoredConfig {
  const filename = path.join(app.getPath('appData'), EXTRATERM_CONFIG_DIR, MAIN_CONFIG);
  let config: UserStoredConfig = { };

  if (fs.existsSync(filename)) {
    _log.info("Reading user configuration from " + filename);
    const configJson = fs.readFileSync(filename, {encoding: "utf8"});
    config = <UserStoredConfig>JSON.parse(configJson);
  } else {
    _log.info("Couldn't find user configuration file at " + filename);
  }
  setConfigDefaults(config);
  return config;
}

function defaultValue<T>(value: T, defaultValue: T): T {
  return value == null ? defaultValue : value;
}

function setConfigDefaults(config: UserStoredConfig): void {
  config.blinkingCursor = defaultValue(config.blinkingCursor, false);
  config.scrollbackMaxLines = defaultValue(config.scrollbackMaxLines, 500000);
  config.scrollbackMaxFrames = defaultValue(config.scrollbackMaxFrames, 100);
  config.showTips = defaultValue<ShowTipsStrEnum>(config.showTips, 'always');
  config.tipTimestamp = defaultValue(config.tipTimestamp, 0);
  config.tipCounter = defaultValue(config.tipCounter, 0);
  
  config.themeTerminal = defaultValue(config.themeTerminal, "default");
  config.themeSyntax = defaultValue(config.themeSyntax, "default");
  config.themeGUI = defaultValue(config.themeGUI, "atomic-dark-ui");
  config.titleBarStyle = defaultValue(config.titleBarStyle, "compact");
  config.frameByDefault = defaultValue(config.frameByDefault, true);

  if (config.commandLineActions === undefined) {
    const defaultCLA: CommandLineAction[] = [
      { match: 'cd', matchType: 'name', frame: false },      
      { match: 'rm', matchType: 'name', frame: false },
      { match: 'mkdir', matchType: 'name', frame: false },
      { match: 'rmdir', matchType: 'name', frame: false },
      { match: 'mv', matchType: 'name', frame: false },
      { match: 'cp', matchType: 'name', frame: false },
      { match: 'chmod', matchType: 'name', frame: false },
      { match: 'show', matchType: 'name', frame: false }
    ];
    config.commandLineActions = defaultCLA;
  }
  
  if (config.keybindingsName === undefined || config.keybindingsName === "") {
    config.keybindingsName = process.platform === "darwin" ? KEYBINDINGS_OSX : KEYBINDINGS_PC;
  }

  config.sessions = defaultValue(config.sessions, []);

  // Ensure that when reading a config file where args is not defined, we define it as an empty string
  let sessionConfiguration: SessionConfiguration = null;
  for (sessionConfiguration of config.sessions) {
    if (sessionConfiguration.args === undefined) {
      sessionConfiguration.args = "";
    }
  }
}


class ConfigDatabaseImpl implements ConfigDatabase {
  private _configDb = new Map<ConfigKey, any>();
  private _onChangeEventEmitter = new EventEmitter<ConfigChangeEvent>();
  onChange: Event<ConfigChangeEvent>;
  private _log: Logger;

  constructor() {
    this.onChange = this._onChangeEventEmitter.event;
    this._log = getLogger("ConfigDatabaseImpl", this);
  }

  getConfig(key: ConfigKey): any {
    if (key === "*") {
      // Wildcard fetch all.
      const result = {};

      for (const [dbKey, value] of this._configDb.entries()) {
        result[dbKey] = value;
      }
      freezeDeep(result);
      return result;
    } else {
      const result = this._configDb.get(key);
      if (result == null) {
        this._log.warn("Unable to find config for key ", key);
      } else {
        return result;
      }
    }
  }

  getConfigCopy(key: ConfigKey): any {
    const data = this.getConfig(key);
    if (data == null) {
      return null;
    }
    return _.cloneDeep(data);
  }

  setConfigNoWrite(key: ConfigKey, newConfig: any): void {
    if (key === "*") {
      for (const objectKey of Object.getOwnPropertyNames(newConfig)) {
        this._setSingleConfigNoWrite(objectKey, newConfig[objectKey]);
      }
    } else {
      this._setSingleConfigNoWrite(key, newConfig);
    }
  }

  private _setSingleConfigNoWrite(key: ConfigKey, newConfig: any): void {
    const oldConfig = this.getConfig(key);
    if (_.isEqual(oldConfig, newConfig)) {
      return;
    }

    if (Object.isFrozen(newConfig)) {
      this._configDb.set(key, newConfig);
    } else {
      this._configDb.set(key, freezeDeep(_.cloneDeep(newConfig)));
    }

    this._onChangeEventEmitter.fire({key, oldConfig, newConfig: this.getConfig(key)});
  }

  setConfig(key: ConfigKey, newConfig: any): void {
    if (newConfig == null) {
      this._log.warn("setConfig() newConfig is null for key ", key);
    }

    this.setConfigNoWrite(key, newConfig);
    if ([GENERAL_CONFIG, COMMAND_LINE_ACTIONS_CONFIG, SESSION_CONFIG, "*"].indexOf(key) !== -1) {
      this._writeConfigurationFile();
    }
  }
  
  private _writeConfigurationFile(): void {
    const cleanConfig = <UserStoredConfig> this.getConfigCopy(GENERAL_CONFIG);
    cleanConfig.commandLineActions = this.getConfig(COMMAND_LINE_ACTIONS_CONFIG);
    cleanConfig.sessions = this.getConfig(SESSION_CONFIG);

    const filename = path.join(app.getPath('appData'), EXTRATERM_CONFIG_DIR, MAIN_CONFIG);
    const formattedConfig = JSON.stringify(cleanConfig, null, "  ");
    this._log.debug(formattedConfig);
    fs.writeFileSync(filename, formattedConfig);
  }
}

function getThemes(): ThemeInfo[] {
  return themeManager.getAllThemes();
}

function getFonts(): FontInfo[] {
  const allAvailableFonts = FontManager.getAvailableFontsSync();
  const usableFonts = allAvailableFonts.filter(fontInfo => {
    const path = fontInfo.path.toLowerCase();
    if ( ! path.endsWith(".ttf") && ! path.endsWith(".otf")) {
      return false;
    }
    if (fontInfo.italic || fontInfo.style.indexOf("Oblique") !== -1) {
      return false;
    }
    if (fontInfo.weight > 600) {
      return false;
    }

    return true;
  });

  const systemFonts = usableFonts.map(result => {
    const name = result.family + (result.style==="Regular" ? "" : " " + result.style) +
      (result.italic && result.style.indexOf("Italic") === -1 ? " Italic" : "");
    const fontInfo: FontInfo = {
      name: name,
      path: pathToUrl(result.path),
      postscriptName: result.postscriptName
    };
    return fontInfo;
  } );
  
  const allFonts = [...getBundledFonts(), ...systemFonts];
  const fonts = _.uniqBy(allFonts, x => x.postscriptName);
  return fonts;
}

function getBundledFonts(): FontInfo[] {
  const fontsDir = path.join(__dirname, TERMINAL_FONTS_DIRECTORY);
  const result: FontInfo[] = [];
  if (fs.existsSync(fontsDir)) {
    const contents = fs.readdirSync(fontsDir);
    contents.forEach( (item) => {
      if (item.endsWith(".ttf")) {
        const ttfPath = path.join(fontsDir, item);
        const fi = fontInfo(ttfPath);
        result.push( {
          path: pathToUrl(ttfPath),
          name: fi.name.fontName,
          postscriptName: fi.name.postscriptName
        });
      }
    });
  }
  
  return result;
}

function pathToUrl(path: string): string {
  if (process.platform === "win32") {
    return path.replace(/\\/g, "/");
  }
  return path;
}

//-------------------------------------------------------------------------
// 
//  ### ######   #####  
//   #  #     # #     # 
//   #  #     # #       
//   #  ######  #       
//   #  #       #       
//   #  #       #     # 
//  ### #        #####  
//
//-------------------------------------------------------------------------

function setupIpc(): void {
  ipc.on(Messages.CHANNEL_NAME, handleIpc);
}

function handleIpc(event: Electron.Event, arg: any): void {
  const msg: Messages.Message = arg;
  let reply: Messages.Message = null;
  
  if (LOG_FINE) {
    _log.debug("Main IPC incoming: ",msg);
  }
  
  switch(msg.type) {
    case Messages.MessageType.CONFIG_REQUEST:
      reply = handleConfigRequest(<Messages.ConfigRequestMessage> msg);
      break;
      
    case Messages.MessageType.CONFIG:
      handleConfig(<Messages.ConfigMessage> msg);
      break;
      
    case Messages.MessageType.FRAME_DATA_REQUEST:
      _log.debug('Messages.MessageType.FRAME_DATA_REQUEST is not implemented.');
      break;
      
    case Messages.MessageType.THEME_LIST_REQUEST:
      reply = handleThemeListRequest();
      break;
      
    case Messages.MessageType.THEME_CONTENTS_REQUEST:
      handleThemeContentsRequest(event.sender, <Messages.ThemeContentsRequestMessage> msg);
      break;
      
    case Messages.MessageType.THEME_RESCAN:
      reply = handleThemeRescan();
      break;

    case Messages.MessageType.PTY_CREATE:
      reply = handlePtyCreate(event.sender, <Messages.CreatePtyRequestMessage> msg);
      break;
      
    case Messages.MessageType.PTY_RESIZE:
      handlePtyResize(<Messages.PtyResize> msg);
      break;
      
    case Messages.MessageType.PTY_INPUT:
      handlePtyInput(<Messages.PtyInput> msg);
      break;
      
    case Messages.MessageType.PTY_CLOSE_REQUEST:
      handlePtyCloseRequest(<Messages.PtyClose> msg);
      break;
      
    case Messages.MessageType.PTY_OUTPUT_BUFFER_SIZE:
      handlePtyOutputBufferSize(<Messages.PtyOutputBufferSize> msg);
      break;

    case Messages.MessageType.DEV_TOOLS_REQUEST:
      handleDevToolsRequest(event.sender, <Messages.DevToolsRequestMessage> msg);
      break;
      
    case Messages.MessageType.CLIPBOARD_WRITE:
      handleClipboardWrite(<Messages.ClipboardWriteMessage> msg);
      break;
      
    case Messages.MessageType.CLIPBOARD_READ_REQUEST:
      reply = handleClipboardReadRequest(<Messages.ClipboardReadRequestMessage> msg);
      break;
      
    case Messages.MessageType.WINDOW_CLOSE_REQUEST:
      mainWindow.close();
      break;
      
    case Messages.MessageType.WINDOW_MINIMIZE_REQUEST:
      mainWindow.minimize();
      break;

    case Messages.MessageType.WINDOW_MAXIMIZE_REQUEST:
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
      break;

    case Messages.MessageType.NEW_TAG_REQUEST:
      const ntrm = <Messages.NewTagRequestMessage> msg;
      reply = handleNewTagRequest(ntrm);
      if (ntrm.async === false) {
        event.returnValue = reply;
        return;
      }
      break;

    case Messages.MessageType.BULK_FILE_CREATE:
      const createBulkFileReply = handleCreateBulkFile(<Messages.BulkFileCreateMessage> msg);
      event.returnValue = createBulkFileReply;
      break;

    case Messages.MessageType.BULK_FILE_WRITE:
      handleWriteBulkFile(<Messages.BulkFileWriteMessage> msg);
      break;

    case Messages.MessageType.BULK_FILE_CLOSE:
      handleCloseBulkFile(<Messages.BulkFileCloseMessage> msg);
      break;

    case Messages.MessageType.BULK_FILE_REF:
      handleRefBulkFile(<Messages.BulkFileRefMessage> msg);
      break;

    case Messages.MessageType.BULK_FILE_DEREF:
      handleDerefBulkFile(<Messages.BulkFileDerefMessage> msg);
      break;

    case Messages.MessageType.EXTENSION_METADATA_REQUEST:
      event.returnValue = handleExtensionMetadataRequest();
      return;

    case Messages.MessageType.COPY_KEYBINDINGS:
      handleKeybindingsCopy(<Messages.KeybindingsCopyMessage> msg);
      break;

    case Messages.MessageType.DELETE_KEYBINDINGS:
      handleKeybindingsDelete(<Messages.KeybindingsDeleteMessage> msg);
      break;

    case Messages.MessageType.RENAME_KEYBINDINGS:
      handleKeybindingsRename(<Messages.KeybindingsRenameMessage> msg);
      break;

    case Messages.MessageType.READ_KEYBINDINGS_REQUEST:
      reply = handleKeybindingsReadRequest(<Messages.KeybindingsReadRequestMessage>msg);
      break;

    case Messages.MessageType.UPDATE_KEYBINDINGS:
      handleKeybindingsUpdate(<Messages.KeybindingsUpdateMessage>msg);
      break;

    default:
      break;
  }
  
  if (reply !== null) {
    if (LOG_FINE) {
      _log.debug("Replying: ", reply);
    }
    event.sender.send(Messages.CHANNEL_NAME, reply);
  }
}

function handleConfigRequest(msg: Messages.ConfigRequestMessage): Messages.ConfigMessage {
  const reply: Messages.ConfigMessage = {
    type: Messages.MessageType.CONFIG,
    key: msg.key,
    config: configDatabase.getConfig(msg.key)
  };
  return reply;
}

function handleConfig(msg: Messages.ConfigMessage): void {
  if (LOG_FINE) {
    _log.debug("Incoming new config: ", msg);
  }

  configDatabase.setConfig(msg.key, msg.config);
}

function handleThemeListRequest(): Messages.ThemeListMessage {
  const reply: Messages.ThemeListMessage = { type: Messages.MessageType.THEME_LIST, themeInfo: getThemes() };
  return reply;
}

async function handleThemeContentsRequest(webContents: Electron.WebContents, 
  msg: Messages.ThemeContentsRequestMessage): Promise<void> {

  const globalVariables: GlobalVariableMap = new Map();
  globalVariables.set("extraterm-titlebar-style", titleBarStyle);
  globalVariables.set("extraterm-platform", process.platform);

  try {
    const renderResult = await themeManager.render(msg.themeType, globalVariables);

    const themeContents = renderResult.themeContents;
    const reply: Messages.ThemeContentsMessage = {
      type: Messages.MessageType.THEME_CONTENTS,
      themeType: msg.themeType,
      themeContents: themeContents,
      success: true,
      errorMessage: renderResult.errorMessage
    };
    webContents.send(Messages.CHANNEL_NAME, reply);

  } catch(err) {
    const reply: Messages.ThemeContentsMessage = {
      type: Messages.MessageType.THEME_CONTENTS, 
      themeType: msg.themeType,
      themeContents: null,
      success: false,
      errorMessage: err.message
    };
    webContents.send(Messages.CHANNEL_NAME, reply);
  }
}

function handleThemeRescan(): Messages.ThemeListMessage {
  themeManager.rescan();

  const userStoredConfig = configDatabase.getConfigCopy(GENERAL_CONFIG);
  if ( ! isThemeType(themeManager.getTheme(userStoredConfig.themeSyntax), 'syntax')) {
    userStoredConfig.themeSyntax = ThemeTypes.FALLBACK_SYNTAX_THEME;
    configDatabase.setConfig(GENERAL_CONFIG, userStoredConfig);
  }

  return handleThemeListRequest();
}

const ptyToSenderMap = new Map<number, number>();

function setupPtyManager(): boolean {
  try {
    ptyManager = new PtyManager(extensionManager);
    injectConfigDatabase(ptyManager, configDatabase);

    ptyManager.onPtyData(event => {
      const senderId = ptyToSenderMap.get(event.ptyId);
      if (senderId == null) {
        return;
      }
      const sender = webContents.fromId(senderId);
      if (sender == null || sender.isDestroyed()) {
        return;
      }
      const msg: Messages.PtyOutput = { type: Messages.MessageType.PTY_OUTPUT, id: event.ptyId, data: event.data };
      sender.send(Messages.CHANNEL_NAME, msg);
    });

    ptyManager.onPtyExit(ptyId => {
      const senderId = ptyToSenderMap.get(ptyId);
      if (senderId == null) {
        return;
      }
      const sender = webContents.fromId(senderId);
      if (sender == null || sender.isDestroyed()) {
        return;
      }

      const msg: Messages.PtyClose = { type: Messages.MessageType.PTY_CLOSE, id: ptyId };
      sender.send(Messages.CHANNEL_NAME, msg);
    });

    ptyManager.onPtyAvailableWriteBufferSizeChange(event => {
      const senderId = ptyToSenderMap.get(event.ptyId);
      const sender = webContents.fromId(senderId);
      if (sender != null && ! sender.isDestroyed()) {
        const msg: Messages.PtyInputBufferSizeChange = {
          type: Messages.MessageType.PTY_INPUT_BUFFER_SIZE_CHANGE,
          id: event.ptyId,
          totalBufferSize: event.bufferSizeChange.totalBufferSize,
          availableDelta:event.bufferSizeChange.availableDelta
        };
        sender.send(Messages.CHANNEL_NAME, msg);
      }
    });

    return true;
  } catch(err) {
    _log.severe("Error occured while creating the PTY connector factory: " + err.message);
    return false;
  }
}

function setupDefaultSessions(): void {
  const sessions = configDatabase.getConfigCopy(SESSION_CONFIG);
  if (sessions == null || sessions.length === 0) {
    const newSessions = ptyManager.getDefaultSessions();
    configDatabase.setConfig(SESSION_CONFIG, newSessions);
  }
}

function handlePtyCreate(sender: Electron.WebContents, msg: Messages.CreatePtyRequestMessage): Messages.CreatedPtyMessage {
  const ptyId = ptyManager.createPty(msg.sessionUuid, msg.env, msg.columns, msg.rows);
  _log.debug(`handlePtyCreate ptyId: ${ptyId}, sender.id: ${sender.id}`);
  ptyToSenderMap.set(ptyId, sender.id);
  const reply: Messages.CreatedPtyMessage = { type: Messages.MessageType.PTY_CREATED, id: ptyId };
  return reply;
}

function handlePtyInput(msg: Messages.PtyInput): void {
  ptyManager.ptyInput(msg.id, msg.data);
}

function handlePtyOutputBufferSize(msg: Messages.PtyOutputBufferSize): void {
  ptyManager.ptyOutputBufferSize(msg.id, msg.size);
}

function handlePtyResize(msg: Messages.PtyResize): void {
  ptyManager.ptyResize(msg.id, msg.columns, msg.rows);
}

function handlePtyCloseRequest(msg: Messages.PtyCloseRequest): void {
  ptyManager.closePty(msg.id);
}

function cleanUpPtyWindow(webContentsId: number): void {
  const closedPtyList: number[] = [];

  for (const [ptyId, senderId] of ptyToSenderMap) {
    if (webContentsId === senderId) {
      ptyManager.closePty(ptyId);
      closedPtyList.push(ptyId);
    }
  }

  for (const ptyId of closedPtyList) {
    ptyToSenderMap.delete(ptyId);
  }
}

//-------------------------------------------------------------------------

function handleDevToolsRequest(sender: Electron.WebContents, msg: Messages.DevToolsRequestMessage): void {
  if (msg.open) {
    sender.openDevTools();
  } else {
    sender.closeDevTools();
  }
}

function sendDevToolStatus(window: Electron.BrowserWindow, open: boolean): void {
  const msg: Messages.DevToolsStatusMessage = { type: Messages.MessageType.DEV_TOOLS_STATUS, open: open };
  window.webContents.send(Messages.CHANNEL_NAME, msg);
}

function handleClipboardWrite(msg: Messages.ClipboardWriteMessage): void {
  if (msg.text.length !== 0) {
    clipboard.writeText(msg.text);
  }
}

function handleClipboardReadRequest(msg: Messages.ClipboardReadRequestMessage): Messages.ClipboardReadMessage {
  const text = clipboard.readText();
  const reply: Messages.ClipboardReadMessage = { type: Messages.MessageType.CLIPBOARD_READ, text: text };
  return reply;
}

function handleNewTagRequest(msg: Messages.NewTagRequestMessage): Messages.NewTagMessage {
  const reply: Messages.NewTagMessage = { type: Messages.MessageType.NEW_TAG, tag: "" + tagCounter };
  tagCounter++;
  return reply;
}

//-------------------------------------------------------------------------

function handleCreateBulkFile(msg: Messages.BulkFileCreateMessage): Messages.BulkFileCreatedResponseMessage {
  const {identifier, url}  = bulkFileStorage.createBulkFile(msg.metadata, msg.size);
  const reply: Messages.BulkFileCreatedResponseMessage = {type: Messages.MessageType.BULK_FILE_CREATED, identifier, url};
  return reply;
}

function handleWriteBulkFile(msg: Messages.BulkFileWriteMessage): void {
  bulkFileStorage.write(msg.identifier, msg.data);
}

function sendBulkFileWriteBufferSizeEvent(event: BufferSizeEvent): void {
  const msg: Messages.BulkFileBufferSizeMessage = {
    type: Messages.MessageType.BULK_FILE_BUFFER_SIZE,
    identifier: event.identifier,
    totalBufferSize: event.totalBufferSize,
    availableDelta: event.availableDelta
  };
  sendMessageToAllWindows(msg);
}

function sendBulkFileStateChangeEvent(event: CloseEvent): void {
  const msg: Messages.BulkFileStateMessage = {
    type: Messages.MessageType.BULK_FILE_STATE,
    identifier: event.identifier,
    state: event.success ? BulkFileState.COMPLETED : BulkFileState.FAILED
  };
  sendMessageToAllWindows(msg);
}

function handleCloseBulkFile(msg: Messages.BulkFileCloseMessage): void {
  bulkFileStorage.close(msg.identifier, msg.success);
}

function handleRefBulkFile(msg: Messages.BulkFileRefMessage): void {
  bulkFileStorage.ref(msg.identifier);
}

function handleDerefBulkFile(msg: Messages.BulkFileDerefMessage): void {
  bulkFileStorage.deref(msg.identifier); 
}

function handleExtensionMetadataRequest(): Messages.ExtensionMetadataMessage {
  return {type: Messages.MessageType.EXTENSION_METADATA, extensionMetadata: extensionManager.getExtensionMetadata()};
}

function handleKeybindingsCopy(msg: Messages.KeybindingsCopyMessage): void {
  keybindingsIOManager.copyKeybindings(msg.sourceName, msg.destName);

  const systemConfig = <SystemConfig> configDatabase.getConfigCopy(SYSTEM_CONFIG);
  systemConfig.keybindingsInfoList = keybindingsIOManager.getInfoList();
  configDatabase.setConfigNoWrite(SYSTEM_CONFIG, systemConfig);
}

function handleKeybindingsDelete(msg: Messages.KeybindingsDeleteMessage): void {
  deleteKeybindings(msg.name);
}

function deleteKeybindings(targetName: string): void {
  keybindingsIOManager.deleteKeybindings(targetName);

  const generalConfig = <GeneralConfig> configDatabase.getConfigCopy(GENERAL_CONFIG);
  if (generalConfig.keybindingsName === targetName) {
    generalConfig.keybindingsName = process.platform === "darwin" ? KEYBINDINGS_OSX : KEYBINDINGS_PC;
    configDatabase.setConfig(GENERAL_CONFIG, generalConfig);
  }

  const systemConfig = <SystemConfig> configDatabase.getConfigCopy(SYSTEM_CONFIG);
  systemConfig.keybindingsInfoList = keybindingsIOManager.getInfoList();
  configDatabase.setConfigNoWrite(SYSTEM_CONFIG, systemConfig);
}

function handleKeybindingsRename(msg: Messages.KeybindingsCopyMessage): void {
  keybindingsIOManager.copyKeybindings(msg.sourceName, msg.destName);

  const systemConfig = <SystemConfig> configDatabase.getConfigCopy(SYSTEM_CONFIG);
  systemConfig.keybindingsInfoList = keybindingsIOManager.getInfoList();
  configDatabase.setConfigNoWrite(SYSTEM_CONFIG, systemConfig);

  const generalConfig = <GeneralConfig> configDatabase.getConfigCopy(GENERAL_CONFIG);
  generalConfig.keybindingsName = msg.destName;
  configDatabase.setConfig(GENERAL_CONFIG, generalConfig);

  deleteKeybindings(msg.sourceName);
}

function handleKeybindingsReadRequest(msg: Messages.KeybindingsReadRequestMessage): Messages.KeybindingsReadMessage {
  const keybindings = keybindingsIOManager.readKeybindingsJson(msg.name);
  const reply: Messages.KeybindingsReadMessage = {
    type: Messages.MessageType.READ_KEYBINDINGS,
    name: msg.name,
    keybindings
  };
  return reply;
}

function handleKeybindingsUpdate(msg: Messages.KeybindingsUpdateMessage): void {
  keybindingsIOManager.updateKeybindings(msg.name, msg.keybindings);

  // Broadcast the updated bindings.
  const generalConfig = <GeneralConfig> configDatabase.getConfig(GENERAL_CONFIG);
  const systemConfig = <SystemConfig> configDatabase.getConfigCopy(SYSTEM_CONFIG);
  systemConfig.keybindingsContexts = keybindingsIOManager.readKeybindingsJson(generalConfig.keybindingsName);
  configDatabase.setConfigNoWrite(SYSTEM_CONFIG, systemConfig);
}

main();

/*
 * Copyright 2014-2016 Simon Edwards <simon@simonzone.com>
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
import * as Commander from 'commander';
import {app, BrowserWindow, crashReporter, ipcMain as ipc, clipboard, dialog, screen, webContents} from 'electron';
import { BulkFileState, Disposable, Event} from 'extraterm-extension-api';
import * as FontManager from 'font-manager';
import fontInfo = require('fontinfo');
import * as fs from 'fs';
import * as _ from 'lodash';
import * as path from 'path';
import * as os from 'os';

import {BulkFileStorage, BulkFileIdentifier, BufferSizeEvent, CloseEvent} from './bulk_file_handling/BulkFileStorage';
import {Config, CommandLineAction, SystemConfig, FontInfo, ShowTipsStrEnum, KeyBindingInfo, ConfigDatabase, injectConfigDatabase, ReadonlyConfig} from '../Config';
import {FileLogWriter} from '../logging/FileLogWriter';
import {Logger, getLogger, addLogWriter} from '../logging/Logger';
import { PtyManager } from './pty/PtyManager';
import * as ResourceLoader from '../ResourceLoader';
import * as ThemeTypes from '../theme/Theme';
import {ThemeManager} from '../theme/ThemeManager';
import * as Messages from '../WindowMessages';
import { MainExtensionManager } from './extension/MainExtensionManager';
import { EventEmitter } from '../utils/EventEmitter';
import { freezeDeep } from 'extraterm-readonly-toolbox';

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
const KEYBINDINGS_DIRECTORY = "../../resources/keybindings";
const DEFAULT_KEYBINDING = "keybindings.json";
const KEYBINDINGS_OSX = "keybindings-osx.json";
const KEYBINDINGS_PC = "keybindings.json";
const TERMINAL_FONTS_DIRECTORY = "../../resources/terminal_fonts";
const DEFAULT_TERMINALFONT = "DejaVuSansMono";

const DEFAULT_TERMINAL_THEME = "default-terminal";
const DEFAULT_SYNTAX_THEME = "default-syntax";
const DEFAULT_UI_THEME = "atomic-dark-ui";

const PNG_ICON_PATH = "../../resources/logo/extraterm_small_logo_256x256.png";
const ICO_ICON_PATH = "../../resources/logo/extraterm_small_logo.ico";

const EXTRATERM_DEVICE_SCALE_FACTOR = "--extraterm-device-scale-factor";


let themeManager: ThemeManager;
let ptyManager: PtyManager;
let configManager: ConfigManager;
let tagCounter = 1;
let fonts: FontInfo[] = null;
let titleBarVisible = false;
let bulkFileStorage: BulkFileStorage = null;
let extensionManager: MainExtensionManager = null;


function main(): void {
  let failed = false;
  configManager = new ConfigManager();

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

  // The extra fields which appear on the command object are declared in extra_commander.d.ts.
  Commander.option('-c, --cygwinDir [cygwinDir]', 'Location of the cygwin directory []')
    .option('-d, --dev-tools [devTools]', 'Open the dev tools on start up')
    .option('--force-device-scale-factor []', '(This option is used by Electron)')
    .option(EXTRATERM_DEVICE_SCALE_FACTOR + ' []', '(Internal Extraterm option. Ignore)')
    .parse(normalizedArgv);

  setupExtensionManager();
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
  app.on('ready', startUpWindows);
}

function setupExtensionManager(): void {
  extensionManager = new MainExtensionManager([path.join(__dirname, "../../../extensions" )]);
  extensionManager.scan();
  extensionManager.startUp();
}

function setupThemeManager(): void {
  // Themes
  const themesdir = path.join(__dirname, '../../resources', THEMES_DIRECTORY);
  const userThemesDir = path.join(app.getPath('appData'), EXTRATERM_CONFIG_DIR, USER_THEMES_DIR);
  themeManager = new ThemeManager([themesdir, userThemesDir], extensionManager);
  injectConfigDatabase(themeManager, configManager);
}

function startUpWindows(): void {
  if ( ! setupScale()) {
    return;
  }
  
  setupBulkFileStorage();
  setupIpc();  
  openWindow();
}

function setupScale(): boolean {
  const deviceScaleFactor = <any>Commander.extratermDeviceScaleFactor;
  const {restartNeeded, originalScaleFactor, currentScaleFactor} = setScaleFactor(deviceScaleFactor);
  if (restartNeeded) {
    return false;
  }
  const newConfig = configManager.getConfigCopy();
  newConfig.systemConfig.currentScaleFactor = currentScaleFactor;
  newConfig.systemConfig.originalScaleFactor = originalScaleFactor;
  configManager.setConfig(newConfig);
  return true;
}

function setupBulkFileStorage(): void {
  bulkFileStorage = new BulkFileStorage(os.tmpdir());
  bulkFileStorage.onWriteBufferSize(sendBulkFileWriteBufferSizeEvent);
  bulkFileStorage.onClose(sendBulkFileStateChangeEvent);
}

function openWindow(): void {
  const config = configManager.getConfig();
  const themeInfo = themeManager.getTheme(config.themeGUI);

  // Create the browser window.
  const options = <Electron.BrowserWindowOptions> {
    width: 1200,
    height: 600,
    "webPreferences": {
      "experimentalFeatures": true,
    },
    frame: config.showTitleBar,
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

  titleBarVisible = config.showTitleBar;
  mainWindow = new BrowserWindow(options);

  if ((<any>Commander).devTools) {
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
  const newConfig = configManager.getConfigCopy();

  if (newConfig.windowConfiguration == null) {
    newConfig.windowConfiguration = {};
  }
  newConfig.windowConfiguration[windowId] = {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height
  };
  configManager.setConfig(newConfig);
}

function getWindowDimensionsFromConfig(windowId: number): Electron.Rectangle {
  const config = configManager.getConfig();
  if (config.windowConfiguration == null) {
    return null;
  }
  const singleWindowConfig = config.windowConfiguration[windowId];
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
      stdio: [process.stdin, process.stdout, process.stderr]});

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
function systemConfiguration(config: Config): SystemConfig {
  let homeDir = app.getPath('home');
  
  const keyBindingsDir = path.join(__dirname, KEYBINDINGS_DIRECTORY);
  const keyBindingFiles = scanKeyBindingFiles(keyBindingsDir);
  const defaultKeyBindingFilename = path.join(keyBindingsDir, config.keyBindingsFilename);
  const keyBindingJsonString = fs.readFileSync(defaultKeyBindingFilename, { encoding: "UTF8" } );
  const keyBindingsJSON = JSON.parse(keyBindingJsonString);
  
  return {
    homeDir: homeDir,
    keyBindingsContexts: keyBindingsJSON,
    keyBindingsFiles: keyBindingFiles,
    availableFonts: getFonts(),
    titleBarVisible: titleBarVisible,
    currentScaleFactor: config.systemConfig == null ? 1 : config.systemConfig.currentScaleFactor,
    originalScaleFactor: config.systemConfig == null ? 1 : config.systemConfig.originalScaleFactor
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
}

function isThemeType(themeInfo: ThemeInfo, themeType: ThemeType): boolean {
  if (themeInfo === null) {
    return false;
  }
  return themeInfo.type.indexOf(themeType) !== -1;
}

function setupConfig(): void {
  const config = readConfigurationFile();
  config.systemConfig = systemConfiguration(config);
  config.blinkingCursor = _.isBoolean(config.blinkingCursor) ? config.blinkingCursor : false;
  
  if (config.terminalFontSize === undefined || typeof config.terminalFontSize !== 'number') {
    config.terminalFontSize = 12;
  } else {
    config.terminalFontSize = Math.max(Math.min(1024, config.terminalFontSize), 4);
  }

  if (config.terminalFont === undefined || config.terminalFont === null) {
    config.terminalFont = DEFAULT_TERMINALFONT;
  }

  if ( ! config.systemConfig.availableFonts.some( (font) => font.postscriptName === config.terminalFont)) {
    config.terminalFont = DEFAULT_TERMINALFONT;
  }

  if ( ! isThemeType(themeManager.getTheme(config.themeTerminal), 'terminal')) {
    config.themeTerminal = ThemeTypes.FALLBACK_TERMINAL_THEME;
  }
  if ( ! isThemeType(themeManager.getTheme(config.themeSyntax), 'syntax')) {
    config.themeSyntax = ThemeTypes.FALLBACK_SYNTAX_THEME;
  }
  if (config.themeGUI === "default" || ! isThemeType(themeManager.getTheme(config.themeGUI), 'gui')) {
    config.themeGUI = "atomic-dark-ui";
  }

  config.uiScalePercent = Math.min(500, Math.max(5, config.uiScalePercent || 100));

  if (config.showTitleBar !== true && config.showTitleBar !== false) {
    config.showTitleBar = false;
  }

  // Validate the selected keybindings config value.
  if ( ! config.systemConfig.keyBindingsFiles.some( (t) => t.filename === config.keyBindingsFilename )) {
    config.keyBindingsFilename = process.platform === "darwin" ? KEYBINDINGS_OSX : KEYBINDINGS_PC;
  }

  if (config.sessions == null) {
    config.sessions = [];
  }

  configManager.setConfigNoWrite(config);
}

/**
 * Read the configuration.
 * 
 * @returns The configuration object.
 */
function readConfigurationFile(): Config {
  const filename = path.join(app.getPath('appData'), EXTRATERM_CONFIG_DIR, MAIN_CONFIG);
  let config: Config = { systemConfig: null };

  if (fs.existsSync(filename)) {
    _log.info("Reading user configuration from " + filename);
    const configJson = fs.readFileSync(filename, {encoding: "utf8"});
    config = <Config>JSON.parse(configJson);
  } else {
    _log.info("Couldn't find user configuration file at " + filename);
  }
  setConfigDefaults(config);
  // FIXME freeze this.
  return config;
}

function defaultValue<T>(value: T, defaultValue: T): T {
  return value == null ? defaultValue : value;
}

function setConfigDefaults(config: Config): void {
  config.systemConfig = defaultValue(config.systemConfig, null);
  config.blinkingCursor = defaultValue(config.blinkingCursor, false);
  config.scrollbackMaxLines = defaultValue(config.scrollbackMaxLines, 500000);
  config.scrollbackMaxFrames = defaultValue(config.scrollbackMaxFrames, 100);
  config.showTips = defaultValue<ShowTipsStrEnum>(config.showTips, 'always');
  config.tipTimestamp = defaultValue(config.tipTimestamp, 0);
  config.tipCounter = defaultValue(config.tipCounter, 0);
  
  config.themeTerminal = defaultValue(config.themeTerminal, "default");
  config.themeSyntax = defaultValue(config.themeSyntax, "default");
  config.themeGUI = defaultValue(config.themeGUI, "atomic-dark-ui");
  config.showTitleBar = defaultValue(config.showTitleBar, false);

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
  
  if (config.keyBindingsFilename === undefined) {
    config.keyBindingsFilename = process.platform === "darwin" ? KEYBINDINGS_OSX : KEYBINDINGS_PC;
  }

  config.sessions = defaultValue(config.sessions, []);
}


class ConfigManager implements ConfigDatabase {
  private _config: ReadonlyConfig = null;
  private _onChangeEventEmitter = new EventEmitter<void>();
  onChange: Event<void>;
  
  constructor() {
    this.onChange = this._onChangeEventEmitter.event;
  }

  getConfig(): ReadonlyConfig {
    return this._config;
  }

  getConfigCopy(): Config {
    if (this._config == null) {
      return null;
    }
    return <Config> _.cloneDeep(this._config);
  }

  setConfigNoWrite(newConfig: Config | ReadonlyConfig): void {
    if (Object.isFrozen(newConfig)) {
      this._config = newConfig;
    } else {
      this._config = <ReadonlyConfig> freezeDeep(_.cloneDeep(newConfig));
    }

    this._onChangeEventEmitter.fire(undefined);
  }

  setConfig(newConfig: Config | ReadonlyConfig): void {
    const copiedConfig = _.cloneDeep(newConfig);
    freezeDeep(copiedConfig);

    // Write it to disk.
    this._writeConfigurationFile(copiedConfig);
    this.setConfigNoWrite(copiedConfig);
  }

  private _writeConfigurationFile(config: ReadonlyConfig): void {
    const cleanConfig = <Config> _.cloneDeep(config);
    cleanConfig.systemConfig = null;
    
    const filename = path.join(app.getPath('appData'), EXTRATERM_CONFIG_DIR, MAIN_CONFIG);
    fs.writeFileSync(filename, JSON.stringify(cleanConfig, null, "  "));
  }
}

function getFullConfig(): Config {
  const config = configManager.getConfigCopy();
  const fullConfig = _.cloneDeep(config);

  fullConfig.systemConfig = systemConfiguration(config);
  
  _log.debug("Full config: ",fullConfig);
  return fullConfig;
}

function getThemes(): ThemeInfo[] {
  return themeManager.getAllThemes();
}

function scanKeyBindingFiles(keyBindingsDir: string): KeyBindingInfo[] {
  const result: KeyBindingInfo[] = [];
  if (fs.existsSync(keyBindingsDir)) {
    const contents = fs.readdirSync(keyBindingsDir);
    contents.forEach( (item) => {
      if (item.endsWith(".json")) {
        const infoPath = path.join(keyBindingsDir, item);
        try {
          const infoStr = fs.readFileSync(infoPath, {encoding: "utf8"});
          const keyBindingJSON = JSON.parse(infoStr);
          const name = keyBindingJSON.name;
          if (name !== undefined) {
            const info: KeyBindingInfo = {
              name: name,
              filename: item
            };
            result.push(info);
          } else {
            _log.warn(`Unable to get 'name' from JSON file '${item}'`);
          }
        } catch(err) {
          _log.warn("Warning: Unable to read file ", infoPath, err);
        }
      }
    });
  }
  return result;
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

function handleIpc(event: Electron.IpcMainEvent, arg: any): void {
  const msg: Messages.Message = arg;
  let reply: Messages.Message = null;
  
  if (LOG_FINE) {
    _log.debug("Main IPC incoming: ",msg);
  }
  
  switch(msg.type) {
    case Messages.MessageType.CONFIG_REQUEST:
      reply = handleConfigRequest(<Messages.ConfigRequestMessage> msg);
      break;
      
    case Messages.MessageType.FRAME_DATA_REQUEST:
      _log.debug('Messages.MessageType.FRAME_DATA_REQUEST is not implemented.');
      break;
      
    case Messages.MessageType.THEME_LIST_REQUEST:
      reply = handleThemeListRequest(<Messages.ThemeListRequestMessage> msg);
      break;
      
    case Messages.MessageType.THEME_CONTENTS_REQUEST:
      handleThemeContentsRequest(event.sender, <Messages.ThemeContentsRequestMessage> msg);
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

    case Messages.MessageType.CONFIG:
      handleConfig(<Messages.ConfigMessage> msg);
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
  const reply: Messages.ConfigMessage = { type: Messages.MessageType.CONFIG, config: getFullConfig() };
  return reply;
}

function handleConfig(msg: Messages.ConfigMessage): void {
  if (LOG_FINE) {
    _log.debug("Incoming new config: ",msg);
  }
  
  // Copy in the updated fields.
  const incomingConfig = msg.config;
  const newConfig = configManager.getConfigCopy();
  newConfig.showTips = incomingConfig.showTips;
  newConfig.tipTimestamp = incomingConfig.tipTimestamp;
  newConfig.tipCounter = incomingConfig.tipCounter;
  newConfig.blinkingCursor = incomingConfig.blinkingCursor;
  newConfig.scrollbackMaxLines = incomingConfig.scrollbackMaxLines;
  newConfig.scrollbackMaxFrames = incomingConfig.scrollbackMaxFrames;
  newConfig.terminalFontSize = incomingConfig.terminalFontSize;
  newConfig.terminalFont = incomingConfig.terminalFont;
  newConfig.commandLineActions = incomingConfig.commandLineActions;
  newConfig.themeSyntax = incomingConfig.themeSyntax;
  newConfig.themeTerminal = incomingConfig.themeTerminal;
  newConfig.themeGUI = incomingConfig.themeGUI;
  newConfig.keyBindingsFilename = incomingConfig.keyBindingsFilename;
  newConfig.showTitleBar = incomingConfig.showTitleBar;
  newConfig.uiScalePercent = incomingConfig.uiScalePercent;
  newConfig.sessions = incomingConfig.sessions;

  configManager.setConfig(newConfig);

  const newConfigMsg: Messages.ConfigMessage = {
    type: Messages.MessageType.CONFIG,
    config: getFullConfig()
  };
  sendMessageToAllWindows(newConfigMsg);  
}

function sendMessageToAllWindows(msg: Messages.Message): void {
  BrowserWindow.getAllWindows().forEach( (window) => {
    if (LOG_FINE) {
      _log.debug("Transmitting new config to window ", window.id);
    }
    window.webContents.send(Messages.CHANNEL_NAME, msg);
  });
}

function handleThemeListRequest(msg: Messages.ThemeListRequestMessage): Messages.ThemeListMessage {
  const reply: Messages.ThemeListMessage = { type: Messages.MessageType.THEME_LIST, themeInfo: getThemes() };
  return reply;
}

async function handleThemeContentsRequest(webContents: Electron.WebContents, 
  msg: Messages.ThemeContentsRequestMessage): Promise<void> {

  const globalVariables = new Map<string, number|boolean|string>();
  globalVariables.set("extraterm-titlebar-visible", titleBarVisible);
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

const ptyToSenderMap = new Map<number, number>();

function setupPtyManager(): boolean {
  try {
    ptyManager = new PtyManager(extensionManager);
    injectConfigDatabase(ptyManager, configManager);

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
      if (sender == null && ! sender.isDestroyed()) {
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
  const config = configManager.getConfigCopy();
  if (config.sessions.length === 0) {
    const newConfig = _.cloneDeep(config);
    newConfig.sessions = ptyManager.getDefaultSessions();
    configManager.setConfig(newConfig);
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

main();

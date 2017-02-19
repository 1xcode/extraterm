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
import sourceMapSupport = require('source-map-support');

import electron = require('electron');
const app = electron.app;
const BrowserWindow = electron.BrowserWindow;
const crashReporter = electron.crashReporter;
const ipc = electron.ipcMain;
const clipboard = electron.clipboard;
const dialog = electron.dialog;

import path = require('path');
import fs = require('fs');
import _ = require('lodash');
import commander = require('commander');
import fontManager = require('font-manager');
import fontinfo = require('fontinfo');
import ptyconnector = require('./ptyconnector');
import * as ResourceLoader from './ResourceLoader';
import * as Messages from './WindowMessages';

import * as ThemeTypes from './Theme';
type ThemeInfo = ThemeTypes.ThemeInfo;
type ThemeType = ThemeTypes.ThemeType;
import * as ThemeManager from './ThemeManager';

import child_process = require('child_process');
import util = require('./gui/util');
import Logger from './Logger';

type PtyConnector  = ptyconnector.PtyConnector;
type Pty = ptyconnector.Pty;
type PtyOptions = ptyconnector.PtyOptions;
type EnvironmentMap = ptyconnector.EnvironmentMap;

// Our special 'fake' module which selects the correct pty connector factory implementation.
const PtyConnectorFactory = require("./ptyconnectorfactory");

// Interfaces.
import config_ = require('./config');
type Config = config_.Config;
type CommandLineAction = config_.CommandLineAction;
type SessionProfile = config_.SessionProfile;
type SystemConfig = config_.SystemConfig;
type FontInfo = config_.FontInfo;

const LOG_FINE = false;

sourceMapSupport.install();

// crashReporter.start(); // Report crashes

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the javascript object is GCed.
let mainWindow: Electron.BrowserWindow = null;

const EXTRATERM_CONFIG_DIR = "extraterm";
const MAIN_CONFIG = "extraterm.json";
const THEMES_DIRECTORY = "themes";
const USER_THEMES_DIR = "themes"
const KEYBINDINGS_DIRECTORY = "keybindings";
const DEFAULT_KEYBINDING = "keybindings.json";
const KEYBINDINGS_OSX = "keybindings-osx.json";
const KEYBINDINGS_PC = "keybindings.json";
const TERMINAL_FONTS_DIRECTORY = "terminal_fonts";
const DEFAULT_TERMINALFONT = "DejaVuSansMono";

const DEFAULT_TERMINAL_THEME = "default-terminal";
const DEFAULT_SYNTAX_THEME = "default-syntax";
const DEFAULT_UI_THEME = "atomic-dark-ui";

let themeManager: ThemeManager.ThemeManager;
let config: Config;
let ptyConnector: PtyConnector;
let tagCounter = 1;
let fonts: FontInfo[] = null;
let titleBarVisible = false;

function main(): void {
  let failed = false;

  app.commandLine.appendSwitch('disable-smooth-scrolling'); // Turn off the sluggish scrolling.

  if (process.platform === "darwin") {
    setupOSX();
  }

  _log.startRecording();

  // commander assumes that the first two values in argv are 'node' and 'blah.js' and then followed by the args.
  // This is not the case when running from a packaged Electron app. Here you have first value 'appname' and then args.
  const normalizedArgv = process.argv[0].includes('extraterm') ? ["node", "extraterm", ...process.argv.slice(1)]
                            : process.argv;

  // The extra fields which appear on the command object are declared in extra_commander.d.ts.
  commander.option('-c, --cygwinDir [cygwinDir]', 'Location of the cygwin directory []')
    .option('-d, --dev-tools [devTools]', 'Open the dev tools on start up')
    .parse(normalizedArgv);

  prepareAppData();  

  // Themes
  const themesdir = path.join(__dirname, THEMES_DIRECTORY);
  const userThemesDir = path.join(app.getPath('appData'), EXTRATERM_CONFIG_DIR, USER_THEMES_DIR);
  
  themeManager = ThemeManager.makeThemeManager([themesdir, userThemesDir]);
  
  initConfig();
  
  if (config.expandedProfiles.length === 0) {
    failed = true;
  } else {
    try {
      ptyConnector = PtyConnectorFactory.factory(config);
    } catch(err) {
      _log.severe(err.message);
      failed = true;
    }
  }
  if (failed) {
    dialog.showErrorBox("Sorry, something went wrong",
      "Something went wrong while starting up Extraterm.\n" +
      "Message log is:\n" + _log.getFormattedLogMessages());
    process.exit(1);
    return;
  }
  
  _log.stopRecording();

  // Quit when all windows are closed.
  app.on('window-all-closed', function() {
    ptyConnector.destroy();
    app.quit();
  });

  // This method will be called when Electron has done everything
  // initialization and ready for creating browser windows.
  app.on('ready', function() {
    
    startIpc();
    
    // Create the browser window.
    const options = {width: 1200, height: 600, "web-preferences": { "experimental-features": true },
      frame: config.showTitleBar};
    titleBarVisible = config.showTitleBar;
    mainWindow = new BrowserWindow(options);

    if ((<any>commander).devTools) {
      mainWindow.webContents.openDevTools();
    }

    mainWindow.setMenu(null);

    // Emitted when the window is closed.
    mainWindow.on('closed', function() {
      cleanUpPtyWindow(mainWindow);
      mainWindow = null;
    });
    
    // and load the index.html of the app.
    mainWindow.loadURL(ResourceLoader.toUrl('main.html'));

    mainWindow.on('devtools-closed', function() {
      sendDevToolStatus(mainWindow, false);
    });
    
    mainWindow.on('devtools-opened', function() {
      sendDevToolStatus(mainWindow, true);
    });

  });
}

const _log = new Logger("main");
function log(msg: any, ...opts: any[]): void {
  _log.debug(msg, ...opts);
}

function mapBadChar(m: string): string {
  const c = m.charCodeAt(0);
  switch (c) {
    case 8:
      return "\\b";
    case 12:
      return "\\f";
    case 13:
      return "\\r";
    case 11:
      return "\\v";
    case 0x22:
      return '\\"';
    default:
      if (c <= 255) {
        return "\\x" + util.to2DigitHex(c);
      } else {
        return "\\u" + util.to2DigitHex( c >> 8) + util.to2DigitHex(c & 0xff);
      }
  }
}

function substituteBadChars(data: string): string {
  return data.replace(/[^ /{},.:;<>!@#$%^&*()+=_'"a-zA-Z0-9-]/g, mapBadChar);
}

function logData(data: string): void {
  log(substituteBadChars(data));
}
// Format a string as a series of JavaScript string literals.
function formatJSData(data: string, maxLen: number = 60): string {
  let buf = "";
  let result = "";
  for (let i=0; i<data.length; i++) {
    buf += substituteBadChars(data[i]);
    if (buf.length+6 >= maxLen) {
      result += "\"" + buf + "\"\n";
      buf = "";
    }
  }
  
  if (buf !== "") {
    result += "\"" + buf + "\"\n";
  }
  return result;
}

function logJSData(data: string): void {
  log(formatJSData(data));
}

//-------------------------------------------------------------------------
//
//  #####                              
// #     # #    # ###### #      #      
// #       #    # #      #      #      
//  #####  ###### #####  #      #      
//       # #    # #      #      #      
// #     # #    # #      #      #      
//  #####  #    # ###### ###### ###### 
//
//-------------------------------------------------------------------------

/**
 * Expands a list of partial profiles.
 *
 * @param profiles List of user configurable partially filled in profiles.
 * @return List where the profiles are completed and a default is added.
 */
function expandSessionProfiles(profiles: SessionProfile[], options: { cygwinDir?: string }): SessionProfile[] {
  if (process.platform === "win32") {
    // Check for the existance of the user specified cygwin installation.
    let cygwinDir = findOptionCygwinInstallation(options.cygwinDir);
    if (cygwinDir === null) {
      // Find a default cygwin installation.
      cygwinDir = findCygwinInstallation();
      if (cygwinDir === null) {
        cygwinDir = findBabunCygwinInstallation();
      }
    }
    let canonicalCygwinProfile = cygwinDir !== null ? defaultCygwinProfile(cygwinDir) : null;
    
    const expandedProfiles: SessionProfile[] = [];
    if (profiles !== undefined && profiles !== null) {
      profiles.forEach( profile => {
        switch (profile.type) {
          case config_.SESSION_TYPE_CYGWIN:
            let templateProfile = canonicalCygwinProfile;
            
            if (profile.cygwinDir !== undefined && profile.cygwinDir !== null) {
              // This profile specifies the location of a cygwin installation.
              templateProfile = defaultCygwinProfile(profile.cygwinDir);
            }
          
            if (templateProfile !== null) {
              const expandedProfile: SessionProfile = {
                name: profile.name,
                type: config_.SESSION_TYPE_CYGWIN,
                command: profile.command !== undefined ? profile.command : templateProfile.command,
                arguments: profile.arguments !== undefined ? profile.arguments : templateProfile.arguments,
                extraEnv: profile.extraEnv !== undefined ? profile.extraEnv : templateProfile.extraEnv,
                cygwinDir: profile.cygwinDir !== undefined ? profile.cygwinDir : templateProfile.cygwinDir              
              };
              expandedProfiles.push(expandedProfile);
            } else {
              log(`Ignoring session profile '${profile.name}' with type '${profile.type}'. ` +
                `The cygwin installation couldn't be found.`);
            }
          
            break;
            
          case config_.SESSION_TYPE_BABUN:
            break;
            
          default:
            log(`Ignoring session profile '${profile.name}' with type '${profile.type}'. ` +
              `It is neither ${config_.SESSION_TYPE_CYGWIN} nor ${config_.SESSION_TYPE_BABUN}.`);
            break;
        }

      });
    }
    expandedProfiles.push(canonicalCygwinProfile);
    return expandedProfiles;
    
  } else {
    // A 'nix style system.
    const expandedProfiles: SessionProfile[] = [];
    let canonicalProfile = defaultProfile();
    if (profiles !== undefined && profiles !== null) {
      profiles.forEach( profile => {
        switch (profile.type) {
          case undefined:
          case null:
          case config_.SESSION_TYPE_UNIX:
            let templateProfile = canonicalProfile;
            const expandedProfile: SessionProfile = {
              name: profile.name,
              type: config_.SESSION_TYPE_UNIX,
              command: profile.command !== undefined ? profile.command : templateProfile.command,
              arguments: profile.arguments !== undefined ? profile.arguments : templateProfile.arguments,
              extraEnv: profile.extraEnv !== undefined ? profile.extraEnv : templateProfile.extraEnv
            };
            expandedProfiles.push(expandedProfile);
            break;
            
          default:
            log(`Ignoring session profile '${profile.name}' with type '${profile.type}'.`);
            break;
        }
      });
    }
    
    expandedProfiles.push(canonicalProfile);
    return expandedProfiles;
  }
}

function defaultProfile(): SessionProfile {
  const shell = readDefaultUserShell(process.env.USER);
  return {
    name: "Default",
    type: config_.SESSION_TYPE_UNIX,
    command: shell,
    arguments: process.platform === "darwin" ? ["-l"] : [], // OSX expects shells to be login shells. Linux etc doesn't
    extraEnv: { }
  };
}

function readDefaultUserShell(userName: string): string {
  if (process.platform === "darwin") {
    return readDefaultUserShellFromOpenDirectory(userName);
  } else {
    return readDefaultUserShellFromEtcPasswd(userName);
  }
}
  
function readDefaultUserShellFromEtcPasswd(userName: string): string {
  let shell = "/bin/bash";
  const passwdDb = readPasswd("/etc/passwd");  
  const userRecords = passwdDb.filter( row => row.username === userName);
  if (userRecords.length !== 0) {
    shell = userRecords[0].shell;
  }
  return shell;
}

function readDefaultUserShellFromOpenDirectory(userName: string): string {
  try {
    const regResult: string = <any> child_process.execFileSync("dscl",
      [".", "-read", "/Users/" + userName, "UserShell"],
      {encoding: "utf8"});
    const parts = regResult.split(/ /g);
    const shell = parts[1].trim();
    _log.info("Found default user shell with Open Directory: " + shell);
    return shell;
  } catch(e) {
    _log.warn("Couldn't run Open Directory dscl command to find the user's default shell. Defaulting to /bin/bash");
    return "/bin/bash";
  }
}

function defaultCygwinProfile(cygwinDir: string): SessionProfile {
  let defaultShell: string = null;
  let homeDir: string = null;
  
  const passwdPath = path.join(cygwinDir, "etc", "passwd");
  if (fs.existsSync(passwdPath)) {
    // Get the info from /etc/passwd
    const passwdDb = readPasswd(passwdPath);
    const username = process.env["USERNAME"];
    const userRecords = passwdDb.filter( row => row.username === username);
    if (userRecords.length !== 0) {
      defaultShell = userRecords[0].shell;
      homeDir = userRecords[0].homeDir;
    }
  }
  
  if (homeDir === null) {
    // Couldn't get the info we needed from /etc/passwd. Cygwin doesn't make a /etc/passwd by default anymore.
    defaultShell = "/bin/bash";
    homeDir = "/home/" + process.env["USERNAME"];
  }
  
  return {
    name: "Cygwin",
    type: config_.SESSION_TYPE_CYGWIN,
    command: defaultShell,
    arguments: ["-l"],
    extraEnv: { HOME: homeDir },
    cygwinDir: cygwinDir
  };
}

function findOptionCygwinInstallation(cygwinDir: string): string {
  if (cygwinDir == null) {
    return null;
  }
  if (fs.existsSync(cygwinDir)) {
    log("Found user specified cygwin installation at " + cygwinDir);
    return cygwinDir;
  } else {
    log("Couldn't find the user specified cygwin installation at " + cygwinDir);
    return null;
  }
}
  
function findCygwinInstallation(): string {
  try {
    const regResult: string = <any> child_process.execFileSync("REG",
      ["query","HKLM\\SOFTWARE\\Cygwin\\setup","/v","rootdir"],
      {encoding: "utf8"});
    const parts = regResult.split(/\r/g);
    const regsz = parts[2].indexOf("REG_SZ");
    const cygwinDir = parts[2].slice(regsz+6).trim();
    
    if (fs.existsSync(cygwinDir)) {
      log("Found cygwin installation at " + cygwinDir);
      return cygwinDir;
    } else {
      log("The registry reported the cygwin installation directory at '" + cygwinDir +
        "', but the directory does not exist.");
      return null;
    }
  } catch(e) {
    log("Couldn't find a cygwin installation.");
    return null;
  }
}

function findBabunCygwinInstallation(): string {
  const cygwinDir = path.join(app.getPath('home'), ".babun/cygwin");
  if (fs.existsSync(cygwinDir)) {
    log("Found babun cygwin installation at " + cygwinDir);
    return cygwinDir;
  } else {
    log("Couldn't find a Babun cygwin installation.");
    return null;
  }
}

interface PasswdLine {
  username: string;
  homeDir: string;
  shell: string;
}

function readPasswd(filename: string): PasswdLine[] {
  const fileText = fs.readFileSync(filename, {encoding: 'utf8'});
  const lines = fileText.split(/\n/g);
  return lines.map<PasswdLine>( line => {
    const fields = line.split(/:/g);
    return { username: fields[0], homeDir: fields[5], shell: fields[6] };
  });
}

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
    titleBarVisible: titleBarVisible
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

function prepareAppData(): void {
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

function initConfig(): void {
  config = readConfigurationFile();
  config.systemConfig = systemConfiguration(config);
  config.blinkingCursor = _.isBoolean(config.blinkingCursor) ? config.blinkingCursor : false;
  config.expandedProfiles = expandSessionProfiles(config.sessionProfiles, commander);
  
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
  if ( ! isThemeType(themeManager.getTheme(config.themeGUI), 'gui')) {
    config.themeGUI = ThemeTypes.FALLBACK_UI_THEME;
  }

  if (config.showTitleBar !== true && config.showTitleBar !== false) {
    config.showTitleBar = false;
  }

  // Validate the selected keybindings config value.
  if ( ! config.systemConfig.keyBindingsFiles.some( (t) => t.filename === config.keyBindingsFilename )) {
    config.keyBindingsFilename = process.platform === "darwin" ? KEYBINDINGS_OSX : KEYBINDINGS_PC;
  }
}

/**
 * Read the configuration.
 * 
 * @returns The configuration object.
 */
function readConfigurationFile(): Config {
  const filename = path.join(app.getPath('appData'), EXTRATERM_CONFIG_DIR, MAIN_CONFIG);
  let config: Config = { systemConfig: null, expandedProfiles: null };

  if (fs.existsSync(filename)) {
    log("Reading user configuration from " + filename);
    const configJson = fs.readFileSync(filename, {encoding: "utf8"});
    config = <Config>JSON.parse(configJson);
  } else {
    log("Couldn't find user configuration file at " + filename);
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
  config.expandedProfiles = defaultValue(config.expandedProfiles, null);
  config.blinkingCursor = defaultValue(config.blinkingCursor, false);
  config.scrollbackLines = defaultValue(config.scrollbackLines, 500000);
  config.showTips = defaultValue<config_.ShowTipsStrEnum>(config.showTips, 'always');
  config.tipTimestamp = defaultValue(config.tipTimestamp, 0);
  config.tipCounter = defaultValue(config.tipCounter, 0);
  
  config.themeTerminal = defaultValue(config.themeTerminal, "default");
  config.themeSyntax = defaultValue(config.themeSyntax, "default");
  config.themeGUI = defaultValue(config.themeGUI, "default");
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
}

/**
 * Write out the configuration to disk.
 * 
 * @param {Object} config The configuration to write.
 */
function writeConfigurationFile(config: Config): void {
  const cleanConfig = <Config> _.cloneDeep(config);
  cleanConfig.systemConfig = null;
  
  const filename = path.join(app.getPath('appData'), EXTRATERM_CONFIG_DIR, MAIN_CONFIG);
  fs.writeFileSync(filename, JSON.stringify(cleanConfig, null, "  "));
}

function setConfig(newConfig: Config): void {
  // Write it to disk.
  writeConfigurationFile(newConfig);
  config = newConfig;
}

function getConfig(): Config {
  return config;
}

function getFullConfig(): Config {
  const fullConfig = _.cloneDeep(config);

  fullConfig.systemConfig = systemConfiguration(config);
  
  _log.debug("Full config: ",fullConfig);
  return fullConfig;
}

function getThemes(): ThemeInfo[] {
  return themeManager.getAllThemes();
}

function scanKeyBindingFiles(keyBindingsDir: string): config_.KeyBindingInfo[] {
  const result: config_.KeyBindingInfo[] = [];
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
            const info: config_.KeyBindingInfo = {
              name: name,
              filename: item
            };
            result.push(info);
          } else {
            _log.warn(`Unable to get 'name' from JSON file '${item}'`);
          }
        } catch(err) {
          this._log.warn("Warning: Unable to read file ", infoPath, err);
        }
      }
    });
  }
  return result;
}

function getFonts(): FontInfo[] {
  const fontResults = fontManager.findFontsSync( { monospace: true } );
  const systemFonts = fontResults.filter( (result) => result.path.toLowerCase().endsWith(".ttf" ))
      .map( (result) => {
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
  const fonts = _.unique(allFonts, false, "postscriptName");
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
        const fi = fontinfo(ttfPath);
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

function startIpc(): void {
  ipc.on(Messages.CHANNEL_NAME, handleIpc);
}

function handleIpc(event: Electron.IpcMainEvent, arg: any): void {
  const msg: Messages.Message = arg;
  let reply: Messages.Message = null;
  
  if (LOG_FINE) {
    log("Main IPC incoming: ",msg);
  }
  
  switch(msg.type) {
    case Messages.MessageType.CONFIG_REQUEST:
      reply = handleConfigRequest(<Messages.ConfigRequestMessage> msg);
      break;
      
    case Messages.MessageType.FRAME_DATA_REQUEST:
      log('Messages.MessageType.FRAME_DATA_REQUEST is not implemented.');
      break;
      
    case Messages.MessageType.THEME_LIST_REQUEST:
      reply = handleThemeListRequest(<Messages.ThemeListRequestMessage> msg);
      break;
      
    case Messages.MessageType.THEME_CONTENTS_REQUEST:
      sendThemeContents(event.sender, (<Messages.ThemeContentsRequestMessage> msg).themeIdList,
        (<Messages.ThemeContentsRequestMessage> msg).cssFileList);
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
    
    default:
      break;
  }
  
  if (reply !== null) {
    if (LOG_FINE) {
      log("Replying: ", reply);
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
    log("Incoming new config: ",msg);
  }
  
  // Copy in the updated fields.
  const incomingConfig = msg.config;
  const newConfig = _.cloneDeep(config);
  newConfig.showTips = incomingConfig.showTips;
  newConfig.tipTimestamp = incomingConfig.tipTimestamp;
  newConfig.tipCounter = incomingConfig.tipCounter;
  newConfig.blinkingCursor = incomingConfig.blinkingCursor;
  newConfig.scrollbackLines = incomingConfig.scrollbackLines;
  newConfig.terminalFontSize = incomingConfig.terminalFontSize;
  newConfig.terminalFont = incomingConfig.terminalFont;
  newConfig.commandLineActions = incomingConfig.commandLineActions;
  newConfig.themeSyntax = incomingConfig.themeSyntax;
  newConfig.themeTerminal = incomingConfig.themeTerminal;
  newConfig.themeGUI = incomingConfig.themeGUI;
  newConfig.keyBindingsFilename = incomingConfig.keyBindingsFilename;
  newConfig.showTitleBar = incomingConfig.showTitleBar;

  setConfig(newConfig);

  const newConfigMsg: Messages.ConfigMessage = {
    type: Messages.MessageType.CONFIG,
    config: getFullConfig()
  };
  
  BrowserWindow.getAllWindows().forEach( (window) => {
    if (LOG_FINE) {
      log("Transmitting new config to window ", window.id);
    }
    window.webContents.send(Messages.CHANNEL_NAME, newConfigMsg);
  });
}

function handleThemeListRequest(msg: Messages.ThemeListRequestMessage): Messages.ThemeListMessage {
  const reply: Messages.ThemeListMessage = { type: Messages.MessageType.THEME_LIST, themeInfo: getThemes() };
  return reply;
}

function sendThemeContents(webContents: Electron.WebContents, themeIdList: string[],
    cssFileList: ThemeTypes.CssFile[]): void {

  const globalVariables = new Map<string, number|boolean|string>();
  globalVariables.set("extraterm-titlebar-visible", titleBarVisible);
  globalVariables.set("extraterm-platform", process.platform);

  themeManager.renderThemes(themeIdList, cssFileList, globalVariables)
    .then( (renderResult) => {
      const themeContents = renderResult.themeContents;
      const msg: Messages.ThemeContentsMessage = { type: Messages.MessageType.THEME_CONTENTS,
        themeIdList: themeIdList,
        cssFileList: cssFileList,
        themeContents: themeContents,
        success: true,
        errorMessage: null
      };
      webContents.send(Messages.CHANNEL_NAME, msg);
    })
    .catch( (err: Error) => {
      const msg: Messages.ThemeContentsMessage = { type: Messages.MessageType.THEME_CONTENTS, 
        themeIdList: themeIdList,
        cssFileList: cssFileList,
        themeContents: null,
        success: false,
        errorMessage: err.message
      };
      webContents.send(Messages.CHANNEL_NAME, msg);      
    });
}

//-------------------------------------------------------------------------
//
//  ######  ####### #     # 
//  #     #    #     #   #  
//  #     #    #      # #   
//  ######     #       #    
//  #          #       #    
//  #          #       #    
//  #          #       #    
//
//-------------------------------------------------------------------------

let ptyCounter = 0;
interface PtyTuple {
  windowId: number;
  ptyTerm: Pty;
  outputBufferSize: number; // The number of characters we are allowed to send.
  outputPaused: boolean;    // True if the term's output is paused.
};

const ptyMap: Map<number, PtyTuple> = new Map<number, PtyTuple>();

function createPty(sender: Electron.WebContents, file: string, args: string[], env: EnvironmentMap,
    cols: number, rows: number): number {
    
  const ptyEnv = _.clone(env);
  ptyEnv["TERM"] = 'xterm';

  const term = ptyConnector.spawn(file, args, {
      name: 'xterm',
      cols: cols,
      rows: rows,
  //    cwd: process.env.HOME,
      env: ptyEnv } );

  ptyCounter++;
  const ptyId = ptyCounter;
  const ptyTup = { windowId: BrowserWindow.fromWebContents(sender).id, ptyTerm: term, outputBufferSize: 0, outputPaused: true };
  ptyMap.set(ptyId, ptyTup);
  
  term.onData( (data: string) => {
    if (LOG_FINE) {
      log("pty process got data for ptyID="+ptyId);
      logJSData(data);
    }
    const msg: Messages.PtyOutput = { type: Messages.MessageType.PTY_OUTPUT, id: ptyId, data: data };
    sender.send(Messages.CHANNEL_NAME, msg);
  });

  term.onExit( () => {
    if (LOG_FINE) {
      log("pty process exited.");
    }
    const msg: Messages.PtyClose = { type: Messages.MessageType.PTY_CLOSE, id: ptyId };
    sender.send(Messages.CHANNEL_NAME, msg);
    
    term.destroy();
    ptyMap.delete(ptyId);
  });

  return ptyId;
}

function handlePtyCreate(sender: Electron.WebContents, msg: Messages.CreatePtyRequestMessage): Messages.CreatedPtyMessage {
  const id = createPty(sender, msg.command, msg.args, msg.env, msg.columns, msg.rows);
  const reply: Messages.CreatedPtyMessage = { type: Messages.MessageType.PTY_CREATED, id: id };
  return reply;
}

function handlePtyInput(msg: Messages.PtyInput): void {
  const ptyTerminalTuple = ptyMap.get(msg.id);
  if (ptyTerminalTuple === undefined) {
    log("handlePtyInput() WARNING: Input arrived for a terminal which doesn't exist.");
    return;
  }

  ptyTerminalTuple.ptyTerm.write(msg.data);
}

function handlePtyOutputBufferSize(msg: Messages.PtyOutputBufferSize): void {
  const ptyTerminalTuple = ptyMap.get(msg.id);
  if (ptyTerminalTuple === undefined) {
    log("handlePtyOutputBufferSize() WARNING: Input arrived for a terminal which doesn't exist.");
    return;
  }

  if (LOG_FINE) {
    log("Received Output Buffer Size message. Resuming PTY output for ptyID=" + msg.id);
  }
  ptyTerminalTuple.ptyTerm.permittedDataSize(msg.size);
}

function handlePtyResize(msg: Messages.PtyResize): void {
  const ptyTerminalTuple = ptyMap.get(msg.id);
  if (ptyTerminalTuple === undefined) {
    log("handlePtyResize() WARNING: Input arrived for a terminal which doesn't exist.");
    return;
  }
  ptyTerminalTuple.ptyTerm.resize(msg.columns, msg.rows);  
}

function handlePtyCloseRequest(msg: Messages.PtyCloseRequest): void {
  const ptyTerminalTuple = ptyMap.get(msg.id);
  if (ptyTerminalTuple === undefined) {
    log("handlePtyCloseRequest() WARNING: Input arrived for a terminal which doesn't exist.");
    return;
  }
  ptyTerminalTuple.ptyTerm.destroy();
  ptyMap.delete(msg.id);
}

function cleanUpPtyWindow(window: Electron.BrowserWindow): void {
  const keys = [...ptyMap.keys()];
  for (const tup of keys) {
    if (tup[1].windowId === window.id) {
      tup[1].ptyTerm.destroy();
      ptyMap.delete(tup[0]);
    }
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

main();

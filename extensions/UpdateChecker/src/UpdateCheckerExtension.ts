
/*
 * Copyright 2023 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { ExtensionContext, Logger, SettingsTab, Terminal } from "@extraterm/extraterm-extension-api";
import * as https from "node:https";
import { Banner } from "./Banner.js";
import { Config } from "./Config.js";
import { UpdateCheckerSettingsPage } from "./UpdateCheckerSettingsPage.js";


let log: Logger = null;
let context: ExtensionContext = null;

let config: Config = null;
let timerId: NodeJS.Timeout = null;

const ONE_DAY_MILLIS = 24 * 60 * 60 * 1000;
const RELEASES_URL = "https://extraterm.org/releases.json";
const BASE_VERSION_URL = "https://extraterm.org/";

let settingsPage: UpdateCheckerSettingsPage = null;


interface ReleaseInfo {
  date: string;
  url: string;
  version: string;
  title: string;
}

export function activate(_context: ExtensionContext): any {
  log = _context.logger;
  context = _context;

  context.commands.registerCommand("update-checker:check", checkCommand);
  context.settings.registerSettingsTab("update-checker-config", configTab);

  loadConfig();
  if ( ! config.requestedPermission) {
    context.terminals.onDidCreateTerminal(handleNewTerminal);
  }
  setUpPoll();
}

function loadConfig(): void {
  config = context.configuration.get();
  if (config == null) {
    config = {
      checkOn: false,
      requestedPermission: false,
      lastCheck: 0,
      newVersion: null,
      newUrl: null,
      lastDismissedVersion: null
    };
  }
}

async function handleNewTerminal(newTerminal: Terminal): Promise<void> {
  if (config.requestedPermission) {
    return;
  }

  const questionHtml = newTerminal.tab.window.style.createHtmlIcon("fa-question-circle");
  const result = await newTerminal.tab.showDialog({
    message: `${newTerminal.tab.window.style.htmlStyleTag}
<h2>${questionHtml} May Extraterm regularly check for updates?</h2>
<p>No personal information, profiles, tracking IDs, cookies, or other codes are sent when checking for updates.</p>
`,
    isHtml: true,
    buttonOptions: [
      { label: "Yes", type: "success" },
      "No"
    ]
  });

  config.requestedPermission = true;
  config.checkOn = result === 0;
  context.configuration.set(config);
}

function setUpPoll(): void {
  timerId = setTimeout(pollAlarm, 60 * 1000 * 10);
}

function pollAlarm(): void {
  if (config.checkOn) {
    const deadline = config.lastCheck + ONE_DAY_MILLIS;
    const now = Date.now();
    if (now > deadline) {
      checkNow();
    }
  }
  setUpPoll();
}

let isFetchingReleaseJSON = false;
function setIsFetchingReleaseJSON(isFetching: boolean): void {
  isFetchingReleaseJSON = isFetching;
  if (settingsPage != null) {
    settingsPage.setIsFetchingReleaseJSON(isFetching);
  }
}

async function checkCommand(): Promise<void> {
  // The user requested a check so flush the old data and make sure a new banner will appear.
  config.lastDismissedVersion = null;
  config.newVersion = null;
  config.newUrl = null;
  await checkNow();
  context.commands.executeCommand("extraterm:window.openSettings", {
    select: "update-checker:update-checker-config"
  });
}

async function checkNow(): Promise<void> {
  config.lastCheck = Date.now();
  context.configuration.set(config);

  setIsFetchingReleaseJSON(true);
  try {
    const jsonBody = await fetchUrl(RELEASES_URL);
    const releaseData: ReleaseInfo[] = JSON.parse(jsonBody);

    const latestVersion = releaseData[releaseData.length-1];
    if (latestVersion.version !== context.application.version) {
      config.newUrl = latestVersion.url;
      config.newVersion = latestVersion.version;

      context.configuration.set(config);

      if (settingsPage != null) {
        settingsPage.configChanged();
      }
      showBanner();
    }
  } catch(e) {
    log.warn(e);
  }
  setIsFetchingReleaseJSON(false);
}

function fetchUrl(url: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    https.get(url, (res) => {
      const { statusCode } = res;
      if (statusCode !== 200) {
        log.warn(`Request to ${url} failed. Status Code: ${statusCode}`);
        res.resume();
        return;
      }

      res.setEncoding("utf8");
      let rawData = "";
      res.on("data", (chunk) => {
        rawData += chunk;
      });
      res.on("end", () => {
        try {
          resolve(rawData);
        } catch (e) {
          log.warn(e.message);
          reject(e);
        }
      });
    }).on("error", (e) => {
      log.warn(`Got error: ${e.message}`);
    });
  });
}

function configTab(extensionTab: SettingsTab): void {
  settingsPage = new UpdateCheckerSettingsPage(extensionTab, config, log);
  settingsPage.onConfigChanged((config) => {
    context.configuration.set(config);
  });
  settingsPage.onCheckNow(()=> {
    checkCommand();
  });
  settingsPage.setIsFetchingReleaseJSON(isFetchingReleaseJSON);
}

let banner: Banner = null;

function showBanner(): void {
  if (context.activeTerminal == null || config.newVersion === config.lastDismissedVersion) {
    return;
  }

  if (banner != null) {
    banner.updateConfig();
    return;
  }

  banner = new Banner(context.activeTerminal, config);
  banner.onDismissClicked(() => {
    config.lastDismissedVersion = config.newVersion;
    context.configuration.set(config);
    banner.close();
  });
  banner.onViewClicked(() => {
    context.application.openExternal(BASE_VERSION_URL + config.newUrl );
  });
  banner.open();
}

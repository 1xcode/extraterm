/*
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as _ from 'lodash';
import * as fse from 'fs-extra';
import * as constants from 'constants';
import * as child_process from 'child_process';

import {ExtensionContext, Logger, SessionConfiguration} from '@extraterm/extraterm-extension-api';
import {WslProxySessionEditorUi} from './WslProxySessionEditorUi';


interface WslProxySessionConfiguration extends SessionConfiguration {
  useDefaultShell?: boolean;
  shell?: string;
  distribution?: string;
}

let log: Logger = null;

export function getWslProxySessionEditorClass(context: ExtensionContext): any {
  log = context.logger;

  log.info("WslProxySessionEditorExtension activate");
  readEtcShellsSpawn();
  readDistributionsSpawn();

  class WslProxySessionEditor extends context.window.extensionSessionEditorBaseConstructor {
    private _ui: WslProxySessionEditorUi = null;
    private _debouncedDataChanged: ()=> void = null;

    created(): void {
      super.created();

      this._debouncedDataChanged = _.debounce(this._dataChanged.bind(this), 500);

      this._ui = new WslProxySessionEditorUi();
      const component = this._ui.$mount();
      this._ui.$watch('$data', this._debouncedDataChanged.bind(this), { deep: true, immediate: false } );

      const config = <WslProxySessionConfiguration> this.getSessionConfiguration();
      this._loadConfig(config);

      this.getContainerElement().appendChild(component.$el);
    }

    setSessionConfiguration(config: SessionConfiguration): void {
      super.setSessionConfiguration(config);
      this._loadConfig(config);
    }

    _loadConfig(config: WslProxySessionConfiguration): void {
      let fixedConfig = config;
      if (config.shell == null) {
        fixedConfig = {
          uuid: config.uuid,
          name: config.name,
          useDefaultShell: true,
          shell: "",
          args: "",
          initialDirectory: "",
          distribution: "",
        };
      }

      this._ui.name = fixedConfig.name;
      this._ui.useDefaultShell = fixedConfig.useDefaultShell ? 1 :0;
      this._ui.shell = fixedConfig.shell;
      this._ui.etcShells = [...etcShells];
      this._ui.distribution = fixedConfig.distribution == null ? "" : fixedConfig.distribution;
      this._ui.distributions = [...distributions];
      this._ui.args = fixedConfig.args;
      this._ui.initialDirectory = fixedConfig.initialDirectory || "";
    }

    _dataChanged(): void {
      const changes = {
        name: this._ui.name,
        useDefaultShell: this._ui.useDefaultShell === 1,
        shell: this._ui.shell,
        args: this._ui.args,
        initialDirectory: this._ui.initialDirectory,
        distribution: this._ui.distribution,
      };
      this.updateSessionConfiguration(changes);
    }
  }

  return WslProxySessionEditor;
}

let etcShells: string[] = [];

function readEtcShellsSpawn(): void {
  spawnWsl(["cat", "/etc/shells"], "utf8", splitEtcShells);
}

function spawnWsl(parameters: string[], encoding: string, onExit: (text: string) => void): void {
  // For some reason child_process.exec() doesn't want to work properly on Windows.
  // spawn still does though, but it is a bit more fiddly to use.

  const wslProcess = child_process.spawn("wsl.exe", parameters, {shell: false, stdio: 'pipe'});

  let text = "";
  wslProcess.stdout.on("data", data => {
log.debug("data:", typeof(data)    );
    text += data.toString(encoding);
  });
  wslProcess.on("exit", (msg) => {
    onExit(text);
  });
  wslProcess.stdin.end();
}

function splitEtcShells(shellText: string): void {
  const lines = shellText.split("\n");
  const result: string[] = [];
  for (const line of lines) {
    if ( ! line.startsWith("#") && line.trim() !== "") {
      result.push(line);
    }
  }
  etcShells = result;
}

let distributions: string[] = [];

function readDistributionsSpawn(): void {
  spawnWsl(["--list"], "utf16le", splitDistributions);
}

function splitDistributions(text: string): void {
  const lines = text.split("\n");
  const result: string[] = [""];
  for (const line of lines.slice(1)) {
    if (line.trim() === "") {
      continue;
    }
    const parts = line.split(" ");
    result.push(parts[0].trim());
  }
  distributions = result;
}

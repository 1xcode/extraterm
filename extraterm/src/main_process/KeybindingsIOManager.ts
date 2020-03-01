/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as fs from 'fs';
import * as path from 'path';

import {Logger, getLogger, log} from "extraterm-logging";

import { MainExtensionManager } from './extension/MainExtensionManager';
import { KeybindingsInfo } from '../Config';
import { KeybindingsFile } from '../keybindings/KeybindingsFile';
import { EventEmitter } from '../utils/EventEmitter';
import { Event } from '@extraterm/extraterm-extension-api';


export class KeybindingsIOManager {

  private _log: Logger = null;
  private _keybindingsList: KeybindingsInfo[] = [];

  private _onUpdateEventEmitter = new EventEmitter<string>();
  onUpdate: Event<string>;

  constructor(private _userPath: string, private _mainExtensionManager: MainExtensionManager) {
    this._log = getLogger("KeybindingsIOManager", this);
    this.onUpdate = this._onUpdateEventEmitter.event;
  }

  scan(): void {
    this._keybindingsList = this._scanAll();

    for (const x of this._keybindingsList) {
      this._log.debug(`{filename: ${x.filename}, path: ${x.path}, name: ${x.name}}`);
    }
  }

  private _scanAll(): KeybindingsInfo[] {
    const userInfoList = this._scanKeybindingsDirectory(this._userPath, false);
    const extensionInfoLists = this._getKeybindingsExtensionPaths().map(p => this._scanKeybindingsDirectory(p, true));
    const infoLists = [userInfoList, ...extensionInfoLists];
    return infoLists.reduce( (list, accu) => [...list, ...accu], []);
  }

  private _getKeybindingsExtensionPaths(): string [] {
    const paths: string[] = [];
    for (const extension of this._mainExtensionManager.getExtensionMetadata()) {
      for (const st of extension.contributes.keybindings) {
        paths.push(path.join(extension.path, st.path));
      }
    }
    return paths;
  }

  private _scanKeybindingsDirectory(directory: string, readOnly: boolean): KeybindingsInfo[] {
    const result: KeybindingsInfo[] = [];
    if (fs.existsSync(directory)) {
      const contents = fs.readdirSync(directory);
      contents.forEach( (item) => {
        if (item.endsWith(".json")) {
          const name = item.slice(0, -5);
          const info: KeybindingsInfo = {
            name: name,
            filename: item,
            readOnly,
            path: directory
          };
          result.push(info);
        }
      });
    }
    return result;
  }

  getInfoList(): KeybindingsInfo[] {
    return this._keybindingsList;
  }

  hasKeybindingsName(name: string): boolean {
    return this._getInfoByName(name) != null;
  }

  private _getInfoByName(name: string): KeybindingsInfo {
    for (const info of this._keybindingsList) {
      if (info.name === name) {
        return info;
      }
    }
    return null;
  }

  readKeybindingsFileByName(name: string): KeybindingsFile {
    const info = this._getInfoByName(name);
    const fullPath = path.join(info.path, info.filename);
    const keyBindingJsonString = fs.readFileSync(fullPath, { encoding: "UTF8" } );
    let keyBindingsJSON: KeybindingsFile = JSON.parse(keyBindingJsonString);

    if (keyBindingsJSON == null) {
      keyBindingsJSON = { name: "", bindings: [] };
    }
    if (keyBindingsJSON.bindings == null) {
      keyBindingsJSON.bindings = [];
    }
    return keyBindingsJSON;
  }

  copyKeybindings(sourceName: string, destName: string): boolean {
    const sourceInfo = this._getInfoByName(sourceName);
    if (sourceInfo == null) {
      this._log.warn(`Unable to find keybindings file '${sourceName}'`);
      return false;
    }

    const sourcePath = path.join(sourceInfo.path, sourceInfo.filename);
    const destPath = path.join(this._userPath, destName + ".json");
    try {
      const contents = fs.readFileSync(sourcePath);
      fs.writeFileSync(destPath, contents);
    } catch(err) {
      this._log.warn(`Unable to copy '${sourcePath}' to '${destPath}'. Error: ${err.message}`);
      return false;
    }

    this.scan();
    return true;
  }

  updateKeybindings(name: string, data: KeybindingsFile): boolean {
    const info = this._getInfoByName(name);
    if (info == null) {
      this._log.warn(`Unable to find keybindings file '${name}'`);
      return false;
    }

    const destPath = path.join(info.path, info.filename);
    try {
      fs.writeFileSync(destPath, JSON.stringify(data, null, "  "));
    } catch(err) {
      this._log.warn(`Unable to update '${destPath}'. Error: ${err.message}`);
      return false;
    }

    this._onUpdateEventEmitter.fire(name);
    return true;
  }

  deleteKeybindings(targetName: string): boolean {
    const targetInfo = this._getInfoByName(targetName);
    if (targetInfo == null) {
      this._log.warn(`Unable to find keybindings file '${targetName}'`);
      return false;
    }

    const targetPath = path.join(targetInfo.path, targetInfo.filename);
    try {
      fs.unlinkSync(targetPath);
    } catch(err) {
      this._log.warn(`Unable to delete '${targetPath}'. Error: ${err.message}`);
      return false;
    }

    this.scan();
    return true;
  }
}

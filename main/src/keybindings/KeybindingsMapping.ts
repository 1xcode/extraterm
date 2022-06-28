/*
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as _ from 'lodash-es';
import { Logger, getLogger, log } from "extraterm-logging";
import { KeybindingsSet, KeybindingsBinding } from './KeybindingsTypes';

const isDarwin = process.platform === "darwin";

export interface KeyStrokeOptions {
  altKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
  plainKey: string;
};


// Defines a single key stroke which the user can press using one or a more keys.
export class KeyStroke {
  readonly altKey: boolean;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;
  readonly plainKey: string;
  readonly plainKeyLowercase: string;
  private _humanReadableString: string = null;
  readonly isComposing: boolean = false;

  constructor(options: KeyStrokeOptions) {
    this.altKey = options.altKey;
    this.ctrlKey = options.ctrlKey;
    this.metaKey = options.metaKey;
    this.shiftKey = options.shiftKey;
    this.plainKey = options.plainKey;
    this.plainKeyLowercase = options.plainKey.toLowerCase();
  }

  static parseConfigString(keyStrokeString: string): KeyStroke {
    return parseConfigKeyStrokeString((options: KeyStrokeOptions) => new KeyStroke(options), keyStrokeString);
  }

  equals(other: KeyStroke): boolean {
    if (other == null) {
      return false;
    }
    return this.altKey === other.altKey &&
      this.ctrlKey === other.ctrlKey &&
      this.metaKey === other.metaKey &&
      this.shiftKey === other.shiftKey &&
      this.plainKeyLowercase === other.plainKeyLowercase;
  }

  formatHumanReadable(): string {
    if (this._humanReadableString != null) {
      return this._humanReadableString;
    }

    const parts: string[] = [];
    if (isDarwin) {
      if (this.ctrlKey) {
        parts.push("^");
      }
      if (this.altKey) {
        parts.push("\u2325");
      }
      if (this.shiftKey) {
        parts.push("\u21E7");
      }
      if (this.metaKey) {
        parts.push("\u2318"); // Mac style 'pretzel' symbol
      }
    } else {
      if (this.ctrlKey) {
        parts.push("Ctrl");
      }
      if (this.metaKey) {
        parts.push("\u2318"); // Mac style 'pretzel' symbol
      }
      if (this.altKey) {
        parts.push("Alt");
      }
      if (this.shiftKey) {
        parts.push("Shift");
      }
    }

    if (eventKeyToHumanMapping[this.plainKey.toLowerCase()] !== undefined) {
      parts.push(eventKeyToHumanMapping[this.plainKey.toLowerCase()]);
    } else {
      parts.push(_.capitalize(this.plainKey));
    }

    this._humanReadableString = parts.join(isDarwin ? "" : "+");
    return this._humanReadableString;
  }

  hashString(): string {
    return `${mapString(this.plainKey)}:${mapBool(this.altKey)}:${mapBool(this.ctrlKey)}:${mapBool(this.metaKey)}:${mapBool(this.shiftKey)}`;
  }
}

function mapBool(b: boolean): string {
  if (b === undefined) {
    return "?";
  }
  return b ? "T" : "F";
}

function mapString(s: string): string {
  return s === undefined ? "" : s;
}

export function parseConfigKeyStrokeString<KS extends KeyStroke>(construct: (options: KeyStrokeOptions) => KS, keyStrokeString: string): KS {
  const parts = keyStrokeString.replace(/\s/g, "").split(/-/g);
  const partSet = new Set(parts.map(part => part.length !== 1 ? part.toLowerCase() : part));
  const hasShift = partSet.has("shift");
  partSet.delete("shift");
  const hasCtrl = partSet.has("ctrl");
  partSet.delete("ctrl");
  const hasAlt = partSet.has("alt");
  partSet.delete("alt");
  const hasMeta = partSet.has("meta") || partSet.has("cmd");
  partSet.delete("meta");
  partSet.delete("cmd");

  if (partSet.size !== 1) {
    return null;
  }

  const key = partSet.values().next().value;
  const keyStroke = construct({
    altKey: hasAlt,
    ctrlKey: hasCtrl,
    shiftKey: hasShift,
    metaKey: hasMeta,
    plainKey: key
  });

  return keyStroke;
}


// Maps key names as found in our configuration files to the values used by browser keyboard events.
const configNameToEventKeyMapping = {
  "Space": " ",
  "Plus": "+",
  "Minus": "-",
  "Esc": "Escape",
  "Up": "ArrowUp",
  "Down": "ArrowDown",
  "Left": "ArrowLeft",
  "Right": "ArrowRight"
};

// Maps special key names in all lower case back to mixed case.
const lowerConfigNameToEventKeyMapping = {};
for (const key in configNameToEventKeyMapping) {
  lowerConfigNameToEventKeyMapping[key.toLowerCase()] = configNameToEventKeyMapping[key];
}

const eventKeyToHumanMapping = {
  "pageup": "Page Up",
  "pagedown": "Page Down",
  "minus": "-",
  "plus": "+"
};
for (const key in configNameToEventKeyMapping) {
  eventKeyToHumanMapping[configNameToEventKeyMapping[key].toLowerCase()] = key;
}


export function configKeyNameToEventKeyName(configKeyName: string): string {
  if (lowerConfigNameToEventKeyMapping[configKeyName.toLowerCase()] !== undefined) {
    return lowerConfigNameToEventKeyMapping[configKeyName.toLowerCase()];
  } else {
    return configKeyName.length === 1 ? configKeyName : _.capitalize(configKeyName.toLowerCase());
  }
}

const eventKeyToConfigKeyMapping = new Map<string, string>();
for (const configKey in configNameToEventKeyMapping) {
  eventKeyToConfigKeyMapping.set(configNameToEventKeyMapping[configKey], configKey);
}

export function eventKeyNameToConfigKeyName(eventKeyName: string): string {
  if (eventKeyToConfigKeyMapping.has(eventKeyName)) {
    return eventKeyToConfigKeyMapping.get(eventKeyName);
  }
  return eventKeyName;
}

/**
 * Mapping from keyboard events to command strings, and command strings to
 * shortcut names.
 */
export class KeybindingsMapping<KS extends KeyStroke=KeyStroke> {

  readonly keyStrokeList: KS[] = [];
  protected _keyStrokeHashToCommandsMapping = new Map<string, KeybindingsBinding[]>();
  private _commandToKeyStrokeMap = new Map<string, KS[]>();
  private _log: Logger = null;
  private _platform: string;
  private _enabled = true;

  // FIXME remove this and the param below
  private _parseConfigKeyStrokeString: (config: string) => KS = null;

  constructor(parseConfigString: (config: string) => KS, keybindingsFile: KeybindingsSet, platform: string) {
    this._log = getLogger("KeybindingMapping", this);
    this._parseConfigKeyStrokeString = parseConfigString;
    this._platform = platform;

    this._buildIndex(keybindingsFile.bindings);
  }

  private _buildIndex(bindingsList: KeybindingsBinding[]): void {
    for (const keybinding of bindingsList) {
      const shortcutList = keybinding.keys;

      const ksList = shortcutList.map(this._parseConfigKeyStrokeString);

      for (const ks of ksList) {
        this.keyStrokeList.push(ks);
      }

      const ksHashList = ksList.map(ks => ks.hashString());

      this._setKeyStrokesForCommand(keybinding.command, ksList);

      for (const ksHash of ksHashList) {
        let list = this._keyStrokeHashToCommandsMapping.get(ksHash);
        if (list == null) {
          list = [];
          this._keyStrokeHashToCommandsMapping.set(ksHash, list);
        }
        list.push(keybinding);
      }
    }
  }

  private _setKeyStrokesForCommand(command: string, keyStrokes: KS[]): void {
    this._commandToKeyStrokeMap.set(command, keyStrokes);
  }

  isEnabled(): boolean {
    return this._enabled;
  }

  setEnabled(enabled: boolean): void {
    this._enabled = enabled;
  }

  equals(other:  KeybindingsMapping<KS>): boolean {
    if (other == null) {
      return false;
    }
    if (other === this) {
      return true;
    }

    if (other._platform !== this._platform) {
      return false;
    }

    const myBindings = [...this._keyStrokeHashToCommandsMapping.keys()];
    const otherBindings = [...other._keyStrokeHashToCommandsMapping.keys()];
    myBindings.sort();
    otherBindings.sort();

    return _.isEqual(myBindings, otherBindings);
  }

  getKeyStrokesForCommand(command: string): KS[] {
    return this._commandToKeyStrokeMap.get(command) || [];
  }
}

/*
 * Copyright 2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

// Key bindings tab

import * as _ from 'lodash';
import {WebComponent} from 'extraterm-web-component-decorators';
import {ViewerMetadata, Disposable} from 'extraterm-extension-api';

import * as ThemeTypes from '../../theme/Theme';
import {ViewerElement} from '../viewers/ViewerElement';
import {ThemeableElementBase} from '../ThemeableElementBase';
import * as keybindingmanager from './KeyBindingManager';
type KeyBindingManager = keybindingmanager.KeyBindingManager;
import * as ViewerElementTypes from '../viewers/ViewerElementTypes';
import Vue from 'vue';
import * as DomUtils from '../DomUtils';
import * as config from '../../Config';
type Config = config.Config;
type ConfigManager = config.ConfigDistributor;

import * as GeneralEvents from '../GeneralEvents';
import log from '../../logging/LogDecorator';

const humanText = require('./keybindingstext.json');

const ID_SELECTOR = "ID_SELECTOR";
const ID_KEY_BINDINGS = "ID_KEY_BINDINGS";
const CLASS_KEYCAP = "CLASS_KEYCAP";

function contexts(): string[] {
  return humanText.contexts;
}

function commandName(commandCode: string): string {
  const str = humanText.commands[commandCode];
  return str || commandCode;
}

function contextHeading(contextName: string): string {
  const str = humanText.contextNames[contextName];
  return str || contextName;
}

function formatShortcut(code: string): string {
  if (process.platform !== "darwin") {
    return code;
  }
  let parts = code.split(/\+/g);
  parts = parts.map( (p) => {
    switch (p) {
      case 'Cmd':
        return '\u2318';
      case 'Shift':
        return '\u21E7';
      case 'Alt':
        return '\u2325';
      case 'Ctrl':
        return '^';
      default:
        return p;
    }
  } );
  return parts.join("");
}

interface ModelData {
  selectedKeyBindings: string;
  keyBindingsFiles: config.KeyBindingInfo[];
  keyBindingsContextsStamp: any;
}

/**
 * The Extraterm Key Bindings tab.
 */
@WebComponent({tag: "et-keybindings-tab"})
export class EtKeyBindingsTab extends ViewerElement implements config.AcceptsConfigDistributor,
    keybindingmanager.AcceptsKeyBindingManager {
  
  static TAG_NAME = "ET-KEYBINDINGS-TAB";
  
  private _configManager: ConfigManager = null;
  private _keyBindingManager: KeyBindingManager = null;
  private _data: ModelData = null;
  private _configManagerDisposable: Disposable = null;

  constructor() {
    super();
    this._data = {
      selectedKeyBindings: "",
      keyBindingsFiles: [],
      keyBindingsContextsStamp: Date.now()
    };
  }

  getMetadata(): ViewerMetadata {
    const metadata = super.getMetadata();
    metadata.title = "Key Bindings";
    metadata.icon = "keyboard-o";
    return metadata;
  }

  connectedCallback(): void {
    super.connectedCallback();
    if (DomUtils.getShadowRoot(this) == null) {

      const shadow = this.attachShadow({ mode: 'open', delegatesFocus: true });
      const themeStyle = document.createElement('style');
      themeStyle.id = ThemeableElementBase.ID_THEME;
      shadow.appendChild(themeStyle);
      
      const vueDivContainer = document.createElement('div');
      vueDivContainer.id = ID_KEY_BINDINGS;
      shadow.appendChild(vueDivContainer);
      
      const elementThis = this;
      const vm = new Vue({
        data: this._data,
        template: 
`<div id="${ID_KEY_BINDINGS}">
  <h1>Key Bindings</h1>
  
  <div className=''>
    <div class="form-horizontal">
      <div class="form-group">
        <label for="theme-terminal" class="col-sm-2 control-label">Key bindings style:</label>
        <div class="col-sm-3">
          <select class="form-control" id="keybindings-style" v-model="selectedKeyBindings">
            <option v-for="option in keyBindingsFiles" v-bind:value="option.filename">
              {{ option.name }}
            </option>
          </select>
        </div>
      </div>
    </div>
  </div>
    
  <div v-html="summary"></div>
</div>
`,
        computed: {
          summary: function(this: ModelData) {
            const foo = this.keyBindingsContextsStamp;
            return formatKeyBindingsPage(elementThis._keyBindingManager.getKeyBindingContexts());
          }
        }
      });
      vm.$mount(vueDivContainer);
      vm.$watch('$data', this._dataChanged.bind(this), { deep: true, immediate: false } );
      
      this.updateThemeCss();
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this._configManagerDisposable !== null) {
      this._configManagerDisposable.dispose();
      this._configManagerDisposable = null;
    }
    if (this._keyBindingManager !== null) {
      this._keyBindingManager.unregisterChangeListener(this);
    }
  }

  setKeyBindingManager(newKeyBindingManager: KeyBindingManager): void {
    if (this._keyBindingManager !== null) {
      this._keyBindingManager.unregisterChangeListener(this);
    }
    
    this._keyBindingManager = newKeyBindingManager;
    if (this._keyBindingManager !== null) {
      this._keyBindingManager.registerChangeListener(this, this._onKeyBindingChange.bind(this));
    }
  }
  
  focus(): void {
    // util.getShadowId(this, ID_CONTAINER).focus();
  }

  hasFocus(): boolean {
    return false;
  }
  
  setConfigDistributor(configManager: ConfigManager): void {
    this._configManager = configManager;
    this._configManagerDisposable = this._configManager.onChange(() => {
      this._setConfig(configManager.getConfig());
    });
    this._setConfig(configManager.getConfig());
  }

  private _onKeyBindingChange(): void {
    this._data.keyBindingsContextsStamp = Date.now();
  }

  private _setConfig(config: Config): void {
    if (this._data.keyBindingsFiles.length !== config.systemConfig.keyBindingsFiles.length) {
      this._data.keyBindingsFiles = config.systemConfig.keyBindingsFiles;
    }
    if (this._data.selectedKeyBindings !== config.keyBindingsFilename) {
      this._data.selectedKeyBindings = config.keyBindingsFilename;
    }
  }
  
  protected _themeCssFiles(): ThemeTypes.CssFile[] {
    return [ThemeTypes.CssFile.GUI_CONTROLS, ThemeTypes.CssFile.KEY_BINDINGS_TAB];
  }
  
  private _dataChanged(newVal: ModelData): void {
    const newConfig = _.cloneDeep(this._configManager.getConfig());
    if (newConfig.keyBindingsFilename !== newVal.selectedKeyBindings) {
      newConfig.keyBindingsFilename = newVal.selectedKeyBindings;
      this._configManager.setConfig(newConfig);
    }
  }
}

function formatKeyBindingsPage(keyBindingContexts: keybindingmanager.KeyBindingContexts): string {
  return contexts()
    .map( (contextName) => {
        return `<h2>${contextHeading(contextName)}</h2>` +  formatKeyBindingsMapping(keyBindingContexts.context(contextName));
      } ).join("");
}

function formatKeyBindingsMapping(context: keybindingmanager.KeyBindingMapping): string {
  const bindings = _.clone(context.keyBindings);
  bindings.sort( (a,b): number => {
    const nameA = commandName(a.command);
    const nameB = commandName(b.command);
    return nameA < nameB ? -1 : ( nameA > nameB ? 1 : 0);
  });
  
  return `<table class='table'>
    <tbody>
    <tr>
      <th class="col-md-7">Command</th>
      <th class="col-md-2">Shortcut</th>
      <th class="col-md-3">Code</th>
    </tr>` +
      bindings.map( (binding) => `<tr>
        <td class="col-md-7">${commandName(binding.command)}</td>
        <td class="col-md-2"><div class='${CLASS_KEYCAP}'><span>${formatShortcut(binding.shortcut)}</span></div></td>
        <td class="col-md-3">${binding.command}</td></tr>`).join("\n") +
    "</tbody></table>";
}

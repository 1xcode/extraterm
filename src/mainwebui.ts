/**
 * Copyright 2015 Simon Edwards <simon@simonzone.com>
 */
import util = require('./gui/util');
import Config = require('config');
import TabWidget = require('./gui/tabwidget');
import resourceLoader = require('./resourceloader');
import EtTerminal = require('./terminal');
import CbTab = require('./gui/tab');
import webipc = require('./webipc');
import Messages = require('./windowmessages');
import path = require('path');

const ID = "ExtratermMainWebUITemplate";

const ID_CONTAINER = "container";
const ID_REST_DIV = "rest";

let registered = false;

interface TerminalTab {
  id: number;
  terminalDiv: HTMLDivElement;
  cbTab: CbTab;
  terminal: EtTerminal;
  ptyId: number;
};

let terminalIdCounter = 1;

/**
 * Top level UI component for a normal terminal window
 *
 */
class ExtratermMainWebUI extends HTMLElement {
  
  //-----------------------------------------------------------------------
  // Statics
  
  static init(): void {
    TabWidget.init();
    EtTerminal.init();
    
    if (registered === false) {
      window.document.registerElement(ExtratermMainWebUI.TAG_NAME, {prototype: ExtratermMainWebUI.prototype});
      registered = true;
    }
  }
  
  static TAG_NAME = 'extraterm-mainwebui';
  
  static EVENT_TAB_OPENED = 'tab-opened';
  
  static EVENT_TAB_CLOSED = 'tab-closed';
  
  //-----------------------------------------------------------------------
  // WARNING: Fields like this will not be initialised automatically. See _initProperties().
  private _terminalTabs: TerminalTab[];
  
  private _config: Config;
  
  private _initProperties(): void {
    this._terminalTabs = [];
  }
  //-----------------------------------------------------------------------
  
  /**
   * Custom element API call back.
   */
  createdCallback(): void {
    this._initProperties(); // Initialise our properties. The constructor was not called.
    
    var shadow = util.createShadowRoot(this);
    var clone = this._createClone();
    shadow.appendChild(clone);
    
    this._setupIpc();
    
    this.newTerminalTab();
  }

  destroy(): void {
  }

  set config(config: Config) {
    this._config = config;
    this._terminalTabs.forEach( (tab) => {
      this._setConfigOnTerminal(tab.terminal, config);
    });    
  }
  
  get tabCount(): number {
    return this._terminalTabs.length;
  }
  
  /**
   * Create a new terminal tab
   *
   * @return ID of the new terminal.
   */
  newTerminalTab(): number {
    const newId = terminalIdCounter;
    terminalIdCounter++;
    const newCbTab = <CbTab> document.createElement(CbTab.TAG_NAME);
    newCbTab.innerHTML = "" + newId;
    
    const newDiv = document.createElement('div');
    newDiv.classList.add('terminal_holder');
    
    const newTerminal = <EtTerminal> document.createElement(EtTerminal.TAG_NAME);
    
    newDiv.appendChild(newTerminal);
    const terminalEntry = { id: newId, terminalDiv: newDiv, cbTab: newCbTab, terminal: newTerminal,
      ptyId: null };
    this._terminalTabs.push(terminalEntry);
    
    const restDiv = this._getById(ID_REST_DIV);
    const containerDiv = this._getById(ID_CONTAINER);
    containerDiv.insertBefore(newCbTab, restDiv);
    containerDiv.insertBefore(newDiv, restDiv);
    
    newTerminal.addEventListener(EtTerminal.USER_INPUT_EVENT, (e) => {
      if (terminalEntry.ptyId !== null) {
        webipc.ptyInput(terminalEntry.ptyId, (<any> e).detail.data);
      }
    });
    
    newTerminal.addEventListener(EtTerminal.TERMINAL_RESIZE_EVENT, (e) => {
      if (terminalEntry.ptyId !== null) {
        webipc.ptyResize(terminalEntry.ptyId, (<any> e).detail.columns, (<any> e).detail.rows);
      }      
    });

    webipc.requestPtyCreate("bash", [], 80, 24, process.env).then(
      (msg: Messages.CreatedPtyMessage) => {
        terminalEntry.ptyId = msg.id;
      }
    );
    
    this._sendTabOpenedEvent();
    return newId;
  }
  
  /**
   *
   */
  closeTerminalTab(terminalId: number): void {
    const matches = this._terminalTabs.filter( (p) => p.id === terminalId );
    if (matches.length === 0) {
      return;
    }
    const tup = matches[0];
    
    // Remove the tab from the list.
    this._terminalTabs = this._terminalTabs.filter( (p) => p.id !== terminalId );
    
    tup.terminalDiv.parentNode.removeChild(tup.terminalDiv);
    tup.cbTab.parentNode.removeChild(tup.cbTab);
    if (tup.ptyId !== null) {
      webipc.ptyClose(tup.ptyId);
    }
    
    this._sendTabClosedEvent();
  }

  //-----------------------------------------------------------------------
  private _sendTabOpenedEvent(): void {
    const event = new CustomEvent(ExtratermMainWebUI.EVENT_TAB_OPENED, { detail: null });
    this.dispatchEvent(event);
  }
  
  private _sendTabClosedEvent(): void {
    const event = new CustomEvent(ExtratermMainWebUI.EVENT_TAB_CLOSED, { detail: null });
    this.dispatchEvent(event);    
  }
  
  private _setConfigOnTerminal(terminal: EtTerminal, config: Config): void {
    terminal.blinkingCursor = config.blinkingCursor;
    terminal.themeCss = "file://" + path.join(config.themePath, "theme.css");
  }
    
  private _css() {
    return `
    @import '${resourceLoader.toUrl('css/font-awesome.css')}';
    @import '${resourceLoader.toUrl('css/topcoat-desktop-light.css')}';
    #${ID_CONTAINER} {
      position: absolute;
      top: 2px;
      bottom: 0;
      left: 0;
      right: 0;
    }    
    
    DIV.terminal_holder {
      height: 100%;
      width: 100%;
    }
    et-terminal {
      height: 100%;
      width: 100%;
    }
    `;
  }

  private _html(): string {
    return `<cb-tabwidget id="${ID_CONTAINER}" show-frame="false">
        <div id="${ID_REST_DIV}"><content></content></div>
      </cb-tabwidget>`;
  }
  
  //-----------------------------------------------------------------------
  // PTY and IPC handling
  //-----------------------------------------------------------------------
  private _setupIpc(): void {
    webipc.registerDefaultHandler(Messages.MessageType.PTY_OUTPUT, this._handlePtyOutput.bind(this));
    webipc.registerDefaultHandler(Messages.MessageType.PTY_CLOSE, this._handlePtyClose.bind(this));
  }
  
  private _handlePtyOutput(msg: Messages.PtyOutput): void {
    this._terminalTabs.forEach( (t) => {
      if (t.ptyId === msg.id) {
        t.terminal.write(msg.data);
      }
    });
  }
  
  private _handlePtyClose(msg: Messages.PtyClose): void {
    const matches = this._terminalTabs.filter( (t) => t.ptyId === msg.id );
    if (matches.length === 0) {
      return;
    }
    matches[0].ptyId = null;
    this.closeTerminalTab(matches[0].id);
  }
  
  //-----------------------------------------------------------------------
  
  private _createClone(): Node {
    var template: HTMLTemplate = <HTMLTemplate>window.document.getElementById(ID);
    if (template === null) {
      template = <HTMLTemplate>window.document.createElement('template');
      template.id = ID;
      template.innerHTML = "<style>" + this._css() + "</style>\n" + this._html();
      window.document.body.appendChild(template);
    }
    return window.document.importNode(template.content, true);
  }

  private _getById(id: string): HTMLElement {
    return <HTMLElement>util.getShadowRoot(this).querySelector('#'+id);
  }
}

export = ExtratermMainWebUI;

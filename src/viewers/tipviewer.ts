/**
 * Copyright 2016 Simon Edwards <simon@simonzone.com>
 */

"use strict";
import electron = require('electron');
const shell = electron.shell;
import _  = require('lodash');
import fs = require('fs');
import config = require('../config');
type ConfigManager = config.ConfigManager;

import ViewerElement = require("../viewerelement");
import ThemeableElementBase = require('../themeableelementbase');
import ThemeTypes = require('../theme');
import util = require("../gui/util");
import domutils = require("../domutils");
import ViewerElementTypes = require('../viewerelementtypes');
import virtualscrollarea = require('../virtualscrollarea');
import Logger = require('../logger');
import LogDecorator = require('../logdecorator');

type VirtualScrollable = virtualscrollarea.VirtualScrollable;
type SetterState = virtualscrollarea.SetterState;
type CursorMoveDetail = ViewerElementTypes.CursorMoveDetail;
type VisualState = ViewerElementTypes.VisualState;
const VisualState = ViewerElementTypes.VisualState;

const ID = "EtTipViewerTemplate";
const ID_CONTAINER = "ID_CONTAINER";
const ID_CONTENT = "ID_CONTENT";
const ID_CONTROLS = "ID_CONTROLS";
const ID_PREVIOUS_BUTTON = "ID_PREVIOUS_BUTTON";
const ID_NEXT_BUTTON = "ID_NEXT_BUTTON";
const ID_SHOW_TIPS = "ID_SHOW_TIPS";

const KEYBINDINGS_SELECTION_MODE = "image-viewer";

const DEBUG_SIZE = true;

const tipData = [
  `<h2><i class="fa fa-lightbulb-o" aria-hidden="true"></i> Tip 1: Shell Integration</h2>
  <p>Extraterm's shell integration unlocks many powerful features such as frames around command output, reusing command
  output and in-place editing of text. bash, zsh and fish shells are supported. To enable it in your shell session see
  <a href="https://github.com/sedwards2009/extraterm/blob/master/docs/guide.md#shell-integration">this guide</a>.</p>`,
  
  `<h2><i class="fa fa-lightbulb-o" aria-hidden="true"></i> Tip 2: Command Palette</h2>
    <p>Extraterm has a pop up Command Palette where all relevant commands can be seen, searched and executed.
    </p>`,
    
  `<h2><i class="fa fa-lightbulb-o" aria-hidden="true"></i> Tip 3: Frames</h2>`
];

const log = LogDecorator;

let registered = false;
let instanceIdCounter = 0;

class EtTipViewer extends ViewerElement implements config.AcceptsConfigManager {

  static TAG_NAME = "et-tip-viewer";
  
  static MIME_TYPE = "application/x-extraterm-tip";
  
  static init(): void {
    if (registered === false) {
      window.document.registerElement(EtTipViewer.TAG_NAME, {prototype: EtTipViewer.prototype});
      registered = true;
    }
  }
  
  /**
   * Type guard for detecting a EtTipViewer instance.
   * 
   * @param  node the node to test
   * @return      True if the node is a EtTipViewer.
   */
  static is(node: Node): node is EtTipViewer {
    return node !== null && node !== undefined && node instanceof EtTipViewer;
  }
  
  //-----------------------------------------------------------------------
  // WARNING: Fields like this will not be initialised automatically. See _initProperties().
  private _log: Logger;
  
  private _configManager: ConfigManager;
  
  private _height: number;
  
  private _tipIndex: number;
  
  private _initProperties(): void {
    this._log = new Logger(EtTipViewer.TAG_NAME);
    this._configManager = null;
    this._height = 0;
    this._tipIndex = 0;
  }

  //-----------------------------------------------------------------------
  //
  // ######                                
  // #     # #    # #####  #      #  ####  
  // #     # #    # #    # #      # #    # 
  // ######  #    # #####  #      # #      
  // #       #    # #    # #      # #      
  // #       #    # #    # #      # #    # 
  // #        ####  #####  ###### #  ####  
  //
  //-----------------------------------------------------------------------
  setConfigManager(newConfigManager: ConfigManager): void {
    if (this._configManager !== null) {
      this._configManager.unregisterChangeListener(this);
    }
    
    this._configManager = newConfigManager;
    if (this._configManager !== null) {
      this._configManager.registerChangeListener(this, this._configChanged.bind(this));
    }
  }
  
  get title(): string {
    return "Tip";
  }
  
  get awesomeIcon(): string {
    return "idea";
  }
  
  getSelectionText(): string {    
    return null;
  }

  focus(): void {
    if (domutils.getShadowRoot(this) === null) {
      return;
    }
    const containerDiv = domutils.getShadowId(this, ID_CONTAINER);
    domutils.focusWithoutScroll(containerDiv);
  }

  hasFocus(): boolean {
    const hasFocus = this === domutils.getShadowRoot(this).activeElement; // FIXME
    return hasFocus;
  }

  // VirtualScrollable
  getHeight(): number {
    return this._height;
  }
  
  // VirtualScrollable
  setDimensionsAndScroll(setterState: SetterState): void {
    if (DEBUG_SIZE) {
      this._log.debug("setDimensionsAndScroll(): ", setterState.height, setterState.heightChanged,
        setterState.yOffset, setterState.yOffsetChanged);
    }
  }

  // VirtualScrollable
  getMinHeight(): number {
    return this._height;
  }

   // VirtualScrollable
  getVirtualHeight(containerHeight: number): number {
    if (DEBUG_SIZE) {
      this._log.debug("getVirtualHeight: ", this._height);
    }
    return this._height;
  }
  
  // VirtualScrollable
  getReserveViewportHeight(containerHeight: number): number {
    if (DEBUG_SIZE) {
      this._log.debug("getReserveViewportHeight: ", 0);
    }
    return 0;
  }
  
  // From viewerelementtypes.SupportsMimeTypes
  static supportsMimeType(mimeType): boolean {
    return [EtTipViewer.MIME_TYPE].indexOf(mimeType) !== -1;
  }
  
  //-----------------------------------------------------------------------
  //
  //   #                                                         
  //   #       # ###### ######  ####  #   #  ####  #      ###### 
  //   #       # #      #      #    #  # #  #    # #      #      
  //   #       # #####  #####  #        #   #      #      #####  
  //   #       # #      #      #        #   #      #      #      
  //   #       # #      #      #    #   #   #    # #      #      
  //   ####### # #      ######  ####    #    ####  ###### ###### 
  //
  //-----------------------------------------------------------------------
  
  createdCallback(): void {
    this._initProperties();
  }
  
  attachedCallback(): void {
    super.attachedCallback();
    
    if (domutils.getShadowRoot(this) !== null) {
      return;
    }
    
    const shadow = domutils.createShadowRoot(this);
    const clone = this.createClone();
    shadow.appendChild(clone);
    this.updateThemeCss();
    
    const containerDiv = domutils.getShadowId(this, ID_CONTAINER);
    
    // Intercept link clicks and open them in an external browser.
    containerDiv.addEventListener('click', (ev: MouseEvent) => {
      const source = <HTMLElement> ev.target;
      if (source.tagName === "A") {
        ev.preventDefault();
        shell.openExternal((<HTMLAnchorElement> source).href);
      }
    });
    
    this._setTipHTML(this._getTipHTML(0));
    
    const nextButton = domutils.getShadowId(this, ID_NEXT_BUTTON);
    nextButton.addEventListener('click', () => {
      this._tipIndex = (this._tipIndex + 1) % this._getTipCount();
      this._setTipHTML(this._getTipHTML(this._tipIndex));
    });
    
    const previousButton = domutils.getShadowId(this, ID_PREVIOUS_BUTTON);
    previousButton.addEventListener('click', () => {
      this._tipIndex = (this._tipIndex + this._getTipCount() - 1) % this._getTipCount();
      this._setTipHTML(this._getTipHTML(this._tipIndex));
    });
    
    const showTipsSelect = <HTMLSelectElement> domutils.getShadowId(this, ID_SHOW_TIPS);
    showTipsSelect.value = this._configManager.getConfig().showTips;
    showTipsSelect.addEventListener('change', () => {
      const newConfig = _.cloneDeep(this._configManager.getConfig());
      newConfig.showTips = <config.ShowTipsStrEnum> showTipsSelect.value;
      this._configManager.setConfig(newConfig);
    });
  }
  
  /**
   * Custom Element 'detached' life cycle hook.
   */
  detachedCallback(): void {
    if (this._configManager !== null) {
      this._configManager.unregisterChangeListener(this);
    }
    super.detachedCallback();
  }
  
  protected _themeCssFiles(): ThemeTypes.CssFile[] {
    return [ThemeTypes.CssFile.TIP_VIEWER, ThemeTypes.CssFile.GUI_CONTROLS];
  }
  
  //-----------------------------------------------------------------------
  //
  // ######                                      
  // #     # #####  # #    #   ##   ##### ###### 
  // #     # #    # # #    #  #  #    #   #      
  // ######  #    # # #    # #    #   #   #####  
  // #       #####  # #    # ######   #   #      
  // #       #   #  #  #  #  #    #   #   #      
  // #       #    # #   ##   #    #   #   ###### 
  //
  //-----------------------------------------------------------------------
  /**
   * 
   */
  private createClone(): Node {
    let template = <HTMLTemplate>window.document.getElementById(ID);
    if (template === null) {
      template = <HTMLTemplate>window.document.createElement('template');
      template.id = ID;
      template.innerHTML = `<style id="${ThemeableElementBase.ID_THEME}">
        </style>
        <div id="${ID_CONTAINER}" tabindex="-1" class="container-fluid">
          <div id="${ID_CONTENT}"></div>
          <hr />
        <div id="${ID_CONTROLS}" class="form-inline">
          <div class="btn-group">
            <button id="${ID_PREVIOUS_BUTTON}" title="Previous Tip" class="btn btn-default btn-sm"><i class="fa fa-chevron-left" aria-hidden="true"></i></button>
            <button id="${ID_NEXT_BUTTON}" title="Next Tip" class="btn btn-default btn-sm"><i class="fa fa-chevron-right" aria-hidden="true"></i></button>
          </div>
          <div class="form-group form-group-sm">
            <label for="">Show tips: </label>
            <select id="${ID_SHOW_TIPS}" class="form-control">
              <option value="always">Everytime</option>
              <option value="daily">Daily</option>
              <option value="never">Never</option>
            </select>
          </div>
        </div>
        </div>`;

      window.document.body.appendChild(template);
    }
    
    return window.document.importNode(template.content, true);
  }
  
  private _configChanged(): void {
    const showTipsSelect = <HTMLSelectElement> domutils.getShadowId(this, ID_SHOW_TIPS);
    showTipsSelect.value = this._configManager.getConfig().showTips;  
  }

  private _setTipHTML(html: string): void {
    const contentDiv = domutils.getShadowId(this, ID_CONTENT);
    contentDiv.innerHTML = html;
    
    const containerDiv = domutils.getShadowId(this, ID_CONTAINER);
    const rect = containerDiv.getBoundingClientRect();
    this._height = rect.height;
    this._adjustHeight(this._height);
    
    this._emitVirtualResizeEvent();
  }

  private _getTipHTML(tipNumber: number): string {
    return tipData[tipNumber];
  }
  
  private _getTipCount(): number {
    return tipData.length;
  }
  
  private _emitVirtualResizeEvent(): void {
    if (DEBUG_SIZE) {
      this._log.debug("_emitVirtualResizeEvent");
    }
    const event = new CustomEvent(virtualscrollarea.EVENT_RESIZE, { bubbles: true });
    this.dispatchEvent(event);
  }

  private _adjustHeight(newHeight: number): void {
    this._height = newHeight;
    if (this.parentNode === null || domutils.getShadowRoot(this) === null) {
      return;
    }
    this.style.height = "" + newHeight + "px";
  }
}

export = EtTipViewer;

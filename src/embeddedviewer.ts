/*
 * Copyright 2014-2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import _ = require('lodash');
import resourceLoader = require('./resourceloader');
import contextmenu = require('./gui/contextmenu');
import menuitem = require('./gui/menuitem');
import checkboxmenuitem = require('./gui/checkboxmenuitem');
import domutils = require('./domutils');
import util = require('./gui/util');
import ViewerElement = require('./viewerelement');
import ViewerElementTypes = require('./viewerelementtypes');
import ThemeableElementBase = require('./themeableelementbase');
import KeyBindingManager = require('./keybindingmanager');
import virtualscrollarea = require('./virtualscrollarea');
import ThemeTypes = require('./theme');
import generalevents = require('./generalevents');

import Logger = require('./logger');
import LogDecorator = require('./logdecorator');

type VirtualScrollable = virtualscrollarea.VirtualScrollable;
type SetterState = virtualscrollarea.SetterState;
const VisualState = ViewerElementTypes.VisualState;

const log = LogDecorator;

contextmenu.init();
menuitem.init();
checkboxmenuitem.init();

const ID = "EtEmbeddedViewerTemplate";

const ID_CONTAINER = "ID_CONTAINER";
const ID_CONTEXT_MENU = "ID_CONTEXT_MENU";
const ID_HEADER = "ID_HEADER";
const ID_OUTPUT = "ID_OUTPUT";
const ID_ICON = "ID_ICON";
const ID_ICON_DIV = "ID_ICON_DIV";
const ID_COMMAND_LINE = "ID_COMMAND_LINE";
const ID_TAG_NAME = "ID_TAG_NAME";
const ID_SCROLL_ICON = "ID_SCROLL_ICON";
const ID_SCROLL_NAME = "ID_SCROLL_NAME";

// const ID_EXPAND_BUTTON = "expand_button";
// const ID_EXPAND_ICON = "expand_icon";
// const ID_EXPAND_MENU_ITEM = "expandmenuitem";
const ID_CLOSE_BUTTON = "ID_CLOSE_BUTTON";
const ID_POP_OUT_BUTTON = "ID_POP_OUT_BUTTON";
const ID_TAG_ICON = "ID_TAG_ICON";

const CLASS_SCROLLING = "scrolling";
const CLASS_NOT_SCROLLING = "not-scrolling";
const CLASS_BOTTOM_VISIBLE = "bottom-visible";
const CLASS_BOTTOM_NOT_VISIBLE = "bottom-not-visible";

let registered = false;

const DEBUG_SIZE = false;

/**
 * A visual frame which contains another element and can be shown directly inside a terminal.
 */
class EtEmbeddedViewer extends ViewerElement {
  
  /**
   * The HTML tag name of this element.
   */
  static TAG_NAME = 'ET-EMBEDDEDVIEWER';
  
  static EVENT_COPY_CLIPBOARD_REQUST = 'copy-clipboard-request';
  
  static EVENT_CLOSE_REQUEST = 'close-request';
  
  static EVENT_FRAME_POP_OUT = 'frame-pop-out';
  
  static EVENT_SCROLL_MOVE = 'scroll-move';
  
  static ATTR_FRAME_TITLE = 'frame-title';

  static ATTR_RETURN_CODE = "return-code";

  static ATTR_EXPAND = 'expand';

  static ATTR_TAG = 'tag';
  
  static ATTR_TOOL_TIP = 'tool-tip';

  static ATTR_AWESOME_ICON = 'awesome-icon';

  /**
   * Initialize the EtEmbeddedViewer class and resources.
   *
   * When EtEmbeddedViewer is imported into a render process, this static method
   * must be called before an instances may be created. This is can be safely
   * called multiple times.
   */
  static init(): void {
    if (registered === false) {
      window.document.registerElement(EtEmbeddedViewer.TAG_NAME, {prototype: EtEmbeddedViewer.prototype});
      registered = true;
    }
  }
  
  /**
   * Type guard for detecting a EtEmbeddedViewer instance.
   * 
   * @param  node the node to test
   * @return      True if the node is a EtEmbeddedViewer.
   */
  static is(node: Node): node is EtEmbeddedViewer {
    return node !== null && node !== undefined && node instanceof EtEmbeddedViewer;
  }
  
  //-----------------------------------------------------------------------
  // WARNING: Fields like this will not be initialised automatically. See _initProperties().
  private _log: Logger;

  private _visualState: number;

  private _mode: ViewerElementTypes.Mode;

  private _virtualScrollArea: virtualscrollarea.VirtualScrollArea;
  
  private _initProperties(): void {
    this._log = new Logger(EtEmbeddedViewer.TAG_NAME);
    this._visualState = VisualState.AUTO;
    this._mode = ViewerElementTypes.Mode.DEFAULT;
    this._virtualScrollArea = new virtualscrollarea.VirtualScrollArea();
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
  
  set viewerElement(element: ViewerElement) {
    if (this.childNodes.length !== 0) {
      this.innerHTML = "";
    }
    
    if (element !== null) {
      element.visualState = this._visualState;
      element.mode = this._mode;
      this.appendChild(element);
      this._virtualScrollArea.appendScrollable(element);
    }
  }
  
  get viewerElement(): ViewerElement {
    return this._getViewerElement();
  }
  
  set visualState(newVisualState: number) {
    this._visualState = newVisualState;
    const viewerElement = this.viewerElement;
    if (viewerElement !== null) {
      viewerElement.visualState = newVisualState;
    }
  }
  
  get visualState(): number {
    return this._visualState;
  }
  
  // See VirtualScrollable
  getMinHeight(): number {
    if (DEBUG_SIZE) {
      this._log.debug("getMinHeight() => ", this.getReserveViewportHeight(0));
    }
    return this.getReserveViewportHeight(0);
  }
  
  // See VirtualScrollable
  getVirtualHeight(containerHeight: number): number {
    const viewerElement = this.viewerElement;
    let result = 0;
    if (viewerElement !== null) {
      result = this._virtualScrollArea.getVirtualHeight();
    }
    if (DEBUG_SIZE) {
      this._log.debug("getVirtualHeight() => ", result);
    }
    return result;
  }
  
  // See VirtualScrollable
  getReserveViewportHeight(containerHeight: number): number {
    const {top, bottom} = this._borderSize();
    const result = top + bottom;
      
    if (DEBUG_SIZE) {
      this._log.debug("getReserveViewportHeight() => ", result);
    }
    return result;
  }
  
  // See VirtualScrollable
  setDimensionsAndScroll(setterState: SetterState): void {

    if (DEBUG_SIZE) {
      this._log.debug("setDimensionsAndScroll(): ", setterState.height, setterState.heightChanged,
        setterState.yOffset, setterState.yOffsetChanged);
    }
    
    if (setterState.heightChanged) {
      this.style.height = "" + setterState.height + "px";
    }

    const containerDiv = <HTMLDivElement>this._getById(ID_CONTAINER);
    if (setterState.yOffset === 0) {
      containerDiv.classList.remove(CLASS_SCROLLING);
      containerDiv.classList.add(CLASS_NOT_SCROLLING);
    } else {
      containerDiv.classList.add(CLASS_SCROLLING);
      containerDiv.classList.remove(CLASS_NOT_SCROLLING);
    }
    
    const headerDiv = <HTMLDivElement>this._getById(ID_HEADER);
    const rect = headerDiv.getBoundingClientRect();   // FIXME slow
    headerDiv.style.top = Math.min(Math.max(setterState.physicalTop, 0), setterState.height - rect.height) + 'px';
    const outputDiv = <HTMLDivElement>this._getById(ID_OUTPUT);
    outputDiv.style.top = "" + rect.height + "px";
    
    if (setterState.physicalTop > 0 || setterState.height < setterState.containerHeight) {
      // Bottom part is visible
      containerDiv.classList.remove(CLASS_BOTTOM_NOT_VISIBLE);
      containerDiv.classList.add(CLASS_BOTTOM_VISIBLE);
    } else {
      containerDiv.classList.add(CLASS_BOTTOM_NOT_VISIBLE);
      containerDiv.classList.remove(CLASS_BOTTOM_VISIBLE);
    }
    
    const scrollNameDiv = <HTMLDivElement>this._getById(ID_SCROLL_NAME);
    const percent = Math.floor(setterState.yOffset / this.getVirtualHeight(0) * 100);
    scrollNameDiv.innerHTML = "" + percent + "%";
    
    if (setterState.heightChanged) {
      this._virtualScrollArea.resize();
    }
    
    this._virtualScrollArea.scrollTo(setterState.yOffset);
  }
  
  getSelectionText(): string {
    const viewerElement = this.viewerElement;
    return viewerElement === null ? null : viewerElement.getSelectionText();
  }
  
  /**
   * 
   */
  openMenu(): void {
    const header = <HTMLDivElement>this._getById(ID_HEADER);
    const cm = <contextmenu>this._getById(ID_CONTEXT_MENU);
    const rect = header.getBoundingClientRect();
    cm.openAround(header); //(rect.left, rect.top );
  }
  
  /**
   * 
   */
  get text(): string {
    const viewerElement = this.viewerElement;
    if (viewerElement === null) {
      return "";
    }
    return viewerElement.text;
  }
  
  set tag(tag: string) {
    this.setAttribute(EtEmbeddedViewer.ATTR_TAG, tag);
  }
  
  get tag(): string {
    return this.getAttribute(EtEmbeddedViewer.ATTR_TAG);
  }

  set title(newTitle: string) {
    this.setAttribute(EtEmbeddedViewer.ATTR_FRAME_TITLE, newTitle);
  }

  get title(): string {
    return this.getAttribute(EtEmbeddedViewer.ATTR_FRAME_TITLE);
  }

  set returnCode(returnCode: number) {
    this.setAttribute(EtEmbeddedViewer.ATTR_RETURN_CODE,
      returnCode === null || returnCode === undefined ? null : "" + returnCode);
  }

  get returnCode(): number {
    const rcString = this.getAttribute(EtEmbeddedViewer.ATTR_RETURN_CODE);
    return rcString === null || rcString === undefined ? null : parseInt(rcString, 10);
  }

  set awesomeIcon(iconName: string) {
    this.setAttribute(EtEmbeddedViewer.ATTR_AWESOME_ICON, iconName);
  }

  get awesomeIcon(): string {
    return this.getAttribute(EtEmbeddedViewer.ATTR_AWESOME_ICON);
  }

  clearSelection(): void {
    const viewerElement = this.viewerElement;
    if (viewerElement === null) {
      return;
    }
    viewerElement.clearSelection();
  }

  set mode(newMode: ViewerElementTypes.Mode) {
    this._mode = newMode;
    const viewerElement = this.viewerElement;
    if (viewerElement !== null) {
      viewerElement.mode = newMode;
    }
  }

  get mode(): ViewerElementTypes.Mode {
    return this._mode;
  }

  focus(): void {
    const viewerElement = this.viewerElement;
    if (viewerElement !== null) {
      return viewerElement.focus();
    } else {
      super.focus();
    }
  }

  getCursorPosition(): ViewerElementTypes.CursorMoveDetail {
    const viewerElement = this.viewerElement;
    if (viewerElement !== null) {
      const borderSize = this._borderSize();
      const {left, top, bottom, viewPortTop } = viewerElement.getCursorPosition();
      return {
        left,
        top: top+borderSize.top,
        bottom: bottom + borderSize.top,
        viewPortTop: viewPortTop+borderSize.top
      };
    }
    return null;
  }
  
  setCursorPositionTop(x: number): boolean {
    const viewerElement = this.viewerElement;
    if (viewerElement !== null) {
      return viewerElement.setCursorPositionTop(x);
    }
    return false;
  }
  
  setCursorPositionBottom(x: number): boolean {
    const viewerElement = this.viewerElement;
    if (viewerElement !== null) {
      return viewerElement.setCursorPositionBottom(x);
    }
    return false;
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

  /**
   * Custom Element 'created' life cycle hook.
   */
  createdCallback(): void {
    this._initProperties();
  }
  
  /**
   * Custom Element 'attached' life cycle hook.
   */
  attachedCallback(): void {
    super.attachedCallback();
    
    if (domutils.getShadowRoot(this) !== null) {
      return;
    }

    const shadow = domutils.createShadowRoot(this);

    const clone = this._createClone();
    shadow.appendChild(clone);

    this._setAttr(EtEmbeddedViewer.ATTR_FRAME_TITLE, this.getAttribute(EtEmbeddedViewer.ATTR_FRAME_TITLE));
    this._setAttr(EtEmbeddedViewer.ATTR_RETURN_CODE, this.getAttribute(EtEmbeddedViewer.ATTR_RETURN_CODE));
    this._setAttr(EtEmbeddedViewer.ATTR_EXPAND, this.getAttribute(EtEmbeddedViewer.ATTR_EXPAND));
    this._setAttr(EtEmbeddedViewer.ATTR_TAG, this.getAttribute(EtEmbeddedViewer.ATTR_TAG));
    this._setAttr(EtEmbeddedViewer.ATTR_TOOL_TIP, this.getAttribute(EtEmbeddedViewer.ATTR_TOOL_TIP));
    this._setAttr(EtEmbeddedViewer.ATTR_AWESOME_ICON, this.getAttribute(EtEmbeddedViewer.ATTR_AWESOME_ICON));

    this.updateThemeCss();

    this._getById(ID_POP_OUT_BUTTON).addEventListener('click', this._emitFramePopOut.bind(this));
    this._getById(ID_CLOSE_BUTTON).addEventListener('click', this._emitCloseRequest.bind(this));
    const headerDiv = domutils.getShadowId(this, ID_HEADER);
    headerDiv.addEventListener('focus', this.focus.bind(this));
    
    const outputDiv = <HTMLDivElement>this._getById(ID_OUTPUT);    
    outputDiv.addEventListener('mousedown', this.focus.bind(this));
    outputDiv.addEventListener('click', this.focus.bind(this));
    outputDiv.addEventListener('keydown', this._handleKeyDown.bind(this));
    
    this._virtualScrollArea.setScrollContainer(outputDiv);
    
    outputDiv.addEventListener(virtualscrollarea.EVENT_RESIZE, (ev: CustomEvent) => {
      const height = this._virtualScrollArea.getVirtualHeight();
      this._virtualScrollArea.updateScrollableSize(<any> ev.target);
      const newHeight = this._virtualScrollArea.getVirtualHeight();
      if (height !== newHeight) {
        const event = new CustomEvent(virtualscrollarea.EVENT_RESIZE, { bubbles: true });
        this.dispatchEvent(event);
      }
    });
    
    // const expandbutton = this._getById(ID_EXPAND_BUTTON);
    // expandbutton.addEventListener('click', (): void => {
    //   const expanded = util.htmlValueToBool(this.getAttribute(EtEmbeddedViewer.ATTR_EXPAND), true);
    //   this.setAttribute(EtEmbeddedViewer.ATTR_EXPAND, "" + !expanded);
    // });

    domutils.addCustomEventResender(this, ViewerElement.EVENT_BEFORE_SELECTION_CHANGE);
    domutils.addCustomEventResender(this, ViewerElement.EVENT_CURSOR_MOVE);
    domutils.addCustomEventResender(this, ViewerElement.EVENT_CURSOR_EDGE);

    const cm = <contextmenu>this._getById(ID_CONTEXT_MENU);
    this._getById(ID_CONTAINER).addEventListener('contextmenu', (ev: MouseEvent): void => {
      ev.stopPropagation();
      ev.preventDefault();
      const cm = <contextmenu>this._getById(ID_CONTEXT_MENU);
      cm.open(ev.clientX, ev.clientY);
    });

    cm.addEventListener('selected', (ev: CustomEvent): void => {
      let event: CustomEvent;
      switch (ev.detail.name) {
        case 'popout':
          this._emitFramePopOut();
          break;
        
        case "copycommand":
          event = new CustomEvent(EtEmbeddedViewer.EVENT_COPY_CLIPBOARD_REQUST);
          event.initCustomEvent(EtEmbeddedViewer.EVENT_COPY_CLIPBOARD_REQUST, true, true,
            this.getAttribute(EtEmbeddedViewer.ATTR_FRAME_TITLE));
          this.dispatchEvent(event);
          break;

        case "typecommand":
          const detail: generalevents.TypeTextEventDetail = { text: this.getAttribute(EtEmbeddedViewer.ATTR_FRAME_TITLE) };
          event = new CustomEvent(generalevents.EVENT_TYPE_TEXT, { detail });
          event.initCustomEvent(generalevents.EVENT_TYPE_TEXT, true, true, detail);
          this.dispatchEvent(event);
          break;

        case "expand":
          this.setAttribute(EtEmbeddedViewer.ATTR_EXPAND, ev.detail.checked);
          break;

        case 'close':
          this._emitCloseRequest();
          break;

        default:
          break;
      }
      this.focus();
    });

    cm.addEventListener('before-close', (function(ev: Event) {
      this.focus();
    }).bind(this));

    const setterState: virtualscrollarea.SetterState = {
      height: this.getMinHeight(),
      heightChanged: true,
      yOffset: 0,
      yOffsetChanged: true,
      physicalTop: 0,
      physicalTopChanged: true,
      containerHeight: this.getMinHeight(),
      containerHeightChanged: true
    };

    this.setDimensionsAndScroll(setterState);

    // Remove the anti-flicker style.
    this._getById(ID_CONTAINER).setAttribute('style', '');
  }
  
  /**
   * Custom Element 'detached' life cycle hook.
   */
  detachedCallback(): void {
    super.detachedCallback();
  }
  
  /**
   * Custom Element 'attribute changed' hook.
   */
  attributeChangedCallback(attrName: string, oldValue: string, newValue: string) {
    this._setAttr(attrName, newValue);
  }
  
  protected _themeCssFiles(): ThemeTypes.CssFile[] {
    return [ThemeTypes.CssFile.GUI_CONTROLS, ThemeTypes.CssFile.EMBEDDED_FRAME];
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
  private _createClone(): Node {
    let template = <HTMLTemplate>window.document.getElementById(ID);
    if (template === null) {
      template = window.document.createElement('template');
      template.id = ID;
      
      template.innerHTML = `
        <style id=${ThemeableElementBase.ID_THEME}></style>
        <div id='${ID_CONTAINER}' style='display: none;' class='running'>
          <div id='${ID_HEADER}' tabindex='-1'>
            <div class='left_block'>
              <div id='${ID_ICON_DIV}'><i id='${ID_ICON}'></i></div>
              <div id='${ID_COMMAND_LINE}'></div>
            </div>
            <div class='header_spacer'></div>
            <div class='right_block'>
              <div id='${ID_SCROLL_ICON}'><i class='fa fa-arrows-v'></i></div>
              <div id='${ID_SCROLL_NAME}'></div>
              <div id='${ID_TAG_ICON}'><i class='fa fa-tag'></i></div>
              <div id='${ID_TAG_NAME}'></div>
              <div class='spacer'></div>
` +//              <button id='${ID_EXPAND_BUTTON}' title='Expand/Collapse'><i id='${ID_EXPAND_ICON}' class='fa fa-plus-square-o'></i></button>
//              <div class='spacer'></div>
`              <button id='${ID_POP_OUT_BUTTON}'><i class='fa fa-external-link'></i></button>
              <div class='spacer'></div>
              <button id='${ID_CLOSE_BUTTON}' title='Close'><i class='fa fa-times-circle'></i></button>` +
            `</div>` +
          `</div>
          <div id='${ID_OUTPUT}'><content></content></div>
        </div>
        <cb-contextmenu id='${ID_CONTEXT_MENU}' style='display: none;'>
          <cb-menuitem icon='external-link' name='popout'>Open in Tab</cb-menuitem>
          <cb-menuitem icon='terminal' name='typecommand'>Type Command</cb-menuitem>
          <cb-menuitem icon='copy' name='copycommand'>Copy Command to Clipboard</cb-menuitem>
` + //          <cb-checkboxmenuitem icon='list-ol' id='${ID_EXPAND_MENU_ITEM}' checked='true' name='expand'>Expand</cb-checkboxmenuitem>
`          <cb-menuitem icon='times-circle' name='close'>Close</cb-menuitem>
        </cb-contextmenu>`;
      window.document.body.appendChild(template);
    }

    return window.document.importNode(template.content, true);
  }

  /**
   * 
   */
  private _getById(id: string): Element {
    return domutils.getShadowRoot(this).querySelector('#'+id);
  }

  /**
   * Process an attribute value change.
   */
  private _setAttr(attrName: string, newValue: string): void {
    if (domutils.getShadowRoot(this) === null) {
      return;
    }

    if (attrName === EtEmbeddedViewer.ATTR_FRAME_TITLE) {
      (<HTMLDivElement>this._getById(ID_COMMAND_LINE)).innerText = newValue;
      return;
    }

    if (attrName === EtEmbeddedViewer.ATTR_RETURN_CODE) {
      const container = <HTMLDivElement>this._getById(ID_CONTAINER);

      if (newValue === null || newValue === undefined || newValue === "") {
        container.classList.add('running');
        container.classList.remove('success');
        container.classList.remove('fail');
      } else {

        const rc = parseInt(newValue, 10);
        container.classList.remove('running');
        container.classList.remove('running');
        if (rc === 0) {
          container.classList.add('success');
        } else {
          container.classList.add('fail');
        }
      }

      return;
    }

    if (attrName === EtEmbeddedViewer.ATTR_EXPAND) {
      const output = <HTMLDivElement>this._getById(ID_OUTPUT);
      // const expandicon = <HTMLDivElement>this._getById(ID_EXPAND_ICON);
      if (util.htmlValueToBool(newValue, true)) {
        // Expanded.
        output.classList.remove('closed');
        // expandicon.classList.remove('fa-plus-square-o');
        // expandicon.classList.add('fa-minus-square-o');
        // (<checkboxmenuitem>this._getById(ID_EXPAND_MENU_ITEM)).setAttribute('checked', "true");
      } else {
        // Collapsed.
        output.classList.add('closed');
        // expandicon.classList.add('fa-plus-square-o');
        // expandicon.classList.remove('fa-minus-square-o');
        // (<checkboxmenuitem>this._getById(ID_EXPAND_MENU_ITEM)).setAttribute('checked', "false");
      }
      return;
    }

    if (attrName === EtEmbeddedViewer.ATTR_TAG) {
      const tagName = <HTMLDivElement>this._getById(ID_TAG_NAME);
      tagName.innerText = newValue;
    }
    
    if (attrName === EtEmbeddedViewer.ATTR_TOOL_TIP) {
      const iconDiv = <HTMLDivElement>this._getById(ID_ICON_DIV);
      if (newValue !== null) {
        iconDiv.setAttribute('title', newValue);
      }
    }
    
    if (attrName === EtEmbeddedViewer.ATTR_AWESOME_ICON) {
      const icon = <HTMLDivElement>this._getById(ID_ICON);
      icon.className = "fa " + (newValue !== null && newValue !== undefined && newValue !== "" ? "fa-" : "") + newValue;
    }
  }

  private _borderSize(): {top: number; bottom: number;} {
    const headerDiv = <HTMLDivElement>this._getById(ID_HEADER);
    const outputDiv =  <HTMLDivElement>this._getById(ID_OUTPUT);
    const outputStyle = window.getComputedStyle(outputDiv);

    const rect = headerDiv.getBoundingClientRect();
    const top = rect.height + domutils.pixelLengthToInt(outputStyle.borderTopWidth);
    const bottom = domutils.pixelLengthToInt(outputStyle.borderBottomWidth);
    
    return {top, bottom};
  }

  private _getViewerElement(): ViewerElement {
    if (this.firstElementChild !== null && this.firstElementChild instanceof ViewerElement) {
      return <ViewerElement> this.firstElementChild;
    } else {
      return null;
    }
  }

  private _handleKeyDown(ev: KeyboardEvent): void {
    if (ev.keyCode === 79 && ev.ctrlKey && ev.shiftKey) { // Ctrl+Shift+O
      ev.stopPropagation();
      ev.preventDefault();
      this._emitFramePopOut();
      return;
    }
    
    if (ev.keyCode === 87 && ev.ctrlKey && ev.shiftKey) { // Ctrl+Shift+W
      ev.stopPropagation();
      ev.preventDefault();
      this._emitCloseRequest();
      return;
    }
  }

  /**
   * 
   */
  private _emitManualScroll(): void {
    const event = new CustomEvent(EtEmbeddedViewer.EVENT_SCROLL_MOVE);
    event.initCustomEvent(EtEmbeddedViewer.EVENT_SCROLL_MOVE, true, true, null);
    this.dispatchEvent(event);
  }
  
  private _emitFramePopOut(): void {
    const event = new CustomEvent(EtEmbeddedViewer.EVENT_FRAME_POP_OUT);
    event.initCustomEvent(EtEmbeddedViewer.EVENT_FRAME_POP_OUT, true, true, this);
    this.dispatchEvent(event);
  }

  private _emitCloseRequest(): void {
    const event = new CustomEvent(EtEmbeddedViewer.EVENT_CLOSE_REQUEST);
    event.initCustomEvent(EtEmbeddedViewer.EVENT_CLOSE_REQUEST, true, true, null);
    this.dispatchEvent(event);
  }
}

export = EtEmbeddedViewer;

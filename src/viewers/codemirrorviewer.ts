/**
 * Copyright 2015 Simon Edwards <simon@simonzone.com>
 */

"use strict";
import ViewerElement = require("../viewerelement");
import util = require("../gui/util");
import domutils = require("../domutils");
import CodeMirror = require('codemirror');
import EtCodeMirrorViewerTypes = require('./codemirrorviewertypes');

type TextDecoration = EtCodeMirrorViewerTypes.TextDecoration;
type CursorMoveDetail = EtCodeMirrorViewerTypes.CursorMoveDetail;

const ID = "CbCodeMirrorViewerTemplate";
const ID_CONTAINER = "container";

const ID_MAIN_STYLE = "main_style";
const ID_THEME_STYLE = "theme_style";

const CLASS_HIDE_CURSOR = "hide_cursor";

let registered = false;

function log(msg: any, ...opts: any[]): void {
  console.log("codemirrorviewer: " + msg, ...opts);
}

class EtCodeMirrorViewer extends ViewerElement {

  static TAG_NAME = "et-codemirror-viewer";
  
  static EVENT_CURSOR_MOVE = "cursor-move";

  static init(): void {
    if (registered === false) {
      window.document.registerElement(EtCodeMirrorViewer.TAG_NAME, {prototype: EtCodeMirrorViewer.prototype});
      registered = true;
    }
  }
  
  /**
   * Type guard for detecting a EtCodeMirrorViewer instance.
   * 
   * @param  node the node to test
   * @return      True if the node is a EtCodeMirrorViewer.
   */
  static is(node: Node): node is EtCodeMirrorViewer {
    return node !== null && node !== undefined && node instanceof EtCodeMirrorViewer;
  }
  
  //-----------------------------------------------------------------------
  // WARNING: Fields like this will not be initialised automatically. See _initProperties().
  private _mutationObserver: MutationObserver;
  private _commandLine: string;
  private _returnCode: string;
  private _focusable: boolean;
  private _codeMirror: CodeMirror.Editor;
  private _maxHeight: number;
  private _isEmpty: boolean;
  private _processKeyboard: boolean;


  private _initProperties(): void {
    this._mutationObserver = null;  
    this._commandLine = null;
    this._returnCode  =null;
    this._focusable = false;
    this._codeMirror = null;
    this._maxHeight = -1;
    this._isEmpty = true;
    this._processKeyboard = true;
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

  set commandLine(commandLine: string) {
    this._commandLine = commandLine;
  }
  
  set returnCode(returnCode: string) {
    this._returnCode = returnCode;
  }
  
  get title(): string {
    if (this._commandLine !== null) {
      return this._commandLine;
    } else {
      return "Terminal Command";
    }
  }
  
  get awesomeIcon(): string {
    return "terminal";
  }
  
  getSelectionText(): string {
    console.log("codemirror getSelectionText called");
    return this._codeMirror.getDoc().getSelection("\n");
  }

  focus(): void {
    this._codeMirror.focus();
  }

  hasFocus(): boolean {
    return this._codeMirror.hasFocus();
  }

  get processKeyboard(): boolean {
    return this._processKeyboard;
  }

  set processKeyboard(on: boolean) {
    this._processKeyboard = on;
    
    // When keyboard processing is off, we really only want the user to be able
    // to select stuff using the mouse and we don't need to show a cursor.
    const containerDiv = <HTMLDivElement> util.getShadowId(this, ID_CONTAINER);
    if (on) {
      containerDiv.classList.remove(CLASS_HIDE_CURSOR);
    } else {
      containerDiv.classList.add(CLASS_HIDE_CURSOR);
    }
  }
  
  // get focusable(): boolean {
  //   return this._focusable;
  // }
  // 
  // set focusable(value: boolean) {
  //   this._focusable = value;
  //   this._updateFocusable(value);
  // }
  
  setMaxHeight(height: number): void {
    this._maxHeight = height;
    if (this.parentNode !== null) {
      this._adjustHeight();
    }
  }
  /**
   * Gets the height of this element.
   * 
   * @return {number} [description]
   */
  getHeight(): number {
    return Math.min(this.getVirtualHeight(), this._maxHeight);
  }
  
  /**
   * Gets the height of the scrollable contents on this element.
   *
   * @return {number} [description]
   */
  getVirtualHeight(): number {
    return this._isEmpty ? 0 : this._codeMirror.defaultTextHeight() * this.lineCount();
  }

  scrollTo(x: number, y: number): void {
    this._codeMirror.scrollTo(x, y);
  }
  
  lineCount(): number {
    const doc = this._codeMirror.getDoc();
    return this._isEmpty ? 0 : doc.lineCount();
  }
  
  setCursor(line: number, ch: number): void {
    const doc = this._codeMirror.getDoc();
    doc.setCursor( { line, ch } );
  }
  
  refresh(): void {
    this._codeMirror.refresh();
    this._scrollBugFix();
  }
  
  createdCallback(): void {
    this._initProperties();
    
    const shadow = util.createShadowRoot(this);
    const clone = this.createClone();
    shadow.appendChild(clone);

    const containerDiv = util.getShadowId(this, ID_CONTAINER);
    // containerDiv.addEventListener('keydown', (ev: KeyboardEvent): void => {
    //   console.log("codemirrorviewer keydown: ",ev);
    //   ev.stopPropagation();
    //   ev.preventDefault();
    // });
    // containerDiv.addEventListener('keypress', (ev: KeyboardEvent): void => {
    //   ev.stopPropagation();
    //   ev.preventDefault();
    // });
    // containerDiv.addEventListener('keyup', (ev: KeyboardEvent): void => {
    //   ev.stopPropagation();
    //   ev.preventDefault();
    // });

    this.style.height = "0px";
    this._updateFocusable(this._focusable);
  }
  
  attachedCallback(): void {
    const containerDiv = <HTMLDivElement> util.getShadowId(this, ID_CONTAINER);
    
    // Create the CodeMirror instance
    this._codeMirror = CodeMirror( (el: HTMLElement): void => {
      containerDiv.appendChild(el);
    }, {value: "", readOnly: true,  scrollbarStyle: "null", cursorScrollMargin: 0});
    
    this._codeMirror.on("cursorActivity", () => {
      const event = new CustomEvent(EtCodeMirrorViewer.EVENT_CURSOR_MOVE, { bubbles: true });
      this.dispatchEvent(event);
    });
    
    this._codeMirror.on("scroll", () => {
      // Over-scroll bug/feature fix
      const scrollInfo = this._codeMirror.getScrollInfo();
      // console.log("codemirror event scroll:", scrollInfo);
      
      const clientYScrollRange = Math.max(0, this.getVirtualHeight() - this.getHeight());
      if (scrollInfo.top > clientYScrollRange) {
        this._codeMirror.scrollTo(0, clientYScrollRange);
      }
      util.doLater( this._scrollBugFix.bind(this));
    });
    
    this._codeMirror.on("keydown", (instance: CodeMirror.Editor, ev: KeyboardEvent): void => {
      if ( ! this._processKeyboard) {
        (<any> ev).codemirrorIgnore = true;
      }
    });
    
    this._codeMirror.on("keypress", (instance: CodeMirror.Editor, ev: KeyboardEvent): void => {
      if ( ! this._processKeyboard) {
        (<any> ev).codemirrorIgnore = true;
      }
    });
    
    this._codeMirror.on("keyup", (instance: CodeMirror.Editor, ev: KeyboardEvent): void => {
      if ( ! this._processKeyboard) {
        (<any> ev).codemirrorIgnore = true;
      }
    });
    
  }

  appendText(text: string, decorations?: TextDecoration[]): void {
    const doc = this._codeMirror.getDoc();
    const lineOffset = this._isEmpty ? 0 : doc.lineCount();
    
    const pos = { line: this._isEmpty ? 0 : doc.lineCount(), ch: 0 };
    doc.replaceRange((this._isEmpty ? "" : "\n") + text, pos, pos);
    this._isEmpty = false;
    
    if (decorations !== undefined && decorations.length !== 0) {
      // Apply the styles to the text.
      const len = decorations.length;
      for (let i=0; i<len; i++) {
        const style = decorations[i];
        const from = { line: style.line + lineOffset, ch: style.fromCh };
        const to = { line: style.line + lineOffset, ch: style.toCh };
        const classList = style.classList;
        for (let j=0; j<classList.length; j++) {
          doc.markText( from, to, { className: classList[j] } );
        }
      }
    }
    this._codeMirror.refresh();
    this._adjustHeight();

    util.doLater( () => {
      this._codeMirror.refresh();
      this._adjustHeight();
    });
  }
  
  deleteLinesFrom(line: number): void {
    const doc = this._codeMirror.getDoc();
    
    this._isEmpty = line === 0;
    
    const lastPos = { line: doc.lineCount(), ch: 0 };
    
    let startPos: { line: number; ch: number; };
    if (line > 0) {
      const previousLineString = doc.getLine(line-1);
      startPos = { line: line-1, ch: previousLineString.length };
    } else {
      startPos = { line: line, ch: 0 };
    }
    doc.replaceRange("", startPos, lastPos);
    
    this._codeMirror.refresh();
    this._adjustHeight();

    util.doLater( () => {
      this._codeMirror.refresh();
      this._adjustHeight();
    });
  }
  
  getCursorInfo(): CursorMoveDetail {
    const cursorPos = this._codeMirror.cursorCoords(true, "local");
    const scrollInfo = this._codeMirror.getScrollInfo();
    const detail: CursorMoveDetail = {
      left: cursorPos.left,
      top: cursorPos.top,
      bottom: cursorPos.bottom,
      viewPortTop: scrollInfo.top
    };
    return detail;
  }
  
  fakeMouseDown(ev: MouseEvent): void {
    const root = util.getShadowRoot(this);
    const newTarget = root.elementFromPoint(ev.clientX, ev.clientY);
    
    const newEvent = document.createEvent('MouseEvents');
    newEvent.initMouseEvent(
      'mousedown',                    // typeArg: string,
      true,                           // canBubbleArg: boolean,
      true,                           // cancelableArg: boolean,
      document.defaultView,           // viewArg: Window,
      0,                              // detailArg: number,
      ev.screenX,                     // screenXArg: number,
      ev.screenY,                     // screenYArg: number,
      ev.clientX,                     // clientXArg: number,
      ev.clientY,                     // clientYArg: number,
      ev.ctrlKey,                     // ctrlKeyArg: boolean,
      ev.altKey,                      // altKeyArg: boolean,
      ev.shiftKey,                    // shiftKeyArg: boolean,
      ev.metaKey,                     // metaKeyArg: boolean,
      ev.button,                      // buttonArg: number,
      null);                          // relatedTargetArg: EventTarget
    newTarget.dispatchEvent(newEvent);
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
      template.innerHTML = `<style id="${ID_MAIN_STYLE}">
        :host {
          display: block;
          width: 100%;
          white-space: normal;
        }
        
        #${ID_CONTAINER} {
/*          height: 100%; */
          width: 100%;
          overflow: hidden;
        }
        
        #${ID_CONTAINER}:focus {
          outline: 0px;
        }
        
        #${ID_CONTAINER}.${CLASS_HIDE_CURSOR} .CodeMirror-cursors {
            display: none !important;
        }
        
        </style>
        <style id="${ID_THEME_STYLE}"></style>
        <style>
        @import url('node_modules/codemirror/lib/codemirror.css');
        @import url('node_modules/codemirror/addon/scroll/simplescrollbars.css');
        @import url('themes/default/theme.css');
        </style>
        <div id="${ID_CONTAINER}" class="terminal_viewer terminal"></div>`

      window.document.body.appendChild(template);
    }
    
    return window.document.importNode(template.content, true);
  }

  private _updateFocusable(focusable: boolean): void {
    // const containerDiv = util.getShadowId(this, ID_CONTAINER);
    // containerDiv.setAttribute('tabIndex', focusable ? "-1" : "");
  }

  private _scrollBugFix(): void {
    const containerDiv = util.getShadowId(this, ID_CONTAINER);
    containerDiv.scrollTop = 0;
  }

  private _adjustHeight(): void {
    const virtualHeight = this.getVirtualHeight();
    const elementHeight = this.getHeight();
    this.style.height = "" + elementHeight + "px";
    
    const containerDiv = util.getShadowId(this, ID_CONTAINER);
    containerDiv.style.height = "" + elementHeight + "px";
    this._codeMirror.refresh();
    this._codeMirror.setSize("100%", "" +elementHeight + "px"); 
  }
    
  _themeCssSet(): void {  
    // const themeTag = <HTMLStyleElement> util.getShadowId(this, ID_THEME_STYLE);
    // if (themeTag !== null) {
    //   themeTag.innerHTML = this.getThemeCss();
    // }
  }
  
}

export = EtCodeMirrorViewer;

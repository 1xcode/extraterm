/**
 * Copyright 2015 Simon Edwards <simon@simonzone.com>
 */

"use strict";
import ViewerElement = require("../viewerelement");
import util = require("../gui/util");
import domutils = require("../domutils");
import CodeMirror = require('codemirror');

const ID = "CbCodeMirrorViewerTemplate";
const ID_CONTAINER = "container";

const ID_MAIN_STYLE = "main_style";
const ID_THEME_STYLE = "theme_style";

let registered = false;



class EtCodeMirrorViewer extends ViewerElement {
  
  static TAG_NAME = "et-codemirror-viewer";

  static init(): void {
    if (registered === false) {
      window.document.registerElement(EtCodeMirrorViewer.TAG_NAME, {prototype: EtCodeMirrorViewer.prototype});
      registered = true;
    }
  }
  
  //-----------------------------------------------------------------------
  // WARNING: Fields like this will not be initialised automatically. See _initProperties().
  private _mutationObserver: MutationObserver;
  private _commandLine: string;
  private _returnCode: string;
  private _focusable: boolean;
  private _codeMirror: CodeMirror.Editor;
  private _importLineCounter: number;
  
  private _initProperties(): void {
    this._mutationObserver = null;  
    this._commandLine = null;
    this._returnCode  =null;
    this._focusable = false;
    this._codeMirror = null;
  }

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
    // const selection = util.getShadowRoot(this).getSelection();
    // if (selection.rangeCount !== 0 && ! selection.getRangeAt(0).collapsed) {
    //   return domutils.extractTextFromRange(selection.getRangeAt(0));
    // } else {
      return null;
    // }
  }

  focus(): void {
    // util.getShadowId(this, ID_CONTAINER).focus();
  }

  hasFocus(): boolean {
    // const root = util.getShadowRoot(this);
    // return root.activeElement !== null;
    return false;
  }

  get focusable(): boolean {
    return this._focusable;
  }
  
  set focusable(value: boolean) {
    this._focusable = value;
    this._updateFocusable(value);
  }

  createdCallback(): void {
    this._initProperties();
    
    const shadow = util.createShadowRoot(this);
    const clone = this.createClone();
    shadow.appendChild(clone);

    const containerDiv = util.getShadowId(this, ID_CONTAINER);
    containerDiv.addEventListener('keydown', (ev: KeyboardEvent): void => {
      ev.stopPropagation();
      ev.preventDefault();
    });
    containerDiv.addEventListener('keypress', (ev: KeyboardEvent): void => {
      ev.stopPropagation();
      ev.preventDefault();
    });
    containerDiv.addEventListener('keyup', (ev: KeyboardEvent): void => {
      ev.stopPropagation();
      ev.preventDefault();
    });
    
    this._updateFocusable(this._focusable);

  }
  
  attachedCallback(): void {
    const containerDiv = <HTMLDivElement> util.getShadowId(this, ID_CONTAINER);
    this._codeMirror = CodeMirror( (el: HTMLElement): void => {
      containerDiv.appendChild(el);
    }, {viewportMargin: Infinity, value: ""});
    this._importLineCounter = 0;
    
    this._mutationObserver = new MutationObserver( (mutations) => {
     this.pullInContents();
    });
    this._mutationObserver.observe(this, { childList: true });
    this.pullInContents();
  }

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
          height: 100%;
          min-height: 50px;
          white-space: normal;
        }
        
        #${ID_CONTAINER} {
          height: 100%;
          width: 100%;
          overflow: auto;
        }
        
        #${ID_CONTAINER}:focus {
          outline: 0px;
        }
        
        </style>
        <style id="${ID_THEME_STYLE}"></style>
        <style>
        @import url('node_modules/codemirror/lib/codemirror.css');
        @import url('themes/default/theme.css');
        </style>
        <div id="${ID_CONTAINER}" class="terminal_viewer terminal"></div>
        <div class="terminal_viewer terminal"><content></content></div>`;

      window.document.body.appendChild(template);
    }
    
    return window.document.importNode(template.content, true);
  }
  
  _themeCssSet(): void {  
    // const themeTag = <HTMLStyleElement> util.getShadowId(this, ID_THEME_STYLE);
    // if (themeTag !== null) {
    //   themeTag.innerHTML = this.getThemeCss();
    // }
  }
  
  private pullInContents(): void {
     const container = <HTMLDivElement> util.getShadowId(this, ID_CONTAINER);
     
     const doc = this._codeMirror.getDoc();

     util.nodeListToArray(this.childNodes).forEach( (node) => {
       if (node.nodeType === Node.ELEMENT_NODE && node.nodeName === 'DIV') {
         const divElement = <HTMLDivElement> node;
         
         const childNodes = util.nodeListToArray(divElement.childNodes);
         const len = childNodes.length;
         
         let rowText = "";
         const styleList: { from: number; to: number; span: HTMLSpanElement; }[] = [];
         for (let i=0; i<len; i++) {
           const charNode = childNodes[i];
           if (charNode.nodeType === Node.TEXT_NODE) {
             const textNode = <Text> charNode;
             rowText += textNode.data;
           } else if (charNode.nodeType === Node.ELEMENT_NODE && charNode.nodeName === 'SPAN') {
             const spanNode = <HTMLSpanElement> charNode;
             const textContent = charNode.textContent;
             
             // Record this range 
             styleList.push( { from: rowText.length, to: rowText.length + textContent.length, span: spanNode} );

             rowText += textContent;
           }
         }

         const lastLine = { line: this._importLineCounter, ch: 0 };
         doc.replaceRange(util.trimRight(util.replaceNbsp(rowText)) + "\n", lastLine, lastLine);
         
         if (styleList.length !== 0) {
           // Apply the styles to the text.
           const len = styleList.length;
           for (let i=0; i<len; i++) {
             const style = styleList[i];
             const from = { line: this._importLineCounter, ch: style.from };
             const to = { line: this._importLineCounter, ch: style.to };
             const classList = style.span.classList;
             for (let j=0; j<classList.length; j++) {
               doc.markText( from, to, { className: classList.item(j) } );
             }
           }
         }
         
         this._importLineCounter++;
       }
       
       this.removeChild(node);
       
     });
  }
  
  private _updateFocusable(focusable: boolean): void {
    // const containerDiv = util.getShadowId(this, ID_CONTAINER);
    // containerDiv.setAttribute('tabIndex', focusable ? "-1" : "");
  }
  
}

export = EtCodeMirrorViewer;

/*
 * Copyright 2014-2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import {Attribute, Filter, Observe, WebComponent} from 'extraterm-web-component-decorators';

import {ThemeableElementBase} from '../ThemeableElementBase';
import * as ThemeTypes from '../../theme/Theme';
import * as DomUtils from '../DomUtils';

const ID = "EtStackedWidgetTemplate";
const ID_CONTAINER = 'ID_CONTAINER';


/**
 * A widget which displays one of its DIV contents at a time.
 */
@WebComponent({tag: "et-stackedwidget"})
export class StackedWidget extends ThemeableElementBase {
  
  static TAG_NAME = 'ET-STACKEDWIDGET';
  
  private _currentIndex: number;
  
  constructor() {
    super();
    this._currentIndex = -1;
  }
  
  connectedCallback(): void {
    super.connectedCallback();
    if (DomUtils.getShadowRoot(this) !== null) {
      return;
    }

    const shadow = this.attachShadow({ mode: 'open', delegatesFocus: true });
    const clone = this.createClone();
    shadow.appendChild(clone);
    this.updateThemeCss();
    this.createPageHolders();
    
    this.showIndex(0);
  }
  
  private createClone() {
    let template = <HTMLTemplateElement>window.document.getElementById(ID);
    if (template === null) {
      template = <HTMLTemplateElement>window.document.createElement('template');
      template.id = ID;
      template.innerHTML = `<style id='${ThemeableElementBase.ID_THEME}'></style>
<div id='${ID_CONTAINER}'></div>`;
      window.document.body.appendChild(template);
    }

    return window.document.importNode(template.content, true);
  }

  private __getById(id:string): Element {
    return DomUtils.getShadowRoot(this).querySelector('#'+id);
  }
  
  protected _themeCssFiles(): ThemeTypes.CssFile[] {
    return [ThemeTypes.CssFile.GUI_STACKEDWIDGET];
  }
    
  //-----------------------------------------------------------------------

  // Override
  appendChild<T extends Node>(newNode: T): T {
    const result = super.appendChild(newNode);

    if (DomUtils.getShadowRoot(this) === null) {
      return result;
    }

    this.createPageHolders();
    if (this._currentIndex === -1) {
      this._currentIndex = 0;
    }
    this.showIndex(this._currentIndex);
    return result;
  }
  
  // Override
  removeChild<T extends Node>(oldNode: T): T {
    const result = super.removeChild(oldNode);
    this.createPageHolders();
    if (this._currentIndex >= this.childElementCount) {
      this._currentIndex = this.childElementCount - 1;
    }
    this.showIndex(this._currentIndex);
    return result;
  }
  
  @Attribute({default: -1}) currentIndex: number;

  @Filter("currentIndex")
  private _filterCurrentIndex(index: number): number {
    if (index < 0 || index >= this.childElementCount) {
      return undefined;
    }
    return index;
  }

  @Observe("currentIndex")
  private _observeCurrentIndex(target: string): void {
    this.showIndex(this.currentIndex);
  }
  
  private showIndex(index: number): void {
    if (DomUtils.getShadowRoot(this) === null) {
      return;
    }
    
    const container = <HTMLDivElement>this.__getById(ID_CONTAINER);
    for (let i=0; i<container.children.length; i++) {
      const kid = <HTMLElement>container.children.item(i);
      if (i === index) {
        kid.classList.add('visible');
        kid.classList.remove('hidden');
      } else {
        kid.classList.remove('visible');
        kid.classList.add('hidden');        
      }
    }
  }

  private createPageHolders(): void {
    const container = <HTMLDivElement>this.__getById(ID_CONTAINER);
    
    for (let i=0; i<this.children.length; i++) {
      const kid = this.children.item(i);
      kid.slot = "" + i;
    }
    
    while (container.childElementCount < this.childElementCount) {
      const holderDiv = this.ownerDocument.createElement('div');
      const contentElement = this.ownerDocument.createElement('slot');
      contentElement.setAttribute('name', "" + container.childElementCount);
      holderDiv.appendChild(contentElement);
      container.appendChild(holderDiv);
    }
    
    while (container.childElementCount > this.childElementCount) {
      container.removeChild(container.children.item(container.children.length-1));
    }
  }
}

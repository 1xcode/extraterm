///<reference path='../chrome_lib.d.ts'/>
import util = require("./util");
"use strict";

const ID = "CbTabTemplate";

let registered = false;

class CbTab extends HTMLElement {
  
  static init(): void {
    if (registered === false) {
      window.document.registerElement('cb-tab', {prototype: CbTab.prototype});
      registered = true;
    }
  }

  /**
   * 
   */
  private createClone() {
    let template = <HTMLTemplate>window.document.getElementById(ID);
    if (template === null) {
      template = <HTMLTemplate>window.document.createElement('template');
      template.id = ID;
      template.innerHTML = `<div><content></content></div>`;
      window.document.body.appendChild(template);
    }
    
    return window.document.importNode(template.content, true);
  }

  createdCallback() {
    const shadow = util.createShadowRoot(this);
    const clone = this.createClone();
    shadow.appendChild(clone);
  }
}

export = CbTab;

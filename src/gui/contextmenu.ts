/**
 * Copyright 2015 Simon Edwards <simon@simonzone.com>
 */
import menuitem = require("./menuitem");
import util = require("./util");

menuitem.init();

const ID = "CbContextMenuTemplate";

let registered = false;

/**
 * A context menu.
 */
class CbContextMenu extends HTMLElement {
  
  static init(): void {
    if (registered === false) {
      window.document.registerElement('cb-contextmenu', {prototype: CbContextMenu.prototype});
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
      template.innerHTML = `<style>
        .container {
            position: fixed;
            background-color: #F4F4F4;
            border-radius: 4px;
            padding: 4px 0px 4px 0px;
            box-shadow: 0px 0px 8px black;
            z-index: 101;
        }
        
        .container:focus {
            outline: none;
        }
        .container_closed {
            display: none;
        }

        .container_open {
        
        }

        .cover_closed {
            visibility: hidden;
        }

        .cover_open {
            visibility: visible;
            position: fixed;
            left: 0px;
            right: 0px;
            top: 0px;
            bottom: 0px;
            z-index: 100;
  /*    background-color: rgba(255, 0, 0, 0.5); */
        }
        </style>
        <div id='cover' class='cover_closed'></div>
        <div id='container' class='container container_closed' tabindex='0'><content></content></div>`;
      window.document.body.appendChild(template);
    }

    return window.document.importNode(template.content, true);
  }

  /**
   * 
   */
  private __getById(id:string): Element {
    return util.getShadowRoot(this).querySelector('#'+id);
  }
  
  /**
   * 
   */
  createdCallback() {
    const shadow = util.createShadowRoot(this);
    const clone = this.createClone();
    shadow.appendChild(clone);

    const cover = <HTMLDivElement>this.__getById('cover');
    cover.addEventListener('mousedown', (ev: MouseEvent) => {
      ev.stopPropagation();
      ev.preventDefault();
      if (ev.button === 0) {
        this.close();
      }
    });

    cover.addEventListener('contextmenu', (ev: MouseEvent) => {
      ev.stopPropagation();
      ev.preventDefault();
      this.close();
    }, true);

    const container = <HTMLDivElement>this.__getById('container');
    container.addEventListener('mousedown', (ev: MouseEvent) => {
      ev.stopPropagation();
      ev.preventDefault();
    });

    container.addEventListener('mousemove', (ev: MouseEvent) => {
      if (ev.srcElement.nodeName === 'CB-MENUITEM' || ev.srcElement.nodeName === 'CB-CHECKBOXMENUITEM') {
        this.selectMenuItem(this.childNodes, ev.srcElement);
      } else {
        this.selectMenuItem(this.childNodes, null);
      }
    });

    container.addEventListener('mouseleave', (ev: MouseEvent) => {
      this.selectMenuItem(this.childNodes, null);
    });

    container.addEventListener('click', (ev: MouseEvent) => {
      if (ev.srcElement instanceof menuitem) {
        const item = <menuitem>ev.srcElement;
        this.activateItem(item);
      }
    });

    container.addEventListener('keydown', (ev: KeyboardEvent) => { this.handleKeyDown(ev); });
    container.addEventListener('keypress', (ev: KeyboardEvent) => { this.handleKeyPress(ev); });
  }

  /**
   * 
   */
  private fetchCbMenuItems(kids: NodeList): menuitem[] {
    const len = kids.length;
    const result: menuitem[] = [];
    for (let i=0; i<len; i++) {
      const item = kids[i];

      if(item instanceof menuitem) {
        result.push(<menuitem>item);
      }
    }
    return result;
  }

  /**
   * 
   */
  private selectMenuItem(kids: NodeList, selectitem: Element) {
    const len = kids.length;
    for (let i=0; i<len; i++) {
      const item = kids[i];

      if (item instanceof menuitem) {
        (<menuitem>item).setAttribute('selected', selectitem === item ? "true" : "false");
      }
    }
  }

  /**
   * 
   */
  private handleKeyDown(ev: KeyboardEvent) {
    // Escape.
    if (ev.keyIdentifier === "U+001B") {
      this.close();
      ev.preventDefault();
      ev.stopPropagation();
      return;
    }

    if (ev.keyIdentifier === "Up" || ev.keyIdentifier === "Down" || ev.keyIdentifier === "Enter") {
      const menuitems = this.fetchCbMenuItems(this.childNodes);
      if (menuitems.length === 0) {
        return;
      }

      const keyboardselected = menuitems.filter( (item:menuitem) => util.htmlValueToBool(item.getAttribute("selected")));

      if (ev.keyIdentifier === "Up") {
        if (keyboardselected.length === 0) {
          this.selectMenuItem(this.childNodes, menuitems[menuitems.length-1]);
        } else {
          let i = menuitems.indexOf(keyboardselected[0]);
          i = i === 0 ? menuitems.length-1 : i-1;
          this.selectMenuItem(this.childNodes, menuitems[i]);
        }
      } else if (ev.keyIdentifier === "Down") {
        if (keyboardselected.length === 0) {
          this.selectMenuItem(this.childNodes, menuitems[0]);
        } else {
          let i = menuitems.indexOf(keyboardselected[0]) + 1;
          if (i === menuitems.length) {
            i = 0;
          }
          this.selectMenuItem(this.childNodes, menuitems[i]);
        }
      } else {
        // Enter
        ev.stopPropagation();
        return;
      }
    }
    ev.preventDefault();
    ev.stopPropagation();
  }

  /**
   * 
   */
  private activateItem(item: menuitem): void {
    item._clicked();

    const name = item.getAttribute('name');
    const checked = item.getAttribute('checked');
    this.close();

    const event = new CustomEvent('selected', { detail: {name: name, checked: checked } });
    this.dispatchEvent(event);
  }

  /**
   * 
   */
  private handleKeyPress(ev: KeyboardEvent): void {
    ev.preventDefault();
    ev.stopPropagation();

    if (ev.keyIdentifier === "Enter") {
      const menuitems = this.fetchCbMenuItems(this.childNodes);
      if (menuitems.length === 0) {
        return;
      }

      const keyboardselected = menuitems.filter( (item:menuitem) => util.htmlValueToBool(item.getAttribute("selected")) );
      if (keyboardselected.length !== 0) {
        this.activateItem(keyboardselected[0]);
      }
    }  
  }

  /**
   * 
   */
  open(x: number, y: number): void {
    // Nuke any style like 'display: none' which can be use to prevent flicker.
    this.setAttribute('style', '');
    
    const container = <HTMLDivElement>this.__getById('container');
    container.classList.remove('container_closed');
    container.classList.add('container_open');  

    const rect = container.getBoundingClientRect();

    var sx = x;
    if (sx+rect.width > window.innerWidth) {
      sx = window.innerWidth - rect.width;
    }

    var sy = y;
    if (sy+rect.height > window.innerHeight) {
      sy = window.innerHeight - rect.height;
    }

    container.style.left = "" + sx + "px";
    container.style.top = "" + sy + "px";

    const cover = <HTMLDivElement>this.__getById('cover');
    cover.className = "cover_open";

    this.selectMenuItem(this.childNodes, null);

    container.focus();
  }

  /**
   * 
   */
  private debugScroll(msg?: string) {
    const text = msg !== undefined ? msg : "";
    const termdiv = window.document.querySelector('div.terminal');
    console.log(text + " -- termdiv.scrollTop: " + termdiv.scrollTop);

    const active = window.document.activeElement;
    console.log("active element: " + active);
    if (active !== null) {
      console.log("active element nodeName: " + active.nodeName);
      console.log("active element class: " + active.getAttribute('class'));
    }
  }

  /**
   * 
   */
  openAround(el: HTMLElement) {
    // Nuke any style like 'display: none' which can be use to prevent flicker.
    this.setAttribute('style', '');
    
    const elrect = el.getBoundingClientRect();

    const container = <HTMLDivElement>this.__getById('container');
    container.classList.remove('container_closed');  
    container.classList.add('container_open');  
    const containerrect = container.getBoundingClientRect();

    let sx = elrect.left;
    if (sx+containerrect.width > window.innerWidth) {
      sx = window.innerWidth - containerrect.width;
    }

    let sy = elrect.bottom;
    if (sy+containerrect.height > window.innerHeight) {
      sy = elrect.top - containerrect.height;
    }

    container.style.left = "" + sx + "px";
    container.style.top = "" + sy + "px";

    const cover = <HTMLDivElement>this.__getById('cover');
    cover.className = "cover_open";

    this.selectMenuItem(this.childNodes, null);

    container.focus();
  }

  /**
   * 
   */
  close(): void {
    let event = new CustomEvent('before-close', { detail: null });
    this.dispatchEvent(event);

    const cover = <HTMLDivElement>this.__getById('cover');
    cover.className = "cover_closed";

    const container = <HTMLDivElement>this.__getById('container');
    container.classList.remove('container_open');  
    container.classList.add('container_closed');

    event = new CustomEvent('close', { detail: null });
    this.dispatchEvent(event);
  }
}

export = CbContextMenu;

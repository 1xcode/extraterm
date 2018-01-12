/*
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import {Disposable} from 'extraterm-extension-api';
import {Attribute, Observe, WebComponent} from 'extraterm-web-component-decorators';

import {doLater} from '../../utils/DoLater';
import {Logger, getLogger} from '../../logging/Logger';
import {ThemeableElementBase} from '../ThemeableElementBase';
import * as ThemeTypes from '../../theme/Theme';
import * as DomUtils from '../DomUtils';
import {PopDownDialog} from './PopDownDialog';

const ID = "EtPopDownListPickerTemplate";
const ID_DIALOG = "ID_DIALOG";
const ID_FILTER = "ID_FILTER";
const ID_RESULTS = "ID_RESULTS";

/**
 * A Pop Down List Picker.
 */
@WebComponent({tag: "et-popdownlistpicker"})
export class PopDownListPicker<T extends { id: string; }> extends ThemeableElementBase {
  
  static TAG_NAME = "ET-POPDOWNLISTPICKER";
  static ATTR_DATA_ID = "data-id";
  static CLASS_RESULT_SELECTED = "CLASS_RESULT_SELECTED";
  static CLASS_RESULT_ENTRY = "CLASS_RESULT_ENTRY";

  private _log: Logger = null;
  private _entries: T[] = [];
  private _filterEntries: (entries: T[], filterText: string) => T[];
  private _formatEntries: (filteredEntries: T[], selectedId: string, filterInputValue: string) => string;
  private _laterHandle: Disposable = null;
  private _extraCssFiles: ThemeTypes.CssFile[] = [];

  constructor() {
    super();
    this._log = getLogger(PopDownListPicker.TAG_NAME, this);
    this._filterEntries = (entries: T[], filterText: string): T[] => entries;
    this._formatEntries = (filteredEntries: T[], selectedId: string, filterInputValue: string): string => 
      filteredEntries.map(entry => `<div ${PopDownListPicker.ATTR_DATA_ID}='${entry.id}'>${entry.id}</div>`).join("");

    const shadow = this.attachShadow({ mode: 'open', delegatesFocus: true });
    const clone = this.createClone();
    shadow.appendChild(clone);
    this.installThemeCss();

    const dialog = <PopDownDialog> DomUtils.getShadowId(this, ID_DIALOG);
    dialog.titlePrimary = this.titlePrimary;
    dialog.titleSecondary = this.titleSecondary;
    dialog.addEventListener(PopDownDialog.EVENT_CLOSE_REQUEST, () => {
      dialog.close();
    });

    const filterInput = <HTMLInputElement> DomUtils.getShadowId(this, ID_FILTER);
    filterInput.addEventListener('input', (ev: Event) => {
      this._updateEntries();
    });
    
    filterInput.addEventListener('keydown', (ev: KeyboardEvent) => { this.handleKeyDown(ev); });
    
    const resultsDiv = DomUtils.getShadowId(this, ID_RESULTS);
    resultsDiv.addEventListener('click', (ev: Event) => {
      for (let node of ev.path) {
        if (node instanceof HTMLElement) {
          const dataId = node.attributes.getNamedItem(PopDownListPicker.ATTR_DATA_ID);
          if (dataId !== undefined && dataId !== null) {
            this._okId(dataId.value);
          }
        }
      }
    });
  }
  
  private createClone(): Node {
    let template = <HTMLTemplateElement>window.document.getElementById(ID);
    if (template === null) {
      template = <HTMLTemplateElement>window.document.createElement('template');
      template.id = ID;
      template.innerHTML = `<style id="${ThemeableElementBase.ID_THEME}"></style>
        <${PopDownDialog.TAG_NAME} id="${ID_DIALOG}">
          <div class="form-group"><input type="text" id="${ID_FILTER}" class="form-control input-sm" /></div>
          <div id="${ID_RESULTS}"></div>
        </${PopDownDialog.TAG_NAME}>
        `;
      window.document.body.appendChild(template);
    }

    return window.document.importNode(template.content, true);
  }
  
  protected _themeCssFiles(): ThemeTypes.CssFile[] {
    return [ThemeTypes.CssFile.GUI_CONTROLS, ThemeTypes.CssFile.FONT_AWESOME,
      ThemeTypes.CssFile.GUI_POP_DOWN_LIST_PICKER, ...this._extraCssFiles];
  }

  @Attribute({default: null}) selected: string;

  @Observe("selected")
  private _updateSelected(target: string): void {
    this._updateEntries();
    this._scrollToSelected();
  }

  setEntries(entries: T[]): void {
    this._entries = entries;
    this.selected = null;
    
    const filterInput = <HTMLInputElement> DomUtils.getShadowId(this, ID_FILTER);
    if (filterInput !== null) {
      filterInput.value = "";
    }
    this._updateEntries();
  }

  getEntries(): T[] {
    return this._entries;
  }

  @Attribute({default: ""}) titlePrimary: string;

  @Observe("titlePrimary")
  private _updateTitlePrimary(target: string): void {
    const dialog = <PopDownDialog> DomUtils.getShadowId(this, ID_DIALOG);
    if (dialog != null) {
      dialog.titlePrimary = this.titlePrimary;
    }
  }

  @Attribute({default: ""}) titleSecondary: string;

  @Observe("titleSecondary")
  private _updateTitleSecondary(target: string): void {
    const dialog = <PopDownDialog> DomUtils.getShadowId(this, ID_DIALOG);
    if (dialog != null) {
      dialog.titleSecondary = this.titleSecondary;
    }
  }

  setFilterAndRankEntriesFunc(func: (entries: T[], filterText: string) => T[]): void {
    this._filterEntries = func;
  }

  setFormatEntriesFunc(func: (filteredEntries: T[], selectedId: string, filterInputValue: string) => string): void {
    this._formatEntries = func;
  }

  /**
   * Specify extra Css files to load into this element.
   * 
   * @param extraCssFiles extra Css files which should be loaded along side the default set.
   */
  addExtraCss(extraCssFiles: ThemeTypes.CssFile[]): void {
    this._extraCssFiles = [...this._extraCssFiles, ...extraCssFiles];
    this.updateThemeCss();
  }

  private _updateEntries(): void {
    const filterInputValue = (<HTMLInputElement> DomUtils.getShadowId(this, ID_FILTER)).value;
    const filteredEntries = this._filterEntries(this._entries, filterInputValue);
    
    if (filteredEntries.length === 0) {
      this.selected = null;
    } else {
      const newSelectedIndex = filteredEntries.findIndex( (entry) => entry.id === this.selected);
      this.selected = filteredEntries[Math.max(0, newSelectedIndex)].id;
    }
    
    const html = this._formatEntries(filteredEntries, this.selected, filterInputValue);
    DomUtils.getShadowId(this, ID_RESULTS).innerHTML = html;
  }

  private _scrollToSelected(): void {
    const resultsDiv = DomUtils.getShadowId(this, ID_RESULTS);
    const selectedElement = <HTMLElement> resultsDiv.querySelector("." + PopDownListPicker.CLASS_RESULT_SELECTED);
    const selectedRelativeTop = selectedElement.offsetTop - resultsDiv.offsetTop;
    resultsDiv.scrollTop = selectedRelativeTop;
  }

  private handleKeyDown(ev: KeyboardEvent) {
    if (ev.key === "Escape") {
      this._okId(null);
      ev.preventDefault();
      ev.stopPropagation();
      return;
    }
    
    const isPageKey = ev.key === "PageUp" || ev.key === "PageDown";
    const isUp = ev.key === "PageUp" || ev.key === "ArrowUp" || ev.key === "Home";
    
    if (isPageKey || isUp || ev.key === "ArrowDown" || ev.key === "End" || ev.key === "Enter") {
      ev.preventDefault();
      ev.stopPropagation();
      
      const filterInput = <HTMLInputElement> DomUtils.getShadowId(this, ID_FILTER);
      const filteredEntries = this._filterEntries(this._entries, filterInput.value);
      if (filteredEntries.length === 0) {
        return;
      }
  
      const selectedIndex = filteredEntries.findIndex( (entry) => entry.id === this.selected);
      
      if (ev.key === "Enter") {
        // Enter
        if (this.selected !== null) {
          this._okId(this.selected);
        }
      } else {
        
        const resultsDiv = DomUtils.getShadowId(this, ID_RESULTS);
        
        // Determine the step size.
        let stepSize = 1;
        if (isPageKey) {
          const selectedElement = <HTMLElement> resultsDiv.querySelector("." + PopDownListPicker.CLASS_RESULT_SELECTED);
          const selectedElementDimensions = selectedElement.getBoundingClientRect();
          
          stepSize = Math.floor(resultsDiv.clientHeight / selectedElementDimensions.height);
        }
        
        if (isUp) {
          if (ev.key === "Home") {
            this.selected = filteredEntries[0].id;
          } else {
            this.selected = filteredEntries[Math.max(0, selectedIndex-stepSize)].id;
          }
        } else {
          if (ev.key === "End") {
            this.selected = filteredEntries[filteredEntries.length-1].id;
          } else {
            this.selected = filteredEntries[Math.min(filteredEntries.length-1, selectedIndex+stepSize)].id;
          }
        }
        
        const top = resultsDiv.scrollTop;
        this._updateEntries();
        resultsDiv.scrollTop = top;
        
        const selectedElement = <HTMLElement> resultsDiv.querySelector("." + PopDownListPicker.CLASS_RESULT_SELECTED);
        const selectedRelativeTop = selectedElement.offsetTop - resultsDiv.offsetTop;
        if (top > selectedRelativeTop) {
          resultsDiv.scrollTop = selectedRelativeTop;
        } else {
          const selectedElementDimensions = selectedElement.getBoundingClientRect();
          if (selectedRelativeTop + selectedElementDimensions.height > top + resultsDiv.clientHeight) {
            resultsDiv.scrollTop = selectedRelativeTop + selectedElementDimensions.height - resultsDiv.clientHeight;
          }
        }
      }
    }
  }

  open(x: number, y: number, width: number, height: number): void {
    const resultsDiv = <HTMLDivElement> DomUtils.getShadowId(this, ID_RESULTS);
    resultsDiv.style.maxHeight = `${height/2}px`;
  
    const filterInput = <HTMLInputElement> DomUtils.getShadowId(this, ID_FILTER);
    filterInput.value = "";
    this._updateEntries();
    filterInput.focus();

    const dialog = <PopDownDialog> DomUtils.getShadowId(this, ID_DIALOG);
    dialog.open(x, y, width, height);

    this._scrollToSelected();      
  }

  close(): void {
    const dialog = <PopDownDialog> DomUtils.getShadowId(this, ID_DIALOG);
    dialog.close();
  }

  private _okId(selectedId: string): void {
    if (this._laterHandle === null) {
      this._laterHandle = doLater( () => {
        this.close();
        this._laterHandle = null;
        const event = new CustomEvent("selected", { detail: {selected: selectedId } });
        this.dispatchEvent(event);
      });
    }
  }
}

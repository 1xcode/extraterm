/*
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { Disposable } from 'extraterm-extension-api';
import { WebComponent } from 'extraterm-web-component-decorators';

import * as ThemeTypes from '../../theme/Theme';
import * as DomUtils from '../DomUtils';
import {doLater} from 'extraterm-later';
import {PopDownDialog} from './PopDownDialog';
import {Logger, getLogger} from "extraterm-logging";
import { log } from "extraterm-logging";
import { TemplatedElementBase } from './TemplatedElementBase';

const ID_DIALOG = "ID_DIALOG";
const ID_FILTER = "ID_FILTER";
const ID_RESULTS = "ID_RESULTS";

/**
 * A List Picker.
 */
@WebComponent({tag: "et-listpicker"})
export class ListPicker<T extends { id: string; }> extends TemplatedElementBase {
  
  static TAG_NAME = "ET-LISTPICKER";
  static ATTR_DATA_ID = "data-id";
  static CLASS_RESULT_SELECTED = "CLASS_RESULT_SELECTED";
  static CLASS_RESULT_ENTRY = "CLASS_RESULT_ENTRY";

  private _log: Logger;
  private _entries: T[] = [];
  private _selectedId: string = null;
  private _filterEntries: (entries: T[], filterText: string) => T[];
  private _formatEntries: (filteredEntries: T[], selectedId: string, filterInputValue: string) => string;
  private _laterHandle: Disposable = null;
  private _extraCssFiles: ThemeTypes.CssFile[] = [];

  constructor() {
    super({ delegatesFocus: true });
    this._log = getLogger(ListPicker.TAG_NAME, this);
    this._filterEntries = (entries: T[], filterText: string): T[] => entries;
    this._formatEntries = (filteredEntries: T[], selectedId: string, filterInputValue: string): string => 
      filteredEntries.map(entry => `<div ${ListPicker.ATTR_DATA_ID}='${entry.id}'>${entry.id}</div>`).join("");

    const filterInput = <HTMLInputElement> this._elementById(ID_FILTER);
    filterInput.addEventListener('input', (ev: Event) => {
      this._updateEntries();
    });
    
    filterInput.addEventListener('keydown', (ev: KeyboardEvent) => { this.handleKeyDown(ev); });
    
    const resultsDiv = DomUtils.getShadowId(this, ID_RESULTS);
    resultsDiv.addEventListener('click', (ev: Event) => {
      for (const node of ev.path) {
        if (node instanceof HTMLElement) {
          const dataId = node.attributes.getNamedItem(ListPicker.ATTR_DATA_ID);
          if (dataId !== undefined && dataId !== null) {
            this._okId(dataId.value);
          }
        }
      }
    });
  }

  protected _html(): string {
    return `
      <div id="${ID_DIALOG}">
        <div class="gui-packed-row"><input type="text" id="${ID_FILTER}" class="expand" /></div>
        <div id="${ID_RESULTS}"></div>
      </div>
    `;
  }

  focus(): void {
    const filter = DomUtils.getShadowId(this, ID_FILTER);
    if (filter != null) {
      filter.focus();
    }
  }

  getFilter(): string {
    const filterInput = <HTMLInputElement> DomUtils.getShadowId(this, ID_FILTER);
    return filterInput.value;
  }

  setFilter(text: string): void {
    const filterInput = <HTMLInputElement> DomUtils.getShadowId(this, ID_FILTER);
    filterInput.value = text;
    this._updateEntries();
  }

  getSelected(): string {
    return this._selectedId;
  }

  setSelected(selectedId: string): void {
    this._selectedId = selectedId;
    this._updateEntries();
    this._scrollToSelected();
  }

  setEntries(entries: T[]): void {
    this._entries = entries;
    this._selectedId = null;
    
    const filterInput = <HTMLInputElement> DomUtils.getShadowId(this, ID_FILTER);
    if (filterInput !== null) {
      filterInput.value = "";
    }
    this._updateEntries();
  }

  getEntries(): T[] {
    return this._entries;
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
  
  protected _themeCssFiles(): ThemeTypes.CssFile[] {
    const extraCssFiles = this._extraCssFiles == null ? [] : this._extraCssFiles;
    return [ThemeTypes.CssFile.GENERAL_GUI, ThemeTypes.CssFile.FONT_AWESOME, ThemeTypes.CssFile.EXTRAICONS,
      ThemeTypes.CssFile.GUI_LIST_PICKER, ...extraCssFiles]; // FIXME
  }

  private _updateEntries(): void {
    const filterInputValue = (<HTMLInputElement> DomUtils.getShadowId(this, ID_FILTER)).value;
    const filteredEntries = this._filterEntries(this._entries, filterInputValue);
    
    if (filteredEntries.length === 0) {
      this._selectedId = null;
    } else {
      const newSelectedIndex = filteredEntries.findIndex( (entry) => entry.id === this._selectedId);
      this._selectedId = filteredEntries[Math.max(0, newSelectedIndex)].id;
    }
    
    const html = this._formatEntries(filteredEntries, this._selectedId, filterInputValue);
    DomUtils.getShadowId(this, ID_RESULTS).innerHTML = html;
  }

  private _scrollToSelected(): void {
    const resultsDiv = DomUtils.getShadowId(this, ID_RESULTS);
    const selectedElement = <HTMLElement> resultsDiv.querySelector("." + ListPicker.CLASS_RESULT_SELECTED);
    const selectedRelativeTop = selectedElement.offsetTop - resultsDiv.offsetTop;
    resultsDiv.scrollTop = selectedRelativeTop;
  }

  //-----------------------------------------------------------------------
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
  
      const selectedIndex = filteredEntries.findIndex( (entry) => entry.id === this._selectedId);
      
      if (ev.key === "Enter") {
        if (this._selectedId !== null) {
          this._okId(this._selectedId);
        }
      } else {
        
        const resultsDiv = DomUtils.getShadowId(this, ID_RESULTS);
        
        // Determine the step size.
        let stepSize = 1;
        if (isPageKey) {
          const selectedElement = <HTMLElement> resultsDiv.querySelector("." + ListPicker.CLASS_RESULT_SELECTED);
          const selectedElementDimensions = selectedElement.getBoundingClientRect();
          
          stepSize = Math.floor(resultsDiv.clientHeight / selectedElementDimensions.height);
        }
        
        if (isUp) {
          if (ev.key === "Home") {
            this._selectedId = filteredEntries[0].id;
          } else {
            this._selectedId = filteredEntries[Math.max(0, selectedIndex-stepSize)].id;
          }
        } else {
          if (ev.key === "End") {
            this._selectedId = filteredEntries[filteredEntries.length-1].id;
          } else {
            this._selectedId = filteredEntries[Math.min(filteredEntries.length-1, selectedIndex+stepSize)].id;
          }
        }
        
        const top = resultsDiv.scrollTop;
        this._updateEntries();
        resultsDiv.scrollTop = top;
        
        const selectedElement = <HTMLElement> resultsDiv.querySelector("." + ListPicker.CLASS_RESULT_SELECTED);
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

    this._scrollToSelected();      
  }

  private _okId(selectedId: string): void {
    if (this._laterHandle === null) {
      this._laterHandle = doLater( () => {
        this._laterHandle = null;
        const event = new CustomEvent("selected", { detail: {selected: selectedId } });
        this.dispatchEvent(event);
      });
    }
  }
}

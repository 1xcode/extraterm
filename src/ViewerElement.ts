/*
 * Copyright 2014-2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import * as fs from 'fs';
import * as Util from './gui/Util';
import * as VirtualScrollArea from './VirtualScrollArea';
import {Mode, VisualState, CursorMoveDetail} from './ViewerElementTypes';
import {ThemeableElementBase} from './ThemeableElementBase';
import * as BulkDomOperation from './BulkDomOperation';
import * as CodeMirrorOperation from './CodeMirrorOperation';

type VirtualScrollable = VirtualScrollArea.VirtualScrollable;
type SetterState = VirtualScrollArea.SetterState;

export abstract class ViewerElement extends ThemeableElementBase implements VirtualScrollable {
  
  static EVENT_BEFORE_SELECTION_CHANGE = "before-selection-change"

  static EVENT_CURSOR_MOVE = "cursor-move";

  static EVENT_CURSOR_EDGE = "cursor-edge";

  /**
   * Type guard for detecting a ViewerElement instance.
   * 
   * @param  node the node to test
   * @return      True if the node is a EtCodeMirrorViewer.
   */
  static isViewerElement(node: Node): node is ViewerElement {
    return node !== null && node !== undefined && node instanceof ViewerElement;
  }
  
  getTitle(): string {
    return "ViewerElement";
  }
  
  hasFocus(): boolean {
    return false;
  }
  
  /**
   * Name of a Font Awesome icon to represent this viewer.
   */
  getAwesomeIcon(): string {
    return "desktop";
  }
  
  /**
   * Gets the selected text.
   *
   * @return the selected text or null if there is no selection.
   */
  getSelectionText(): string {
    return null;
  }
  
  clearSelection(): void {
  }
 
  isFocusable(): boolean {
    return false;
  }
  
  setFocusable(value: boolean) {
  }
  
  getVisualState(): VisualState {
    return VisualState.AUTO;
  }

  setVisualState(state: VisualState): void {
    
  }

  getMode(): Mode {
    return Mode.DEFAULT;
  }
  
  setMode(mode: Mode): void {
  }

  getText(): string {
    return null;
  }

  setText(text: string): void {
  }

  getMimeType(): string {
    return null;
  }
  
  setMimeType(mimetype: string): void {
  }

  getEditable(): boolean {
    return false;
  }

  setEditable(editable: boolean): void {
  }
    
  // VirtualScrollable
  getMinHeight(): number {
    return 0;
  }

  // VirtualScrollable
  getVirtualHeight(containerHeight: number): number {
    return 0;
  }
  
  // VirtualScrollable
  getReserveViewportHeight(containerHeight: number): number {
    return 0;
  }
  
  // VirtualScrollable
  setDimensionsAndScroll(setterState: SetterState): void {
  }

  markVisible(visible: boolean): void {
  }

  getCursorPosition(): CursorMoveDetail {
    return {
      left: 0,
      top: 0,
      bottom: 0,
      viewPortTop: 0
    };
  }
   
  setCursorPositionBottom(x: number): boolean {
    return false;
  }
  
  setCursorPositionTop(x: number): boolean {
    return false;
  }
  
  setBytes(buffer: Buffer, mimeType: string): void {
    
  }
}

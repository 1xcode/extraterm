/*
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as ExtensionApi from "@extraterm/extraterm-extension-api";
import { InternalExtensionContext } from "../InternalTypes";
import { TerminalViewer } from "../../viewers/TerminalAceViewer";

export class TerminalOutputDetailsProxy implements ExtensionApi.TerminalOutputDetails {

  #scrollback: ExtensionApi.Screen = null;

  constructor(internalExtensionContext: InternalExtensionContext, private _terminalViewer: TerminalViewer) {
    this._terminalViewer.onDispose(this._handleTerminalViewerDispose.bind(this));
  }

  private _handleTerminalViewerDispose(): void {
    this._terminalViewer = null;
  }

  private _checkIsAlive(): void {
    if ( ! this.isAlive) {
      throw new Error("TerminalOutputDetails is not alive and can no longer be used.");
    }
  }

  get isAlive(): boolean {
    return this._terminalViewer != null;
  }

  get hasPty(): boolean {
    this._checkIsAlive();
    return this._terminalViewer.getEmulator() != null;
  }

  get scrollback(): ExtensionApi.Screen {
    if (this.#scrollback == null) {
      this.#scrollback = new ScrollbackProxy(this._terminalViewer);
    }
    return this.#scrollback;
  }

  find(needle: string, options?: ExtensionApi.FindOptions): boolean {
    this._checkIsAlive();
    return this._terminalViewer.find(needle, options);
  }

  findNext(needle: string): boolean {
    this._checkIsAlive();
    return this._terminalViewer.findNext(needle);
  }

  findPrevious(needle: string): boolean {
    this._checkIsAlive();
    return this._terminalViewer.findPrevious(needle);
  }

  hasSelection(): boolean {
    this._checkIsAlive();
    return this._terminalViewer.hasSelection();
  }

  highlight(re: RegExp): void {
    this._checkIsAlive();
    this._terminalViewer.highlight(re);
  }
}

class ScrollbackProxy implements ExtensionApi.Screen {

  constructor(private _terminalViewer) {
  }

  get width(): number {
    return this._terminalViewer.getScreenWidth();
  }

  get height(): number {
    return this._terminalViewer.getScrollbackLength();
  }

  getLineText(line: number): string {
    return this._terminalViewer.getScrollbackLine(line);
  }

  applyHyperlink(line: number, x: number, length: number, url: string): void {
    this._terminalViewer.applyScrollbackHyperlink(line, x, length, url);
  }
}

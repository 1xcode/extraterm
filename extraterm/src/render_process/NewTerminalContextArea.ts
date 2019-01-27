/*
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { WebComponent } from 'extraterm-web-component-decorators';
import { Logger } from 'extraterm-extension-api';
import { getLogger, log } from 'extraterm-logging';
import { dispatchContextMenuRequest } from './command/CommandUtils';

@WebComponent({tag: "et-new-terminal-button"})
export class NewTerminalContextArea extends HTMLElement {

  static TAG_NAME = "et-new-terminal-button";

  private _log: Logger;

  constructor() {
    super();
    this._log = getLogger("NewTerminalButton", this);
    this.addEventListener('contextmenu', ev => this._handleContextMenuCapture(ev), true);
  }

  private _handleContextMenuCapture(ev: MouseEvent): void {
    ev.stopImmediatePropagation();
    ev.preventDefault();
    dispatchContextMenuRequest(this, ev.clientX, ev.clientY);
  }
}

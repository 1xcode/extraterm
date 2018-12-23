/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as he from "he";

import { getLogger } from "extraterm-logging";
import { Logger } from "extraterm-extension-api";
import { ContextMenu } from "../gui/ContextMenu";
import { trimBetweenTags } from "extraterm-trim-between-tags";
import * as DomUtils from "../DomUtils";
import { eventToCommandableStack, commandableStackToBoundCommands, CommandType, COMMAND_OPEN_COMMAND_PALETTE } from "./CommandUtils";
import { BoundCommand, Commandable } from "./CommandTypes";
import { doLater } from "../../utils/DoLater";
import { ExtensionManager } from "../extension/InternalTypes";
import { MenuItem } from "../gui/MenuItem";
import { DividerMenuItem } from "../gui/DividerMenuItem";
import { CheckboxMenuItem } from "../gui/CheckboxMenuItem";

const ID_APPLICATION_CONTEXT_MENU = "ID_APPLICATION_CONTEXT_MENU";


export class ApplicationContextMenu {
  private _log: Logger;
  private _contextMenuElement: ContextMenu = null
  private _menuEntries: BoundCommand[] = null;
  
  constructor(private extensionManager: ExtensionManager, private rootCommandable: Commandable) {
    this._log = getLogger("ApplicationContextMenu", this);
    
    const contextMenuFragment = DomUtils.htmlToFragment(trimBetweenTags(`
    <${ContextMenu.TAG_NAME} id="${ID_APPLICATION_CONTEXT_MENU}">
    </${ContextMenu.TAG_NAME}>
    `));
    window.document.body.appendChild(contextMenuFragment)
    this._contextMenuElement = <ContextMenu> window.document.getElementById(ID_APPLICATION_CONTEXT_MENU);

    this._contextMenuElement.addEventListener("selected", (ev: CustomEvent) => {
      this._executeMenuCommand(ev.detail.name);
    });

    this._contextMenuElement.addEventListener("close", () => {
      const oldMenuEntries = this._menuEntries;
      // We do this to avoid holding refs to objects after the context menu has closed. (-> GC). The delay
      // is needed because a 'selected' event may need the list immediately after this 'close' event.
      doLater( () => {
        if (oldMenuEntries === this._menuEntries) {
          this._menuEntries = null;
        }
      });
    });
  }

  handleContextMenuRequest(ev: CustomEvent): void {
    const requestCommandableStack = [...eventToCommandableStack(ev), this.rootCommandable];

    doLater( () => {
      const entries = commandableStackToBoundCommands(CommandType.CONTEXT_MENU, requestCommandableStack,
                                                      this.extensionManager);
      this._menuEntries = this._filterOutDuplicateSpecialCommands(entries);

      if (this._menuEntries.length === 0) {
        this._menuEntries = null;
        return;
      }
      
      this._contextMenuElement.innerHTML = this._formatMenuHtml(this._menuEntries);
      this._contextMenuElement.open(ev.detail.x, ev.detail.y);
    });
  }

  private _formatMenuHtml(menuEntries: BoundCommand[]): string {
    const htmlParts: string[] = [];
    let lastGroup = "";
    let index = 0;
    for (const command of menuEntries) {
      if (command.group !== lastGroup && lastGroup !== "") {
        htmlParts.push(`<${DividerMenuItem.TAG_NAME}></${DividerMenuItem.TAG_NAME}>`);
      }
      lastGroup = command.group;
      htmlParts.push(this._boundCommandToHtml("index_" + index, command));
      index++;
    }
    return htmlParts.join("");
  }

  private _filterOutDuplicateSpecialCommands(commands: BoundCommand[]): BoundCommand[] {
    const specialCommands = new Set<string>([COMMAND_OPEN_COMMAND_PALETTE]);
    const seenSpecialCommands = new Set<string>();

    const result: BoundCommand[] = [];
    for (const command of commands) {
      if (specialCommands.has(command.id)) {
        if (seenSpecialCommands.has(command.id)) {
          continue;
        }
        seenSpecialCommands.add(command.id);
      }
      result.push(command);
    }
    return result;
  }

  private _boundCommandToHtml(name: string, command: BoundCommand): string {
    if (command.checked != null) {
      return `<${CheckboxMenuItem.TAG_NAME} name="${name}" icon="${command.icon}" checked="${command.checked}"
        shortcut="${command.shortcut}">${he.encode(command.label)}</${CheckboxMenuItem.TAG_NAME}>`;
    } else {
      return `<${MenuItem.TAG_NAME} name="${name}" icon="${command.icon}"
        shortcut="${command.shortcut}">${he.encode(command.label)}</${MenuItem.TAG_NAME}>`;
    }
  }

  private _executeMenuCommand(id: string): void {
    if (this._menuEntries == null) {
      return;
    }

    const index = Number.parseInt(id.substr("index_".length), 10);
    const boundCommand = this._menuEntries[index];
    doLater( () => {
      boundCommand.commandExecutor.executeCommand(boundCommand.id, boundCommand.commandArguments);
    });
  }
}

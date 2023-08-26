/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as ExtensionApi from "@extraterm/extraterm-extension-api";
import { InternalExtensionContext } from "../../InternalTypes.js";
import { CommandFunction } from "../../CommandsRegistry.js";


export class CommandsImpl implements ExtensionApi.Commands {
  #internalExtensionContext: InternalExtensionContext;

  constructor(internalExtensionContext: InternalExtensionContext) {
    this.#internalExtensionContext = internalExtensionContext;
  }

  registerCommand(name: string, commandFunc: CommandFunction, customizer?: () => ExtensionApi.CustomizedCommand): void {
    return this.#internalExtensionContext.commands.registerCommand(name, commandFunc, customizer);
  }

  executeCommand<T>(name: string, args?: any): Promise<T> {
    return this.#internalExtensionContext.commands.executeCommand<T>(name, args);
  }

  get commands(): string[] {
    return this.#internalExtensionContext.commands.commands;
  }
}

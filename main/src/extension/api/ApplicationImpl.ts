/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import open from "open";
import * as fs from "node:fs";
import * as path from "node:path";
import * as ExtensionApi from "@extraterm/extraterm-extension-api";
import { ClipboardImpl } from "./ClipboardImpl.js";


export class ApplicationImpl implements ExtensionApi.Application {
  #log: ExtensionApi.Logger = null;
  #clipboard: ClipboardImpl = null;
  #version = "";

  constructor(version: string, logger: ExtensionApi.Logger) {
    this.#log = logger;
    this.#clipboard = new ClipboardImpl(logger);
    this.#version = version;
  }

  get clipboard(): ExtensionApi.Clipboard {
    return this.#clipboard;
  }

  openExternal(url: string): void {
    if (url == null) {
      return;
    }
    open(url);
  }

  showItemInFileManager(itemPath: string): void {
    if (itemPath == null) {
      return;
    }

    const stats = fs.statSync(itemPath);
    let cleanPath = itemPath;
    if (!stats.isDirectory()) {
      cleanPath = path.dirname(itemPath);
    }
    open(cleanPath);
  }

  get isLinux(): boolean {
    return process.platform === "linux";
  }

  get isMacOS(): boolean {
    return process.platform === "darwin";
  }

  get isWindows(): boolean {
    return process.platform === "win32";
  }

  get version(): string {
    return this.#version;
  }
}

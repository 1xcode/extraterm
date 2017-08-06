/*
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import * as CodeMirror from 'codemirror';

/**
 * A resource which can later be freed by calling `dispose()`.
 */
export interface Disposable {
  dispose(): void;
}

/**
 * Function which represents a specific event which you can subscribe to.
 */
export interface Event<T> {
  (listener: (e: T) => any): Disposable;
}

export interface Tab {
  getTerminal(): Terminal;

  /**
   * Show an input box requesting a number.
   * 
   */
  showNumberInput(options: NumberInputOptions): Promise<number | undefined>;

  showListPicker(options: ListPickerOptions): Promise<number | undefined>;
}


export interface Terminal {
  type(text: string): void;
//   getSections(): Section[];
  getTab(): Tab;
}

// export interface Section {

// }

export interface NumberInputOptions {
  /**
   * The title of the input box.
   */
  title: string;

  /**
   * The default value of the input box.
   */
  value: number;

  /**
   * The minimum acceptable value.
   */
  minimum?: number;

  /**
   * The maximum acceptable value.
   */
  maximum?: number;
}

export interface ListPickerOptions {
  title: string;
  items: string[];
  selectedItemIndex: number;
}

export interface Viewer {
  getTab(): Tab;
  getOwningTerminal(): Terminal;
}

export interface Frame {
  contents: Viewer;
}

export interface TerminalOutputViewer extends Viewer {

}

export interface TextViewer extends Viewer {
  getTabSize(): number;
  setTabSize(size: number): void;
  getMimeType(): string;
  setMimeType(mimeType: string): void;
}


/**
 * Defines a command for display in the Command Palette.
 */
export interface CommandEntry {
  /**
   * Identifier for this command. This ID is used internally and should only
   * consist of alphanumeric characters ([A-Z0-9]+). It must be unique
   * to this extension and stable between calls.
   */
  id: string;

  /**
   * Optional identifier used to grouping related commands in the command
   * palette.
   * 
   * Commands with the same group name are visually separated from the
   * surrounding commands.
   */
  group?: string;

  iconLeft?: string;
  iconRight?: string;

  /**
   * Label for this command. This string is shown in the Command Palette to
   * the user.
   */
  label: string;

   /**
    * Optional object which will be passed to the command executor when this
    * command is run.
    */
  commandArguments?: object;
}


export interface Workspace {

  getTerminals(): Terminal[];

  onDidCreateTerminal: Event<Terminal>;

  // onWillDestroyTerminal: Event<Terminal>;
  registerCommandsOnTerminal(
    commandLister: (terminal: Terminal) => CommandEntry[],
    commandExecutor: (terminal: Terminal, commandId: string, commandArguments?: object) => void): Disposable;

  registerCommandsOnTextViewer(
    commandLister: (textViewer: TextViewer) => CommandEntry[],
    commandExecutor: (textViewer: TextViewer, commandId: string, commandArguments?: object) => void): Disposable;
}

export interface ExtensionContext {
  workspace: Workspace;
  codeMirrorModule: typeof CodeMirror;
}

/**
 * An extension module as viewed from Extraterm.
 */
export interface ExtensionModule {

  /**
   * Each extension module must export a functioncalled `activate()` with signature below.
   * 
   * @param context The extension context which this extension is running in.
   * @return The public API of this extension, or null or undefined.
   */
  activate(context: ExtensionContext): any;
}

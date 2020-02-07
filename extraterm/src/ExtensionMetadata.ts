/*
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

export interface ExtensionMetadata {
  name: string;
  path: string;
  main?: string;
  version?: string;
  description?: string;
  homepage?: string;
  keywords?: string[];
  displayName?: string;
  contributes: ExtensionContributes;
  includePlatform?: ExtensionPlatform[];
  excludePlatform?: ExtensionPlatform[];
  isInternal?: boolean;
}

export interface ExtensionPlatform {
  os?: string;
  arch?: string;
}

export interface ExtensionContributes {
  commands: ExtensionCommandContribution[];
  keybindings: ExtensionKeybindingsContribution[];
  menus: ExtensionMenusContribution;
  sessionBackends: ExtensionSessionBackendContribution[];
  sessionEditors: ExtensionSessionEditorContribution[];
  syntaxThemes: ExtensionSyntaxThemeContribution[];
  syntaxThemeProviders: ExtensionSyntaxThemeProviderContribution[];
  tabTitleWidgets: ExtensionTabTitlesWidgetContribution[];
  terminalBorderWidgets: ExtensionTerminalBorderContribution[];
  terminalThemes: ExtensionTerminalThemeContribution[];
  terminalThemeProviders: ExtensionTerminalThemeProviderContribution[];
  viewers: ExtensionViewerContribution[];
}

export type Category = "global" |
                        "application" |
                        "window" |
                        "textEditing" |
                        "terminal" |
                        "terminalCursorMode" |
                        "viewer";

export interface WhenVariables {
  true: boolean;
  false: boolean;
  terminalFocus: boolean;
  isCursorMode: boolean;
  isNormalMode: boolean;
  textEditorFocus: boolean;
  isTextEditing: boolean;
  viewerFocus: boolean;
}

export interface ExtensionCommandContribution {
  command: string;
  title: string;
  when?: string;
  category?: Category;
  order?: number;
  icon?: string;
  checked?: boolean;
}

export interface ExtensionViewerContribution {
  name: string;
  mimeTypes: string[];
  css: ExtensionCss;
}

export interface ExtensionCss {
  directory: string;
  cssFile: string[];
  fontAwesome: boolean;
}

export interface ExtensionSessionEditorContribution {
  /**
   * Human readable name for this session editor.
   */
  name: string;

  /**
   * Internal symbol used internally for indentifying this type of session.
   */
  type: string;
  css: ExtensionCss;
}

export interface ExtensionSessionBackendContribution {
  /**
   * Human readable name for this session editor.
   */
  name: string;

  /**
   * Symbol used internally for identifying this type of session.
   */
  type: string;
}

export interface ExtensionSyntaxThemeProviderContribution {
  /**
   * Internal name for this provider.
   */
  name: string;

  humanFormatNames: string[];
}

export interface ExtensionSyntaxThemeContribution {
  path: string;
}

export type BorderDirection = "north" | "south" | "east" | "west";

export interface ExtensionTabTitlesWidgetContribution {
  name: string;
  css: ExtensionCss;
}

export interface ExtensionTerminalBorderContribution {
  name: string;
  border: BorderDirection;
  css: ExtensionCss;
}

export interface ExtensionTerminalThemeProviderContribution {
  /**
   * Internal name for this provider.
   */
  name: string;

  humanFormatNames: string[];
}

export interface ExtensionTerminalThemeContribution {
  path: string;
}

export interface ExtensionKeybindingsContribution {
  path: string;
}

export interface ExtensionMenusContribution {
  contextMenu: ExtensionMenu[];
  commandPalette: ExtensionMenu[];
  emptyPane: ExtensionMenu[];
  newTerminal: ExtensionMenu[];
  terminalTab: ExtensionMenu[];
}

export interface ExtensionMenu {
  command: string;
  show: boolean;
}

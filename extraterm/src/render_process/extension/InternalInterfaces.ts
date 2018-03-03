/*
 * Copyright 2017-2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import {ExtensionMetadata} from './ExtensionLoader';
import {EtTerminal} from '../Terminal';
import {TextViewer} from'../viewers/TextViewer';
import {ViewerElement} from '../viewers/ViewerElement';
import * as ExtensionApi from 'extraterm-extension-api';
import * as CommandPaletteRequestTypes from '../CommandPaletteRequestTypes';

export interface ExtensionManager {
  startUp(): void;
  getWorkspaceTerminalCommands(terminal: EtTerminal): CommandPaletteRequestTypes.CommandEntry[];
  getWorkspaceTextViewerCommands(textViewer: TextViewer): CommandPaletteRequestTypes.CommandEntry[];

  findViewerElementTagByMimeType(mimeType: string): string;
}

export interface ExtensionBridge {
  workspaceGetTerminals(): EtTerminal[];
  showNumberInput(terminal: EtTerminal, options: ExtensionApi.NumberInputOptions): Promise<number | undefined>;
  showListPicker(terminal: EtTerminal, options: ExtensionApi.ListPickerOptions): Promise<number | undefined>;
}

export interface InternalWorkspace extends ExtensionApi.Workspace {
  getTerminalCommands(extensionName: string, terminal: ExtensionApi.Terminal): CommandPaletteRequestTypes.CommandEntry[];
  getTextViewerCommands(extensionName: string, terminal: ExtensionApi.TextViewer): CommandPaletteRequestTypes.CommandEntry[];
  findViewerElementTagByMimeType(mimeType: string): string;
}

export interface InternalExtensionContext extends ExtensionApi.ExtensionContext {
  extensionBridge: ExtensionBridge;
  extensionMetadata: ExtensionMetadata;
  internalWorkspace: InternalWorkspace;
  getTabProxy(terminal: EtTerminal): ExtensionApi.Tab;
  getTerminalProxy(terminal: EtTerminal): ExtensionApi.Terminal;
  getViewerProxy(viewer: ViewerElement): ExtensionApi.Viewer;

  findViewerElementTagByMimeType(mimeType: string): string;
}

/*
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as path from 'path';
import * as _ from 'lodash';
import * as ExtensionApi from 'extraterm-extension-api';
import * as Ace from 'ace-ts';

import {Logger, getLogger} from "extraterm-logging";
import {EtTerminal} from '../Terminal';
import {TextViewer} from'../viewers/TextAceViewer';
import {ProxyFactoryImpl} from './ProxyFactoryImpl';
import {ExtensionManager, ExtensionUiUtils, InternalExtensionContext, InternalWindow, ProxyFactory, isMainProcessExtension, isSupportedOnThisPlatform} from './InternalTypes';
import {ExtensionUiUtilsImpl} from './ExtensionUiUtilsImpl';
import {WindowProxy} from './Proxies';
import { ExtensionMetadata } from '../../ExtensionMetadata';
import * as WebIpc from '../WebIpc';
import { BoundCommand } from '../command/CommandTypes';
import { CommandsRegistry } from './CommandsRegistry';
import { CommonExtensionState } from './CommonExtensionState';


interface ActiveExtension {
  metadata: ExtensionMetadata;
  contextImpl: InternalExtensionContext;
  publicApi: any;
  module: any;
}


export class ExtensionManagerImpl implements ExtensionManager {
  private _log: Logger = null;
  private _extensionMetadata: ExtensionMetadata[] = [];
  private _activeExtensions: ActiveExtension[] = [];
  private _extensionUiUtils: ExtensionUiUtils = null;
  private _proxyFactory: ProxyFactory = null;
  private _commonExtensionState: CommonExtensionState = {
    activeTerminal: null
  };

  constructor() {
    this._log = getLogger("ExtensionManager", this);
    this._extensionUiUtils = new ExtensionUiUtilsImpl();
    this._proxyFactory = new ProxyFactoryImpl(this._extensionUiUtils);
  }

  startUp(): void {
    this._extensionMetadata = WebIpc.requestExtensionMetadataSync();

    for (const extensionInfo of this._extensionMetadata) {
      if ( ! isMainProcessExtension(extensionInfo) && isSupportedOnThisPlatform(extensionInfo)) {
        this._startExtension(extensionInfo);
      }
    }
  }

  getWorkspaceTerminalCommands(terminal: EtTerminal): BoundCommand[] {
    return _.flatten(
      this._activeExtensions.map(activeExtension => {
        const ownerExtensionContext = activeExtension.contextImpl;
        const terminalProxy = ownerExtensionContext.proxyFactory.getTerminalProxy(terminal);
        return activeExtension.contextImpl.internalWindow.getTerminalCommands(
          activeExtension.metadata.name, terminalProxy);
      }));
  }

  getWorkspaceTextViewerCommands(textViewer: TextViewer): BoundCommand[] {
    return _.flatten(
      this._activeExtensions.map(activeExtension => {
        const extensionContext = activeExtension.contextImpl;
        const textViewerProxy = <ExtensionApi.TextViewer> extensionContext.proxyFactory.getViewerProxy(textViewer);
        return extensionContext.internalWindow.getTextViewerCommands(
          activeExtension.metadata.name, textViewerProxy);
      }));
  }

  findViewerElementTagByMimeType(mimeType: string): string {
    for (let extension of this._activeExtensions) {
      const tag = extension.contextImpl.findViewerElementTagByMimeType(mimeType);
      if (tag !== null) {
        return tag;
      }
    }
    return null;
  }

  private _startExtension(metadata: ExtensionMetadata): void {
    this._log.info(`Starting extension '${metadata.name}' in the render process.`);
    const module = this._loadExtensionModule(metadata);
    if (module != null) {
      try {
        const contextImpl = new InternalExtensionContextImpl(this._extensionUiUtils, metadata,
                                      this._proxyFactory, this._commonExtensionState);
        const publicApi = (<ExtensionApi.ExtensionModule> module).activate(contextImpl);
        this._activeExtensions.push({metadata, publicApi, contextImpl, module});
      } catch(ex) {
        this._log.warn(`Exception occurred while starting extensions ${metadata.name}. ${ex}`);
      }
    }
  }

  private _loadExtensionModule(extension: ExtensionMetadata): any {
    const mainJsPath = path.join(extension.path, extension.main);
    try {
      const module = require(mainJsPath);
      return module;
    } catch(ex) {
      this._log.warn(`Unable to load ${mainJsPath}. ${ex}`);
      return null;
    }
  }

  getAllSessionTypes(): { name: string, type: string }[] {
    return _.flatten(
      this._activeExtensions.map(activeExtension => {
        if (activeExtension.metadata.contributes.sessionEditors != null) {
          return activeExtension.metadata.contributes.sessionEditors.map(se => ({name: se.name, type: se.type}));
        } else {
          return [];
        }
      })
    );
  }

  getSessionEditorTagForType(sessionType: string): string {
    const seExtensions = this._activeExtensions.filter(ae => ae.metadata.contributes.sessionEditors != null);
    for (const extension of seExtensions) {
      const tag = extension.contextImpl.internalWindow.getSessionEditorTagForType(sessionType);
      if (tag != null) {
        return tag;
      }
    }
    return null;
  }

  getAllTerminalThemeFormats(): {name: string, formatName: string}[] {
    const results = [];
    for (const metadata of this._extensionMetadata) {
      for (const provider of metadata.contributes.terminalThemeProviders) {
        for (const formatName of provider.humanFormatNames) {
          results.push( { name: provider.name, formatName } );
        }
      }
    }
    return results;
  }

  getAllSyntaxThemeFormats(): {name: string, formatName: string}[] {
    const results = [];
    for (const metadata of this._extensionMetadata) {
      for (const provider of metadata.contributes.syntaxThemeProviders) {
        for (const formatName of provider.humanFormatNames) {
          results.push( { name: provider.name, formatName } );
        }
      }
    }
    return results;
  }

  setActiveTerminal(terminal: EtTerminal): void {
    this._commonExtensionState.activeTerminal = terminal;
  }
}


class InternalExtensionContextImpl implements InternalExtensionContext {
  commands: CommandsRegistry = null;
  window: InternalWindow = null;
  internalWindow: InternalWindow = null;
  aceModule: typeof Ace = Ace;
  logger: ExtensionApi.Logger = null;
  isBackendProcess = false;

  constructor(public extensionUiUtils: ExtensionUiUtils, public extensionMetadata: ExtensionMetadata, public proxyFactory: ProxyFactory, commonExtensionState: CommonExtensionState) {
    this.commands = new CommandsRegistry();
    this.window = new WindowProxy(this, commonExtensionState);
    this.internalWindow = this.window;
    this.logger = getLogger(extensionMetadata.name);
  }

  get backend(): never {
    this.logger.warn("'ExtensionContext.backend' is not available from a render process.");
    throw Error("'ExtensionContext.backend' is not available from a render process.");
  }

  findViewerElementTagByMimeType(mimeType: string): string {
    return this.internalWindow.findViewerElementTagByMimeType(mimeType);
  }
}

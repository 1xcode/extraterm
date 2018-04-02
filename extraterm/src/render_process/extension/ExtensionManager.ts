/*
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as CodeMirror from 'codemirror';
import * as path from 'path';
import * as _ from 'lodash';
import * as ExtensionApi from 'extraterm-extension-api';

import {Logger, getLogger} from '../../logging/Logger';
import * as CommandPaletteRequestTypes from '../CommandPaletteRequestTypes';
import {EtTerminal} from '../Terminal';
import {TextViewer} from'../viewers/TextViewer';
import {ProxyFactoryImpl} from './ProxyFactoryImpl';
import {ExtensionManager, ExtensionUiUtils, InternalExtensionContext, InternalWorkspace, ProxyFactory} from './InternalTypes';
import {ExtensionUiUtilsImpl} from './ExtensionUiUtilsImpl';
import {WorkspaceProxy} from './Proxies';
import { ExtensionMetadata } from '../../ExtensionMetadata';
import * as WebIpc from '../WebIpc';


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

  constructor() {
    this._log = getLogger("ExtensionManager", this);
    this._extensionUiUtils = new ExtensionUiUtilsImpl();
    this._proxyFactory = new ProxyFactoryImpl(this._extensionUiUtils);
  }

  startUp(): void {
    this._extensionMetadata = WebIpc.requestExtensionMetadataSync();

    for (const extensionInfo of this._extensionMetadata) {
      this._startExtension(extensionInfo);
    }
  }

  getWorkspaceTerminalCommands(terminal: EtTerminal): CommandPaletteRequestTypes.CommandEntry[] {
    return _.flatten(
      this._activeExtensions.map(activeExtension => {
        const ownerExtensionContext = activeExtension.contextImpl;
        const terminalProxy = ownerExtensionContext.proxyFactory.getTerminalProxy(terminal);
        return activeExtension.contextImpl.internalWorkspace.getTerminalCommands(
          activeExtension.metadata.name, terminalProxy);
      }));
  }

  getWorkspaceTextViewerCommands(textViewer: TextViewer): CommandPaletteRequestTypes.CommandEntry[] {
    return _.flatten(
      this._activeExtensions.map(activeExtension => {
        const extensionContext = activeExtension.contextImpl;
        const textViewerProxy = <ExtensionApi.TextViewer> extensionContext.proxyFactory.getViewerProxy(textViewer);
        return extensionContext.internalWorkspace.getTextViewerCommands(
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
    const module = this._loadExtensionModule(metadata);
    if (module != null) {
      try {
        const contextImpl = new InternalExtensionContextImpl(this._extensionUiUtils, metadata,
                                      this._proxyFactory);
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
    return [];
  }

  getSessionEditorTagForType(type: string): string {
    return null;
  }
}


class InternalExtensionContextImpl implements InternalExtensionContext {
  workspace: InternalWorkspace = null;
  internalWorkspace: InternalWorkspace = null;
  codeMirrorModule: typeof CodeMirror = CodeMirror;
  logger: ExtensionApi.Logger = null;

  constructor(public extensionUiUtils: ExtensionUiUtils, public extensionMetadata: ExtensionMetadata, public proxyFactory: ProxyFactory) {
    this.workspace = new WorkspaceProxy(this);
    this.internalWorkspace = this.workspace;
    this.logger = getLogger(extensionMetadata.name);
  }

  findViewerElementTagByMimeType(mimeType: string): string {
    return this.internalWorkspace.findViewerElementTagByMimeType(mimeType);
  }
}

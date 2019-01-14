/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as ExtensionApi from 'extraterm-extension-api';
import * as fs from 'fs';
import * as _ from 'lodash';
import * as path from 'path';

import { Logger, getLogger } from "extraterm-logging";
import { ExtensionMetadata, ExtensionSessionBackendContribution } from "../../ExtensionMetadata";
import { parsePackageJson } from './PackageFileParser';
import { ExtensionContext, Backend, SessionBackend, SyntaxThemeProvider, TerminalThemeProvider } from 'extraterm-extension-api';
import { log } from "extraterm-logging";
import { isMainProcessExtension, isSupportedOnThisPlatform } from '../../render_process/extension/InternalTypes';


interface ActiveExtension {
  metadata: ExtensionMetadata;
  publicApi: any;
  contextImpl: ExtensionContextImpl;
  module: any;
}

export interface LoadedSessionBackendContribution {
  metadata: ExtensionMetadata;
  sessionBackendMetadata: ExtensionSessionBackendContribution;
  sessionBackend: SessionBackend;
}

export interface LoadedSyntaxThemeProviderContribution {
  metadata: ExtensionMetadata;
  syntaxThemeProvider: SyntaxThemeProvider;
}

export interface LoadedTerminalThemeProviderContribution {
  metadata: ExtensionMetadata;
  terminalThemeProvider: TerminalThemeProvider;
}


export class MainExtensionManager {

  private _log: Logger = null;
  private _extensionMetadata: ExtensionMetadata[] = [];
  private _activeExtensions: ActiveExtension[] = [];

  constructor(private extensionPaths: string[]) {
    this._log = getLogger("MainExtensionManager", this);
  }

  scan(): void {
    this._extensionMetadata = _.flatten(this.extensionPaths.map(p => this._scanPath(p)));
  }

  getExtensionMetadata(): ExtensionMetadata[] {
    return this._extensionMetadata;
  }

  getSessionBackendContributions(): LoadedSessionBackendContribution[] {
    return _.flatten(this._activeExtensions.map(
      ae => ae.contextImpl.backend.__BackendImpl__sessionBackends));
  }

  getSessionBackend(type: string): ExtensionApi.SessionBackend {
    for (const extension of this._activeExtensions) {
      for (const backend of extension.contextImpl.backend.__BackendImpl__sessionBackends) {
        if (backend.sessionBackendMetadata.type === type) {
          return backend.sessionBackend;
        }
      }
    }
    return null;
  }

  getSyntaxThemeProviderContributions(): LoadedSyntaxThemeProviderContribution[] {
    return _.flatten(this._activeExtensions.map(
      ae => ae.contextImpl.backend.__BackendImpl__syntaxThemeProviders));
  }

  getTerminalThemeProviderContributions(): LoadedTerminalThemeProviderContribution[] {
    return _.flatten(this._activeExtensions.map(
      ae => ae.contextImpl.backend.__BackendImpl__terminalThemeProviders));
  }

  private _scanPath(extensionPath: string): ExtensionMetadata[] {
    if (fs.existsSync(extensionPath)) {
      const result: ExtensionMetadata[] = [];
      const contents = fs.readdirSync(extensionPath);
      for (const item of contents) {
        const packageJsonPath = path.join(extensionPath, item, "package.json");

        if (fs.existsSync(packageJsonPath)) {
          const extensionInfo = this._loadPackageJson(path.join(extensionPath, item));
          if (extensionInfo !== null) {
            result.push(extensionInfo);
            this._log.info(`Read extension metadata from '${extensionInfo.name}'.`);
          }
        } else {
          this._log.warn(`Unable to read ${packageJsonPath}, skipping`);
        }
      }
      return result;

    } else {
      this._log.warn(`Extension path ${extensionPath} doesn't exist.`);
      return [];
    }
  }

  private _loadPackageJson(extensionPath: string): ExtensionMetadata {
    const packageJsonPath = path.join(extensionPath, "package.json");
    const packageJsonString = fs.readFileSync(packageJsonPath, "UTF8");
    try {
      const packageJson = JSON.parse(packageJsonString);
      const result = parsePackageJson(packageJson, extensionPath);
      return result;
    } catch(ex) {
      this._log.warn(`An error occurred while processing '${packageJsonPath}': ` + ex);
      return null;   
    }
  }

  startUp(): void {
    for (const extensionInfo of this._extensionMetadata) {
      if (isMainProcessExtension(extensionInfo) && isSupportedOnThisPlatform(extensionInfo)) {
        this._startExtension(extensionInfo);
      }
    }
  }

  private _startExtension(metadata: ExtensionMetadata): void {
    this._log.info(`Starting extension '${metadata.name}' in the main process.`);

    let module = null;
    let publicApi = null;
    const contextImpl = new ExtensionContextImpl(metadata);
    if (metadata.main != null) {
      module = this._loadExtensionModule(metadata);
      if (module == null) {
        return;
      }
      try {
        publicApi = (<ExtensionApi.ExtensionModule> module).activate(contextImpl);
      } catch(ex) {
        this._log.warn(`Exception occurred while starting extensions ${metadata.name}. ${ex}`);
        return;
      }
    }

    this._activeExtensions.push({metadata, publicApi, contextImpl, module});
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
  
}

class ExtensionContextImpl implements ExtensionContext {
  get commands(): never {
    this.logger.warn("'ExtensionContext.commands' is only available from a window process, not the main process.");
    throw Error("'ExtensionContext.commands' is only available from a window process, not the main process.");
  }
  logger: ExtensionApi.Logger = null;
  isBackendProcess = true;
  backend: BackendImpl = null;

  constructor(public __extensionMetadata: ExtensionMetadata) {
    this.logger = getLogger("[Main]" + this.__extensionMetadata.name);
    this.backend = new BackendImpl(this.__extensionMetadata);
  }
  
  get window(): never {
    this.logger.warn("'ExtensionContext.window' is only available from a window process, not the main process.");
    throw Error("'ExtensionContext.window' is only available from a window process, not the main process.");    
  }

  get aceModule(): never {
    this.logger.warn("'ExtensionContext.aceModule' is only available from a window process, not the main process.");
    throw Error("'ExtensionContext.aceModule' is only available from a window process, not the main process.");
  }
}

class BackendImpl implements Backend {
  private _log: Logger = null;
  __BackendImpl__sessionBackends: LoadedSessionBackendContribution[] = [];
  __BackendImpl__syntaxThemeProviders: LoadedSyntaxThemeProviderContribution[] = [];
  __BackendImpl__terminalThemeProviders: LoadedTerminalThemeProviderContribution[] = [];

  constructor(public __extensionMetadata: ExtensionMetadata) {
    this._log = getLogger("Backend (" + this.__extensionMetadata.name + ")", this);
  }

  registerSessionBackend(name: string, backend: SessionBackend): void {
    for (const backendMeta of this.__extensionMetadata.contributes.sessionBackends) {
      if (backendMeta.name === name) {
        this.__BackendImpl__sessionBackends.push({
          metadata: this.__extensionMetadata,
          sessionBackendMetadata: backendMeta,
          sessionBackend: backend
        });
        return;
      }
    }

    this._log.warn(`Unable to register session backend '${name}' for extension ` +
      `'${this.__extensionMetadata.name}' because the session backend contribution data ` +
      `couldn't be found in the extension's package.json file.`);
    return;
  }

  registerSyntaxThemeProvider(name: string, provider: SyntaxThemeProvider): void {
    for (const backendMeta of this.__extensionMetadata.contributes.syntaxThemeProviders) {
      if (backendMeta.name === name) {
        this.__BackendImpl__syntaxThemeProviders.push({
          metadata: this.__extensionMetadata,
          syntaxThemeProvider: provider
        } );
        return;
      }
    }

    this._log.warn(`Unable to register syntax theme provider '${name}' for extension ` +
      `'${this.__extensionMetadata.name}' because the syntax theme provider contribution data ` +
      `couldn't be found in the extension's package.json file.`);
    return;
  }

  registerTerminalThemeProvider(name: string, provider: TerminalThemeProvider): void {
    for (const backendMeta of this.__extensionMetadata.contributes.terminalThemeProviders) {
      if (backendMeta.name === name) {
        this.__BackendImpl__terminalThemeProviders.push({
          metadata: this.__extensionMetadata,
          terminalThemeProvider: provider
        } );
        return;
      }
    }

    this._log.warn(`Unable to register terminal theme provider '${name}' for extension ` +
      `'${this.__extensionMetadata.name}' because the terminal theme provider contribution data ` +
      `couldn't be found in the extension's package.json file.`);
    return;
  }
}

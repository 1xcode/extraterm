/*
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as ExtensionApi from "@extraterm/extraterm-extension-api";

import { InternalExtensionContext } from "./InternalTypes";
import { ViewerElement } from "../viewers/ViewerElement";
import { EmbeddedViewer } from "../viewers/EmbeddedViewer";
import { TerminalViewer } from "../viewers/TerminalAceViewer";
import { TextViewer } from"../viewers/TextAceViewer";
import { TerminalOutputDetailsProxy } from "./proxy/TerminalOutputDetailsProxy";
import { TextViewerDetailsProxy } from "./proxy/TextViewerDetailsProxy";
import * as DomUtils from "../DomUtils";
import { EtTerminal } from "../Terminal";
import { EtViewerTab } from "../ViewerTab";


export class BlockImpl implements ExtensionApi.Block {

  private _type: string = null;
  private _details: any = null;

  constructor(private _internalExtensionContext: InternalExtensionContext, private _viewer: ViewerElement) {
  }

  private _init(): void {
    if (this._type != null) {
      return;
    }

    let insideViewer = this._viewer;
    if (this._viewer instanceof EmbeddedViewer) {
      insideViewer = this._viewer.getViewerElement();
    }

    if (insideViewer instanceof TerminalViewer) {
      this._details = new TerminalOutputDetailsProxy(this._internalExtensionContext, insideViewer);
      this._type = ExtensionApi.TerminalType;
    } else if (insideViewer instanceof TextViewer) {
      this._details = new TextViewerDetailsProxy(this._internalExtensionContext, insideViewer);
      this._type = ExtensionApi.TextViewerType;
    } else {
      this._type = "unknown";
    }
  }

  get type(): string {
    this._init();
    return this._type;
  }

  get details(): any {
    this._init();
    return this._details;
  }

  get tab(): ExtensionApi.Tab {
    const terminal = this._getOwningEtTerminal();
    if (terminal != null) {
      return this._internalExtensionContext._proxyFactory.getTabProxy(terminal);
    }
    const viewerTab = this._getOwningEtViewerTab();
    if (viewerTab != null) {
      return this._internalExtensionContext._proxyFactory.getTabProxy(viewerTab);
    }
    return null;
  }

  private _getOwningEtTerminal(): EtTerminal {
    const path = DomUtils.nodePathToRoot(this._viewer);
    for (const node of path) {
      if (node instanceof EtTerminal) {
        return node;
      }
    }
    return null;
  }

  private _getOwningEtViewerTab(): EtViewerTab {
    const path = DomUtils.nodePathToRoot(this._viewer);
    for (const node of path) {
      if (node instanceof EtViewerTab) {
        return node;
      }
    }
    return null;
  }
}

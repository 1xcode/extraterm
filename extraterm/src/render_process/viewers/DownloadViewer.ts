/**
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 */

import {BulkFileHandle, BulkFileState, Disposable, ViewerMetadata, ViewerPosture} from '@extraterm/extraterm-extension-api';
import { CustomElement } from 'extraterm-web-component-decorators';

import {DebouncedDoLater} from 'extraterm-later';
import {FileTransferProgress} from '../gui/file_transfer/FileTransferProgress';
import {Logger, getLogger} from "extraterm-logging";
import { log } from "extraterm-logging";
import {SimpleViewerElement} from '../viewers/SimpleViewerElement';
import {ViewerElement} from './ViewerElement';
import * as ThemeTypes from '../../theme/Theme';


@CustomElement("et-download-viewer")
export class DownloadViewer extends SimpleViewerElement implements Disposable {

  static TAG_NAME = "et-download-viewer";

  private _log: Logger;
  private _bulkFileHandle: BulkFileHandle = null;
  private _fileTransferProgress: FileTransferProgress = null;
  private _onAvailableSizeChangeDisposable: Disposable = null;
  private _onStateChangeDisposable: Disposable = null;
  private _updateLater: DebouncedDoLater = null;

  constructor() {
    super();
    this._log = getLogger("et-download-viewer", this);

    this._updateLater = new DebouncedDoLater(this._updateLaterCallback.bind(this), 250);

    this._fileTransferProgress =  <FileTransferProgress> document.createElement(FileTransferProgress.TAG_NAME);

    const div = document.createElement("DIV");
    div.id = "top_container";
    div.appendChild(this._fileTransferProgress);
    this.getContainerNode().appendChild(div);
  }

  getMetadata(): ViewerMetadata {
    const metadata = super.getMetadata();
    metadata.title = "Download";
    metadata.icon = "fa fa-download";
    if (this._bulkFileHandle != null) {
      const fileMetadata = this._bulkFileHandle.metadata;
      const filename = fileMetadata["filename"] != null ? fileMetadata["filename"] : "(unknown)";

      switch (this._bulkFileHandle.state) {
        case BulkFileState.DOWNLOADING:
          metadata.title = `Downloading ${filename}`;
          metadata.posture = ViewerPosture.NEUTRAL;
          metadata.icon = "fa fa-download";
          metadata.moveable = false;
          metadata.deleteable = false;
          break;

        case BulkFileState.COMPLETED:
          metadata.title = `Completed downloading ${filename}`;
          metadata.posture = ViewerPosture.SUCCESS;
          metadata.icon = "fa fa-check";
          break;

        case BulkFileState.FAILED:
          metadata.title = `Failed to download ${filename}`;
          metadata.posture = ViewerPosture.FAILURE;
          metadata.icon = "fa fa-times";
          break;
      }
    }

    return metadata;
  }

  private _updateLaterCallback(): void {
    const event = new CustomEvent(ViewerElement.EVENT_METADATA_CHANGE, { bubbles: true });
    this.dispatchEvent(event);
  }

  protected _themeCssFiles(): ThemeTypes.CssFile[] {
    return [ThemeTypes.CssFile.GENERAL_GUI, ThemeTypes.CssFile.DOWNLOAD_VIEWER];
  }

  // From viewerelementtypes.SupportsMimeTypes
  static supportsMimeType(mimeType): boolean {
    return ["application/octet-stream"].indexOf(mimeType) !== -1;
  }

  getBulkFileHandle(): BulkFileHandle {
    return this._bulkFileHandle;
  }

  setBulkFileHandle(handle: BulkFileHandle): Promise<void> {
    this._releaseBulkFileHandle();

    this._bulkFileHandle = handle;
    handle.ref();

    return new Promise( (resolve, reject) => {
      this._onAvailableSizeChangeDisposable = this._bulkFileHandle.onAvailableSizeChange(
        () => {
          this._fileTransferProgress.transferred = this._bulkFileHandle.availableSize;
        });

      this._onStateChangeDisposable = this._bulkFileHandle.onStateChange(() => {
        this._fileTransferProgress.finished = true;
        this._updateLater.trigger();
        resolve();
      });

      this._fileTransferProgress.transferred = handle.availableSize;
      this._fileTransferProgress.total = handle.totalSize;

      const metadata = handle.metadata;
      if (metadata["filename"] !== undefined) {
        this._fileTransferProgress.filename = <string> metadata["filename"];
      }
    });
  }

  private _releaseBulkFileHandle(): void {
    if (this._bulkFileHandle !== null) {
      this._onAvailableSizeChangeDisposable.dispose();
      this._onStateChangeDisposable.dispose();
      this._bulkFileHandle.deref();
    }
    this._bulkFileHandle = null;
  }

  dispose(): void {
    this._releaseBulkFileHandle();
    this._updateLater.cancel();
    super.dispose();
  }
}

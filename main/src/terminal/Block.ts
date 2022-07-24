/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { QWidget } from "@nodegui/nodegui";
import { BulkFileHandle, BlockMetadata } from "@extraterm/extraterm-extension-api";
import { Event } from "extraterm-event-emitter";

export interface Block {
  getWidget(): QWidget;
  getMetadata(): BlockMetadata;
  onMetadataChanged: Event<void>;
  getBulkFileHandle(): BulkFileHandle;
  setParent(parent: any): void;
  getParent(): any;
}

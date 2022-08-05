/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { QWidget } from "@nodegui/nodegui";
import { Disposable, Event } from "@extraterm/extraterm-extension-api";


export interface Tab extends Disposable {
  getIconName(): string;
  getTitle(): string;
  getContents(): QWidget;
  getTabWidget(): QWidget;
  setIsCurrent(isCurrent: boolean): void;
  focus(): void;
  unfocus(): void;
  getWindowTitle(): string;
  setWindowTitle(title: string): void;
  onWindowTitleChanged: Event<string>;
  setParent(parent: any);
  getParent(): any;
}

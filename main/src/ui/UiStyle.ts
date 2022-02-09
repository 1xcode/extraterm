/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { QIcon } from "@nodegui/nodegui";

export interface IconPair {
  normal: QIcon;
  hover: QIcon;
}

export interface UiStyle {
  getApplicationStyleSheet(guiScale: number, dpi: number): string;
  getButtonIcon(name: string): QIcon;
  getCommandPaletteIcon(name: string): QIcon;
  getToolbarButtonIconPair(name: string): IconPair;
  getBorderlessButtonIconPair(name: string): IconPair;
  getHTMLStyle(): string;
  getLinkLabelCSS(): string;
  getMenuIcon(name: string): QIcon;
  getSettingsMenuIcon(name: string): QIcon;
  getTabIcon(name: string): QIcon;
  getTrafficLightRunningColor(): string;
  getTrafficLightStoppedColor(): string;
  getFrameMarginLeftRightPx(): number;
  getDecoratedFrameMarginTopPx(): number;
  getDecoratedFrameMarginBottomPx(): number;
}
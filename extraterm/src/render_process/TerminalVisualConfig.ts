/*
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { TerminalTheme } from 'extraterm-extension-api';

export interface TerminalVisualConfig {
  fontFamily: string;
  fontSizePx: number;
  devicePixelRatio: number;
  terminalTheme: TerminalTheme;
}

export interface AcceptsTerminalVisualConfig {
  setTerminalVisualConfig(newTerminalVisualConfig: TerminalVisualConfig): void;
}

export function isAcceptsTerminalVisualConfig(instance: any): instance is AcceptsTerminalVisualConfig {
  if (instance === null || instance === undefined) {
    return false;
  }
  return (<AcceptsTerminalVisualConfig> instance).setTerminalVisualConfig !== undefined;
}

export function injectTerminalVisualConfig(instance: any, terminalVisualConfig: TerminalVisualConfig): void {
  if (isAcceptsTerminalVisualConfig(instance)) {
    instance.setTerminalVisualConfig(terminalVisualConfig);
  }
}

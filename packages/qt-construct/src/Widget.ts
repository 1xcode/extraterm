/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { FocusPolicy, NodeLayout, NodeWidget, QWidget, WidgetAttribute, WidgetEventTypes, WindowType } from "@nodegui/nodegui";

export interface WidgetOptions {
  attribute?: WidgetAttribute[];
  enabled?: boolean;
  id?: string;
  layout?: NodeLayout<any>;
  cssClass?: string | string[];
  windowTitle?: string;
  focusPolicy?: FocusPolicy;
  onEnter?: () => void;
  onLeave?: () => void;
  onKeyPress?: (nativeEvent /* NativeQEvent */) => void;
  windowFlag?: WindowType;
}

export function ApplyWidgetOptions(widget: NodeWidget<any>, options: WidgetOptions): void {
  const {
    attribute, enabled, id, cssClass, focusPolicy, layout, onEnter, onLeave, onKeyPress, windowTitle, windowFlag
  } = options;

  if (enabled !== undefined) {
    widget.setEnabled(enabled);
  }
  if (attribute !== undefined) {
    for (const attr of attribute) {
      widget.setAttribute(attr, true);
    }
  }
  if (id !== undefined) {
    widget.setObjectName(id);
  }
  if (layout !== undefined) {
    widget.setLayout(layout);
  }
  if (cssClass !== undefined) {
    widget.setProperty("cssClass", cssClass);
  }
  if (windowTitle !== undefined) {
    widget.setWindowTitle(windowTitle);
  }
  if (focusPolicy !== undefined) {
    widget.setFocusPolicy(focusPolicy);
  }
  if (onKeyPress !== undefined) {
    widget.addEventListener(WidgetEventTypes.KeyPress, onKeyPress);
  }
  if (onEnter !== undefined) {
    widget.addEventListener(WidgetEventTypes.Enter, onEnter);
  }
  if (onLeave !== undefined) {
    widget.addEventListener(WidgetEventTypes.Leave, onLeave);
  }
  if (windowFlag !== undefined) {
    widget.setWindowFlag(windowFlag, true);
  }
}

export function Widget(options: WidgetOptions): QWidget {
  const widget = new QWidget();
  ApplyWidgetOptions(widget, options);
  return widget;
}

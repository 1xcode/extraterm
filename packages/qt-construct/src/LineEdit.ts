/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { QLineEdit } from "@nodegui/nodegui";
import { ApplyWidgetOptions, WidgetOptions } from "./Widget";

export interface LineEditOptions extends WidgetOptions {
  text?: string;
  onTextEdited?: (newText: string) => void;
}

export function LineEdit(options: LineEditOptions): QLineEdit {
  const { text, onTextEdited } = options;
  const lineEdit = new QLineEdit();

  ApplyWidgetOptions(lineEdit, options);

  if (text != null) {
    lineEdit.setText(text);
  }
  if (onTextEdited !== undefined) {
    lineEdit.addEventListener("textEdited", onTextEdited);
  }
  return lineEdit;
}

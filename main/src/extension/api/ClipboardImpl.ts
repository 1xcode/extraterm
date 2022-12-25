/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as ExtensionApi from '@extraterm/extraterm-extension-api';
import { QApplication } from '@nodegui/nodegui';


export class ClipboardImpl implements ExtensionApi.Clipboard {
  #log: ExtensionApi.Logger = null;

  constructor(logger: ExtensionApi.Logger) {
    this.#log = logger;
  }

  writeText(text: string): void {
    if (text == null) {
      this.#log.warn(`An invalid value ('null' or 'undefined') was passed to 'clipboard.writeText()'.`);
      return;
    }
    const clipboard = QApplication.clipboard();
    clipboard.setText(text);
  }
}

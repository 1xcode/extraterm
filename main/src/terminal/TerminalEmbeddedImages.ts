/*
 * Copyright 2024 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import { EmbeddedImage, EmbeddedImageMap } from "extraterm-char-render-canvas";

export class TerminalEmbeddedImages {

  #embeddedImageMap: EmbeddedImageMap = new Map<number, EmbeddedImage>();

  getMap(): EmbeddedImageMap {
    return this.#embeddedImageMap;
  }
}

/**
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 */
import { StyleCode } from "extraterm-char-cell-grid";

export interface FontAtlas {
  drawCodePoint(ctx: CanvasRenderingContext2D, codePoint: number, style: StyleCode,
                xPixel: number, yPixel: number): void;
}

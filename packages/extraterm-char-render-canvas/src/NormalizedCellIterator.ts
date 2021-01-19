/**
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 */

import {
  CharCellGrid, FLAG_MASK_LIGATURE, FLAG_MASK_WIDTH, FLAG_WIDTH_SHIFT, FLAG_MASK_EXTRA_FONT
} from "extraterm-char-cell-grid";

export interface NormalizedCell {
  x: number;
  segment: number;
  codePoint: number;
  extraFontFlag: boolean;

  isLigature: boolean;
  ligatureCodePoints: number[];
}

/**
 * Iterate through a row of cells and emit a 'cell' which contains extra data
 * about where it is in a ligature etc.
 *
 * Looping through a `CharCellGrid` and keeping track or where you are w.r.t.
 * ligatures and wide chars is a PITA, but this simpliies the bookkeeping
 * considerably.
 *
 * The `result` is constantly recycled to avoid memory allocations.
 */
export function* normalizedCellIterator(cellGrid: CharCellGrid, row: number, result: NormalizedCell): IterableIterator<number> {
  const rowLength = cellGrid.width;
  let x = 0;
  while (x < rowLength) {
    const flags = cellGrid.getFlags(x, row);

    const widthChars = ((flags & FLAG_MASK_WIDTH) >> FLAG_WIDTH_SHIFT) + 1;
    const isLigature = flags & FLAG_MASK_LIGATURE;

    if (isLigature) {
      // Ligature case
      const extraFontFlag = (cellGrid.getFlags(x, row) & FLAG_MASK_EXTRA_FONT) !== 0;

      const ligatureCodePoints: number[] = [];
      for (let k=0; k<widthChars; k++) {
        ligatureCodePoints[k] = cellGrid.getCodePoint(x+k, row);
      }

      for (let i=0; i<widthChars; i++) {
        result.x = x;
        result.segment = i;
        result.codePoint = null;
        result.extraFontFlag = extraFontFlag;
        result.isLigature = true;
        result.ligatureCodePoints = ligatureCodePoints;

        yield x;
        x++;
      }
    } else {
      // Normal and wide character case
      const codePoint = cellGrid.getCodePoint(x, row);
      const extraFontFlag = (cellGrid.getFlags(x, row) & FLAG_MASK_EXTRA_FONT) !== 0;
      for (let k=0; k<widthChars; k++) {
        result.x = x;
        result.segment = k;
        result.codePoint = codePoint;
        result.extraFontFlag = extraFontFlag;
        result.isLigature = false;
        result.ligatureCodePoints = null;

        yield x;
        x++;
      }
    }
  }
}

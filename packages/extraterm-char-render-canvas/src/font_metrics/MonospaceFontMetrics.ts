/**
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 */


export interface MonospaceFontMetrics {
  readonly fontSizePx: number,
  readonly fontFamily: string,

  readonly fillTextYOffset: number;  // Offset to add to y when rendering text.
  readonly fillTextXOffset: number;  // Offset to add to x when rendering text.

  readonly widthPx: number;
  readonly heightPx: number;
  readonly boldItalicWidthPx: number;

  readonly strikethroughY: number;
  readonly strikethroughHeight: number;
  readonly underlineY: number;
  readonly underlineHeight: number;
  readonly secondUnderlineY: number;

  readonly overlineY: number;
  readonly overlineHeight: number;

  readonly curlyHeight: number;
  readonly curlyThickness: number;
  readonly curlyY: number;
}

/*
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

/**
 * Describes a change on a screen.
 */
export interface ScreenChange {
  /**
   * The index into the scrollback area of the first line added.
   *
   * The complete range of affected lines is from `startLine` up to but not including `endLine`.
   */
  startLine: number;

  /**
   * The index after the last affected line.
   *
   * The range of affected lines is from `startLine` up to but not including `endLine`.
   */
  endLine: number;
}

/**
 * A "screen" or grid of cells.
 *
 * Note that the mapping from values in a JavaScript style UTF16 string to
 * and from cells in a grid is complex.
 *
 * A single character / Unicode code point, can require 0, 1 or 2 cells.
 * Many Asian languages and characters are "full width" and occupy 2 cells.
 * Emojis often occupy 2 cells as well.
 *
 * There are also complications on the encoding side too. Unicode code points
 * are 32 bit values, but the values in a JavaScript string are encoding
 * UTF16, and hold 16 bit values. Code points outside the 16 bit range use 2
 * values with the "surrogate pairs" system. In this case 2 UTF16 values can map
 * to just one cell in the grid.
 *
 * For the most part you can ignore the difference between cells and values in
 * JavaScript's UTF16 based strings. The methods which deal with strings and
 * indexes assume UTF16 indexes unless noted otherwise.
 */
export interface Screen {

  /**
   * The width of the screen in cells.
   */
  readonly width: number;

  /**
   * The height of the screen in cells.
   */
  readonly height: number;

  /**
   * Get a row of text from the screen as a string.
   *
   * @param line The line/row to fetch. Top line on the screen is line 0. Last
   *    one is `height` - 1.
   * @returns The line as a string.
   */
  getLineText(line: number): string;

  /**
   * Add a hyperlink to a range of characters.
   *
   * @param line The line number of the row to affect.
   * @param x The starting UTF16 index of the characters to affect.
   * @param length The number of characters to apply the link to.
   */
  applyHyperlink(line: number, x: number, length: number, url: string): void;
}

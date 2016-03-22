/*
 * Copyright 2014-2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import resourceLoader = require('../resourceloader');
import fs = require('fs');
import path = require('path');
import sourceDir = require('../sourceDir');

/*
 * This file mostly exists to work around Blink's poor handling for font-face in combination with the Shadow DOM.
 * Font-faces are not handling correctly inside the Shadow DOM and also loading fonts via a STYLE tag inside
 * the shadow DOM can also result in crashes.
 
 * This issue hints at how Blink doesn't handle fonts and the Shadow DOM very well:
 * https://code.google.com/p/chromium/issues/detail?id=336876
 */

const FONT_AWESOME_CSS_PATH = "css/font-awesome.css";

let installed = false;

export function init(): void {
  if (installed) {
    return;
  }

  const awesomeLink = document.createElement('link');
  awesomeLink.href = resourceLoader.toUrl(FONT_AWESOME_CSS_PATH);
  awesomeLink.rel = 'stylesheet';
  document.head.appendChild(awesomeLink);

  installed = true;
}

let fontFaceFreeAwesomeCSS: string = null;

/**
 * Get the mutated Font Awesome CSS rules.
 * 
 * @return font Awesome CSS rules, suitable for direct inclusion inside a STYLE tag.
 */
export function fontAwesomeCSS(): string {
  if (fontFaceFreeAwesomeCSS === null) {
    // Read the Font Awesome CSS file and removethe font-face part.
    const fontAwesomeCSS: string = fs.readFileSync(path.join(sourceDir.path, FONT_AWESOME_CSS_PATH), {encoding: 'utf8'});
    fontFaceFreeAwesomeCSS = stripFontFaces(fontAwesomeCSS);
  }
  return fontFaceFreeAwesomeCSS;
}

export function stripFontFaces(cssText: string): string {
  const lines = cssText.split(/\n/g);  
  const fontFaceFreeLines: string[] = [];
  let insideFontFaceFlag = false;
  lines.forEach( (line) => {
    if ( ! insideFontFaceFlag) {
      if (line.startsWith("@font-face")) {
        insideFontFaceFlag = true;
      } else {
        fontFaceFreeLines.push(line);
      }
    } else {
      if (line.startsWith("}")) {
        insideFontFaceFlag = false;
      }
    }
  });
  return fontFaceFreeLines.join("\n");  
}

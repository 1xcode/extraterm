/*
 * Copyright 2014-2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import ThemeTypes = require('./theme');
import domutils = require('./domutils');
import ThemeConsumer = require('./themeconsumer');
import ResizeableElementBase = require('./resizeableelementbase');

/**
 * A base class for HTMLElements which also want theming CSS support.
 */
class ThemeableElementBase extends ResizeableElementBase implements ThemeTypes.Themeable {

  static ID_THEME = "ID_THEME";

  /**
   * See `ThemeTypes.Themeable.setThemeCssMap()`
   */
  setThemeCssMap(cssMap: Map<ThemeTypes.CssFile, string>): void {
    if (domutils.getShadowRoot(this) === null) {
      return;
    }
    
    const themeElement = (<HTMLStyleElement> domutils.getShadowId(this, ThemeableElementBase.ID_THEME));
    if (themeElement === null) {
      return;
    }
    const cssText = this._themeCssFiles().map( (cssFile) => cssMap.get(cssFile) ).join("\n");
    themeElement.textContent = cssText;
  }

  /**
   * Custom Element 'attached' life cycle hook.
   */
  protected attachedCallback(): void {
    ThemeConsumer.registerThemeable(this);
  }
  
  /**
   * Custom Element 'detached' life cycle hook.
   */
  protected detachedCallback(): void {
    ThemeConsumer.unregisterThemeable(this);
  }
  
  /**
   * Updates the Style element's CSS contents immediately.
   */
  protected updateThemeCss(): void {
    this.setThemeCssMap(ThemeConsumer.cssMap());
    this.resize();
  }
  
  /**
   * Gets the list of CssFiles this element requires for its CSS theming.
   *
   * Subclasses should override this method.
   *
   * @returns the list of CssFiles
   */
  protected _themeCssFiles(): ThemeTypes.CssFile[] {
    return [];
  }
}

export = ThemeableElementBase;

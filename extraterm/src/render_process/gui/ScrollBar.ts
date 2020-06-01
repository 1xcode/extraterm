/*
 * Copyright 2014-2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import {Attribute, Filter, Observe, WebComponent} from 'extraterm-web-component-decorators';

import {Logger, getLogger} from "extraterm-logging";
import { log } from "extraterm-logging";
import * as ThemeTypes from '../../theme/Theme';
import { TemplatedElementBase } from './TemplatedElementBase';

const ID_AREA = "ID_AREA";
const ID_CONTAINER = "ID_CONTAINER";

/**
 * A scrollbar.
 */
@WebComponent({tag: "et-scroll-bar"})
export class ScrollBar extends TemplatedElementBase {

  static TAG_NAME = 'ET-SCROLL-BAR';

  private _log: Logger;
  private _lastSetPosition = 0;

  constructor() {
    super({ delegatesFocus: false });

    this._log = getLogger(ScrollBar.TAG_NAME, this);

    this._elementById(ID_CONTAINER).addEventListener('scroll', (ev: Event) => {
      const container = this._elementById(ID_CONTAINER);
      const top = container.scrollTop;

      if (top === this._lastSetPosition) {
        // Prevent emitting an event due to the position being set via API and not the user.
        return;
      }
      this.position = top;

      const event = new CustomEvent('scroll',
          { detail: {
            position: top,
            isTop: top === 0,
            isBottom: (container.scrollHeight - container.clientHeight) === top } });
      this.dispatchEvent(event);
    });

    this._updateLengthNumber("length");
    this._updatePosition("position");
  }

  connectedCallback(): void {
    super.connectedCallback();
    this._updatePosition("position");
  }

  protected _themeCssFiles(): ThemeTypes.CssFile[] {
    return [ThemeTypes.CssFile.GUI_SCROLLBAR];
  }

  protected _html(): string {
    return `<div id='${ID_CONTAINER}'><div id='${ID_AREA}'></div></div>`;
  }

  @Attribute({default: 1}) length = 1;

  @Filter("length")
  private _sanitizeLength(value: number): number {
    if (value == null) {
      return undefined;
    }

    if (isNaN(value)) {
      console.warn("Value '" + value + "'to scrollbar attribute 'length' was NaN.");
      return undefined;
    }

    return Math.max(0, value);
  }

  @Observe("length")
  private _updateLengthNumber(target: string): void {
    const areaElement = this._elementById(ID_AREA);
    areaElement.style.height = this.length + "px";
  }

  setLength(length: number): void {
    this.length = length;
  }

  getLength(): number {
    return this.length;
  }

  @Attribute({default: 0}) position = 0;

  @Filter("position")
  private _sanitizePosition(value: number): number {
    const container = this._elementById(ID_CONTAINER);
    const cleanValue = Math.min(container.scrollHeight-container.clientHeight, Math.max(0, value));
    return cleanValue !== this.position ? cleanValue : undefined;
  }

  @Observe("position")
  private _updatePosition(target: string): void {
    const containerElement = this._elementById(ID_CONTAINER);
    containerElement.scrollTop = this.position;
    this._lastSetPosition = containerElement.scrollTop;
  }

  setPosition(pos: number): void {
    this.position = pos;
  }

  getPosition(): number {
    return this.position;
  }

  setThumbSize(size: number): void {
  }

  getThumbSize(): number {
    return 7734;  // FIXME bogus.
  }
}

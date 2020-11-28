/**
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 */

import { Renderer, HScrollBar, HScrollTracking, Position, VScrollBar, TextLayer, FontMetricsMonitor, FontMetrics } from "@extraterm/ace-ts";
import { CanvasTextLayer } from "./CanvasTextLayer";
import { computeDpiFontMetrics } from "extraterm-char-render-canvas";
import { Event } from '@extraterm/extraterm-extension-api';
import { EventEmitter } from "extraterm-event-emitter";
import { log, Logger, getLogger } from "extraterm-logging";
import { CursorStyle } from "extraterm-char-render-canvas";
import { LigatureMarker } from "./LigatureMarker";
export { CursorStyle } from "extraterm-char-render-canvas";


export interface TerminalCanvasRendererConfig {
  cursorStyle: CursorStyle;
  palette: number[];
  devicePixelRatio: number;
  fontFamily: string;
  fontSizePx: number;
  fontFilePath: string;
  ligatureMarker: LigatureMarker;
  transparentBackground: boolean;
}

export class TerminalCanvasRenderer extends Renderer {
  private _log: Logger = null;
  private _canvasTextLayer: CanvasTextLayer;
  private _terminalCanvasRendererConfig: TerminalCanvasRendererConfig = null;
  private _canvasFontMetricsMonitor: CanvasFontMetricsMonitor = null;
  private _isLowMemoryMode = false;

  constructor(container: HTMLElement, terminalCanvasRendererConfig: TerminalCanvasRendererConfig) {
    super(container, { injectCss: false, fontSize: null });
    this._log = getLogger("TerminalCanvasRenderer", this);

    this.setTerminalCanvasRendererConfig(terminalCanvasRendererConfig);
    this.setHScrollTracking(HScrollTracking.VISIBLE);
  }

  protected createVScrollBar(container: HTMLElement): VScrollBar {
    return null;
  }

  protected createHScrollBar(container: HTMLElement): HScrollBar {
    return new InsetHScrollBar(container, this);
  }

  protected createTextLayer(contentDiv: HTMLDivElement): TextLayer {
    this._canvasTextLayer = new CanvasTextLayer({
      contentDiv,
      palette: this._terminalCanvasRendererConfig.palette,
      fontFamily: this._terminalCanvasRendererConfig.fontFamily,
      fontSizePx: this._terminalCanvasRendererConfig.fontSizePx,
      devicePixelRatio: this._terminalCanvasRendererConfig.devicePixelRatio,
      cursorStyle: this._terminalCanvasRendererConfig.cursorStyle,
      ligatureMarker: this._terminalCanvasRendererConfig.ligatureMarker,
      transparentBackground: this._terminalCanvasRendererConfig.transparentBackground
    });
    return this._canvasTextLayer;
  }

  protected createFontMetricsMonitor(): FontMetricsMonitor {
    this._canvasFontMetricsMonitor = new CanvasFontMetricsMonitor(this._terminalCanvasRendererConfig);
    return this._canvasFontMetricsMonitor;
  }

  setTerminalCanvasRendererConfig(terminalCanvasRendererConfig: TerminalCanvasRendererConfig): void {
    this._terminalCanvasRendererConfig = terminalCanvasRendererConfig;
    if (this._canvasTextLayer != null) {
      this._canvasTextLayer.setCursorStyle(terminalCanvasRendererConfig.cursorStyle);
      this._canvasTextLayer.setPalette(terminalCanvasRendererConfig.palette);
      this._canvasTextLayer.setFontFamily(terminalCanvasRendererConfig.fontFamily);
      this._canvasTextLayer.setFontSizePx(terminalCanvasRendererConfig.fontSizePx);
      this._canvasTextLayer.setDevicePixelRatio(terminalCanvasRendererConfig.devicePixelRatio);
      this._canvasTextLayer.setLigatureMarker(terminalCanvasRendererConfig.ligatureMarker);
      this._canvasTextLayer.setTransparentBackground(terminalCanvasRendererConfig.transparentBackground);
    }
    if (this._canvasFontMetricsMonitor != null) {
      this._canvasFontMetricsMonitor.setTerminalCanvasRendererConfig(terminalCanvasRendererConfig);
    }
    if ( ! this._isLowMemoryMode) {
      this.rerenderText();
    }
  }

  setRenderCursorStyle(cursorStyle: CursorStyle): void {
    if (this._canvasTextLayer != null) {
      this._canvasTextLayer.setCursorStyle(cursorStyle);
    }
  }

  /**
   * Free up the canvas memory
   *
   * The canvas memory will remain freed until an explicit request to
   * rerender the text is given.
   */
  reduceMemory(): void {
    this._isLowMemoryMode = true;
    if (this._canvasTextLayer != null) {
      this._canvasTextLayer.reduceMemory();
    }
  }

  rerenderText(): void {
    this._isLowMemoryMode = false;
    if (this._canvasTextLayer != null) {
      this._canvasTextLayer.rerender();
    }
  }

  mouseOver(pos: Position): void {
    this._canvasTextLayer.mouseOver(pos);
  }

  getHyperlinkAtTextCoordinates(pos: Position): string {
    return this._canvasTextLayer.getHyperlinkAtTextCoordinates(pos);
  }
}

class InsetHScrollBar extends HScrollBar {

  constructor(parent: HTMLElement, renderer: Renderer) {
    super(parent, renderer);

    this.inner.style.removeProperty("height");
    this.element.style.removeProperty("height");
  }

  get height(): number {
    return 0;
  }
}

class CanvasFontMetricsMonitor implements FontMetricsMonitor {
  private _log: Logger = null;
  private _terminalCanvasRendererConfig: TerminalCanvasRendererConfig = null;
  private _onChangeEventEmitter = new EventEmitter<FontMetrics>();
  onChange: Event<FontMetrics>;
  private _fontMetrics: FontMetrics = null;

  constructor(terminalCanvasRendererConfig: TerminalCanvasRendererConfig) {
    this._log = getLogger("CanvasFontMetricsMonitor", this);
    this._terminalCanvasRendererConfig = terminalCanvasRendererConfig;

    // this._log.debug(`fontFamily: ${this._fontFamily}, fontSizePx: ${this._fontSizePx}, devicePixelRatio: ${this._devicePixelRatio}`);
    this.onChange = this._onChangeEventEmitter.event;
  }

  getFontMetrics(): FontMetrics {
    if (this._fontMetrics != null) {
      return this._fontMetrics;
    }
    this._fontMetrics = this._computeAceFontMetrics();
    return this._fontMetrics;
  }

  private _computeAceFontMetrics(): FontMetrics {
    const { renderFontMetrics, cssFontMetrics } = computeDpiFontMetrics(this._terminalCanvasRendererConfig.fontFamily,
      this._terminalCanvasRendererConfig.fontSizePx, this._terminalCanvasRendererConfig.devicePixelRatio);
    const fontMetrics = {
      charWidthPx: cssFontMetrics.widthPx,
      charHeightPx: cssFontMetrics.heightPx,
      isBoldCompatible: true
    };
    return fontMetrics;
  }

  checkForSizeChanges(): void {
    const newMetrics = this._computeAceFontMetrics();
    if (this._fontMetrics != null) {
      if (this._fontMetrics.charHeightPx === newMetrics.charHeightPx &&
          this._fontMetrics.charWidthPx === newMetrics.charWidthPx &&
          this._fontMetrics.isBoldCompatible === newMetrics.isBoldCompatible) {
        return;
      }
    }
    this._fontMetrics = newMetrics;
    this._onChangeEventEmitter.fire(newMetrics);
  }

  startMonitoring(): void {
  }

  dispose(): void {
  }

  setTerminalCanvasRendererConfig(terminalCanvasRendererConfig: TerminalCanvasRendererConfig): void {
    this._terminalCanvasRendererConfig = terminalCanvasRendererConfig;
    this.checkForSizeChanges();
  }
}

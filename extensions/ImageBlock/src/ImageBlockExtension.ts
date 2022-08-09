/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import {
  ExtensionContext,
  Logger,
  ExtensionBlock,
  BulkFileState,
  BlockMetadataChange,
  BlockPosture
} from "@extraterm/extraterm-extension-api";
import * as http from "node:http";
import { QImage, QPainter, QPaintEvent, QScrollArea, QWidget, RenderHint, ScrollBarPolicy, WidgetEventTypes } from "@nodegui/nodegui";
import { ScrollArea, Widget } from "qt-construct";

let log: Logger = null;
let context: ExtensionContext = null;


export function activate(_context: ExtensionContext): any {
  context = _context;
  log = context.logger;

  context.terminals.registerBlock("image-block", newImageBlock);
  context.commands.registerCommand("image-block:zoomIn", commandZoomIn);
  context.commands.registerCommand("image-block:zoomOut", commandZoomOut);
}

function newImageBlock(extensionBlock: ExtensionBlock): void {
  const imageUI = new ImageUI(extensionBlock);
  extensionBlock.contentWidget = imageUI.getWidget();
  extensionBlock.details = imageUI;
}

class ImageUI {

  #extensionBlock: ExtensionBlock = null;
  #filename = "";
  #topWidget: QScrollArea = null;
  #imageWidget: QWidget = null;
  #needsScrollbar = false;
  #image: QImage = null;
  #zoomPercent = 100;

  static ZoomPercentsArray = [
    10,
    25,
    50,
    75,
    100,
    125,
    150,
    200,
    250,
    300,
    500,
    1000
  ];

  constructor(extensionBlock: ExtensionBlock) {
    this.#extensionBlock = extensionBlock;

    this.#filename = this.#extensionBlock.bulkFile.metadata["filename"];
    if (this.#filename === undefined) {
      this.#filename = "(unknown)";
    }

    this.#updateMetadata();

    this.#topWidget = ScrollArea({
      widgetResizable: true,
      verticalScrollBarPolicy: ScrollBarPolicy.ScrollBarAlwaysOff,
      contentsMargins: 0,
      widget: this.#imageWidget = Widget({
        contentsMargins: 0,
        onPaint: (nativeEvent): void => {
          this.#handlePaint(new QPaintEvent(nativeEvent));
        }
      })
    });

    this.#topWidget.addEventListener(WidgetEventTypes.LayoutRequest, () => {
      this.#handleScrollAreaLayout();
    }, {afterDefault: true});

    const bulkFile = this.#extensionBlock.bulkFile;
    bulkFile.onStateChanged(this.#handleStateChanged.bind(this));
  }

  #updateMetadata(): void {
    const changes: BlockMetadataChange = {};

    switch (this.#extensionBlock.bulkFile.state) {
      case BulkFileState.DOWNLOADING:
        changes.title = `Downloading ${this.#filename}`;
        changes.posture = BlockPosture.NEUTRAL;
        changes.icon = "fa-download";
        break;
      case BulkFileState.COMPLETED:
        changes.title = `${this.#filename} (Zoom: ${this.#zoomPercent}%)`;
        changes.posture = BlockPosture.SUCCESS;
        changes.icon = "fa-file-image";
        break;
      case BulkFileState.FAILED:
        changes.title = `Failed to download ${this.#filename}`;
        changes.posture = BlockPosture.FAILURE;
        changes.icon = "fa-times";
        break;
      default:
        break;
    }
    this.#extensionBlock.updateMetadata(changes);
  }

  #handlePaint(event: QPaintEvent): void {
    if (this.#image == null) {
      return;
    }

    const painter = new QPainter(this.#imageWidget);
    if (this.#zoomPercent !== 100) {
      painter.setRenderHint(RenderHint.SmoothPixmapTransform, true);
      const zoomRatio = this.#zoomPercent / 100;
      painter.setTransform([
        zoomRatio, 0, // a, b 
        0, zoomRatio, // c, d 
        0, 0          // tx, ty
      ]);
    }
    painter.drawImage(0, 0, this.#image);
    painter.end();
  }

  getWidget(): QWidget {
    return this.#topWidget;
  }

  #handleStateChanged(): void {
    this.#updateMetadata();
    if (this.#extensionBlock.bulkFile.state === BulkFileState.COMPLETED) {
      this.#downloadImage();
    }
  }

  zoomIn(): void {
    const i = Math.min(ImageUI.ZoomPercentsArray.length - 1, ImageUI.ZoomPercentsArray.indexOf(this.#zoomPercent) + 1);
    this.#setZoomPercent(ImageUI.ZoomPercentsArray[i]);
  }

  zoomOut(): void {
    const i = Math.max(0, ImageUI.ZoomPercentsArray.indexOf(this.#zoomPercent) - 1);
    this.#setZoomPercent(ImageUI.ZoomPercentsArray[i]);
  }

  async #downloadImage(): Promise<void> {
    const imageBuffer = await downloadURL(this.#extensionBlock.bulkFile. url); 
    this.#image = new QImage();
    this.#image.loadFromData(imageBuffer);
    if (this.#image.isNull()) {
      log.warn(`Unable to load image into QImage.`);
      return;
    }
    this.#setZoomPercent(100);
    this.#imageWidget.update();
  }

  #handleScrollAreaLayout(): void {
    const geo = this.#topWidget.geometry();
    const width = Math.round(this.#zoomPercent * this.#image.width() / 100);

    const neededScrollbar = this.#needsScrollbar;
    this.#needsScrollbar = geo.width() < width;
    if (neededScrollbar !== this.#needsScrollbar) {
      this.#updateLayout();
    }
  }

  #setZoomPercent(zoomPercent: number): void {
    this.#zoomPercent = zoomPercent;  
    this.#updateLayout();
    this.#imageWidget.update();
    this.#updateMetadata();
  }

  #updateLayout(): void {
    const width = Math.round(this.#zoomPercent * this.#image.width() / 100);
    const height = Math.round(this.#zoomPercent * this.#image.height() / 100);
    let scrollAreaHeight = height;
    if (this.#needsScrollbar) {
      const barGeo = this.#topWidget.horizontalScrollBar();
      scrollAreaHeight += barGeo.height();
    }

    this.#topWidget.setMinimumHeight(scrollAreaHeight);
    this.#topWidget.setMaximumHeight(scrollAreaHeight);
    this.#imageWidget.setMinimumSize(width, height);
    this.#imageWidget.setMaximumSize(width, height);
  }
}


function downloadURL(url: string): Promise<Buffer> {
  return new Promise((resolve) => {
    http.get(url, (response) => {
      const body: Buffer[] = [];
      response.on("data", (chunk: Buffer) => {
        body.push(chunk);
      });
      response.on("end", () => {
        resolve(Buffer.concat(body));
      });
    })
  })
}

function commandZoomIn(): void {
  const block = context.activeBlock;
  if (block.type !== "image-block:image-block") {
    return;
  }
  block.details.zoomIn();
}

function commandZoomOut(): void {
  const block = context.activeBlock;
  if (block.type !== "image-block:image-block") {
    return;
  }
  block.details.zoomOut();
}
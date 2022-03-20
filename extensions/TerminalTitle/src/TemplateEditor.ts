/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { Event, Logger, Style, TerminalEnvironment } from '@extraterm/extraterm-extension-api';
import { Direction, QAction, QBoxLayout, QLineEdit, QPoint, QPushButton, QVariant, QWidget, WidgetAttribute, WindowType } from "@nodegui/nodegui";
import { BoxLayout, LineEdit, Menu, PushButton, ToolButton, Widget } from "qt-construct";
import { EventEmitter } from "extraterm-event-emitter";

import { Segment, TemplateString } from './TemplateString';
import { TitlePreview } from './TitlePreview';


export class TemplateEditor {

  #widget: QWidget;
  #style: Style;
  #templateString: TemplateString;
  #titlePreview: TitlePreview = null;

  #onTemplateChangedEventEmitter = new EventEmitter<string>();
  onTemplateChanged: Event<string> = null;

  #templateLineEdit: QLineEdit = null;

  constructor(templateString: TemplateString, style: Style, log: Logger) {
    this.onTemplateChanged = this.#onTemplateChangedEventEmitter.event;
    this.#templateString = templateString;
    this.#style = style;

    let iconButton: QPushButton = null;

    const fieldList = [
      ["Title", TerminalEnvironment.TERM_TITLE],
      ["Rows", TerminalEnvironment.TERM_ROWS],
      ["Columns", TerminalEnvironment.TERM_COLUMNS],
      ["Current command", TerminalEnvironment.EXTRATERM_CURRENT_COMMAND],
      ["Last command", TerminalEnvironment.EXTRATERM_LAST_COMMAND],
      ["Current command line", TerminalEnvironment.EXTRATERM_CURRENT_COMMAND_LINE],
      ["Last command line", TerminalEnvironment.EXTRATERM_LAST_COMMAND_LINE],
      ["Exit code", TerminalEnvironment.EXTRATERM_EXIT_CODE],
    ];
    const fieldMenu = Menu({
      onTriggered: (nativeAction) => {
        const action = new QAction(nativeAction);
        this.#insertText("${" + action.data().toString() + "}");
      }
    });
    for (const item of fieldList) {
      const action = fieldMenu.addAction(`${item[0]}   $\{${item[1]}\}`);
      action.setData(new QVariant(item[1]));
    }

    const iconPopup = this.#createIconPopup((iconName: string): void => {
      this.#insertText("${icon:" + iconName +"}");
      iconPopup.hide();
    });
    this.#titlePreview = new TitlePreview(this.#templateString, log);
    this.#titlePreview.onSegmentClicked((segment: Segment): void => {
      this.#templateLineEdit.setSelection(segment.startColumn, segment.endColumn - segment.startColumn);
      this.#templateLineEdit.setFocus();
    });

    this.#widget = Widget({
      contentsMargins: 0,

      layout: BoxLayout({
        direction: Direction.TopToBottom,
        children: [
          {
            layout: BoxLayout({
              direction: Direction.LeftToRight,
              children: [
                this.#templateLineEdit = LineEdit({
                  text: templateString.getTemplateString(),
                  onTextEdited: (newText: string) => {
                    this.#templateStringChanged();
                  }
                }),
                {
                  layout: BoxLayout({
                    direction: Direction.LeftToRight,
                    spacing: 0,
                    children: [
                      PushButton({
                        text: "Insert Field",
                        cssClass: ["group-left", "small"],
                        menu: fieldMenu
                      }),
                      iconButton = PushButton({
                        text: "Insert Icon",
                        cssClass: ["group-right", "small"],
                        onClicked: () => {
                          if (iconPopup.isVisible()) {
                            iconPopup.hide();
                            return;
                          }

                          const rect = iconButton.geometry();
                          const bottomLeft = this.#widget.mapToGlobal(new QPoint(rect.left(), rect.top() + rect.height()));
                          iconPopup.setGeometry(bottomLeft.x(), bottomLeft.y(), rect.width(), 200);
                          iconPopup.raise();
                          iconPopup.show();
                        }
                      })
                    ]
                  })
                }
              ]
            })
          },
          this.#titlePreview.getWidget()
        ]
      })
    });
  }
  getWidget(): QWidget {
    return this.#widget;
  }

  #insertText(text: string): void {
    this.#templateLineEdit.insert(text);
    this.#templateStringChanged();
  }

  #templateStringChanged(): void {
    const string = this.#templateLineEdit.text();
    this.#templateString.setTemplateString(string);
    this.#titlePreview.templateStringUpdated();
    this.#onTemplateChangedEventEmitter.fire(string);
  }

  #createIconPopup(iconSelectedFunc: (iconName: string) => void): QWidget {
    const ICONS_PER_ROW = 10;
    const iconList: string[] = [
      "fa-linux",
      "fa-windows",
      "fa-apple",
      "fa-android",
      "fa-ubuntu",
      "fa-fedora",
      "fa-redhat",
      "fa-suse",
      "fa-centos",
      "fa-freebsd",

      "fa-keyboard",
      "fa-terminal",
      "fa-docker",
      "fa-laptop",
      "fa-desktop",
      "fa-server",
      "fa-database",
      "fa-microchip",
      "fa-mobile-alt",
      "fa-tablet-alt",

      "fa-bug",
      "fa-code",
      "fa-git",
      "fa-code-branch",
      "fa-sitemap",
      "fa-cloud",
      "fa-upload",
      "fa-download",
      "fa-comments",
      "fa-envelope",

      "fa-home",
      "fa-building",
      "fa-industry",
      "fa-city",
      "fa-robot",
      "fa-raspberry-pi",
      "fa-bolt",
      "fa-exclamation-triangle",
      "fa-shield-alt",
      "fa-usb",
    ];

    const rows: QBoxLayout[] = [];
    for (let y=0; y < iconList.length/ICONS_PER_ROW; y++) {
      rows.push(BoxLayout({
        direction: Direction.LeftToRight,
        spacing: 0,
        contentsMargins: 0,
        children: iconList.slice(y*ICONS_PER_ROW, (y+1)*ICONS_PER_ROW).map(
          iconName => ToolButton({
            toolTip: "${icon:" + iconName + "}",
            icon: this.#style.createQIcon(<any> iconName),
            onClicked: () => {
              iconSelectedFunc(iconName);
            }
          })
        )
      }));
    }

    const iconPopup = Widget({
      cssClass: ["window-background"],
      windowFlag: WindowType.Popup,
      contentsMargins: 0,
      attribute: [WidgetAttribute.WA_WindowPropagation, WidgetAttribute.WA_X11NetWmWindowTypePopupMenu],
      layout: BoxLayout({
        direction: Direction.TopToBottom,
        spacing: 0,
        contentsMargins: 0,
        children: rows
      })
    });
    return iconPopup;
  }
}

/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { Direction, QApplication, QBoxLayout, QLabel, QPushButton, QWidget, TextFormat } from "@nodegui/nodegui";
import { BoxLayout, Label, PushButton, Widget } from "qt-construct";
import { UiStyle } from "./UiStyle";

export interface CompactGroupOptions {
  children: (QWidget | string)[];
}

/**
 * Visually group a bunch of widgets
 *
 * Strings are turned into labels
 */
export function makeGroupLayout(...children: (QWidget | string)[]): QBoxLayout {

  const expandedChildren: QWidget[] = children.map((c): QWidget => {
    if ((typeof c) === "string") {
      return Label({text: <string>c, cssClass: ["group-middle"]});
    } else {
      (<QWidget>c).setProperty("cssClass", ["group-middle"]);
      return <QWidget>c;
    }
  });

  if (expandedChildren.length !== 0) {
    expandedChildren[0].setProperty("cssClass", ["group-left"]);
    expandedChildren[expandedChildren.length-1].setProperty("cssClass", ["group-right"]);
  }

  return BoxLayout({
    direction: Direction.LeftToRight,
    spacing: 0,
    contentsMargins: [0, 0, 0, 0],
    children: expandedChildren,
  });
}

export interface LinkLabelOptions {
  onLinkActivated?: (url: string) => void;
  openExternalLinks?: boolean;
  text: string;
  uiStyle: UiStyle;
  wordWrap?: boolean;
}

/**
 * Create a QLabel which looks like a HTML link.
 *
 * Contents are rich text and the link responds to hover correctly.
 */
export function makeLinkLabel(options: LinkLabelOptions): QLabel {
  const { onLinkActivated, openExternalLinks, text, uiStyle, wordWrap } = options;
  const normalText = `${uiStyle.getLinkLabelCSS()}${text}`;
  const hoverText = `<span class="hover">${normalText}</span>`;
  const label = Label({
    text: normalText,
    onLinkActivated,
    openExternalLinks,
    textFormat: TextFormat.RichText,
    onEnter: () => label.setText(hoverText),
    onLeave: () => label.setText(normalText),
    wordWrap
  });
  return label;
}

export interface SubTabBarOptions {
  onCurrentChanged?: (index: number) => void;
  tabs: string[];
}

/**
 * Make a tab bar for use inside page content.
 */
export function makeSubTabBar(options: SubTabBarOptions): QWidget {
  const selectTab = (selectIndex: number) => {
    for (const [index, tabWidget] of tabWidgets.entries()) {
      const classes = tabWidget.property("cssClass").toStringList();
      const newClasses = classes.filter(className => className !== "selected");
      if (index === selectIndex) {
        newClasses.push("selected");
      }

      tabWidget.setProperty("cssClass", newClasses);
      const style = tabWidget.style();
      style.unpolish(tabWidget);
      style.polish(tabWidget);
    }
  };

  const tabWidgets = options.tabs.map((label: string, index: number): QPushButton => {
    return PushButton({
      cssClass: ["subtabbar-tab"],
      text: label,
      onClicked: () => {
        selectTab(index);
        if (options.onCurrentChanged !== undefined) {
          options.onCurrentChanged(index);
        }
      }
    });
  });
  selectTab(0);

  return Widget({
    layout: BoxLayout({
      direction: Direction.LeftToRight,
      contentsMargins: [0, 0, 0, 0],
      spacing: 0,
      children: tabWidgets
    })
  });
}

/*
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as DomUtils from './DomUtils';
import {Splitter, SplitOrientation} from './gui/Splitter';
import {TabWidget} from './gui/TabWidget';
import {Tab} from './gui/Tab';
import Logger from './Logger';

interface ElementFactory {
  (): Element;
}

interface TabContentContainerElementFactory {
  (tabWidget: TabWidget, tab: Tab, tabContent: Element): Element;
}

interface SplitterInfoNode {
  type: "splitter";
  children: (TabWidgetInfoNode | SplitterInfoNode)[];

  splitter: Splitter;
  orientation: SplitOrientation;
}

interface TabWidgetInfoNode {
  type: "tabwidget";
  children: TabInfo[];

  tabWidget: TabWidget;

  emptyTab: Tab;
  emptyTabContent: Element
  emptyContainer: Element;

  leftSpaceDefaultElement: Element;
  rightSpaceDefaultElement: Element;
}

interface TabInfo {
  type: "tabinfo";
  tab: Tab;
  content: Element;
  container: Element;
}

type InfoNode = SplitterInfoNode | TabWidgetInfoNode | TabInfo;

type RootInfoNode = SplitterInfoNode | TabWidgetInfoNode;

enum RelativePosition {
  TOP_LEFT,
  TOP_RIGHT,
  TOP_WIDE,
  OTHER
}

export class SplitLayout {

  private _log: Logger = new Logger("SplitLayout");

  private _rootContainer: Element = null;

  private _tabContainerFactory: TabContentContainerElementFactory = null;

  private _emptySplitFactory: ElementFactory = null;

  private _topLeftElement: Element = null;

  private _topRightElement: Element = null;

  private _leftSpaceDefaultElementFactory: ElementFactory = null;

  private _rightSpaceDefaultElementFactory: ElementFactory = null;

  private _rootInfoNode: RootInfoNode = null;

  constructor() {
    this._tabContainerFactory = () => document.createElement("DIV");

    const tabWidget = <TabWidget> document.createElement(TabWidget.TAG_NAME);
    tabWidget.setShowFrame(false);
    this._rootInfoNode = {type: "tabwidget", children: [], tabWidget: tabWidget, emptyTab: null,
      emptyTabContent: null, emptyContainer: null, leftSpaceDefaultElement: null, rightSpaceDefaultElement: null};
  }

  setRootContainer(el: Element): void {
    this._rootContainer = el;
  }

  getRootContainer(): Element {
    return this._rootContainer;
  }

  setTabContainerFactory(factory: TabContentContainerElementFactory): void {
    this._tabContainerFactory = factory;
  }

  getTabContainerFactory(): TabContentContainerElementFactory {
    return this._tabContainerFactory;
  }

  // Set the factory function to use when creating content to fill the situation where there are not tabs.
  setEmptySplitElementFactory(factory: ElementFactory): void {
    this._emptySplitFactory = factory;
  }

  getEmptySplitElementFactory(): ElementFactory {
    return this._emptySplitFactory;
  }

  setTopLeftElement(el: Element): void {
    this._topLeftElement = el;
  }

  getTopLeftElement(): Element {
    return this._topLeftElement;
  }

  setTopRightElement(el: Element): void {
    this._topRightElement = el;
  }
  
  getTopRightElement(): Element {
    return this._topRightElement;
  }

  setLeftSpaceDefaultElementFactory(el: ElementFactory): void {
    this._leftSpaceDefaultElementFactory = el;
  }
  
  getLeftSpaceDefaultElementFactory(): ElementFactory {
    return this._leftSpaceDefaultElementFactory;
  }

  setRightSpaceDefaultElementFactory(el: ElementFactory): void {
    this._rightSpaceDefaultElementFactory = el;
  }

  getRightSpaceDefaultElementFactory(): ElementFactory {
    return this._rightSpaceDefaultElementFactory;
  }

  /**
   * Add a new tab to a Tab widget.
   * 
   * @param tabWidget the tab widget which receives the new tab.
   * @param tab the new tab object.
   * @param tabContent the contents of the new tab.
   */
  appendTab(tabWidget: TabWidget, tab: Tab, tabContent: Element): void {
    const info = findTabWidgetInfoByTabWidget(this._rootInfoNode, tabWidget);
    if (info == null) {
      this._log.severe("Unable to find the info for TabWidget ", tabWidget);
      return;
    }

    info.children.push({type: "tabinfo", tab: tab, content: tabContent, container: null});
  }

  /**
   * Remove a tab and its contents.
   * 
   * @param tabContent the tab content which is used to find the tab to remove.
   */
  removeTabContent(tabContent: Element): void {
    const info = findTabWidgetInfoByTabContent(this._rootInfoNode, tabContent);
    if (info == null) {
      this._log.severe("Unable to find the info for TabWidget ", tabContent);
      return;
    }

    const {tabWidgetInfo, tabInfo} = info;
    tabWidgetInfo.children = tabWidgetInfo.children.filter( info => info !== tabInfo);
  }

  getAllTabContents(): Element[] {
    return getAllTabContents(this._rootInfoNode);
  }

  getTabContentsByTabWidget(tabWidget: TabWidget): Element[] {
    const info = findTabWidgetInfoByTabWidget(this._rootInfoNode, tabWidget)
    if (info == null) {
      this._log.severe("Unable to find the info for TabWidget ", TabWidget);
      return null;
    }

    if (info.children.length === 0) {
      return info.emptyTabContent != null ? [info.emptyTabContent] : [];
    }

    return info.children.map(kid => kid.content);
  }

  /**
   * Get the tab which matches the tab content.
   * 
   * @param tabContent the tab content to search by.
   * @return the tab which holds the given tab content or null if it could
   *        not be found.
   */
  getTabByTabContent(tabContent: Element): Tab {
    const info = findTabWidgetInfoByTabContent(this._rootInfoNode, tabContent);
    if (info == null) {
      this._log.severe("Unable to find the info for tab content ", tabContent);
      return null;
    }
    return info.tabInfo.tab;
  }

  /**
   * Get the Tab widget which holds the tab content.
   * 
   * @param tabContent the tab content used to find the Tab widget.
   * @return the Tab widget which holds the given tab content, or null if
   *          it could not be found.
   */
  getTabWidgetByTabContent(tabContent: Element): TabWidget {
    const info = findTabWidgetInfoByTabContent(this._rootInfoNode, tabContent);
    if (info == null) {
      this._log.severe("Unable to find the info for tab content ", tabContent);
      return null;
    }
    return info.tabWidgetInfo.tabWidget;
  }

  /**
   * Get the tab content element which is paired with the tab.
   * 
   * @param tab the tab object to search by.
   * @return the tab content element or null if it could not be found.
   */
  getTabContentByTab(tab: Tab): Element {
    const info = findTabWidgetInfoByTab(this._rootInfoNode, tab);
    if (info == null) {
      this._log.severe("Unable to find the info for Tab ", tab);
      return null;
    }
    return info.tabInfo != null ? info.tabInfo.content : info.tabWidgetInfo.emptyTabContent;
  }

  getEmptyContentByTabWidget(tabWidget: TabWidget): Element {
    const info = findTabWidgetInfoByTabWidget(this._rootInfoNode, tabWidget);
    if (info == null) {
      this._log.severe("Unable to find the info for TabWidget ", tabWidget);
      return null;
    }
    return info.children.length === 0 ? info.emptyTabContent : null;
  }

  /**
   * Get the first tab widget.
   * 
   * @return the first tab widget.
   */
  firstTabWidget(): TabWidget {
    return firstTabWidget(this._rootInfoNode);
  }

  /**
   * Show a tab identified by the given tab content.
   * 
   * Selects the tab which is identified by the given tab content.
   * 
   * @param tabContent the tab content which identifies the tab to select.
   */
  showTabByTabContent(tabContent: Element): void {
    const info = findTabWidgetInfoByTabContent(this._rootInfoNode, tabContent);
    if (info == null) {
      this._log.severe("Unable to find the info for tab contents ", tabContent);
      return;
    }

    const {tabWidgetInfo, tabInfo} = info;
    tabWidgetInfo.tabWidget.setSelectedIndex(tabWidgetInfo.children.indexOf(tabInfo));
  }

  splitAfterTabWidget(tabWidget: TabWidget, orientation: SplitOrientation): TabWidget {
    const path = findPathToTabWidget(this._rootInfoNode, tabWidget);
    if (path == null) {
      this._log.severe("Unable to find the info for tab widget ", tabWidget);
      return null;
    }

    const len = path.length;
    if (len === 1) {
      // Path must be TabWidget only.
      const tabWidgetInfo = path[0];
      if (tabWidgetInfo.type === "tabwidget") {
        
        // Create a new TabWidget
        const newTabWidget = <TabWidget> document.createElement(TabWidget.TAG_NAME);
        newTabWidget.setShowFrame(false);
        const newTabWidgetInfo: TabWidgetInfoNode = {
          type: "tabwidget",
          children: [],
          tabWidget: newTabWidget,
          emptyTab: null,
          emptyTabContent: null,
          emptyContainer: null,
          leftSpaceDefaultElement: null,
          rightSpaceDefaultElement: null
        };

        // Insert a Splitter at the root.
        const newRoot: SplitterInfoNode = {
          type: "splitter",
          children: [tabWidgetInfo, newTabWidgetInfo],
          orientation: orientation,
          splitter: null
        };

        this._rootInfoNode = newRoot;
        return newTabWidget;
      }
    } else {

      const splitterInfo = path[len-2];
      const tabWidgetInfo = path[len-1];
      if (splitterInfo.type === "splitter" && tabWidgetInfo.type === "tabwidget") {
        // Create a new TabWidget
        const newTabWidget = <TabWidget> document.createElement(TabWidget.TAG_NAME);
        newTabWidget.setShowFrame(false);
        const newTabWidgetInfo: TabWidgetInfoNode = {
          type: "tabwidget",
          children: [],
          tabWidget: newTabWidget,
          emptyTab: null,
          emptyTabContent: null,
          emptyContainer: null,
          leftSpaceDefaultElement: null,
          rightSpaceDefaultElement: null
        };

        splitterInfo.children.splice(splitterInfo.children.indexOf(tabWidgetInfo)+1,0, newTabWidgetInfo);
        return newTabWidget;
      }
    }
  }

  splitAfterTabContent(tabContent: Element, orientation: SplitOrientation): TabWidget {
    const path = findPathToTabContent(this._rootInfoNode, tabContent);
    if (path == null) {
      this._log.severe("Unable to find the info for tab contents ", tabContent);
      return null;
    }
    
    if (path.length === 1) {
      const tabWidgetInfo = path[0];
      if (tabWidgetInfo.type === "tabwidget") {
        return this.splitAfterTabWidget(tabWidgetInfo.tabWidget, orientation);
      }
    }

    if (path.length === 2) {

      // Path could be ;TabWidget, TabInfo].
      const tabWidgetInfo = path[0];
      const tabInfo = path[1];
      if (tabWidgetInfo.type === "tabwidget" && tabInfo.type === "tabinfo") {
        const splitIndex = tabWidgetInfo.children.map(c => c.content).indexOf(tabContent) + 1;

        // Create a new TabWidget
        const newTabWidget = <TabWidget> document.createElement(TabWidget.TAG_NAME);
        newTabWidget.setShowFrame(false);
        const newTabWidgetInfo: TabWidgetInfoNode = {
          type: "tabwidget",
          children: tabWidgetInfo.children.slice(splitIndex),
          tabWidget: newTabWidget,
          emptyTab: null,
          emptyTabContent: null,
          emptyContainer: null,
          leftSpaceDefaultElement: null,
          rightSpaceDefaultElement: null
        };

        tabWidgetInfo.children = tabWidgetInfo.children.slice(0, splitIndex);

        // Insert a Splitter at the root.
        const newRoot: SplitterInfoNode = {
          type: "splitter",
          children: [tabWidgetInfo, newTabWidgetInfo],
          orientation: orientation,
          splitter: null
        };

        this._rootInfoNode = newRoot;
        return newTabWidget;
      } else {

        const splitterInfo = path[0];
        const tabWidgetInfo = path[1];
        if (splitterInfo.type === "splitter" && tabWidgetInfo.type === "tabwidget") {
          return this.splitAfterTabWidget(tabWidgetInfo.tabWidget, orientation);
        }
      }

    } else {
      if (path.length >= 3) {
        const len = path.length;
        const splitterInfo = path[len-3];
        const tabWidgetInfo = path[len-2];
        const tabInfo = path[len-1];
        if (splitterInfo.type === "splitter" && tabWidgetInfo.type === "tabwidget" && tabInfo.type === "tabinfo") {
          const splitIndex = tabWidgetInfo.children.map(c => c.content).indexOf(tabContent) + 1;


          // Create a new TabWidget
          const newTabWidget = <TabWidget> document.createElement(TabWidget.TAG_NAME);
          newTabWidget.setShowFrame(false);
          const newTabWidgetInfo: TabWidgetInfoNode = {
            type: "tabwidget",
            children: tabWidgetInfo.children.slice(splitIndex),
            tabWidget: newTabWidget,
            emptyTab: null,
            emptyTabContent: null,
            emptyContainer: null,
            leftSpaceDefaultElement: null,
            rightSpaceDefaultElement: null
          };

          tabWidgetInfo.children = tabWidgetInfo.children.slice(0, splitIndex);

          const tabWidgetIndex = splitterInfo.children.indexOf(tabWidgetInfo);
          splitterInfo.children.splice(tabWidgetIndex+1,0, newTabWidgetInfo);          
          return newTabWidget;
        }
      }
    }

  }

  closeSplitAtTabContent(tabContent: Element): void {
    const path = findPathToTabContent(this._rootInfoNode, tabContent);
    if (path == null) {
      this._log.severe("Unable to find the info for tab contents ", tabContent);
      return;
    }

    let tabInfo: TabInfo = null;
    let tabWidgetInfo: TabWidgetInfoNode = null;
    let splitterInfo: SplitterInfoNode = null;

    if (path.length >= 2) {
      const lastPart = path[path.length-1];
      if (lastPart.type === "tabinfo") {
        tabInfo = lastPart;
        tabWidgetInfo = <TabWidgetInfoNode> path[path.length-2];
        splitterInfo = <SplitterInfoNode> path[path.length-3];

      } else if (lastPart.type === "tabwidget") {
        tabWidgetInfo = lastPart;
        splitterInfo = <SplitterInfoNode> path[path.length-2];
      }
    }

    if (tabWidgetInfo != null) {
      // We merge two adjacent TabWidgets together by merging the indicated
      // Tab Widget with its neighbour to the right. If there is nothing to
      // the right, then merge to the left.
      let index = splitterInfo.children.indexOf(tabWidgetInfo);
      if (index === splitterInfo.children.length-1) {
        index = splitterInfo.children.length-2;
      }

      const leftTabWidgetInfo = splitterInfo.children[index];
      const rightTabWidgetInfo = splitterInfo.children[index+1];
      if (leftTabWidgetInfo.type === "tabwidget" && rightTabWidgetInfo.type === "tabwidget") {
        leftTabWidgetInfo.children = [...leftTabWidgetInfo.children, ...rightTabWidgetInfo.children];
        splitterInfo.children = splitterInfo.children.filter( kid => kid !== rightTabWidgetInfo);

        this._removeRedundantSplitters();
      }
    }

  }

  _removeRedundantSplitters(): void {
    if (this._rootInfoNode.type === "splitter") {
      if (this._rootInfoNode.children.length === 1) {
        this._rootInfoNode = this._rootInfoNode.children[0];
      } else {
        this._removeRedundantSplittersFromParent(this._rootInfoNode);
      }
    }
  }

  _removeRedundantSplittersFromParent(nodeInfo: RootInfoNode): void {
    if (nodeInfo.type === "splitter") {
      for (let i=0; i<nodeInfo.children.length; i++) {
        const kid = nodeInfo.children[i];
        if (kid.type === "splitter") {
          if (kid.children.length === 1) {
            nodeInfo.children.splice(i, 1, kid.children[0]);
          }
          this._removeRedundantSplittersFromParent(kid);
        }
      }
    }
  }

  getTabWidgetToLeft(tabWidget: TabWidget): TabWidget {
    return this._getTabWidgetSibling(tabWidget, -1);
  }

  getTabWidgetToRight(tabWidget: TabWidget): TabWidget {
    return this._getTabWidgetSibling(tabWidget, 1);
  }

  private _getTabWidgetSibling(tabWidget: TabWidget, direction: 1 | -1) : TabWidget {
    const path = findPathToTabWidget(this._rootInfoNode, tabWidget);
    if (path == null) {
      this._log.severe("Unable to find the info for tab widget ", tabWidget);
      return;
    }
    const len = path.length;
    if (len >=2 ) {
      const tabWidgetInfo = path[len-1];
      const splitterInfo = path[len-2];

      if (splitterInfo.type === "splitter" && tabWidgetInfo.type === "tabwidget") {
        const index = splitterInfo.children.indexOf(tabWidgetInfo) + direction;
        if (index >= 0 && index < splitterInfo.children.length) {
          const sibling = splitterInfo.children[index];
          if (sibling.type === "tabwidget") {
            return sibling.tabWidget;
          }
        }
      }
    }
    return null;
  }

  /**
   * Update the DOM to match the desired new state.
   * 
   * This should be called after mutation methods to update the DOM with the new changes.
   */
  update(): void {
    this._update(this._rootContainer, this._rootInfoNode, RelativePosition.TOP_WIDE);
  }

  private _update(container: Element, infoNode: RootInfoNode, position: RelativePosition): void {
    if (infoNode.type === "splitter") {
      this._updateSplitter(infoNode, position);

      // Remove the unneeded children, and insert the Splitter.
      removeAllChildrenExceptOne(container, infoNode.splitter);
      if (container.children.length === 0) {
        container.appendChild(infoNode.splitter);
      }

    } else {
      this._updateTabWidget(infoNode, position);

      // TabWidget
      removeAllChildrenExceptOne(container, infoNode.tabWidget);
      if (container.children.length === 0) {
        container.appendChild(infoNode.tabWidget);
      }

    }
  }

  private _updateSplitter(infoNode: SplitterInfoNode, position: RelativePosition): void {
    if (infoNode.splitter  == null) {
      infoNode.splitter = <Splitter> document.createElement(Splitter.TAG_NAME);
      infoNode.splitter.setSplitOrientation(infoNode.orientation);
    }

    const targetChildrenList: Element[] = [];
    const len = infoNode.children.length;
    for (let i=0; i<len; i++) {
      const kidInfo = infoNode.children[i];
      const newPosition = this._computeNewPosition(position, i, len);
      if (kidInfo.type === "splitter") {
        this._updateSplitter(kidInfo, newPosition);
        targetChildrenList.push(kidInfo.splitter);
      } else {
        // Tab widget
        this._updateTabWidget(kidInfo, newPosition);
        targetChildrenList.push(kidInfo.tabWidget);
      } 
    }

    DomUtils.setElementChildren(infoNode.splitter, targetChildrenList);
  }

  private _computeNewPosition(oldPosition: RelativePosition, index: number, length: number): RelativePosition {
    switch (oldPosition) {
      case RelativePosition.TOP_WIDE:
        if (length === 1) {
          return RelativePosition.TOP_WIDE;
        } else {
          if (index === 0) {
            return RelativePosition.TOP_LEFT;
          } else if (index === length-1) {
            return RelativePosition.TOP_RIGHT;
          } else {
            return RelativePosition.OTHER;
          }
        }

      case RelativePosition.TOP_LEFT:
        return index === 0 ? RelativePosition.TOP_LEFT : RelativePosition.OTHER;

      case RelativePosition.TOP_RIGHT:
        return index === length-1 ? RelativePosition.TOP_RIGHT : RelativePosition.OTHER;

      default:
        return RelativePosition.OTHER;
    }
  }

  private _updateTabWidget(infoNode: TabWidgetInfoNode, position: RelativePosition): void {
    if (infoNode.tabWidget  == null) {
      infoNode.tabWidget = <TabWidget> document.createElement(TabWidget.TAG_NAME);
      infoNode.tabWidget.setShowFrame(false);
    }
    const tabWidget = infoNode.tabWidget;

    // Compute the correct thing to place on the left side.
    let leftSpaceElement = infoNode.leftSpaceDefaultElement;
    if ((position === RelativePosition.TOP_LEFT || position == RelativePosition.TOP_WIDE) && this._topLeftElement != null) {
      leftSpaceElement = this._topLeftElement;
    } else {
      if (this._leftSpaceDefaultElementFactory != null && infoNode.leftSpaceDefaultElement == null) {
        infoNode.leftSpaceDefaultElement = this._leftSpaceDefaultElementFactory();
        leftSpaceElement = infoNode.leftSpaceDefaultElement;
      }
    }

    // Compute the correct thing to place on the right side.
    let rightSpaceElement = infoNode.rightSpaceDefaultElement;
    if ((position === RelativePosition.TOP_RIGHT || position == RelativePosition.TOP_WIDE) && this._topRightElement != null) {
      rightSpaceElement = this._topRightElement;
    } else {
      if (this._rightSpaceDefaultElementFactory != null && infoNode.rightSpaceDefaultElement == null) {
        infoNode.rightSpaceDefaultElement = this._rightSpaceDefaultElementFactory();
        rightSpaceElement = infoNode.rightSpaceDefaultElement;
      }
    }

    // Build the list of desired children nodes in order.
    const targetChildrenList: Element[] = [];
    if (leftSpaceElement != null) {
      targetChildrenList.push(leftSpaceElement);
    }

    if (infoNode.children.length !== 0) {
      for (const kidInfo of infoNode.children) {
        targetChildrenList.push(kidInfo.tab);

        if (kidInfo.container == null) {
          kidInfo.container = this._tabContainerFactory(tabWidget, kidInfo.tab, kidInfo.content);
          kidInfo.container.appendChild(kidInfo.content);
        }
        targetChildrenList.push(kidInfo.container);
      }
    } else if (this._emptySplitFactory != null) {
      if (infoNode.emptyTab == null) {
        infoNode.emptyTab = <Tab> document.createElement(Tab.TAG_NAME);
      }
      if (infoNode.emptyTabContent == null) {
        infoNode.emptyTabContent = this._emptySplitFactory();
        infoNode.emptyContainer = this._tabContainerFactory(tabWidget, infoNode.emptyTab, infoNode.emptyTabContent);
        infoNode.emptyContainer.appendChild(infoNode.emptyTabContent);
      }

      targetChildrenList.push(infoNode.emptyTab);
      targetChildrenList.push(infoNode.emptyContainer);
    }

    if (rightSpaceElement != null) {
      targetChildrenList.push(rightSpaceElement);
    }

    DomUtils.setElementChildren(tabWidget, targetChildrenList);
    tabWidget.setShowTabs(infoNode.children.length !== 0);
    tabWidget.update();
  }
}

function findTabWidgetInfoByTabWidget(root: RootInfoNode, tabWidget: TabWidget): TabWidgetInfoNode {
  if (root.type === "splitter") {
    for (const kid of root.children) {
      const info = findTabWidgetInfoByTabWidget(kid, tabWidget);
      if (info != null) {
        return info;
      }
    }
  } else {
    if (root.tabWidget === tabWidget) {
      return root;
    }
  }
  return null;
}

function removeAllChildrenExceptOne(container: Element, chosenOne: Element): void {
  DomUtils.toArray(container.children).forEach( (kid) => {
    if (kid !== chosenOne) {
      container.removeChild(kid);
    }
  });
}

function firstTabWidget(infoNode: RootInfoNode): TabWidget {
  if (infoNode.type === "tabwidget") {
    return infoNode.tabWidget;
  } else {
    for (const kidInfo of infoNode.children) {
      const tabWidget = firstTabWidget(kidInfo);
      if (tabWidget != null) {
        return tabWidget;
      }
    }
    return null;
  }
}

function findTabWidgetInfoByTabContent(infoNode: RootInfoNode, tabContent: Element): {tabWidgetInfo: TabWidgetInfoNode, tabInfo: TabInfo} {
  if (infoNode.type === "splitter") {
    for (const kid of infoNode.children) {
      const info = findTabWidgetInfoByTabContent(kid, tabContent);
      if (info != null) {
        return info;
      }
    }
  } else {
    // Tab widget
    if (infoNode.emptyTabContent === tabContent) {
      return { tabWidgetInfo: infoNode, tabInfo: null };
    }

    for (const tabInfo of infoNode.children) {
      if (tabInfo.content === tabContent) {
        return { tabWidgetInfo: infoNode, tabInfo };
      }
    }
  }
  return null;
}

function findTabWidgetInfoByTab(infoNode: RootInfoNode, tab: Tab): {tabWidgetInfo: TabWidgetInfoNode, tabInfo: TabInfo} {
  if (infoNode.type === "splitter") {
    for (const kid of infoNode.children) {
      const info = findTabWidgetInfoByTab(kid, tab);
      if (info != null) {
        return info;
      }
    }
  } else {

    if (infoNode.children.length === 0) {
      if (infoNode.emptyTab === tab) {
        return { tabWidgetInfo: infoNode, tabInfo: null };
      }
    } else {

      // Tab widget
      for (const tabInfo of infoNode.children) {
        if (tabInfo.tab === tab) {
          return { tabWidgetInfo: infoNode, tabInfo };
        }
      }
    }
  }
  return null;
}

function findPathToTabContent(infoNode: RootInfoNode, tabContent: Element): InfoNode[] {
  if (infoNode.type === "splitter") {
    for (const kid of infoNode.children) {
      const path = findPathToTabContent(kid, tabContent);
      if (path != null) {
        return [infoNode, ...path];
      }
    }
    return null;

  } else {
    if (infoNode.emptyTabContent === tabContent) {
      return [infoNode];
    }

    // Tab widget
    for (const kid of infoNode.children) {
      if (kid.content === tabContent) {
        return [infoNode, kid];
      }
    }
    return null;
  }
}

function findPathToTabWidget(infoNode: RootInfoNode, tabWidget: TabWidget): InfoNode[] {
  if (infoNode.type === "splitter") {
    for (const kid of infoNode.children) {
      const path = findPathToTabWidget(kid, tabWidget);
      if (path != null) {
        return [infoNode, ...path];
      }
    }
    return null;

  } else {
    if (infoNode.tabWidget === tabWidget) {
      return [infoNode];
    }
    return null;
  }
}


function getAllTabContents(infoNode: RootInfoNode): Element[] {
  if (infoNode.type === "splitter") {
    return infoNode.children.map(getAllTabContents).reduce( (accu,list) => [...accu, ...list], []);
  } else {
    return infoNode.children.map(kidInfo => kidInfo.content);
  }
}

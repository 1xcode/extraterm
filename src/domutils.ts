
import util = require('./gui/util');

/**
 * Convert an array-like object to a real array.
 * 
 * @param {Object} fakeArray An array-like object with get() and length support.
 * @return {Array} A real array object with the elements as fakeArray.
 */
export function toArray<T>(fakeArray: { [key: number]: T; length: number; }): T[] {
  var result: T[] = [];

  var len = fakeArray.length;
  for (var i=0; i<len; i++) {
    result.push(fakeArray[i]);
  }
  return result;
}

export interface LeftRightPair {
  left: Node[];
  right: Node[];
}

/**
 * Split child nodes at a character offset.
 * 
 * @param {Node} rootNode The node whose child nodes are to be split.
 * @param {number} charOffset The character offset to split at.
 * @return {Object} An object of the form {left: array, right: array}
 *     containing arrays of the child nodes left of, and right of the
 *     character offset.
 */
export function splitNodeContentsAtChar(rootNode: Node, charOffset: number): LeftRightPair {
  var newoffset: number;
  var newNode: Node;

  var kids = toArray(rootNode.childNodes);
  var len = kids.length;
  var offset = 0;
  if (charOffset === 0) {
    return {left: [], right: kids};
  }

  for (var i=0; i<len; i++) {
    var kid = kids[i];
    if (kid.nodeName === "#text") {
      newoffset = offset + kid.nodeValue.length;
      if (newoffset === charOffset) {
        return {left: kids.slice(0,i+1), right: kids.slice(i+1)};
      }
      if (newoffset > charOffset) {
        newNode = kid.ownerDocument.createTextNode(kid.nodeValue.slice(0, charOffset-offset));
        kid.nodeValue = kid.nodeValue.slice(charOffset-offset);
        rootNode.insertBefore(newNode, kid);
        return {left: kids.slice(0,i).concat(newNode), right: kids.slice(i)};
      }
    } else {

      // Assume a normal node.
      newoffset = offset + kid.textContent.length;
      if (newoffset === charOffset) {
        return {left: kids.slice(0,i+1), right: kids.slice(i+1)};
      }
      if (newoffset > charOffset) {
        var parts = splitNodeContentsAtChar(kid, charOffset-offset);
        newNode = kid.cloneNode(false);
        parts.left.forEach(function(node) {
          newNode.appendChild(node);
        });
        rootNode.insertBefore(newNode, kid);
        return {left: kids.slice(0,i).concat(newNode), right: kids.slice(i)};
      }
    }
    offset = newoffset;
  }

  return {left: kids, right: []};
}

export function encloseCharRange(rootNode: Node, startOffset: number, endOffset: number, newNode: Node) {
  var split1Results = splitNodeContentsAtChar(rootNode, startOffset);
  var nodeStartOffset = split1Results.left.length;    
  var split2Results = splitNodeContentsAtChar(rootNode, endOffset);
  var nodeEndOffset = split2Results.left.length;
  var kids = toArray(rootNode.childNodes).slice(nodeStartOffset, nodeEndOffset);

  kids.forEach(function(kid) {                 
    newNode.appendChild(kid);
  });

  insertNodeAt(rootNode, nodeStartOffset, newNode);
}

/**
 * Insert a node under a parent node at an offset.
 * 
 * @param {Node} rootNode
 * @param {number} offset
 * @param {Node} newNode
 */
export function insertNodeAt(rootNode: Node, offset: number, newNode: Node): void {
  if (offset >= rootNode.childNodes.length) {
    rootNode.appendChild(newNode);
  } else {
    rootNode.insertBefore(newNode, rootNode.childNodes[offset]);
  }
}

/**
 * Extracts formatted plain text from a document range.
 *
 * @param range the range to scan and extract the text from.
 * @return the formatted plain text representation.
 */
export function extractTextFromRange(range: Range): string {
  const nbspRegexp = /\u00a0/g;
  
  const startContainer = range.startContainer;
  const endContainer = range.endContainer;
  let result = "";
  
  // Use case where the start and end of the range are inside the same text node.
  if (startContainer === range.endContainer) {
    if (startContainer.nodeType === Node.TEXT_NODE) {
      const textNode = <Text> startContainer;
      return textNode.data.slice(range.startOffset, range.endOffset).replace(nbspRegexp, " ");
    }
  }
  
  let currentNode: Node;
  if (startContainer.nodeType === Node.TEXT_NODE) {
    result += (<Text> startContainer).data.slice(range.startOffset).replace(nbspRegexp, " ");
    currentNode = nextDocumentOrderNode(startContainer);
  } else {
    currentNode = startContainer.childNodes[range.startOffset];
  }

  const endNode = endContainer.nodeType === Node.TEXT_NODE ? endContainer : endContainer.childNodes[range.endOffset];
  
  while (currentNode !== endNode && currentNode !== null) {
    if (currentNode.nodeType === Node.TEXT_NODE) {
      result += (<Text> currentNode).data.replace(nbspRegexp, " ");
      
    } else if (currentNode.nodeName === "DIV") {
      const divElement = <HTMLDivElement> currentNode;
      if (divElement.classList.contains('terminal-active') || divElement.classList.contains('terminal-scrollback')) {
        result = util.trimRight(result) + "\n";
      }
    }
    
    currentNode = nextDocumentOrderNode(currentNode);
  }
  
  if (endContainer.nodeType === Node.TEXT_NODE) {
    result += (<Text> endContainer).data.slice(0, range.endOffset).replace(nbspRegexp, " ");
  }
  
  return result;
}

function nextDocumentOrderNode(currentNode: Node): Node {
  if (currentNode.childNodes.length !== 0) {
    return currentNode.childNodes[0];
  }
  
  if (currentNode.nextSibling !== null) {
    return currentNode.nextSibling;
  }
  
  return nextDocumentOrderNodeUp(currentNode.parentNode);
}

function nextDocumentOrderNodeUp(currentNode: Node): Node {
  if (currentNode.nextSibling !== null) {
    return currentNode.nextSibling;
  }
  return nextDocumentOrderNodeUp(currentNode.parentNode);
}

export function createShadowRoot(self: HTMLElement): ShadowRoot {
    return self.webkitCreateShadowRoot ? self.webkitCreateShadowRoot() : self.createShadowRoot();
}
  
export function getShadowRoot(self: HTMLElement): ShadowRoot {
    return self.webkitShadowRoot ? self.webkitShadowRoot : self.shadowRoot;
}

export function getShadowId(el: HTMLElement, id: string): HTMLElement {
  return <HTMLElement> getShadowRoot(el).querySelector('#' + id);
}

/**
 * Converts a node list to a real array.
 * 
 * @param  nodeList the node list to convert.
 * @return          a new array holding the same contents as the node list.
 */
export function nodeListToArray(nodeList: NodeList): Node[] {
  let i = 0;
  const result: Node[] = [];
  const len = nodeList.length;
  for (i=0; i<len; i++) {
    result.push(nodeList[i]);
  }
  return result;
}

/**
 * Create a KeyboardEvent.
 *
 * This works around a bunch of bugs in Blink.
 * 
 * @param  eventName event name, one of 'keypress', 'keydown' and 'keyup'
 * @param  initMap map of values to use to fill the event
 * @return new keyboard event
 */
export function newKeyboardEvent(eventName: string, initMap: {
      bubbles?: boolean;
      key?: string;
      code?: string;
      location?: number;
      repeat?: boolean;
      keyCode?: number;
      charCode?: number;
      keyIdentifier?: string;
      which?: number;
      ctrlKey?: boolean;
      shiftKey?: boolean;
      altKey?: boolean;
      metaKey?: boolean;
    }): KeyboardEvent {
  
  const fakeKeyDownEvent = new KeyboardEvent(eventName, initMap);

  // https://stackoverflow.com/questions/12937391/cannot-initialize-keycode-in-keyboard-event-init-method      
  Object.defineProperty(fakeKeyDownEvent, 'keyCode', {
    get: function() {
      return initMap.keyCode;
    }
  });
  
  Object.defineProperty(fakeKeyDownEvent, 'charCode', {
    get: function() {
      return initMap.charCode;
    }
  });

  Object.defineProperty(fakeKeyDownEvent, 'code', {
    get: function() {
      return initMap.code;
    }
  });

  Object.defineProperty(fakeKeyDownEvent, 'which', {
    get: function() {
      return initMap.which;
    }
  });
  return fakeKeyDownEvent;
}

//-------------------------------------------------------------------------

export interface LaterHandle {
  cancel(): void;
}

let doLaterId: number = -1;
let laterList: Function[] = [];

function doLaterTimeoutHandler(): void {
  doLaterId = -1;
  const workingList = [...laterList];
  laterList = [];
  workingList.forEach( f => f() );
}

/**
 * Schedule a function to be executed later.
 * 
 * @param  {Function}    func [description]
 * @return {LaterHandle} This object can be used to cancel the scheduled execution.
 */
export function doLater(func: Function): LaterHandle {
  laterList.push(func);
  if (doLaterId === -1) {
    doLaterId = window.setTimeout(doLaterTimeoutHandler, 0);
  }
  return { cancel: () => {
    laterList = laterList.filter( f => f!== func );
  } };
}

let doLaterFrameId: number = -1;
let laterFrameList: Function[] = [];

/**
 * Schedule a function to run at the next animation frame.
 */
function doLaterFrameHandler(): void {
  const workingList = [...laterFrameList];
  laterFrameList = [];
  
  window.cancelAnimationFrame(doLaterFrameId);
  doLaterFrameId = -1;
  
  workingList.forEach( f => f() );
}

export function doLaterFrame(func: Function): LaterHandle {
  laterFrameList.push(func);
  if (doLaterFrameId === -1) {
    doLaterFrameId = window.requestAnimationFrame(doLaterFrameHandler);
  }
  return { cancel: () => {
    laterFrameList = laterFrameList.filter( f => f!== func );
  } };
}

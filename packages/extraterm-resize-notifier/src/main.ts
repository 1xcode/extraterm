/*
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

export interface ResizeCallback {
  (target: Element, contentRect: DOMRectReadOnly): void;
}

export class ResizeNotifier {
  private _resizeObserver: ResizeObserver;
  private _observedElementsMap = new WeakMap<Element, ResizeCallback>();

  constructor() {
    this._resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const callback = this._observedElementsMap.get(entry.target);
        if (callback != null) {
          callback(entry.target, entry.contentRect);
        }
      }
    });
  }

  /**
   * Start observing resizes of an element
   * 
   * @param element the element to observe
   * @param callback the callback function to call when the element resizes.
   */
  observe(element: Element, callback: ResizeCallback): void {
    this._resizeObserver.observe(element);
    this._observedElementsMap.set(element, callback);
  }

  /**
   * Stop observing an element
   * 
   * @param element the element to stop observing
   */
  unobserve(element: Element): void {
    this._resizeObserver.unobserve(element);
    this._observedElementsMap.delete(element);
  }
}

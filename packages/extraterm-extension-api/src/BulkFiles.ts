/*
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import { Event } from "extraterm-event-emitter";


export interface BulkFileMetadata {
  readonly [index: string]: (string | number | undefined);
}


export enum BulkFileState {
  DOWNLOADING,
  COMPLETED,
  FAILED
}


/**
 * A handle for accessing a bulk file.
 */
export interface BulkFileHandle {

  readonly state: BulkFileState;

  /**
   * URL to the file contents.
   */
  readonly url: string;

  /**
   * The number of bytes of the file which are available.
   *
   * This value can change when a file is being downloaded. See the event
   * `onAvailableSizeChange`.
   */
  readonly availableSize: number;

  onAvailableSizeChange: Event<number>;

  /**
   * Get the complete size of the file.
   *
   * This may be -1 if the total size is unknown.
   */
  readonly totalSize: number;

  /**
   * Get the metadata associated with the file.
   *
   * The keys are simply strings and are specific to the file type.
   */
  readonly metadata: BulkFileMetadata;

  /**
   * Get the first 1KB of the file contents.
   *
   * @return The first 1KB of file or less if the available size and/or total
   *          size is less than 1024.
   */
  peek1KB(): Buffer;

  /**
   * Reference the file and increment its internal reference count.
   *
   * Files are managed and deleted when unneeded by using a simple reference
   * counting scheme. When a file handle is held it must also be referenced
   * by calling this method. When a file handle is no longer needed, then the
   * matching `deref()` method must be called.
   *
   * When a file's internal reference count transitions to zero, then the file
   * may be cleaned up and removed on the next process tick.
   */
  ref(): void;

  /**
   * Dereference this file.
   *
   * See `ref()` above.
   */
  deref(): void;

  /**
   * This event is fired when the file has been completely downloaded or fails.
   */
  onStateChange: Event<BulkFileState>;
}

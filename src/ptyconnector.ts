/*
 * Copyright 2014-2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

/**
 * Represents a PTY.
 */
export interface Pty {
  /**
   * Write data to the pty
   *
   * @param data data to write.
   */
  write(data: any): void;
  
  /**
   * Tell the pty that the size of the terminal has changed
   *
   * @param cols number of columns in ther terminal.
   * @param rows number of rows in the terminal.
   */
  resize(cols: number, rows: number): void;
  
  /**
   * Puase the stream of data from the PTY.
   */
  pause(): void;

  /**
   * Pause the stream of data from the PTY.
   */
  resume(): void;  

  /**
   * Destroy the pty and shut down the attached process
   */
  destroy(): void;
  
  onData(callback: (data: string) => void): void;
  
  onExit(callback: () => void): void;
}

export interface EnvironmentMap {
  [key:string]: string;
}

export interface PtyOptions {
  name?: string;
  cols?: number;
  rows?: number;
  cwd?: string;
  env?: EnvironmentMap;
}

export interface PtyConnector {
  spawn(file: string, args: string[], opt: PtyOptions): Pty;
  destroy(): void;
}

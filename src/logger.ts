/**
 * Copyright 2014-2015 Simon Edwards <simon@simonzone.com>
 */

/**
 * Logging support for inside Electron apps.
 *
 * Instances of this class can be made for different parts of the program
 * code. Logger instances with the same name are made unique by use a counter.
 */

const instanceCounter = new Map<string, number>();

class Logger {
  
  private _name: string;
  
  /**
   * Contruct a logger.
   * 
   * @param  name the name of the code or class associated with this logger instance.
   * @return the new logger instance
   */
  constructor(name?: string) {
    const baseName = name === undefined ? "(unknown)" : name;
    const instanceCount = instanceCounter.has(baseName) ? instanceCounter.get(baseName) + 1 : 0;
    instanceCounter.set(baseName, instanceCount);
    this._name = baseName + " #" + instanceCount;
  }
  
  /**
   * Log a debug message.
   * 
   * @param msg     the log message
   * @param ...opts extra values to log with the message
   */
  debug(msg: any, ...opts: any[]): void {
    this._log("DEBUG", msg, opts);
  }
  
  /**
   * Log an info message.
   * 
   * @param msg     the log message
   * @param ...opts extra values to log with the message
   */
  info(msg: any, ...opts: any[]): void {
    this._log("INFO", msg, opts);
  }
  
  /**
   * Log a warning message.
   * 
   * @param msg     the log message
   * @param ...opts extra values to log with the message
   */
  warn(msg: any, ...opts: any[]): void {
    this._log("WARN", msg, opts);
  }
  
  /**
   * Log a severe message.
   * 
   * @param msg     the log message
   * @param ...opts extra values to log with the message
   */
  severe(msg: any, ...opts: any[]): void {
    this._log("SEVERE", msg, opts);
  }
  
  private _log(level: string, msg: string, opts: any[]): void {
    console.log(this._format(level, msg), ...opts);
  }
  
  private _format(level: string, msg: string): string {
    return `${(new Date()).toISOString().replace(/(T|Z)/g," ").trim()} ${level} [${this._name}] ${msg}`;
  }
}

export = Logger;

/**
 * Copyright 2014-2015 Simon Edwards <simon@simonzone.com>
 */
import util = require('./gui/util');
import os = require('os');
import _ = require('lodash');

export interface Config {
  blinkingCursor?: boolean;
  theme?: string;
  themePath?: string;

  // List of regexp patterns which are used to identify command
  // lines which should not get a command frame around their output.
  noFrameCommands?: string[];

  sessionProfiles?: SessionProfile[]; // User configurable list of sessions.
  expandedProfiles: SessionProfile[]; // 'cooked' or expanded list of sessions where missing information is filled in.
  systemConfig: SystemConfig;
}

export interface SystemConfig {
  homeDir: string;
}

export const SESSION_TYPE_UNIX = "unix";
export const SESSION_TYPE_CYGWIN = "cygwin";
export const SESSION_TYPE_BABUN = "babun";

export interface SessionProfile {
  name: string;             // Human readable name for the profile.
  type?: string;            // type - "cygwin", "babun" or "native" ("" means "native")
  command?: string;         // the command to execute in the terminal
  arguments?: string[];     // the arguments for said command
  extraEnv?: Object;        // extra entries to add to the environment before running the command.
  cygwinDir?: string;       // The directory holding the 'system'. Used by babun and cygwin.
}

export function envContext(systemConfig: SystemConfig): Map<string, string> {
  const context = new Map<string, string>();
  context.set("HOME_DIR", systemConfig.homeDir);
  return context;
}

export function expandEnvVariables(extraEnv: Object, context: Map<string, string>): Object {
  const expandedEnv = {};
  if (extraEnv !== null && extraEnv !== undefined) {
    let prop: string;
    for (prop in extraEnv) {
      expandedEnv[prop] = expandEnvVariable(extraEnv[prop], context);
    }
  }

  return expandedEnv;
}

export function expandEnvVariable(value: string, context: Map<string, string>): string {
  let result = value;
  let prop: string;
  context.forEach( (value, prop) => {
    const re = new RegExp("\\$\\{" + prop + "\\}", "g");
    result = result.replace(re, value);
  });
  return result;
}

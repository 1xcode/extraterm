/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as http from "node:http";
import { Event, EventEmitter } from "extraterm-event-emitter";
import { getLogger, Logger } from "extraterm-logging";
import getStream from "get-stream";

import { RequestContext, RequestHandler } from "../local_http_server/RequestHandlerType.js";
import { ExtensionManager } from "../extension/ExtensionManager.js";
import { Window } from "../Window.js";

const BAD_REQUEST_400 = 400;
const METHOD_NOT_ALLOWED_405 = 405;
const OK_200 = 200;
const NO_CONTENT_204 = 204;
const INTERNAL_SERVER_ERROR_500 = 500;

const SUCCESS_STATUS_CODES = [OK_200, NO_CONTENT_204];

export interface CommandHttpResponse {
  commandName?: string;
  statusCode: number,
  body?: any
}


export class CommandRequestHandler implements RequestHandler {
  private _log: Logger = null;
  // #mainDesktop: MainDesktop = null;
  #extensionManager: ExtensionManager = null;
  #getWindowById: (id: number) => Window = null;

  /**
   * Fired after a command has been responded to.
   */
  onCommandComplete: Event<CommandHttpResponse> = null;
  #onCommandCompleteEventEmitter = new EventEmitter<CommandHttpResponse>();

  constructor(extensionManager: ExtensionManager, getWindowById: (id: number) => Window) {
    this._log = getLogger("CommandRequestHandler", this);
    this.#getWindowById = getWindowById;
    this.#extensionManager = extensionManager;
    this.onCommandComplete = this.#onCommandCompleteEventEmitter.event;
  }

  async handle(req: http.IncomingMessage, res: http.ServerResponse, path: string, context: RequestContext): Promise<void> {
    const response = await this.#handleRequest(req, path, context);

    if ( ! SUCCESS_STATUS_CODES.includes(response.statusCode)) {
      this._log.warn(`${response.statusCode}: ${response.body}`);
    }

    res.statusCode = response.statusCode;
    res.setHeader("Content-Type", "application/json");
    if (response.body == null) {
      res.end();
    } else {
      res.end(JSON.stringify(response.body));
    }
    this.#onCommandCompleteEventEmitter.fire(response);
  }

  async #handleRequest(req: http.IncomingMessage, path: string, context: RequestContext): Promise<CommandHttpResponse> {
    if (req.method !== "POST" || path !== "") {
      return {
        statusCode: METHOD_NOT_ALLOWED_405,
        body: {
          message: "Method not allowed"
        }
      };
    }

    try {
      const body = await getStream(req);

      let jsonBody: object = null;
      try {
        jsonBody = JSON.parse(body);
      } catch (e) {
        return {
          statusCode: BAD_REQUEST_400,
          body: {
            message: "Bad request. JSON body failed to parse."
          }
        };
      }

      return this.#processBody(jsonBody);
    } catch(error) {
      this._log.warn(error);
      return {
        statusCode: INTERNAL_SERVER_ERROR_500,
        body: {
          message: "Internal server error. Consult the Extraterm logs for details."
        }
      };
    }
  }

  async #processBody(jsonBody: any): Promise<CommandHttpResponse> {
    const commandName = jsonBody.command;
    if (commandName == null) {
      this._log.warn(`'command' was missing from the POST body.`);
      return {
        statusCode: BAD_REQUEST_400,
        body: {
          message: "`'command' was missing from the POST body.`"
        }
      };
    }

    let result: any = null;
    try {
      const tempState = this.#extensionManager.copyExtensionWindowState();

      const windowIdStr = jsonBody.window;
      let windowId: number = null;
      if (windowIdStr != null) {
        windowId = Number.parseInt(windowIdStr, 10);
        if (Number.isNaN(windowId)) {
          return {
            commandName,
            statusCode: BAD_REQUEST_400,
            body: {
              message: "`Parameter 'window' could not be parsed.`"
            }
          };
        }

        const window = this.#getWindowById(windowId);
        if (window == null) {
          return {
            commandName,
            statusCode: BAD_REQUEST_400,
            body: {
              message: "`Invalid value for parameter 'window' was given.`"
            }
          };
        }
        tempState.activeWindow = window;
      }

      if ( ! this.#extensionManager.hasCommand(commandName)) {
        return {
          commandName,
          statusCode: BAD_REQUEST_400,
          body: {
            message: `Unknown command '${commandName}'.`
          }
        };
      }

      result = await this.#extensionManager.executeCommandWithExtensionWindowState(tempState, commandName, this.#collectArgs(jsonBody));
    } catch(ex) {
      this._log.warn(`Exception occurred while processing command ${commandName}.`, ex);
      return {
        commandName,
        statusCode: INTERNAL_SERVER_ERROR_500,
        body: "" + ex
      };
    }

    if (result == null) {
      return {
        commandName,
        statusCode: NO_CONTENT_204
      };
    }

    return {
      commandName,
      statusCode: OK_200,
      body: result
    };
  }

  #collectArgs(jsonBody: any): object {
    if (jsonBody == null || jsonBody.args == null) {
      return {};
    }
    return jsonBody.args;
  }
}

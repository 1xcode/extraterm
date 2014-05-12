/**
 * Copyright 2014 Simon Edwards <simon@simonzone.com>
 */
var _ = require('lodash-node');
var termjs = require('term.js');
var child_process = require('child_process');

var EXTRATERM_COOKIE_ENV = "EXTRATERM_COOKIE";
var SEMANTIC_TYPE = "data-extraterm-type";
var SEMANTIC_VALUE = "data-extraterm-value";
var SEMANTIC_START_OUTPUT = "data-extraterm-start-output";
var SEMANTIC_RETURN_CODE = "data-extraterm-return-code";

var APPLICATION_MODE_NONE = 0;
var APPLICATION_MODE_HTML = 1;
var APPLICATION_MODE_OUTPUT_BRACKET_START = 2;
var APPLICATION_MODE_OUTPUT_BRACKET_END = 3;
var TYPE_OUTPUT_START = "command-output-start";
var TYPE_OUTPUT = "command-output";

/**
 * Create a new terminal.
 * 
 * See startUp().
 * 
 * @param {type} parentElement The DOM element under which the terminal will
 *     be placed.
 * @returns {Terminal}
 */
function Terminal(parentElement) {
  if (!(this instanceof Terminal)) {
    throw new Error("Call Terminal using the new keyword.");
  }
  this._parentElement = parentElement;
  _.bindAll(this);
  
  this._htmlData = null;
  this._applicationMode = APPLICATION_MODE_NONE;
  this._bracketStyle = null;
  this._lastBashBracket = null;
}

/**
 * Get the window which this terminal is on.
 * 
 * @returns {Window} The window object.
 */
Terminal.prototype._getWindow = function() {
  return this._parentElement.ownerDocument.defaultView;  
};

/**
 * Start the terminal up.
 * 
 * This method should be called once all event handlers have been set up.
 */
Terminal.prototype.startUp = function() {
  var size;
  var cookie;
  
  cookie = "DEADBEEF";  // FIXME
  process.env[EXTRATERM_COOKIE_ENV] = cookie;

  this._term = new termjs.Terminal({
    cols: 80,
    rows: 30,
    scrollback: 10000,
//      cursorBlink: false,
    physicalScroll: true,
    applicationModeCookie: cookie
  });
  this._term.debug = true;
  this._term.on('title', this._handleTitle);
  this._term.on('data', this._handleTermData);
  this._getWindow().addEventListener('resize', this._handleResize);

  // Application mode handlers    
  this._term.on('application-mode-start', this._handleApplicationModeStart);
  this._term.on('application-mode-data', this._handleApplicationModeData);
  this._term.on('application-mode-end', this._handleApplicationModeEnd);

  // Window DOM event handlers
  this._getWindow().document.body.addEventListener('click', this._handleWindowClick);

  this._term.open(this._parentElement);
  this._term.write('\x1b[31mWelcome to Extraterm!\x1b[m\r\n');

  // Start our PTY bridge process and connect it to our terminal.
  this._ptyBridge = child_process.spawn('node', ['pty_bridge.js'], {
    env: process.env
  });
  this._ptyBridge.stdout.on('data', this._handlePtyStdoutData);
  this._ptyBridge.stderr.on('data', this._handlePtyStderrData);
  this._ptyBridge.on('close', this._handlePtyClose);

  size = this._term.resizeToContainer();
  this._sendResize(size.cols, size.rows);
};

/**
 * Handler for window title change events from the pty.
 * 
 * @param {String} title The new window title for this terminal.
 */
Terminal.prototype._handleTitle = function(title) {
  this._getWindow().document.title = title;
};

/**
 * Handle a resize event from the window.
 */
Terminal.prototype._handleResize = function() {
  var size = this._term.resizeToContainer();
  this._sendResize(size.cols, size.rows);
};

/**
 * Handle when the embedded term.js enters start of application mode.
 * 
 * @param {array} params The list of parameter which were specified in the
 *     escape sequence.
 */
Terminal.prototype._handleApplicationModeStart = function(params) {
  console.log("application-mode started! ",params);
  if (params.length === 1) {
    // Normal HTML mode.
    this._applicationMode = APPLICATION_MODE_HTML;

  } else if(params.length >= 2) {
    switch ("" + params[1]) {
      case "2":
      this._applicationMode = APPLICATION_MODE_OUTPUT_BRACKET_START;
      this._bracketStyle = params[2];
      break;

    case "3":
      this._applicationMode = APPLICATION_MODE_OUTPUT_BRACKET_END;
      console.log("Starting APPLICATION_MODE_OUTPUT_BRACKET_END");
      break;

    default:
      console.log("Unrecognized application escape parameters.");
      break;
    }
  }
  this._htmlData = "";
};

/**
 * Handle incoming data while in application mode.
 * 
 * @param {string} data The new data.
 */
Terminal.prototype._handleApplicationModeData = function(data) {
//      console.log("html-mode data!", data);
  if (this._applicationMode !== APPLICATION_MODE_NONE) {
    this._htmlData = this._htmlData + data;
  }
};

/**
 * Handle the exit from application mode.
 */
Terminal.prototype._handleApplicationModeEnd = function() {
  var el;
  var cleancommand;
  var trimmed;
  var startdivs;
  var outputdiv;
  var node;
  var nodelist;

  switch (this._applicationMode) {
    case APPLICATION_MODE_HTML:
      el = this._getWindow().document.createElement("div");
      el.innerHTML = this._htmlData;
      this._term.appendElement(el);
      break;

    case APPLICATION_MODE_OUTPUT_BRACKET_START:
      if (this._lastBashBracket !== this._htmlData) {
        el = this._getWindow().document.createElement("div");
        el.className = "extraterm_start_output";
        cleancommand = this._htmlData;
        if (this._bracketStyle === "bash") {
          // Bash includes the history number. Remove it.
          trimmed = this._htmlData.trimLeft();
          cleancommand = trimmed.slice(trimmed.indexOf(" ")).trimLeft();
        }
        el.setAttribute(SEMANTIC_TYPE, TYPE_OUTPUT_START);
        el.setAttribute(SEMANTIC_VALUE, cleancommand);
        this._term.appendElement(el);
        this._lastBashBracket = this._htmlData;
      }
      break;

    case APPLICATION_MODE_OUTPUT_BRACKET_END:
      console.log("startdivs:", startdivs);
      this._term.moveRowsToScrollback();
      startdivs = this._term.element.querySelectorAll("DIV[" + SEMANTIC_TYPE + "='" + TYPE_OUTPUT_START + "']");
      if (startdivs.length !== 0) {
        outputdiv = startdivs[startdivs.length-1];
        node = outputdiv.nextSibling;

        nodelist = [];
        while (node !== null) {
          nodelist.push(node);
          node = node.nextSibling;
        }
        nodelist.forEach(function(node) {
          outputdiv.appendChild(node);
        });
        outputdiv.setAttribute(SEMANTIC_TYPE, TYPE_OUTPUT);
        outputdiv.setAttribute(SEMANTIC_RETURN_CODE, this._htmlData);
        outputdiv.className = "extraterm_output";
      }

      break;

    default:
      break;
  }
  this._applicationMode = APPLICATION_MODE_NONE;

  console.log("html-mode end!",this._htmlData);
  this._htmlData = null;
};

/**
 * Handle a click inside the terminal.
 * 
 * @param {event} event
 */
Terminal.prototype._handleWindowClick = function(event) {
  var type;
  var value;

//      console.log("body on click!",event);
  type = event.srcElement.getAttribute(SEMANTIC_TYPE);
  value = event.srcElement.getAttribute(SEMANTIC_VALUE);
  this._handleMineTypeClick(type, value);
};

/**
 * Handle new stdout data from the pty.
 * 
 * @param {string} data New data.
 */
Terminal.prototype._handlePtyStdoutData = function (data) {
  console.log("incoming data:",""+data);
  this._term.write("" + data);
};

/**
 * Handle new stderr data from the pty.
 * 
 * @param {type} data New data.
 */
Terminal.prototype._handlePtyStderrData = function(data) {
  this._term.write(data);
};

/**
 * Handle a pty close event.
 * 
 * @param {string} data
 */
Terminal.prototype._handlePtyClose = function(data) {
  this._term.destroy();
  this._getWindow().close();
};
  
/**
 * Handle data coming from the user.
 * 
 * This just pushes the keys from the user through to the pty.
 * @param {string} data The data to process.
 */
Terminal.prototype._handleTermData = function(data) {
  this._sendDataToPty(data);
};

/**
 * Send data to the pseudoterminal.
 * 
 * @param {string} text
 * @param {function} callback (Optional) Callback to call once the data has
 *     been sent.
 */
Terminal.prototype._sendDataToPty = function(text, callback) {
  var jsonString = JSON.stringify({stream: text});
//      console.log("<<< json string is ",jsonString);
//      console.log("<<< json string length is ",jsonString.length);
  var sizeHeaderBuffer = new Buffer(4);
  sizeHeaderBuffer.writeUInt32BE(jsonString.length, 0);

  this._ptyBridge.stdin.write(sizeHeaderBuffer);
  this._ptyBridge.stdin.write(jsonString, callback);
};

/**
 * Send a resize message to the pty.
 * 
 * @param {number} cols The new number of columns in the terminal.
 * @param {number} rows The new number of rows in the terminal.
 * @param {function} callback (Optional) Callback to call once the data has
 *     been sent.
 */
Terminal.prototype._sendResize = function(cols, rows, callback) {
  var jsonString = JSON.stringify({resize: [cols, rows]});
//      console.log("<<< json string is ",jsonString);
//      console.log("<<< json string length is ",jsonString.length);
  var sizeHeaderBuffer = new Buffer(4);
  sizeHeaderBuffer.writeUInt32BE(jsonString.length, 0);

  this._ptyBridge.stdin.write(sizeHeaderBuffer);
  this._ptyBridge.stdin.write(jsonString, callback);  
};

/**
 * Process a click on a item of the given mimetype and value.
 * 
 * @param {string} type
 * @param {string} value
 */
Terminal.prototype._handleMineTypeClick = function(type, value) {
  if (type === "directory") {
    this._sendDataToPty("cd " + value + "\n"); // FIXME escaping
  }
};

/*************************************************************************/
exports.startUp = (function() {
  "use strict";

  function startUp() {
    var terminaltab = new Terminal(window.document.getElementById("tab_container"));
    terminaltab.startUp();
  }

  return startUp;
})();

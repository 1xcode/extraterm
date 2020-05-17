---
title: Logging and Debugging Extensions
---

# Logging and Debugging Extensions


## Developer Tools

Extraterm is built on top of Electron which is in turn built on top of the browser engine used in Google Chrome,
Chromium, Microsoft Edge, and many other modern web browsers. This platform also includes the same powerful "Web Developer Tools" web developers have come to expect.

To open the "Web Developer Tools" window, select the "Developer Tools" menu item from the menu in the top right corner of the Extraterm window. From here you can poke around in the Extraterm internals and also open up and debug your extensions.

Extraterm internally makes extensive use of Custom Elements. If you look around the tree of DOM elements you will see many unusual elements with names refering to Extraterm. Much of the contents of these element is hidden below the `#shadow-root` node in the tree.


## Logging

Although it is possible to use the traditional browser `console.log()` API and friends, Extraterm supplies each extension with a logger object to use. It's API is very similar to `console.log()` but has the advantage of adding timestamps and marking where the output came from.

Where logging output appears depends on whether the extension was running inside the main Extraterm process or one of the window processes. Many extensions run in the window process and their logging output is visible in the "Web Developer Tools" window, "Console" section. Logging output from extensions running in the main process appear on Extraterm's stdout and/or in the `extraterm.log` file inside `~/.config/extraterm` (Linux and macOS) or `%APPDATA%\extraterm` (Windows).

Note: On Windows if a second instance of Extraterm is started then it might not be able put logs in `extraterm.log`. Starting up Extraterm from the terminal directly and watching stdout is a good way of viewing these log messages.

Extensions can acquire their logger object from the context object which is given during extension activation. It can be safely put in a variable for later use.

```javascript

let log = null;

export function activate(context: ExtensionContext): any {
  log = context.logger;

  //...
}

exports.activate = activate;
```

Usage is similar to `console.log()` and friends:

```javascript
  log.debug('I have something to debug.');

  log.warn('That value is', thatValue, ' and some other value is ', otherValue);

  log.info('Just informing you of something.');

  log.serve('Time to panic');
```


The complete API for the logger is documented in the [API reference](extension_api/) at [Logger](extension_api/interfaces/logging.html).

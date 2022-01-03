/*
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import 'jest';

test("Dummy", () => {
});
/*
import { KeybindingsIOManager } from "./KeybindingsIOManager";
import { ExtensionManager } from '../extension/ExtensionManager';
import * as path from 'path';
import { SharedMap } from '../shared_map/SharedMap';
import { ConfigDatabase } from '../config/ConfigDatabase';
import { GeneralConfig } from '../config/Config';


test("Scan & Flatten", () => {
  const sharedMap = new SharedMap();
  const configDatabase = new ConfigDatabase(sharedMap);
  const config: GeneralConfig = {
    keybindingsName: "pc-style"
  };
  configDatabase.setGeneralConfig(config);
  const extensionManager = new ExtensionManager(configDatabase, ["../extensions"], "0.1.0");
  extensionManager.startUpExtensions({"default-keybindings": true}, false);

  const kbm = new KeybindingsIOManager(path.join(__dirname, "../../src/keybindings/test_files"),
    extensionManager, configDatabase);

  const stackedBindings = kbm.getStackedKeybindings("pc-style");
  expect(stackedBindings.keybindingsSet.bindings.filter(b => b.command === "extraterm:application.openCommandPalette").length).toBe(1);
  expect(stackedBindings.customKeybindingsSet.customBindings.filter(b => b.command === "extraterm:window.newTerminal").length).toBe(0);
  expect(stackedBindings.customKeybindingsSet.customBindings.filter(b => b.command === "extraterm:application.openCommandPalette").length).toBe(1);
  expect(stackedBindings.customKeybindingsSet.customBindings.filter(b => b.command === "extraterm:global.globalToggleShowHide").length).toBe(1);
  const flatBindings = kbm.getFlatKeybindingsSet("pc-style");

  expect(flatBindings.extends).toBe("pc-style");
  expect(flatBindings.bindings.length).not.toBe(0);

  expect(flatBindings.bindings.filter(b => b.command === "extraterm:window.newTerminal").length).toBe(1);
  expect(flatBindings.bindings.find(b => b.command === "extraterm:window.newTerminal").keys.length).toBe(1);

  // The pc-style.json file under `test_files` should override the Command palette binding.
  expect(flatBindings.bindings.filter(b => b.command === "extraterm:application.openCommandPalette").length).toBe(1);
  expect(flatBindings.bindings.find(b => b.command === "extraterm:application.openCommandPalette").keys.length).toBe(0);

  expect(flatBindings.bindings.filter(b => b.command === "extraterm:global.globalToggleShowHide").length).toBe(1);
  expect(flatBindings.bindings.find(b => b.command === "extraterm:global.globalToggleShowHide").keys.length).toBe(1);

});
*/

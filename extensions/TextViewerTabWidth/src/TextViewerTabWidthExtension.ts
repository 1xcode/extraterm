/*
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import {ExtensionContext, CommandEntry, TextViewer} from 'extraterm-extension-api';

export function activate(context: ExtensionContext): any {
  context.workspace.registerCommandsOnTextViewer(textViewerCommandLister, textViewerCommandExecutor);
}

const COMMAND_SET_TAB_WIDTH = "setTabWidth";

function textViewerCommandLister(textViewer: TextViewer): CommandEntry[] {
  return [{
    id: COMMAND_SET_TAB_WIDTH,
    label: "Tab Size: " + textViewer.getTabSize()
  }];
}

async function textViewerCommandExecutor(textViewer: TextViewer, commandId: string, commandArguments?: object): Promise<any> {
  const selectedTabSize = await textViewer.getTab().showNumberInput({
    title: "Tab Size",
    value: textViewer.getTabSize(),
    minimum: 0,
    maximum: 32
  });
  if (selectedTabSize !== undefined) {
    textViewer.setTabSize(selectedTabSize);
  }
}

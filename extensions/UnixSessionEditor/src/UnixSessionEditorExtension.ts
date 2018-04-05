/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import _ = require('lodash');

import {BulkFileHandle, BulkFileState, CommandEntry, ExtensionContext, Logger, Terminal, SessionConfiguration} from 'extraterm-extension-api';
import {UnixSessionEditorUi} from './UnixSessionEditorUi';


let log: Logger = null;

interface UnixSessionConfiguration extends SessionConfiguration {
  shell?: string;
}

export function activate(context: ExtensionContext): any {
  log = context.logger;
  
  log.info("UnixSessionEditorExtension activate");
  
  class UnixSessionEditor extends context.workspace.extensionSessionEditorBaseConstructor {
    private _ui: UnixSessionEditorUi = null;

    created(): void {
      super.created();

      this._ui = new UnixSessionEditorUi();
      const component = this._ui.$mount();
      this._ui.$watch('$data', this._dataChanged.bind(this), { deep: true, immediate: false } );

      const config = <UnixSessionConfiguration> this.getSessionConfiguration();
      this._ui.name = config.name;
      this._ui.shell = config.shell;

      this.getContainerElement().appendChild(component.$el);
    }

    _dataChanged(): void {
      const oldConfig = this.getSessionConfiguration();
      const newConfig: UnixSessionConfiguration = {
        uuid: oldConfig.uuid,
        name: this._ui.name,
        shell: this._ui.shell
      };
      if ( ! _.isEqual(oldConfig, newConfig)) {
        this.updateSessionConfiguration(newConfig);
      }
    }
  }

  context.workspace.registerSessionEditor("unix", UnixSessionEditor);
}

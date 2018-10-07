/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import Component from 'vue-class-component';
import Vue from 'vue';
import * as _ from 'lodash';
import { KeybindingsInfo } from '../../../Config';
import { KeybindingsFile } from '../../../KeybindingsFile';
import { EVENT_START_KEY_INPUT, EVENT_END_KEY_INPUT } from './ContextUi';
import { KeybindingsList } from './KeybindingsListUi';

export const EVENT_DELETE = "delete";
export const EVENT_DUPLICATE = "duplicate";
export const EVENT_RENAME = "rename";


@Component(
  {
    components: {
      "keybindings-contexts-list": KeybindingsList
    },
    template: `
<div class="settings-page">
  <h2><i class="far fa-keyboard"></i>&nbsp;&nbsp;Keybindings</h2>

  <div className=''>
    <div class="form-horizontal">
      <div class="form-group">
        <label for="theme-terminal" class="col-sm-2 control-label">Keybindings:</label>

        <div class="col-sm-10 keybindings-select-group">

          <div v-if=" ! editingTitle" class="keybindings-select">
            <select class="form-control" id="keybindings-style" v-model="selectedKeybindings">
              <option v-for="option in sortedKeybindingsInfoList" v-bind:value="option.name">
                {{ option.name }} {{option.readOnly ? "   &#x1f512": ""}}
              </option>
            </select>
          </div>

          <template v-else>
            <div v-bind:class="{'has-error': isTitleConflict, 'keybindings-title-input': true}">
              <input
                ref="titleInput"
                v-bind:title="isTitleConflict ? 'This name is already being used' : ''"
                v-model="selectedTitle"
                class="form-control" 
                v-on:keydown.capture="onTitleKeyDown"
                />
            </div>
            <div class="btn-group keybindings-title-controls">
              <button title="Accept" class="btn btn-success" :disabled="isTitleConflict" v-on:click="onOkTitle">
                <i class="fas fa-check"></i>
              </button>
              <button title="Cancel" class="btn btn-danger" v-on:click="onCancelTitle">
                <i class="fas fa-times"></i>
              </button>
            </div>
          </template>

          <div class="btn-group keybindings-copy-controls">
            <button title="Duplicate" class="btn btn-default" v-on:click="duplicate">
              <i class="fas fa-copy"></i>
            </button>
            <button title="Rename" class="btn btn-default" v-bind:disabled="isSelectedKeybindingsReadOnly" v-on:click="rename">
              <i class="fas fa-edit"></i>
            </button>
            <button title="Delete" class="btn btn-default" v-bind:disabled="isSelectedKeybindingsReadOnly" v-on:click="trash">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
  <keybindings-contexts-list
    v-if="keybindings !== null"
    :keybindings="keybindings"
    :readOnly="isSelectedKeybindingsReadOnly"
    v-on:${EVENT_START_KEY_INPUT}="$emit('${EVENT_START_KEY_INPUT}')"
    v-on:${EVENT_END_KEY_INPUT}="$emit('${EVENT_END_KEY_INPUT}')">
  </keybindings-contexts-list>
</div>
`
})
export class KeybindingsSettingsUi extends Vue {
  keybindingsInfoList: KeybindingsInfo[] = [];

  keybindings: KeybindingsFile = null;
  selectedKeybindings: string = "";

  editingTitle = false;
  titleKeybindingsInfo: KeybindingsInfo = null;
  selectedTitle: string = ""

  get isSelectedKeybindingsReadOnly(): boolean {
    const info = this._selectedKeybindingsInfo();
    return info != null ? info.readOnly : true;
  }

  private _selectedKeybindingsInfo(): KeybindingsInfo {
    for (const kbf of this.keybindingsInfoList) {
      if (kbf.name === this.selectedKeybindings) {
        return kbf;
      }
    }
    return null;
  }

  get sortedKeybindingsInfoList(): KeybindingsInfo[] {
    return [...this.keybindingsInfoList].sort( (a,b) => {
      if (a.readOnly && ! b.readOnly) {
        return -1;
      }

      if ( ! a.readOnly && b.readOnly) {
        return 1;
      }

      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();
      if (aName < bName) {
        return -1;
      }

      if (aName > bName) {
        return 1;
      }
      return 0;
    });
  }

  duplicate(): void {
    this.$emit(EVENT_DUPLICATE, this.selectedKeybindings);
  }

  trash(): void {
    this.$emit(EVENT_DELETE, this.selectedKeybindings);
  }

  rename(): void {
    this.selectedTitle = this._selectedKeybindingsInfo().name;
    this.editingTitle = true;
    this.$nextTick(() => (<HTMLInputElement>this.$refs.titleInput).focus());
  }

  onTitleKeyDown(event: KeyboardEvent) {
    if ( ! this._isCharValidInFilenames(event.key)) {
      event.preventDefault();
    }
  }

  private _isCharValidInFilenames(char: string): boolean {
    if (process.platform === "win32") {
      return ["<", ">", ":", '"', "/", "\\", "|", "?", "*"].indexOf(char) === -1;
    } else {
      return char !== "/";
    }
  }

  onOkTitle(): void {
    this.editingTitle = false;
    if (this.selectedKeybindings === this.selectedTitle) {
      return;
    }
    this.$emit(EVENT_RENAME, this.selectedKeybindings, this.selectedTitle);
  }

  onCancelTitle(): void {
    this.editingTitle = false;
  }

  get isTitleConflict(): boolean {
    const lowerSelectedKeybindings= this.selectedKeybindings.toLowerCase();
    const lowerSelectedTitle = this.selectedTitle.toLowerCase();
    for (const kbf of this.keybindingsInfoList) {
      const lowerKbfName = kbf.name.toLowerCase();
      if (lowerKbfName !== lowerSelectedKeybindings && lowerKbfName === lowerSelectedTitle) {
        return true;
      }
    }
    return false;
  }
}

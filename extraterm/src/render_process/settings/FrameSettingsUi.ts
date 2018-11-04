/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import Component from 'vue-class-component';
import Vue from 'vue';

import {CommandLineAction} from '../../Config';
import { trimBetweenTags } from 'extraterm-trim-between-tags';

const CLASS_DELETE = "CLASS_DELETE";
const CLASS_FRAME = "CLASS_FRAME";
const CLASS_MATCH = "CLASS_MATCH";
const CLASS_MATCH_TYPE = "CLASS_MATCH_TYPE";


export interface Identifiable {
  id?: string;
}

export interface IdentifiableCommandLineAction extends CommandLineAction, Identifiable {
}

let idCounter = 0;
export function nextId(): string {
  idCounter++;
  return "" + idCounter;
}


@Component(
  {
    template: trimBetweenTags(`
<div class="settings-page">
  <h2><i class="far fa-window-maximize"></i>&nbsp;&nbsp;Frame Handling Rules</h2>

  <label for="tips">Default action:</label>
  <select v-model="frameByDefault" class="char-width-20">
    <option value="true">Frame command output</option>
    <option value="false">Do not frame command output</option>
  </select>

  <table class="table">
    <thead v-if="commandLineActions.length !== 0">
      <tr>
        <th>Match</th>
        <th>Command</th>
        <th>Frame</th>
        <th></th>
      </tr>
    </thead>
    <tbody>
      <tr v-if="commandLineActions.length !== 0" v-for="commandLineAction in commandLineActions" track-by="id">
        <td class='${CLASS_MATCH_TYPE}'><select v-model="commandLineAction.matchType" class="form-control">
          <option value="name">Match command name</option>
          <option value="regexp">Match regular expression</option>
          </select></td>
        <td class='${CLASS_MATCH}'><input type="text" class="form-control" v-model="commandLineAction.match" debounce="500" /></td>
        <td class='${CLASS_FRAME}'>
          <label>
            <input type="checkbox" v-model="commandLineAction.frame" /> Frame
          </label>
        </td>
        <td class='${CLASS_DELETE}'>
          <button @click="deleteCommandLineAction(commandLineAction.id);" class="small danger">Delete</button>
        </td>
      </tr>
      
      <tr>
        <td colspan="4">
          <button @click="addCommandLineAction">New Rule</button>
        </td>
      </tr>
    </tbody>
  </table>
</div>
`)
})
export class FrameSettingsUi extends Vue {

  frameByDefault: "true" | "false" = "true";
  commandLineActions: IdentifiableCommandLineAction[] = [];

  constructor() {
    super();
    this.commandLineActions = [];
  }

  addCommandLineAction(): void {
    const emptyAction: IdentifiableCommandLineAction = { match: "", matchType: 'name', frame: true, id: nextId() };
    this.commandLineActions.push(emptyAction);
  }

  deleteCommandLineAction(id: string): void {
    const index = this.commandLineActions.findIndex(cla => cla.id === id);
    if (index !== -1) {
      this.commandLineActions.splice(index, 1);
    }
  }
}

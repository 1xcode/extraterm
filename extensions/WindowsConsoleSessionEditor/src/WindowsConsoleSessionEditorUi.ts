/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import Component from 'vue-class-component';
import Vue from 'vue';

import { trimBetweenTags } from 'extraterm-trim-between-tags';

@Component(
  {
    template: trimBetweenTags(`
<div class="gui-layout cols-1-2">
  <label for="name">Name:</label>
  <input type="text" name="name" v-model="name" spellcheck="false">

  <label>Executable:</label>
  <span>
    <input type="text" list="exes" name="exe" v-bind:class="{'has-error': exeErrorMsg != ''}" v-model="exe" spellcheck="false">
    <span v-if="exeErrorMsg != ''">&nbsp;
      <i class="fas fa-exclamation-triangle"></i> {{ exeErrorMsg }}
    </span>
    <datalist id="exes">
      <option v-for="item in availableExes" :value="item"></option>
    </datalist>
  </span>

  <label for="name">Arguments:</label>
  <input type="text" name="args" v-model="args" spellcheck="false">

  <label for="initialDirectory">Initial Directory:</label>
  <input type="text" name="initialDirectory" v-model="initialDirectory" spellcheck="false">
  <template v-if="initialDirectoryErrorMsg != ''">
    <label></label>
    <span><i class="fas fa-exclamation-triangle"></i> {{ initialDirectoryErrorMsg }}</span>
  </template>
</div>
`)
  }
)
export class WindowsConsoleSessionEditorUi extends Vue {
  name: string = "";
  exe: string = "";
  args: string = "";
  exeErrorMsg = "";
  availableExes: string[] = [];
  initialDirectory = "";
  initialDirectoryErrorMsg = "";
}

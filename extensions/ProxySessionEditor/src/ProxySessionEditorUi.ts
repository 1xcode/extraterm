/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import Component from 'vue-class-component';
import Vue from 'vue';

@Component(
  {
    template: `
<div class="form-horizontal">
  <div class="form-group">
    <label for="name" class="col-sm-4 control-label">Name:</label>
    <div class="input-group col-sm-8">
      <input type="text" class="form-control" name="name" v-model="name">
    </div>
  </div>

  <div class="form-group">
    <label for="cygwinPath" class="col-sm-4 control-label">Cygwin path:</label>
    <div class="input-group col-sm-8">
      <input type="text" class="form-control" name="cygwinPath" v-model="cygwinPath">
    </div>
  </div>

  <div class="form-group">
    <label class="col-sm-4 control-label">Shell:</label>
    <div class="input-group col-sm-8">
      <input class="input-radio" type="radio" value="1" v-model.number="useDefaultShell">
      <div class="inline-text">Default shell</div>
    </div>
  </div>
  <div class="form-group">
    <div class="col-sm-4 control-label"></div>
    <div class="input-group col-sm-8 form-inline">
      <input class="input-radio" type="radio" value="0" v-model.number="useDefaultShell">
      <div class="inline-text">Other</div>
      <input id="other_shell" type="text" class="form-control" :disabled="useDefaultShell===1" v-model="shell">
    </div>
  </div>
</div>`
})
export class ProxySessionEditorUi extends Vue {
  name: string = "";
  shell: string = "";
  useDefaultShell: number = 1;
  cygwinPath = "";
}

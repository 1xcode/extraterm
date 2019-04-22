/*
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import Component from 'vue-class-component';
import Vue from 'vue';
import { ExtensionContext, Logger, Terminal, TerminalBorderWidget, TabTitleWidget, TerminalEnvironment } from 'extraterm-extension-api';
import { trimBetweenTags } from 'extraterm-trim-between-tags';

import { TemplateString } from './TemplateString';
import { TerminalEnvironmentFormatter } from './TerminalEnvironmentFormatter';
import { IconFormatter } from './IconFormatter';

let log: Logger = null;

interface TabTitleData {
  templateString: TemplateString;
  updateTitleFunc: () => void;
}

for (const el of [
  "et-contextmenu",
]) {
  if (Vue.config.ignoredElements.indexOf(el) === -1) {
    Vue.config.ignoredElements.push(el);
  }
}

const terminalToTemplateMap = new Map<Terminal, TabTitleData>();


export function activate(context: ExtensionContext): any {
  log = context.logger;

  const commands = context.commands;
  commands.registerCommand("terminal-title:editTitle", () => {
    const editTabTitleWidget = <EditTabTitleWidget> context.window.activeTerminal.openTerminalBorderWidget("edit-title");
    editTabTitleWidget.focus();
  });

  context.window.registerTabTitleWidget("title", (terminal: Terminal, widget: TabTitleWidget): any => {
    const templateString = new TemplateString();
    templateString.addFormatter("term", new TerminalEnvironmentFormatter("term", terminal.environment));
    templateString.addFormatter("icon", new IconFormatter());
    templateString.setTemplateString("${icon:fab fa-linux} ${" + TerminalEnvironment.TERM_TITLE + "}");
  
    const newDiv = document.createElement("div");
    widget.getContainerElement().appendChild(newDiv);

    const updateTitleFunc = () => {
      newDiv.innerHTML = templateString.formatHtml();
    };

    terminal.environment.onChange(updateTitleFunc);

    updateTitleFunc();

    terminalToTemplateMap.set(terminal, { templateString, updateTitleFunc });
    return null;
  });

  context.window.registerTerminalBorderWidget("edit-title", (terminal: Terminal, widget: TerminalBorderWidget): any => {
    const tabTitleData = terminalToTemplateMap.get(terminal);
    return new EditTabTitleWidget(context, terminal, widget, tabTitleData.templateString,
      tabTitleData.updateTitleFunc);
  });
}


class EditTabTitleWidget {

  private _ui: EditTabTitlePanelUI = null;

  constructor(context: ExtensionContext, private _terminal: Terminal, private _widget: TerminalBorderWidget,
      private _templateString: TemplateString, updateFunc: () => void) {

    this._ui = new EditTabTitlePanelUI();

    const component = this._ui.$mount();
    this._widget.getContainerElement().appendChild(component.$el);
    this._ui.template = this._templateString.getTemplateString();
    this._ui.templateDiagnostic = this._templateString.formatDiagnosticHtml();

    this._ui.$on("templateChange", (template: string) => {
      this._templateString.setTemplateString(template);
      updateFunc();
      this._ui.templateDiagnostic = this._templateString.formatDiagnosticHtml();
    });
    this._ui.$on("close", () => {
      this._close();
    });
  }

  focus(): void {
    this._ui.focus();
  }

  private _close(): void {
    this._widget.close();
  }
}

@Component(
  {
    template: trimBetweenTags(`
      <div class="width-100pc">
        <div class="gui-packed-row width-100pc">
          <label class="compact"><i class="fas fa-pen"></i></label>
          <input ref="template" type="text" class="char-width-40"
            v-model="template"
            v-on:input="onTemplateChange"
            />
          
          <button class="inline" ref="insertField" v-on:click="onInsertField">Insert Field</button>
          <button class="inline" ref="insertIcon" v-on:click="onInsertIcon">Insert Icon</button>
          
          <span class="expand"></span>
          <button v-on:click="$emit('close')" class="compact microtool danger"><i class="fa fa-times"></i></button>
        </div>
        <div class="width-100pc" v-html="templateDiagnostic"></div>

        <et-contextmenu ref="insertFieldMenu">
          <div
            class="insert_field_menu_item"
            v-on:click="onInsertFieldClick('term:title')">Title - \${term:title}</div>
        </et-contextmenu>

        <et-contextmenu ref="insertIconMenu">
          <div class="insert_icon_grid">
            <div v-for="(icon, index) in iconList"
              class="insert_icon_menu_item"
              v-on:click="onInsertIconClick(icon)"><i v-bind:class="{ [icon]: true }"></i></div>
            </div>
        </et-contextmenu>
      </div>`)
  })
class EditTabTitlePanelUI extends Vue {
  template: string;
  templateDiagnostic: string;
  iconList: string[];

  constructor() {
    super();
    this.template = "";
    this.templateDiagnostic = "";
    this.iconList = [
      "fab fa-linux",
      "fab fa-windows",
      "fab fa-apple",
      "fab fa-android",
      "fab fa-ubuntu",
      "fab fa-fedora",
      "fab fa-redhat",
      "fab fa-suse",
      "fab fa-centos",
      "fab fa-freebsd",

      "fas fa-keyboard",
      "fas fa-terminal",
      "fab fa-docker",
      "fas fa-laptop",
      "fas fa-desktop",
      "fas fa-server",
      "fas fa-database",
      "fas fa-microchip",
      "fas fa-mobile-alt",
      "fas fa-tablet-alt",

      "fas fa-bug",
      "fas fa-code",
      "fab fa-git",
      "fas fa-code-branch",
      "fas fa-sitemap",
      "fas fa-cloud",
      "fas fa-upload",
      "fas fa-download",
      "far fa-comments",
      "far fa-envelope",

      "fas fa-home",
      "far fa-building",
      "fas fa-industry",
      "fas fa-city",
      "fas fa-robot",
      "fab fa-raspberry-pi",
      "fas fa-bolt",
      "fas fa-exclamation-triangle",
      "fas fa-shield-alt",
      "fab fa-usb",
    ];
  }

  onTemplateChange(): void {
    this.$emit('templateChange', this.template);
  }

  onInsertField(): void {
    (<any> this.$refs.insertFieldMenu).openAround(this.$refs.insertField);
  }

  onInsertFieldClick(fieldName: string): void {
    this.template = this.template + `\${${fieldName}}`;
    (<any> this.$refs.insertFieldMenu).close();
    this.$emit('templateChange', this.template);
  }

  onInsertIcon(): void {
    (<any> this.$refs.insertIconMenu).openAround(this.$refs.insertIcon);
  }

  onInsertIconClick(icon: string): void {
    this.template = this.template + `\${icon:${icon}}`;
    (<any> this.$refs.insertIconMenu).close();
    this.$emit('templateChange', this.template);
  }

  focus(): void {
    if (this.$refs.template != null) {
      (<HTMLInputElement> this.$refs.template).focus();
    }
  }
}

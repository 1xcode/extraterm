/*
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as path from 'path';
import { ExtensionContributes, ExtensionMetadata, ExtensionViewerContribution, ExtensionCss, ExtensionSessionEditorContribution, ExtensionSessionBackendContribution, ExtensionPlatform, ExtensionSyntaxThemeProviderContribution, ExtensionSyntaxThemeContribution, ExtensionTerminalThemeProviderContribution, ExtensionTerminalThemeContribution, ExtensionKeybindingsContribution, ExtensionCommandContribution, Category, WhenVariables, ExtensionTerminalBorderContribution, BorderDirection } from "../../ExtensionMetadata";
import { getLogger, Logger } from "extraterm-logging";
import { BooleanExpressionEvaluator } from "extraterm-boolean-expression-evaluator";

// const jsonParse = require("json-to-ast");
import { JsonNode, JsonObject } from "json-to-ast";
import jsonParse = require("json-to-ast");

const FONT_AWESOME_DEFAULT = false;


export function parsePackageJsonString(packageJsonString: string, extensionPath: string): ExtensionMetadata {
  return (new PackageParser(extensionPath)).parse(packageJsonString);
}

class JsonError {
  constructor(public readonly msg: string, public readonly node: JsonNode) {
  }
}

function throwJsonError(msg: string, node: JsonNode): never {
  throw new JsonError(msg, node);
}

function assertIsJsonObject(json: JsonNode): JsonObject {
  if (json.type === "Object") {
    return json;
  }
  return throwJsonError("Expected an object.", json);
}

function getJsonProperty(json: JsonObject, name: string): JsonNode {
  for (const prop of json.children) {
    if (name === prop.key.value) {
      return prop.value;
    }
  }
  return undefined;
}

const categoryList: Category[] = [
  "global",
  "application",
  "window",
  "textEditing",
  "terminal",
  "terminalCursorMode",
  "viewer"
];

class PackageParser {
  private _log: Logger;
  private _bee: BooleanExpressionEvaluator;

  constructor(private _extensionPath: string) {
    this._log = getLogger("PackageParser", this);

    const variables: WhenVariables = {
      true: true,
      false: false,
      terminalFocus: false,
      isCursorMode: false,
      isNormalMode: false,
      textEditorFocus: false,
      isTextEditing: false,
      viewerFocus: false,
    };
    this._bee = new BooleanExpressionEvaluator(variables);
  }

  parse(packageJsonString: string): ExtensionMetadata {
    try {
      const packageJson = jsonParse(packageJsonString, {loc: true});

      const result: ExtensionMetadata = {
        name: this.getJsonStringField(packageJson, "name"),
        path: this._extensionPath,
        main: this.getJsonStringField(packageJson, "main", null),
        version: this.getJsonStringField(packageJson, "version"),
        includePlatform: this.parsePlatformsJson(packageJson, "includePlatform"),
        excludePlatform: this.parsePlatformsJson(packageJson, "excludePlatform"),
        description: this.getJsonStringField(packageJson, "description"),
        contributes: this.parseContributesJson(packageJson)
      };
      return result;
    } catch(ex) {
      if (ex instanceof JsonError) {
        const loc = ex.node.loc;
        throw `${ex.msg}\n${path.join(this._extensionPath, "package.json")} line: ${loc.start.line} column: ${loc.start.column}`;
      } else {
        throw ex;
      }
    }
  }

  private getJsonStringField(packageJson: JsonNode, fieldName: string, defaultValue: string=undefined): string {
    const jsonObject = assertIsJsonObject(packageJson);
    const value = getJsonProperty(jsonObject, fieldName);
    if (value == null) {
      if (defaultValue !== undefined) {
        return defaultValue;
      }
      return throwJsonError(`Field '${fieldName}' is missing.`, jsonObject);
    }

    if (value.type === "Literal") {
      if(typeof value.value === "string") {
        return value.value;
      }
    }
    return throwJsonError(`Field '${fieldName}' is not a string.`, value);
  }

  private getJsonNumberField(packageJson: JsonNode, fieldName: string, defaultValue: number=1000000): number {
    const jsonObject = assertIsJsonObject(packageJson);
    const value = getJsonProperty(jsonObject, fieldName);
    if (value == null) {
      if (defaultValue !== undefined) {
        return defaultValue;
      }
      return throwJsonError(`Field '${fieldName}' is missing.`, jsonObject);
    }

    if (value.type === "Literal") {
      if (typeof value.value === "number") {
        return value.value;
      }
    }    
    return throwJsonError(`Field '${fieldName}' is not a number.`, value);
  }

  private getJsonCategoryField(packageJson: JsonNode, fieldName: string): Category {
    const value = this.getJsonStringField(packageJson, fieldName, null);
    if (value == null) {
      return "window";
    }

    if ((<string[]>categoryList).indexOf(value) === -1) {
      return throwJsonError(`Field '${fieldName}' is not one of ${categoryList.join(", ")}.`,
        getJsonProperty(<JsonObject>packageJson, fieldName));
    }
    return <Category> value;
  }

  private getJsonBooleanField(packageJson: JsonNode, fieldName: string, defaultValue: boolean): boolean {
    const jsonObject = assertIsJsonObject(packageJson);
    const value = getJsonProperty(jsonObject, fieldName);
    if (value == null) {
      if (defaultValue !== undefined) {
        return defaultValue;
      }
      return throwJsonError(`Field '${fieldName}' is missing.`, jsonObject);
    }

    if (value.type === "Literal") {
      if (typeof value.value === "boolean") {
        return value.value;
      }
    }    
    return throwJsonError(`Field '${fieldName}' is not a boolean.`, value);
  }

  private getJsonStringArrayField(packageJson: JsonNode, fieldName: string, defaultValue: string[]=undefined): string[] {
    const jsonObject = assertIsJsonObject(packageJson);
    const value = getJsonProperty(jsonObject, fieldName);
    if (value == null) {
      if (defaultValue !== undefined) {
        return defaultValue;
      }
      return throwJsonError(`Field '${fieldName}' is missing.`, packageJson);
    }

    if (value.type === "Array") {
      const result: string[] = [];
      for (let i=0; i < value.children.length; i++) {
        const kid = value.children[i];
        if (kid.type !== "Literal" || typeof kid.value !== "string") {
          return throwJsonError(`Item of field '${fieldName}' is not a string.`, kid);
        }
        result.push(kid.value);
      }
      return result;
    }

    return throwJsonError(`Field '${fieldName}' is not an array.`, value);
  }

  private parsePlatformsJson(packageJson: JsonNode, fieldName: string): ExtensionPlatform[] {
    const jsonObject = assertIsJsonObject(packageJson);
    const value = getJsonProperty(jsonObject, fieldName);
    if (value == null) {
      return [];
    }

    if (value.type === "Array") {
      const result = [];
      for (let i=0; i < value.children.length; i++) {
        result.push(this.parsePlatformJson(value.children[i]));
      }
      return result;
    }    

    return throwJsonError(`Field '${fieldName}' is not an array.`, value);
  }

  private parsePlatformJson(packageJson: JsonNode): ExtensionPlatform {
    return {
      os: this.getJsonStringField(packageJson, "os", null),
      arch: this.getJsonStringField(packageJson, "arch", null)
    };
  }

  private parseContributesJson(packageJson: JsonNode): ExtensionContributes {
    const jsonObject = assertIsJsonObject(packageJson);
    const contributes = getJsonProperty(jsonObject, "contributes");
    if (contributes == null) {
      return {
        commands: [],
        keybindings: [],
        sessionBackends: [],
        sessionEditors: [],
        syntaxThemes: [],
        syntaxThemeProviders: [],
        terminalBorderWidget: [],
        terminalThemes: [],
        terminalThemeProviders: [],
        viewers: [],
      };
    }

    if (contributes.type !== "Object") {
      return throwJsonError(`'contributes' field is not an object.`, contributes);
    }

    const knownContributions: (keyof ExtensionContributes)[] = [
      "commands",
      "keybindings",
      "viewers",
      "sessionEditors",
      "sessionBackends",
      "syntaxThemes",
      "syntaxThemeProviders",
      "terminalBorderWidget",
      "terminalThemes",
      "terminalThemeProviders"
    ];
    for (const key of contributes.children) {
      if (knownContributions.indexOf(<any> key.key.value) === -1) {
        return throwJsonError(`'contributes' contains an unknown property '${key}'`, contributes);
      }
    }

    return {
      commands: this.parseCommandContributionsListJson(contributes),
      keybindings: this.parseKeybindingsContributionsListJson(contributes),
      sessionBackends: this.parseSessionBackendContributionsListJson(contributes),
      sessionEditors: this.parseSessionEditorContributionsListJson(contributes),
      syntaxThemes: this.parseSyntaxThemeContributionsListJson(contributes),
      syntaxThemeProviders: this.parseSyntaxThemeProviderContributionsListJson(contributes),
      terminalBorderWidget: this.parseTerminalBorderWidgetContributionsListJson(contributes),
      terminalThemes: this.parseTerminalThemeContributionsListJson(contributes),
      terminalThemeProviders: this.parseTerminalThemeProviderContributionsListJson(contributes),
      viewers: this.parseViewerContributionsListJson(contributes),
    };
  }

  private parseViewerContributionsListJson(packageJson: JsonNode): ExtensionViewerContribution[] {
    const jsonObject = assertIsJsonObject(packageJson);
    const value = getJsonProperty(jsonObject, "viewers");
    if (value == null) {
      return [];
    }

    if (value.type === "Array") {
      const result: ExtensionViewerContribution[] = [];
      for (const item of value.children) {
        result.push(this.parseViewerConstributionJson(item));
      }
      return result;
    }
    return throwJsonError(`Field 'viewers' is not an array.`, value);
  }

  private parseViewerConstributionJson(packageJson: JsonNode): ExtensionViewerContribution {
    return {
      name: this.getJsonStringField(packageJson, "name"),
      mimeTypes: this.getJsonStringArrayField(packageJson, "mimeTypes"),
      css: this.parseCss(packageJson)
    };
  }

  private  parseCss(packageJson: JsonNode): ExtensionCss {
    const jsonObject = assertIsJsonObject(packageJson);
    const value = getJsonProperty(jsonObject, "css");
    if (value == null) {
      return {
        directory: null,
        cssFile: [],
        fontAwesome: FONT_AWESOME_DEFAULT
      };
    }

    return {
      directory: this.getJsonStringField(value, "directory", "."),
      cssFile: this.getJsonStringArrayField(value, "cssFile", []),
      fontAwesome: this.getJsonBooleanField(value, "fontAwesome", FONT_AWESOME_DEFAULT)
    };
  }

  private parseCommandContributionsListJson(packageJson: JsonNode): ExtensionCommandContribution[] {
    const jsonObject = assertIsJsonObject(packageJson);
    const value = getJsonProperty(jsonObject, "commands");
    if (value == null) {
      return [];
    }

    if (value.type === "Array") {
      const result: ExtensionCommandContribution[] = [];
      for (const item of value.children) {
        result.push(this.parseCommandConstributionJson(item));
      }
      return result;
    }

    return throwJsonError(`Field 'commands' in the 'contributes' object is not an array.`, value);
  }

  private parseCommandConstributionJson(packageJson: JsonNode): ExtensionCommandContribution {
    return {
      command: this.getJsonStringField(packageJson, "command"),
      title: this.getJsonStringField(packageJson, "title"),
      when: this.getJsonWhenField(packageJson, "when", ""),
      category: this.getJsonCategoryField(packageJson, "category"),
      order: this.getJsonNumberField(packageJson, "order", 100000),
      commandPalette: this.getJsonBooleanField(packageJson, "commandPalette", true),
      contextMenu: this.getJsonBooleanField(packageJson, "contextMenu", false),
      emptyPaneMenu: this.getJsonBooleanField(packageJson, "emptyPaneMenu", false),
      newTerminalMenu: this.getJsonBooleanField(packageJson, "newTerminalMenu", false),
      icon: this.getJsonStringField(packageJson, "icon", ""),
    };
  }

  private getJsonWhenField(packageJson: JsonNode, fieldName: string, defaultValue: string=undefined): string {
    const value = this.getJsonStringField(packageJson, fieldName, defaultValue);

    if (value.trim() === "") {
      return "true";
    }

    try {
      this._bee.evaluate(value);
    } catch(ex) {
      this._log.warn(`When clause '${value}' in package '${this._extensionPath}' has an error:\n` + ex);
      return "false";
    }
    return value;
  }

  private parseSessionEditorContributionsListJson(packageJson: JsonNode): ExtensionSessionEditorContribution[] {
    const jsonObject = assertIsJsonObject(packageJson);
    const value = getJsonProperty(jsonObject, "sessionEditors");
    if (value == null) {
      return [];
    }

    if (value.type === "Array") {
      const result: ExtensionSessionEditorContribution[] = [];
      for (const item of value.children) {
        result.push(this.parseSessionEditorConstributionJson(item));
      }
      return result;
    }
    return throwJsonError(`Field 'sessionEditors' in the 'contributes' object is not an array.`, value);
  }

  private parseSessionEditorConstributionJson(packageJson: JsonNode): ExtensionSessionEditorContribution {
    return {
      name: this.getJsonStringField(packageJson, "name"),
      type: this.getJsonStringField(packageJson, "type"),
      css: this.parseCss(packageJson)
    };
  }

  private parseSessionBackendContributionsListJson(packageJson: JsonNode): ExtensionSessionBackendContribution[] {
    const jsonObject = assertIsJsonObject(packageJson);
    const value = getJsonProperty(jsonObject, "sessionBackends");
    if (value == null) {
      return [];
    }

    if (value.type === "Array") {
      const result: ExtensionSessionBackendContribution[] = [];
      for (const item of value.children) {
        result.push(this.parseSessionBackendConstributionJson(item));
      }
      return result;
    }

    return throwJsonError(`Field 'sessionBackends' in the 'contributes' object is not an array.`, value);
  }

  private parseSessionBackendConstributionJson(packageJson: JsonNode): ExtensionSessionBackendContribution {
    return {
      name: this.getJsonStringField(packageJson, "name"),
      type: this.getJsonStringField(packageJson, "type")
    };
  }

  private parseSyntaxThemeContributionsListJson(packageJson: JsonNode): ExtensionSyntaxThemeContribution[] {
    const jsonObject = assertIsJsonObject(packageJson);
    const value = getJsonProperty(jsonObject, "syntaxThemes");
    if (value == null) {
      return [];
    }
    if (value.type === "Array") {
      const result: ExtensionSyntaxThemeContribution[] = [];
      for (const item of value.children) {
        result.push(this.parseSyntaxThemeContributionsJson(item));
      }
      return result;
    }

    return throwJsonError(`Field 'syntaxThemes' in the 'contributes' object is not an array.`, value);
  }

  private parseSyntaxThemeContributionsJson(packageJson: JsonNode): ExtensionSyntaxThemeContribution {
    return {
      path: this.getJsonStringField(packageJson, "path")
    };
  }

  private parseSyntaxThemeProviderContributionsListJson(packageJson: JsonNode): ExtensionSyntaxThemeProviderContribution[] {
    const jsonObject = assertIsJsonObject(packageJson);
    const value = getJsonProperty(jsonObject, "syntaxThemeProviders");
    if (value == null) {
      return [];
    }

    if (value.type === "Array") {
      const result: ExtensionSyntaxThemeProviderContribution[] = [];
      for (const item of value.children) {
        result.push(this.parseSyntaxThemeProviderContributionsJson(item));
      }
      return result;
    }
    return throwJsonError(`Field 'syntaxThemeProviders' in the 'contributes' object is not an array.`, value);
  }

  private parseSyntaxThemeProviderContributionsJson(packageJson: JsonNode): ExtensionSyntaxThemeProviderContribution {
    return {
      name: this.getJsonStringField(packageJson, "name"),
      humanFormatNames: this.getJsonStringArrayField(packageJson, "humanFormatNames", [])
    };
  }

  private parseTerminalBorderWidgetContributionsListJson(packageJson: JsonNode): ExtensionTerminalBorderContribution[] {
    const jsonObject = assertIsJsonObject(packageJson);
    const value = getJsonProperty(jsonObject, "terminalBorderWidget");
    if (value == null) {
      return [];
    }

    if (value.type === "Array") {
      const result: ExtensionTerminalBorderContribution[] = [];
      for (const item of value.children) {
        result.push(this.parseTerminalBorderWidgetContributionsJson(item));
      }
      return result;
    }

    return throwJsonError(`Field 'terminalBorderWidget' in the 'contributes' object is not an array.`, value);
  }

  private parseTerminalBorderWidgetContributionsJson(packageJson: JsonNode): ExtensionTerminalBorderContribution {
    return {
      name: this.getJsonStringField(packageJson, "name"),
      border: this.getJsonBorderDirectionField(packageJson, "border"),
      css: this.parseCss(packageJson)
    };
  }

  private getJsonBorderDirectionField(packageJson: JsonNode, fieldName: string): BorderDirection {
    const jsonObject = assertIsJsonObject(packageJson);
    const value = getJsonProperty(jsonObject, fieldName);
    if (value == null) {
      return "south";
    }

    if (value.type === "Literal" && typeof value.value === "string") {
      const borderDirections: BorderDirection[] = ["north", "south", "east", "west"];
      if (borderDirections.indexOf(<BorderDirection> value.value) === -1) {
        return throwJsonError(`Field '${fieldName}' is not one of ${borderDirections.join(", ")}.`, value);
      }
      return <BorderDirection> value.value;
    }

    return throwJsonError(`Field '${fieldName}' is not a string.`, value);
  }

  private parseTerminalThemeContributionsListJson(packageJson: JsonNode): ExtensionTerminalThemeContribution[] {
    const jsonObject = assertIsJsonObject(packageJson);
    const value = getJsonProperty(jsonObject, "terminalThemes");
    if (value == null) {
      return [];
    }

    if (value.type === "Array") {
      const result: ExtensionTerminalThemeContribution[] = [];
      for (const item of value.children) {
        result.push(this.parseTerminalThemeContributionsJson(item));
      }
      return result;
    }

    return throwJsonError(`Field 'terminalTheme' in the 'contributes' object is not an array.`, value);
  }

  private parseTerminalThemeContributionsJson(packageJson: JsonNode): ExtensionTerminalThemeContribution {
    return {
      path: this.getJsonStringField(packageJson, "path")
    };
  }

  private parseTerminalThemeProviderContributionsListJson(packageJson: JsonNode): ExtensionTerminalThemeProviderContribution[] {
    const jsonObject = assertIsJsonObject(packageJson);
    const value = getJsonProperty(jsonObject, "terminalThemeProviders");
    if (value == null) {
      return [];
    }

    if (value.type === "Array") {
      const result: ExtensionTerminalThemeProviderContribution[] = [];
      for (const item of value.children) {
        result.push(this.parseTerminalThemeProviderContributionsJson(item));
      }
      return result;
    }
    return throwJsonError(`Field 'terminalThemeProviders' in the 'contributes' object is not an array.`, value);
  }

  private parseTerminalThemeProviderContributionsJson(packageJson: JsonNode): ExtensionTerminalThemeProviderContribution {
    return {
      name: this.getJsonStringField(packageJson, "name"),
      humanFormatNames: this.getJsonStringArrayField(packageJson, "humanFormatNames", [])
    };
  }

  private parseKeybindingsContributionsListJson(packageJson: JsonNode): ExtensionKeybindingsContribution[] {
    const jsonObject = assertIsJsonObject(packageJson);
    const value = getJsonProperty(jsonObject, "keybindings");
    if (value == null) {
      return [];
    }

    if (value.type === "Array") {
      const result: ExtensionKeybindingsContribution[] = [];
      for (const item of value.children) {
        result.push(this.parseKeybindingsContributionsJson(item));
      }
      return result;
    }

    return throwJsonError(`Field 'keybindings' in the 'contributes' object is not an array.`, value);
  }

  private parseKeybindingsContributionsJson(packageJson: JsonNode): ExtensionKeybindingsContribution {
    return {
      path: this.getJsonStringField(packageJson, "path")
    };
  }
}

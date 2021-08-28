import { Direction, QMainWindow, QWidget } from "@nodegui/nodegui";
import { BoxLayout, CheckBox, ComboBox, Label, LineEdit, PushButton, RadioButton, ScrollArea, SpinBox, TabWidget,
  Widget } from "qt-construct";
import * as fs from "fs";
import * as path from "path";
import * as SourceDir from './SourceDir';

import { createUiStyle } from "./ui/styles/DarkTwo";

let centralWidget: QWidget = null;

function main(): void {
  const win = new QMainWindow();
  win.setWindowTitle("Theme Test");

  centralWidget = ScrollArea({
    widgetResizable: true,
    widget: Widget({
      cssClass: "background",
      layout: BoxLayout({
        direction: Direction.TopToBottom,
        children: [
          Label({text: "H1 Heading", cssClass: "h1"}),
          Label({text: "H2 Heading", cssClass: "h2"}),
          Label({text: "H3 Heading", cssClass: "h3"}),
          Label({text: "H4 Heading", cssClass: "h4"}),
          Label({text: "H5 Heading", cssClass: "h5"}),
          Label({text: "H6 Heading", cssClass: "h6"}),
          Label({text: "Plain QLabel text"}),

          PushButton({text: "Default button"}),
          PushButton({text: "Success button", cssClass: "success"}),
          PushButton({text: "Info button", cssClass: "info"}),
          PushButton({text: "Warning button", cssClass: "warning"}),
          PushButton({text: "Danger button", cssClass: "danger"}),

          PushButton({text: "Disabled default button", enabled: false}),
          PushButton({text: "Disabled success button", enabled: false, cssClass: "success"}),
          PushButton({text: "Disabled info button", enabled: false, cssClass: "info"}),
          PushButton({text: "Disabled warning button", enabled: false, cssClass: "warning"}),
          PushButton({text: "Disabled danger button", enabled: false, cssClass: "danger"}),

          PushButton({text: "Small Default button", cssClass: "small"}),
          PushButton({text: "Small Success button", cssClass: ["small", "success"]}),
          PushButton({text: "Small Info button", cssClass: ["small", "info"]}),
          PushButton({text: "Small Warning button", cssClass: ["small", "warning"]}),
          PushButton({text: "Small Danger button", cssClass: ["small", "danger"]}),

          LineEdit({text: "Some text input"}),


          ComboBox({items: ["One", "Two"]}),

          CheckBox({text: "Checkbox"}),
          CheckBox({text: "Select Checkbox", checkState: true}),

          RadioButton({text: "Radio button"}),
          RadioButton({text: "Selected Radio button", checked: true}),

          SpinBox({suffix: " frames", minimum: 0, maximum: 1000}),

          Widget({layout:
            BoxLayout({
              direction:Direction.LeftToRight,
              spacing: 0,
              children: [
                { widget: PushButton({ text: "Left", cssClass: ["group-left"] }), stretch: 0 },
                { widget: PushButton({ text: "Right", cssClass: ["group-right"] }), stretch: 0 },
                { widget: Widget({}), stretch: 1 }
              ]
            })}
          ),

          Widget({layout:
            BoxLayout({
              direction:Direction.LeftToRight,
              spacing: 0,
              children: [
                { widget: PushButton({ text: "Left", cssClass: ["group-left"] }), stretch: 0 },
                { widget: PushButton({ text: "Middle", cssClass: ["group-middle"] }), stretch: 0 },
                { widget: PushButton({ text: "Right", cssClass: ["group-right"] }), stretch: 0 },
                { widget: Widget({}), stretch: 1 }
              ]
            })}
          ),

          Widget({layout:
            BoxLayout({
              direction:Direction.LeftToRight,
              spacing: 0,
              children: [
                { widget: Label({ text: "I like", cssClass: ["group-left"] }), stretch: 0 },
                { widget: LineEdit({ text: "bananas", cssClass: ["group-right"] }), stretch: 0 },
                { widget: Widget({}), stretch: 1 }
              ]
            })}
          ),

          Widget({layout:
            BoxLayout({
              direction:Direction.LeftToRight,
              spacing: 0,
              children: [
                { widget: Label({ text: "I like", cssClass: ["group-left"] }), stretch: 0 },
                { widget: LineEdit({ text: "bananas", cssClass: ["group-middle"] }), stretch: 0 },
                { widget: Label({ text: "for breakfast.", cssClass: ["group-right"] }), stretch: 0 },
                { widget: Widget({}), stretch: 1 }
              ]
            })}
          ),

          Widget({layout:
            BoxLayout({
              direction:Direction.LeftToRight,
              spacing: 0,
              children: [
                { widget: Label({ text: "$", cssClass: ["group-left"] }), stretch: 0 },
                { widget: SpinBox({minimum: 0, maximum: 1000, cssClass: ["group-right"] }), stretch: 0 },
                { widget: Widget({}), stretch: 1 }
              ]
            })}
          ),

          Widget({layout:
            BoxLayout({
              direction:Direction.LeftToRight,
              spacing: 0,
              children: [
                { widget: Label({ text: "$", cssClass: ["group-left"] }), stretch: 0 },
                { widget: SpinBox({minimum: 0, maximum: 1000, cssClass: ["group-middle"] }), stretch: 0 },
                { widget: Label({ text: ".00", cssClass: ["group-right"] }), stretch: 0 },
                { widget: Widget({}), stretch: 1 }
              ]
            })}
          ),

          Widget({layout:
            BoxLayout({
              direction:Direction.LeftToRight,
              spacing: 0,
              children: [
                { widget: SpinBox({minimum: 0, maximum: 1000, cssClass: ["group-left"] }), stretch: 0 },
                { widget: Label({ text: "euro", cssClass: ["group-right"] }), stretch: 0 },
                { widget: Widget({}), stretch: 1 }
              ]
            })}
          ),

          SpinBox({suffix: " frames", minimum: 0, maximum: 1000}),

          TabWidget({
            tabs: [
              {label: "Extraterm", page: Widget({})},
              {label: "Tabs", page: Widget({})},
            ]
          }),
          { widget: Widget({}), stretch: 1}
        ]
      })
    })
  });

  const styleSheet = createUiStyle(path.posix.join(SourceDir.posixPath, "../resources/theme_ui/DarkTwo/"))
                      .getApplicationStyleSheet();
  console.log(styleSheet);

  win.resize(600, 800);
  centralWidget.setStyleSheet(styleSheet);

  win.setCentralWidget(centralWidget);
  win.show();

  (global as any).win = win;
}

main();

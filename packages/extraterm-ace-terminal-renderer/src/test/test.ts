import { TerminalCanvasEditSession } from "../TerminalCanvasEditSession";
import { EditSession } from "ace-ts/build/EditSession";
import { Editor } from "ace-ts/build/Editor";
import { UndoManager } from "ace-ts/build/UndoManager";
import { Renderer } from "ace-ts/build/Renderer";
import * as dom from "ace-ts/build/lib/dom";
import * as event from "ace-ts/build/lib/event";
import { TerminalCanvasAceEditor } from "../TerminalCanvasAceEditor";
import * as TermApi from "term-api";
import { TerminalDocument } from "../TerminalDocument";
import { CharCellGrid, STYLE_MASK_BOLD, STYLE_MASK_UNDERLINE, STYLE_MASK_BLINK, STYLE_MASK_INVERSE, STYLE_MASK_INVISIBLE, STYLE_MASK_ITALIC, STYLE_MASK_STRIKETHROUGH, STYLE_MASK_FAINT } from "extraterm-char-cell-grid";

function createEditSession(text, mode?): EditSession {
  const doc = new EditSession(text, mode);
  doc.setUndoManager(new UndoManager());
  return doc;
};

function terminalEditor(elementOrString: HTMLElement | string): TerminalCanvasAceEditor {
  let el: Element = null;
  let value = "";
  let oldNode: HTMLInputElement | HTMLTextAreaElement = null;
  if (typeof elementOrString == "string") {
    const _id = elementOrString;
    el = document.getElementById(_id);
    if (!el) {
      throw new Error("ace.edit can't find div #" + _id);
    }
  } else {
    if (elementOrString && /input|textarea/i.test(elementOrString.tagName)) {
      oldNode = elementOrString as HTMLInputElement | HTMLTextAreaElement;
      value = oldNode.value;
      el = dom.createElement("pre") as HTMLPreElement;
      oldNode.parentNode.replaceChild(el, oldNode);
    }
  }
  if (el) {
    value = el.textContent;
    el.innerHTML = "";
  }

  const editSession = new TerminalCanvasEditSession(new TerminalDocument(value));
  editSession.setUndoManager(new UndoManager());

  const editor = new TerminalCanvasAceEditor(new Renderer(el as HTMLElement), editSession);
  editor.addCommand({
      name: "pasteSomething",
      bindKey: {win: "Ctrl-V", mac: "Command-V"},
      exec: function (editor: Editor) {
        editor.insert("abc\ndef\nghi");
      }
  });

  const env = {
      document: editSession,
      editor: editor,
      onResize: editor.resize.bind(editor, null),
      textarea: null
  };
  if (oldNode) {
    env.textarea = oldNode;
  }
  event.addListener(window, "resize", env.onResize);
  editor.on("destroy", function() {
    event.removeListener(window, "resize", env.onResize);
  });
  return editor;
}

// FIXME de-duplicate this class
class LineImpl extends CharCellGrid implements TermApi.Line {
  wrapped = false;

  constructor(width: number, height: number, _palette: number[]=null, __bare__=false) {
    super(width, height, _palette, __bare__);
  }

  clone(): TermApi.Line {
    const grid = new LineImpl(this.width, this.height, this.palette);
    this.cloneInto(grid);
    return grid;
  }
}

function getLine(): TermApi.Line {
  const input = <HTMLInputElement> document.getElementById("input_line");
  const text = input.value;

  const line = new LineImpl(text.length, 0);

  let cellStyle = 0;
  if ((<HTMLInputElement> document.getElementById("bold")).checked) {
    cellStyle = cellStyle | STYLE_MASK_BOLD;
  }
  if ((<HTMLInputElement> document.getElementById("italic")).checked) {
    cellStyle = cellStyle | STYLE_MASK_ITALIC;
  }
  if ((<HTMLInputElement> document.getElementById("underline")).checked) {
    cellStyle = cellStyle | STYLE_MASK_UNDERLINE;
  }

  for (let i=0; i<text.length; i++) {
    line.setCodePoint(i, 0, text.codePointAt(i));
    line.setFgClutIndex(i, 0, 256);
    line.setBgClutIndex(i, 0, 256);
  }

  return line;
}

function start(): void {
  console.log("Starting test");
  const editor = terminalEditor("editor");
  editor.setThemeCss("ace-terminal-theme", "terminal.css");

  document.getElementById("append_text").addEventListener('click', () => {
    const line = getLine();
    editor.appendTerminalLine(line);
  });

  document.getElementById("replace_text").addEventListener('click', () => {
    const line = getLine();
    editor.setTerminalLines(0, [line]);
  });
}
start();

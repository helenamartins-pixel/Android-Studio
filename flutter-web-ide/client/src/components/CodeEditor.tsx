import { useEffect, useRef, useState } from "react";
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { javascript } from "@codemirror/lang-javascript";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { json } from "@codemirror/lang-json";
import { xml } from "@codemirror/lang-xml";
import { yaml } from "@codemirror/lang-yaml";
import { java } from "@codemirror/lang-java";
import { markdown } from "@codemirror/lang-markdown";
import { oneDark } from "@codemirror/theme-one-dark";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { bracketMatching, foldGutter, indentOnInput, syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import { autocompletion, closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { Save, Loader2 } from "lucide-react";

interface CodeEditorProps {
  content: string;
  filePath: string;
  onSave: (content: string) => void;
  saving?: boolean;
}

function getLanguageExtension(filePath: string) {
  const ext = filePath.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "dart":
    case "java":
    case "kt":
    case "gradle":
      return java();
    case "js":
    case "jsx":
    case "ts":
    case "tsx":
      return javascript({ jsx: true, typescript: ext === "ts" || ext === "tsx" });
    case "html":
    case "htm":
      return html();
    case "css":
    case "scss":
      return css();
    case "json":
      return json();
    case "xml":
    case "plist":
    case "svg":
      return xml();
    case "yaml":
    case "yml":
      return yaml();
    case "md":
    case "markdown":
      return markdown();
    default:
      return javascript();
  }
}

export function CodeEditor({ content, filePath, onSave, saving }: CodeEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [modified, setModified] = useState(false);

  useEffect(() => {
    if (!editorRef.current) return;

    // Destroy previous editor
    if (viewRef.current) {
      viewRef.current.destroy();
    }

    const langExt = getLanguageExtension(filePath);

    const state = EditorState.create({
      doc: content,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightActiveLine(),
        drawSelection(),
        history(),
        foldGutter(),
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        autocompletion(),
        highlightSelectionMatches(),
        langExt,
        oneDark,
        keymap.of([
          ...defaultKeymap,
          ...historyKeymap,
          ...searchKeymap,
          ...closeBracketsKeymap,
          indentWithTab,
          {
            key: "Mod-s",
            run: (view) => {
              onSave(view.state.doc.toString());
              setModified(false);
              return true;
            },
          },
        ]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            setModified(true);
          }
        }),
        EditorView.theme({
          "&": {
            height: "100%",
            fontSize: "13px",
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          },
          ".cm-scroller": {
            overflow: "auto",
          },
          ".cm-content": {
            padding: "8px 0",
          },
          ".cm-gutters": {
            borderRight: "1px solid oklch(0.25 0.015 260)",
            backgroundColor: "oklch(0.14 0.012 260)",
          },
        }),
      ],
    });

    const view = new EditorView({
      state,
      parent: editorRef.current,
    });

    viewRef.current = view;
    setModified(false);

    return () => {
      view.destroy();
    };
  }, [content, filePath]);

  const handleSave = () => {
    if (viewRef.current) {
      onSave(viewRef.current.state.doc.toString());
      setModified(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Editor toolbar */}
      <div className="h-9 bg-card border-b border-border flex items-center px-3 shrink-0">
        <span className="text-xs text-muted-foreground font-mono truncate flex-1">
          {filePath}
          {modified && <span className="text-primary ml-1">*</span>}
        </span>
        <button
          onClick={handleSave}
          disabled={!modified || saving}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
            modified
              ? "bg-primary/15 text-primary hover:bg-primary/25"
              : "text-muted-foreground/50"
          }`}
        >
          {saving ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Save className="w-3 h-3" />
          )}
          Save
        </button>
      </div>
      {/* Editor area */}
      <div ref={editorRef} className="flex-1 overflow-hidden" />
    </div>
  );
}

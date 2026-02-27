<!-- src/lib/components/Editor.svelte -->
<script lang="ts">
  import { untrack } from 'svelte';
  import { EditorView, basicSetup } from 'codemirror';
  import { EditorState } from '@codemirror/state';
  import { linter, lintGutter, setDiagnostics, type Diagnostic } from '@codemirror/lint';
  import { dbmlLanguage } from '$lib/dbml/lang-dbml';
  import { syntaxHighlighting, HighlightStyle } from '@codemirror/language';
  import { tags } from '@lezer/highlight';

  interface Props {
    value?: string;
    diagnostics?: Diagnostic[];
    onchange?: (value: string) => void;
  }

  let { value = $bindable(''), diagnostics = [], onchange }: Props = $props();

  let container: HTMLDivElement;
  let view: EditorView | undefined;
  let internalUpdate = false;

  const highlightStyle = syntaxHighlighting(
    HighlightStyle.define([
      { tag: tags.keyword, color: '#c792ea', fontWeight: 'bold' },
      { tag: tags.comment, color: '#637777', fontStyle: 'italic' },
      { tag: tags.blockComment, color: '#637777', fontStyle: 'italic' },
      { tag: tags.string, color: '#c3e88d' },
      { tag: tags.number, color: '#f78c6c' },
      { tag: tags.variableName, color: '#82aaff' },
      { tag: tags.typeName, color: '#ffcb6b' },
      { tag: tags.atom, color: '#f07178' },
      { tag: tags.operator, color: '#89ddff' },
      { tag: tags.bracket, color: '#d4d4d4' },
    ])
  );

  const darkTheme = EditorView.theme({
    '&': {
      backgroundColor: '#1e1e2e',
      color: '#cdd6f4',
      height: '100%',
    },
    '.cm-content': {
      caretColor: '#f5e0dc',
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
      fontSize: '14px',
    },
    '.cm-gutters': {
      backgroundColor: '#181825',
      color: '#6c7086',
      borderRight: '1px solid #313244',
    },
    '.cm-activeLineGutter': {
      backgroundColor: '#313244',
    },
    '.cm-activeLine': {
      backgroundColor: '#313244',
    },
    '&.cm-focused .cm-cursor': {
      borderLeftColor: '#f5e0dc',
    },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
      backgroundColor: '#45475a',
    },
    '.cm-scroller': {
      overflow: 'auto',
    },
  });

  $effect(() => {
    if (!container) return;
    const initialValue = untrack(() => value);
    view = new EditorView({
      state: EditorState.create({
        doc: initialValue,
        extensions: [
          basicSetup,
          dbmlLanguage,
          highlightStyle,
          darkTheme,
          lintGutter(),
          linter(() => []),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              internalUpdate = true;
              const newValue = update.state.doc.toString();
              value = newValue;
              onchange?.(newValue);
              internalUpdate = false;
            }
          }),
        ],
      }),
      parent: container,
    });

    return () => {
      view?.destroy();
      view = undefined;
    };
  });

  // Sync external value changes into editor
  $effect(() => {
    if (!view || internalUpdate) return;
    const current = view.state.doc.toString();
    if (value !== current) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      });
    }
  });

  // Push diagnostics into editor
  $effect(() => {
    if (!view) return;
    view.dispatch(setDiagnostics(view.state, diagnostics));
  });
</script>

<div bind:this={container} class="h-full w-full overflow-hidden"></div>

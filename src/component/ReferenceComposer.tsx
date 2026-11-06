import React, { useEffect, useMemo, useRef, useState } from "react";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { PlainTextPlugin } from "@lexical/react/LexicalPlainTextPlugin";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { $getClipboardDataFromSelection, setLexicalClipboardDataTransfer, $insertDataTransferForRichText } from "@lexical/clipboard";
import {
  $applyNodeReplacement,
  $createParagraphNode,
  $createTextNode,
  $createLineBreakNode,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  $isElementNode,
  DecoratorNode,
  KEY_ENTER_COMMAND,
  COMMAND_PRIORITY_HIGH,
  COPY_COMMAND,
  CUT_COMMAND,
  PASTE_COMMAND,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
  type EditorState,
} from "lexical";
import { listClubs } from "../club/clubApi";
import { listEvents } from "../event/eventApi";
import { findSources } from "../library/libraryApi";
import { searchProfiles } from "../profile/profileApi";
import {
  EntityReferenceLink,
  ReferenceThumbnail,
  referenceLabel,
  type EntityReference,
  type ReferenceObject,
} from "./entityReferences";

type SerializedReference = SerializedLexicalNode & {
  reference: ReferenceObject;
};

/** Lexical owns selection, deletion, clipboard and history for this inline atom. */
export class ReferenceNode extends DecoratorNode<React.ReactElement> {
  __reference: ReferenceObject;
  static getType() {
    return "tempvs-reference";
  }
  static clone(node: ReferenceNode) {
    return new ReferenceNode(node.__reference, node.__key);
  }
  constructor(reference: ReferenceObject, key?: NodeKey) {
    super(key);
    this.__reference = reference;
  }
  createDOM() {
    const host = document.createElement("span");
    host.className = "reference-node";
    return host;
  }
  updateDOM() {
    return false;
  }
  isInline() {
    return true;
  }
  getTextContent() {
    return `@${this.__reference.name}`;
  }
  decorate() {
    return <EntityReferenceLink reference={this.__reference} />;
  }
  exportJSON(): SerializedReference {
    return {
      ...super.exportJSON(),
      type: ReferenceNode.getType(),
      version: 1,
      reference: this.__reference,
    };
  }
  static importJSON(value: SerializedReference) {
    return $referenceNode(value.reference);
  }
}
function $referenceNode(reference: ReferenceObject) {
  return $applyNodeReplacement(new ReferenceNode(reference));
}

/** Only the editor model is serialized; hover-card DOM never becomes message text. */
export function $readReferenceDocument() {
  let value = "";
  const references: EntityReference[] = [];
  const visit = (node: LexicalNode) => {
    if (node instanceof ReferenceNode) {
      const start = value.length;
      value += node.getTextContent();
      references.push({ ...node.__reference, start, end: value.length });
    } else if ($isElementNode(node)) node.getChildren().forEach(visit);
    else value += node.getTextContent();
  };
  $getRoot()
    .getChildren()
    .forEach((node, index) => {
      if (index) value += "\n";
      visit(node);
    });
  return { value, references };
}
function $loadDocument(value: string, references: EntityReference[]) {
  const root = $getRoot();
  root.clear();
  const paragraph = $createParagraphNode();
  root.append(paragraph);
  const append = (text: string) =>
    text.split("\n").forEach((part, index) => {
      if (index) paragraph.append($createLineBreakNode());
      if (part) paragraph.append($createTextNode(part));
    });
  let cursor = 0;
  [...references]
    .sort((a, b) => a.start - b.start)
    .forEach((reference) => {
      if (
        reference.start < cursor ||
        reference.end > value.length ||
        value.slice(reference.start, reference.end) !== `@${reference.name}`
      )
        return;
      append(value.slice(cursor, reference.start));
      const { start, end, ...object } = reference;
      paragraph.append($referenceNode(object));
      cursor = end;
    });
  append(value.slice(cursor));
}

export type ComposerProps = {
  value: string;
  references: EntityReference[];
  onChange: (value: string, references: EntityReference[]) => void;
  onSubmitEnter?: () => void;
} & Omit<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>,
  "value" | "onChange"
>;
type Trigger = { key: NodeKey; start: number; end: number; query: string };

function ComposerController({
  value,
  references,
  onChange,
  disabled,
  maxLength,
  onSubmitEnter,
}: ComposerProps) {
  const [editor] = useLexicalComposerContext();
  const [trigger, setTrigger] = useState<Trigger | null>(null);
  const [results, setResults] = useState<ReferenceObject[]>([]);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const emitted = useRef(JSON.stringify({ value, references }));
  const acceptedState = useRef(editor.getEditorState());
  const triggerRef = useRef(trigger);
  triggerRef.current = trigger;
  const controlled = JSON.stringify({ value, references });
  useEffect(() => {
    if (emitted.current === controlled) return;
    emitted.current = controlled;
    editor.update(
      () => {
        $loadDocument(value, references);
        $getRoot().selectEnd();
      },
      { tag: "external" },
    );
    setTrigger(null);
  }, [controlled, editor, value, references]);
  useEffect(() => {
    editor.setEditable(!disabled);
  }, [editor, disabled]);
  useEffect(() => {
    const copy = (event: ClipboardEvent | KeyboardEvent | null) => {
      if (!event || typeof ClipboardEvent === "undefined" || !(event instanceof ClipboardEvent) || !event.clipboardData) return false;
      event.preventDefault();
      setLexicalClipboardDataTransfer(event.clipboardData, $getClipboardDataFromSelection());
      return true;
    };
    const removeCopy = editor.registerCommand(COPY_COMMAND, copy, COMMAND_PRIORITY_HIGH);
    const removeCut = editor.registerCommand(CUT_COMMAND, event => {
      if (!copy(event)) return false;
      const selection = $getSelection();
      if ($isRangeSelection(selection)) selection.removeText();
      return true;
    }, COMMAND_PRIORITY_HIGH);
    const removePaste = editor.registerCommand(PASTE_COMMAND, event => {
      if (typeof ClipboardEvent === "undefined" || !(event instanceof ClipboardEvent) || !event.clipboardData?.getData("application/x-lexical-editor")) return false;
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return false;
      event.preventDefault();
      $insertDataTransferForRichText(event.clipboardData, selection, editor);
      return true;
    }, COMMAND_PRIORITY_HIGH);
    return () => { removeCopy(); removeCut(); removePaste(); };
  }, [editor]);
  useEffect(
    () =>
      editor.registerCommand(
        KEY_ENTER_COMMAND,
        (event) => {
          if (
            !onSubmitEnter ||
            !event ||
            event.shiftKey ||
            event.isComposing ||
            editor.isComposing() ||
            disabled
          )
            return false;
          event.preventDefault();
          onSubmitEnter();
          return true;
        },
        COMMAND_PRIORITY_HIGH,
      ),
    [editor, onSubmitEnter, disabled],
  );
  const select = (item: ReferenceObject) => {
    const match = triggerRef.current;
    if (!match) return;
    editor.update(
      () => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return;
        const node = selection.anchor.getNode();
        if (!$isTextNode(node) || node.getKey() !== match.key) return;
        node.select(match.start, match.end);
        const after = $createTextNode(" ");
        $getSelection()?.insertNodes([$referenceNode(item), after]);
        after.selectEnd();
      },
      { tag: "history-push" },
    );
    setTrigger(null);
    editor.focus();
  };
  useEffect(() => {
    if (!trigger?.query) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setResults([]);
    setLoading(true);
    setActive(0);
    const timer = window.setTimeout(() => {
      const query = trigger.query;
      Promise.allSettled([
        searchProfiles({ query, size: 8 }).then((items) =>
          items.map((item) => ({
            entityType: "PROFILE" as const,
            entityId: String(item.id),
            name:
              [item.firstName, item.lastName].filter(Boolean).join(" ") ||
              "Unnamed profile",
            thumbnailUrl: item.avatarUrl || undefined,
          })),
        ),
        listClubs(query).then((page) =>
          page.content
            .slice(0, 8)
            .map((item) => ({
              entityType: "CLUB" as const,
              entityId: String(item.id),
              name: item.name,
              thumbnailUrl:
                item.photoThumbnailUrl || item.photoUrl || undefined,
            })),
        ),
        listEvents().then((page) =>
          page.content
            .filter((item) =>
              item.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
            )
            .slice(0, 8)
            .map((item) => ({
              entityType: "EVENT" as const,
              entityId: item.id,
              name: item.name,
              thumbnailUrl: item.image?.thumbnailUrl || item.image?.url,
            })),
        ),
        findSources({ query, size: 8 }).then((page) =>
          page.data.map((item) => ({
            entityType: "SOURCE" as const,
            entityId: item.id,
            name: item.name || "Untitled source",
          })),
        ),
      ]).then((groups) => {
        if (!cancelled) {
          setResults(
            groups.flatMap<ReferenceObject>((group) =>
              group.status === "fulfilled" ? group.value : [],
            ),
          );
          setLoading(false);
        }
      });
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [trigger?.query]);
  useEffect(() => {
    const root = editor.getRootElement();
    const handler = (event: KeyboardEvent) => {
      if (!triggerRef.current || event.isComposing) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setTrigger(null);
      } else if (
        (event.key === "ArrowDown" || event.key === "ArrowUp") &&
        results.length
      ) {
        event.preventDefault();
        event.stopPropagation();
        setActive(
          (index) =>
            (index + (event.key === "ArrowDown" ? 1 : results.length - 1)) %
            results.length,
        );
      } else if (event.key === "Enter" && results[active]) {
        event.preventDefault();
        event.stopPropagation();
        select(results[active]);
      }
    };
    root?.addEventListener("keydown", handler, true);
    return () => root?.removeEventListener("keydown", handler, true);
  });
  const changed = (state: EditorState, tags: Set<string>) => {
    const length = state.read(() => $readReferenceDocument().value.length);
    if (maxLength && length > maxLength) {
      editor.setEditorState(acceptedState.current, { tag: "history-merge" });
      return;
    }
    acceptedState.current = state;
    state.read(() => {
      const document = $readReferenceDocument();
      const serialized = JSON.stringify(document);
      if (serialized !== emitted.current) {
        emitted.current = serialized;
        onChange(document.value, document.references);
      }
      if (tags.has("external")) return;
      const selection = $getSelection();
      if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
        setTrigger(null);
        return;
      }
      const node = selection.anchor.getNode();
      if (!$isTextNode(node)) {
        setTrigger(null);
        return;
      }
      const offset = selection.anchor.offset;
      const match = /(?:^|\s)@([^@\s]*)$/.exec(
        node.getTextContent().slice(0, offset),
      );
      setTrigger(
        match
          ? {
              key: node.getKey(),
              start: offset - match[1].length - 1,
              end: offset,
              query: match[1],
            }
          : null,
      );
    });
  };
  return (
    <>
      <OnChangePlugin
        ignoreSelectionChange={false}
        onChange={(state, _editor, tags) => changed(state, tags)}
      />
      {trigger && (
        <div
          className="entity-reference-menu"
          role="listbox"
          aria-label="Reference search results"
        >
          {results.length ? (
            results.map((item, index) => (
              <button
                role="option"
                aria-selected={index === active}
                key={`${item.entityType}:${item.entityId}`}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => select(item)}
              >
                <span className="entity-reference-menu-thumb">
                  <ReferenceThumbnail reference={item} />
                </span>
                <span>
                  {item.name}
                  <small>{referenceLabel(item.entityType)}</small>
                </span>
              </button>
            ))
          ) : (
            <p>
              {loading
                ? "Searching…"
                : trigger.query
                ? "No references found."
                : "Type a name to search profiles, clubs, events, and sources."}
            </p>
          )}
        </div>
      )}
    </>
  );
}

export default function ReferenceComposer(props: ComposerProps) {
  const initial = useRef({
    value: props.value,
    references: props.references,
    disabled: props.disabled,
  });
  const config = useMemo(
    () => ({
      namespace: "TempvsReferences",
      nodes: [ReferenceNode],
      editable: !initial.current.disabled,
      onError: (error: Error) => {
        throw error;
      },
      editorState: () =>
        $loadDocument(initial.current.value, initial.current.references),
    }),
    [],
  );
  return (
    <LexicalComposer initialConfig={config}>
      <div
        className="entity-reference-composer"
        style={{ "--composer-lines": props.rows || 3 } as React.CSSProperties}
      >
        <PlainTextPlugin
          contentEditable={
            <ContentEditable
              id={props.id}
              className={`form-control reference-editor ${
                props.className || ""
              }`}
              aria-label={
                props["aria-label"] || props.placeholder || "Message content"
              }
              aria-multiline="true"
              onKeyDown={(event) =>
                props.onKeyDown?.(
                  event as unknown as React.KeyboardEvent<HTMLTextAreaElement>,
                )
              }
            />
          }
          placeholder={
            <div className="reference-editor-placeholder">
              {props.placeholder}
            </div>
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
        <HistoryPlugin />
        <ComposerController {...props} />
      </div>
    </LexicalComposer>
  );
}

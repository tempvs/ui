import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import {
  EntityReferenceComposer,
  EntityReferenceText,
  type EntityReference,
} from "../../src/component/entityReferences";

function Fixture() {
  const [value, setValue] = useState("");
  const [references, setReferences] = useState<EntityReference[]>([]);
  const [saved, setSaved] = useState({
    value: "",
    references: [] as EntityReference[],
  });
  return (
    <MemoryRouter>
      <EntityReferenceComposer
        value={value}
        references={references}
        onChange={(text, refs) => {
          setValue(text);
          setReferences(refs);
        }}
        placeholder="Write a message"
        maxLength={2000}
        onSubmitEnter={
          window.location.search.includes("chat")
            ? () => {
                setSaved({ value, references });
                setValue("");
                setReferences([]);
              }
            : undefined
        }
      />
      <output data-testid="document">
        {JSON.stringify({ value, references })}
      </output>
      <button
        onClick={() => {
          setSaved({ value, references });
          setValue("");
          setReferences([]);
        }}
      >
        Send
      </button>
      <button
        onClick={() => {
          setValue(saved.value);
          setReferences(saved.references);
        }}
      >
        Edit saved
      </button>
      <button
        onClick={() => {
          let text = "";
          const refs = (["PROFILE", "CLUB", "EVENT", "SOURCE"] as const).map(
            (entityType, index) => {
              const name = `Object ${index}`;
              if (text) text += " ";
              const start = text.length;
              text += `@${name}`;
              return {
                entityType,
                entityId: `older-${index}`,
                name,
                start,
                end: text.length,
              };
            },
          );
          setSaved({ value: text, references: refs });
        }}
      >
        Load older references
      </button>
      <EntityReferenceText
        content={saved.value}
        references={saved.references}
      />
    </MemoryRouter>
  );
}
createRoot(document.getElementById("root")!).render(<Fixture />);

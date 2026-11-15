import { useEffect, useState } from "react";
import type { ComponentType } from "react";
import { FaSearch } from "react-icons/fa";
import TextFilterInput from "../component/TextFilterInput";

let searchModule: Promise<typeof import("./SearchDialog")> | undefined;

/** Keep search results, source cards and their APIs out of the initial shell.
 * Preserve typing while the search module loads on the first interaction. */
export default function LazySearchDialog() {
  const [active, setActive] = useState(false);
  const [query, setQuery] = useState("");
  const [Dialog, setDialog] = useState<ComponentType<{
    initialOpen: boolean;
    initialQuery: string;
  }> | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!active) return;
    let current = true;
    setError(false);
    searchModule ||= import("./SearchDialog");
    void searchModule
      .then((module) => {
        if (current) setDialog(() => module.default);
      })
      .catch(() => {
        searchModule = undefined;
        if (current) setError(true);
      });
    return () => {
      current = false;
    };
  }, [active, attempt]);
  useEffect(() => {
    if (active) return;
    const shortcut = (event: KeyboardEvent) => {
      if (
        event.key !== "/" ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        (event.target as HTMLElement | null)?.matches(
          "input, textarea, select, [contenteditable='true']",
        )
      )
        return;
      event.preventDefault();
      setActive(true);
    };
    document.addEventListener("keydown", shortcut);
    return () => document.removeEventListener("keydown", shortcut);
  }, [active]);
  const trigger = (
    <div className="header-search-shell">
      <div className="header-search-trigger">
        <span className="header-search-icon" aria-hidden="true">
          <FaSearch />
        </span>
        <TextFilterInput
          value={query}
          onChange={(value) => {
            setQuery(value);
            setActive(true);
          }}
          onFocus={() => setActive(true)}
          className="header-search-input"
          placeholder="Search"
          ariaLabel="Search profiles, clubs, events, and sources"
        />
      </div>
    </div>
  );
  return (
    <>
      {Dialog ? <Dialog initialOpen initialQuery={query} /> : trigger}
      {error && (
        <div role="alert">
          Search could not be loaded.{" "}
          <button
            type="button"
            onClick={() => setAttempt((value) => value + 1)}
          >
            Retry search
          </button>
        </div>
      )}
    </>
  );
}

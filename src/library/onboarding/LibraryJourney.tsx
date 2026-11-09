import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link } from "react-router-dom";
import { getLibraryViewer, type LibraryViewer } from "../libraryApi";
import {
  canAccessLibraryAdministration,
  canEditSource,
  getRoles,
} from "../libraryRoles";
import DismissibleCoachmark from "../../component/DismissibleCoachmark";
import {
  libraryLearningSnapshot,
  loadLibraryLearning,
  setLibraryLearningUser,
  subscribeLibraryLearning,
  updateLibraryLearning,
  learnFromChangeset,
  receiveLibraryLearningStorage,
  type LibraryAudience,
  type LibraryTopic,
} from "./libraryLearning";
import type { SourceChangeset } from "../libraryApi";
import "./libraryJourney.css";

type Step = {
  id: LibraryTopic;
  title: string;
  copy: string;
  to?: string;
  action?: string;
};
export function libraryAudience(viewer: LibraryViewer): LibraryAudience {
  const roles = getRoles(viewer);
  if (roles.has("LIBRARY_ADMIN")) return "admin";
  if (roles.has("LIBRARY_ARCHIVARIUS")) return "archivarius";
  return canEditSource(viewer) ? "contributor" : "reader";
}
export function librarySteps(viewer: LibraryViewer): Step[] {
  const steps: Step[] = [
    {
      id: "browse",
      title: "Find a source",
      copy: "Choose a historical period, then search by name or filter by type, dates, and place.",
    },
    {
      id: "source",
      title: "Read and use a source",
      copy: "Open a source to see its description, dating, locations, and images. To support your equipment, link a Library source from the item's editor.",
    },
    {
      id: "workflow",
      title: "Understand the workflow",
      copy: "Published sources are public. Scribes propose changes; a reviewer who did not author or amend the proposal approves it; the author then publishes. Editing an approved proposal requires fresh approval.",
    },
  ];
  if (canEditSource(viewer))
    steps.push(
      {
        id: "proposal",
        title: "Propose or amend a source",
        copy: "Use + in a period to propose a new source, or Edit source on an existing one. Review the changes before submitting. Nothing becomes public yet.",
      },
      {
        id: "status",
        title: "Check proposal status",
        copy: "Pending proposals opens the review queue. Open a source's Changesets to find its proposals, including published, rejected, or withdrawn changes. Each proposal shows its status and revision history.",
        to: "/library/proposals",
        action: "Open pending proposals",
      },
      {
        id: "review",
        title: "Review independently",
        copy: "Open another member's proposal, compare the changes and images, and leave comments. Approve if ready, or explain a rejection. Authors and members who amended the proposal need another reviewer.",
        to: "/library/proposals",
        action: "Find a proposal",
      },
      {
        id: "tasks",
        title: "Discuss and resolve action items",
        copy: "Use comments to discuss changes and Action items for concrete tasks. Blocking tasks prevent approval and publication. The author amends the proposal and replies; the task creator verifies the fix and resolves it.",
      },
      {
        id: "publish",
        title: "Publish after approval",
        copy: "On your approved proposal, use Publish to update the public source. Approval alone does not publish. A changed source or a new blocking task may require another review.",
      },
    );
  if (canAccessLibraryAdministration(viewer))
    steps.push({
      id: "members",
      title: "Manage Library membership",
      copy: "Library administration contains role requests, members, and proposal review. Archivarius members may assign Scribe access; Library Admins may also assign Archivarius. Only Tempvs Admin can assign Library Admin.",
      to: "/library/admin",
      action: "Open administration",
    });
  if (libraryAudience(viewer) === "admin")
    steps.push({
      id: "overrides",
      title: "Know when to use an admin override",
      copy: "Only Library Admin and Tempvs Admin see yellow override actions. They require a recorded reason. Resolve blocking tasks first, then approve if needed and publish. You do not need to use an override to finish this guide.",
    });
  return steps;
}

type Hint = { topic: LibraryTopic; priority: number };
type JourneyContext = {
  viewer: LibraryViewer;
  refreshViewer: (viewer: LibraryViewer) => void;
  ready: boolean;
  hidden: boolean;
  learned: LibraryTopic[];
  dismissed: LibraryTopic[];
  active: string | null;
  register: (id: string, hint: Hint | null) => void;
};
const Context = createContext<JourneyContext | null>(null);

export function useLibraryJourneyViewer(viewer: LibraryViewer) {
  const journey = useContext(Context);
  const refreshViewer = journey?.refreshViewer;
  useEffect(() => {
    if (viewer) refreshViewer?.(viewer);
  }, [viewer, refreshViewer]);
}

export function useLibraryTopic(topic: LibraryTopic, demonstrated: boolean) {
  const journey = useContext(Context);
  const id = journey?.viewer?.userId;
  useEffect(() => {
    if (id && demonstrated) updateLibraryLearning(id, { learned: [topic] });
  }, [id, topic, demonstrated]);
}
export function useLibraryProposalEvidence(changeset: SourceChangeset | null) {
  const journey = useContext(Context);
  const id = journey?.viewer?.userId;
  useEffect(() => {
    if (id && changeset) learnFromChangeset(id, changeset);
  }, [id, changeset]);
}

export function LibraryJourneyProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [viewer, setViewer] = useState<LibraryViewer>(null);
  const [, render] = useState(0);
  const [hints, setHints] = useState<Record<string, Hint>>({});
  const refreshViewer = useCallback((value: LibraryViewer) => {
    setViewer((current) =>
      current?.userId === value?.userId &&
      JSON.stringify(current?.roles) === JSON.stringify(value?.roles)
        ? current
        : value,
    );
    setLibraryLearningUser(value?.userId || null);
    if (value) void loadLibraryLearning(value.userId);
  }, []);
  useEffect(
    () => subscribeLibraryLearning(() => render((value) => value + 1)),
    [],
  );
  useEffect(() => {
    window.addEventListener("storage", receiveLibraryLearningStorage);
    return () =>
      window.removeEventListener("storage", receiveLibraryLearningStorage);
  }, []);
  useEffect(() => {
    let live = true;
    void getLibraryViewer()
      .then((value) => {
        if (!live) return;
        refreshViewer(value);
      })
      .catch(() => undefined);
    return () => {
      live = false;
      setLibraryLearningUser(null);
    };
  }, [refreshViewer]);
  const register = useCallback((id: string, hint: Hint | null) => {
    setHints((current) => {
      const next = { ...current };
      if (hint) next[id] = hint;
      else delete next[id];
      return next;
    });
  }, []);
  const audience = libraryAudience(viewer);
  const snapshot = viewer ? libraryLearningSnapshot(viewer.userId) : null;
  const learned = snapshot?.progress.learned || [];
  const dismissed = snapshot?.progress.dismissedHints || [];
  const hidden = Boolean(snapshot?.progress.hiddenAudiences.includes(audience));
  const active =
    Object.entries(hints)
      .filter(
        ([, hint]) =>
          !learned.includes(hint.topic) && !dismissed.includes(hint.topic),
      )
      .sort(
        (a, b) => a[1].priority - b[1].priority || a[0].localeCompare(b[0]),
      )[0]?.[0] || null;
  return (
    <Context.Provider
      value={{
        viewer,
        refreshViewer,
        ready: Boolean(snapshot?.ready),
        hidden,
        learned,
        dismissed,
        active,
        register,
      }}
    >
      {children}
    </Context.Provider>
  );
}

/** Register only actionable targets; the provider permits one Library hint at a time. */
export function LibraryHint({
  topic,
  message,
  priority = 10,
  enabled = true,
  children,
  className,
}: {
  topic: LibraryTopic;
  message: string;
  priority?: number;
  enabled?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const journey = useContext(Context);
  const id = useId();
  const anchor = useRef<HTMLSpanElement>(null);
  const [inView, setInView] = useState(
    typeof IntersectionObserver === "undefined",
  );
  useEffect(() => {
    if (
      !enabled ||
      !anchor.current ||
      typeof IntersectionObserver === "undefined"
    )
      return;
    const observer = new IntersectionObserver(
      ([target]) =>
        setInView(target.isIntersecting && target.intersectionRatio >= 0.2),
      { threshold: [0, 0.2] },
    );
    observer.observe(anchor.current);
    return () => observer.disconnect();
  }, [enabled]);
  const register = journey?.register;
  const eligible = Boolean(
    journey?.ready &&
    !journey.hidden &&
    enabled &&
    inView &&
    !journey.learned.includes(topic) &&
    !journey.dismissed.includes(topic),
  );
  useEffect(() => {
    if (!register || !eligible) return;
    register(id, { topic, priority });
    return () => register(id, null);
  }, [register, eligible, id, topic, priority]);
  return (
    <span ref={anchor} className={className || "library-hint"}>
      <DismissibleCoachmark
        id={`library:${journey?.viewer?.userId || "anonymous"}:${topic}`}
        visible={eligible && journey?.active === id}
        message={message}
        placement="below"
        tooltipClassName="library-coachmark"
        className={className}
        onDismiss={() => {
          if (journey?.viewer)
            updateLibraryLearning(journey.viewer.userId, {
              dismissedHints: [topic],
            });
        }}
      >
        {children}
      </DismissibleCoachmark>
    </span>
  );
}

export default function LibraryJourney({
  compact = false,
}: {
  compact?: boolean;
}) {
  const journey = useContext(Context);
  const [expanded, setExpanded] = useState(false);
  const steps = useMemo(
    () => librarySteps(journey?.viewer || null),
    [journey?.viewer],
  );
  if (!journey?.viewer) return null;
  const { viewer, ready, hidden, learned } = journey;
  const audience = libraryAudience(viewer);
  const complete = steps.every((step) => learned.includes(step.id));
  const shown = expanded || (!compact && ready && !hidden && !complete);
  const changeVisibility = (hide: boolean) => {
    updateLibraryLearning(viewer.userId, { audience, hidden: hide });
    setExpanded(!hide);
  };
  return (
    <aside className="library-journey mx-4 mx-xl-5" aria-label="Library guide">
      <div className="library-journey-heading">
        <div>
          <strong>Library guide</strong>
          <span className="ms-2 text-muted small">
            {ready
              ? `${steps.filter((step) => learned.includes(step.id)).length} of ${steps.length} topics learned`
              : "Learn at your own pace"}
          </span>
        </div>
        <button
          type="button"
          className="btn btn-link btn-sm"
          onClick={() => changeVisibility(shown)}
        >
          {shown ? "Hide guide and hints" : "Open Library guide"}
        </button>
      </div>
      {shown && (
        <>
          <p className="library-journey-intro">
            {audience === "reader"
              ? "Explore public historical evidence. Request Scribe access on the Library page when you are ready to contribute."
              : "Propose → discuss and resolve tasks → independent approval → author publishes. Learn at your own pace; there is no need to create practice content."}
          </p>
          <div className="library-journey-steps">
            {steps
              .filter((step) => !learned.includes(step.id))
              .map((step) => (
                <section
                  key={step.id}
                  className={
                    learned.includes(step.id)
                      ? "library-journey-step learned"
                      : "library-journey-step"
                  }
                >
                  <h2>
                    {learned.includes(step.id) ? "✓ " : ""}
                    {step.title}
                  </h2>
                  <p>{step.copy}</p>
                  {!learned.includes(step.id) && (
                    <div className="d-flex gap-2 flex-wrap align-items-center">
                      {step.to && (
                        <Link
                          className="btn btn-outline-dark btn-sm"
                          to={step.to}
                        >
                          {step.action}
                        </Link>
                      )}
                      <button
                        className="btn btn-link btn-sm"
                        onClick={() =>
                          updateLibraryLearning(viewer.userId, {
                            learned: [step.id],
                          })
                        }
                      >
                        {step.id === "workflow" || step.id === "overrides"
                          ? "Got it"
                          : "I already know this"}
                      </button>
                    </div>
                  )}
                </section>
              ))}
          </div>
          {steps.some((step) => learned.includes(step.id)) && (
            <details className="library-learned-topics mt-3">
              <summary>
                Learned topics (
                {steps.filter((step) => learned.includes(step.id)).length})
              </summary>
              <div className="library-journey-steps mt-2">
                {steps
                  .filter((step) => learned.includes(step.id))
                  .map((step) => (
                    <section
                      className="library-journey-step learned"
                      key={step.id}
                    >
                      <h2>✓ {step.title}</h2>
                      <p>{step.copy}</p>
                    </section>
                  ))}
              </div>
            </details>
          )}
        </>
      )}
    </aside>
  );
}

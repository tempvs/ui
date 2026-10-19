import { Button } from "react-bootstrap";

export type AdministrationTab = {
  id: string;
  label: string;
  disabled?: boolean;
};

type Props = {
  tabs: readonly AdministrationTab[];
  activeTab: string;
  onSelect: (tab: string) => void;
  ariaLabel: string;
  className?: string;
};

/**
 * Shared administration navigation.  It deliberately uses the same compact
 * button treatment as Library administration while leaving each resource free
 * to keep its own URL/state model.
 */
export default function AdministrationTabs({
  tabs,
  activeTab,
  onSelect,
  ariaLabel,
  className = "",
}: Props) {
  return (
    <div
      className={`d-flex gap-2 mb-4 flex-wrap ${className}`.trim()}
      role="tablist"
      aria-label={ariaLabel}
    >
      {tabs.map((tab) => (
        <Button
          key={tab.id}
          type="button"
          variant={activeTab === tab.id ? "dark" : "outline-dark"}
          disabled={tab.disabled}
          aria-selected={activeTab === tab.id}
          role="tab"
          onClick={() => onSelect(tab.id)}
        >
          {tab.label}
        </Button>
      ))}
    </div>
  );
}

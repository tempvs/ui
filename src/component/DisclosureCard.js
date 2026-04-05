import React from 'react';
import { FaChevronDown, FaChevronRight } from 'react-icons/fa';

export default function DisclosureCard({
  expanded,
  onToggle,
  summary,
  topRightAction = null,
  children = null,
  className = '',
  style = {},
}) {
  return (
    <div
      className={`tempvs-disclosure-card rounded border p-3 position-relative ${!expanded ? 'tempvs-disclosure-card-collapsed' : ''} ${className}`.trim()}
      style={style}
    >
      {expanded && topRightAction}
      <button
        type="button"
        className="btn p-0 border-0 bg-transparent w-100 text-start"
        onClick={onToggle}
      >
        <div className="d-flex align-items-start justify-content-between gap-3 pe-5">
          <div className="d-flex align-items-start gap-3 flex-grow-1">
            <div className="pt-1" style={{ color: '#4b4b4b', minWidth: '1rem' }}>
              {expanded ? <FaChevronDown /> : <FaChevronRight />}
            </div>
            <div className="flex-grow-1">
              {summary}
            </div>
          </div>
        </div>
      </button>
      {expanded && children}
    </div>
  );
}

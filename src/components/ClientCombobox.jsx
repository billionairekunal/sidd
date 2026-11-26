"use client";

import { useId, useMemo, useState } from "react";
import { Building2, Check, Plus } from "lucide-react";

/**
 * One field for the consignor: type any name, or pick a saved client from the
 * suggestions (picking also fills the address via onPick).
 */
export default function ClientCombobox({ value, onChange, onPick, clients, required }) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const query = value.trim().toLowerCase();
  const matches = useMemo(
    () =>
      query
        ? clients.filter((c) => c.name.toLowerCase().includes(query) || c.gstin?.toLowerCase().includes(query))
        : clients,
    [clients, query]
  );
  const exact = clients.find((c) => c.name.toLowerCase() === query);
  const showNewRow = query && !exact;
  const rowCount = matches.length + (showNewRow ? 1 : 0);

  function pick(client) {
    onPick(client);
    setOpen(false);
  }

  function onKeyDown(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, rowCount - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && open && rowCount) {
      e.preventDefault(); // don't submit the LR form while choosing
      if (active < matches.length) pick(matches[active]);
      else setOpen(false);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <div className="relative">
        <input
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          className={`input ${exact ? "pr-28" : ""}`}
          placeholder="Type name or pick saved client"
          value={value}
          required={required}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
        />
        {exact && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 rounded bg-primary-container text-primary text-[11px] font-semibold px-1.5 py-0.5 pointer-events-none">
            <Check className="w-3 h-3" strokeWidth={3} /> Saved client
          </span>
        )}
      </div>

      {open && rowCount > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto rounded-md border border-hairline bg-white shadow-lg py-1"
        >
          {matches.map((c, i) => (
            <li
              key={c.id}
              role="option"
              aria-selected={i === active}
              // mousedown (not click) so the input's blur doesn't close the list first
              onMouseDown={(e) => {
                e.preventDefault();
                pick(c);
              }}
              onMouseEnter={() => setActive(i)}
              className={`flex items-start gap-2.5 px-3 py-2.5 cursor-pointer ${i === active ? "bg-primary-container" : ""}`}
            >
              <Building2 className="w-4 h-4 mt-0.5 text-primary shrink-0" />
              <span className="min-w-0">
                <span className="block text-[13.5px] font-semibold text-ink-secondary truncate">{c.name}</span>
                {(c.gstin || c.address) && (
                  <span className="block text-[12px] text-ink-mute truncate">
                    {[c.gstin && `GSTIN ${c.gstin}`, c.address].filter(Boolean).join(" · ")}
                  </span>
                )}
              </span>
            </li>
          ))}
          {showNewRow && (
            <li
              role="option"
              aria-selected={active === matches.length}
              onMouseDown={(e) => {
                e.preventDefault();
                setOpen(false);
              }}
              onMouseEnter={() => setActive(matches.length)}
              className={`flex items-center gap-2.5 px-3 py-2.5 cursor-pointer border-t border-hairline text-[13px] text-ink-secondary ${
                active === matches.length ? "bg-primary-container" : ""
              }`}
            >
              <Plus className="w-4 h-4 text-primary shrink-0" />
              <span className="truncate">
                Use “<b>{value.trim()}</b>” as a new consignor
              </span>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

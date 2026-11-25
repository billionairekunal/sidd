"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

/**
 * Styled dropdown that never grows wider than its field (native <select> popups
 * do on narrow screens). options: [{ value, label, hint? }]
 */
export default function Select({ value, onChange, options, placeholder = "Select…", size = "md", className = "" }) {
  const listId = useId();
  const rootRef = useRef(null);
  const listRef = useRef(null);
  const [open, setOpen] = useState(false);
  const selectedIndex = options.findIndex((o) => String(o.value) === String(value));
  const [active, setActive] = useState(Math.max(0, selectedIndex));
  const selected = options[selectedIndex];

  // Close when tapping/clicking anywhere else.
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => !rootRef.current?.contains(e.target) && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  // Keep the highlighted option in view.
  useEffect(() => {
    if (open) listRef.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  // The list floats (position: fixed) so scrolling tables / cards can't clip it.
  // Page scroll or resize would detach it from the box, so close it then.
  const [pos, setPos] = useState(null);
  useEffect(() => {
    if (!open) return;
    const close = (e) => !listRef.current?.contains(e.target) && setOpen(false);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  function openList() {
    const r = rootRef.current.getBoundingClientRect();
    const LIST_MAX = 288; // matches max-h-72
    const below = window.innerHeight - r.bottom;
    const up = below < Math.min(LIST_MAX, options.length * 44 + 8) && r.top > below;
    const width = Math.max(r.width, 176);
    setPos({
      left: Math.max(8, Math.min(r.left, window.innerWidth - width - 8)),
      width,
      ...(up ? { bottom: window.innerHeight - r.top + 4 } : { top: r.bottom + 4 }),
      maxHeight: Math.min(LIST_MAX, (up ? r.top : below) - 12),
    });
    setActive(Math.max(0, selectedIndex));
    setOpen(true);
  }

  function choose(opt) {
    onChange(opt.value);
    setOpen(false);
  }

  function onKeyDown(e) {
    if (!open && ["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
      e.preventDefault();
      openList();
    } else if (open && e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, options.length - 1));
    } else if (open && e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (open && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      choose(options[active]);
    } else if (e.key === "Escape" || e.key === "Tab") {
      setOpen(false);
    }
  }

  const sm = size === "sm";

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        className={`w-full flex items-center gap-2 text-left border bg-white transition focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary ${
          open ? "border-primary ring-2 ring-primary/20" : "border-hairline"
        } ${sm ? "h-9 px-2.5 rounded-md text-[13px]" : "min-h-[42px] px-md py-sm rounded-lg text-sm"}`}
      >
        <span className="flex-1 min-w-0 truncate">
          {selected ? (
            <>
              <span className="text-ink-secondary">{selected.label}</span>
              {selected.hint && !sm && <span className="text-ink-mute"> · {selected.hint}</span>}
            </>
          ) : (
            <span className="text-ink-mute">{placeholder}</span>
          )}
        </span>
        <ChevronDown className={`w-4 h-4 text-ink-mute shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && pos && (
        <ul
          id={listId}
          ref={listRef}
          role="listbox"
          style={{ position: "fixed", ...pos }}
          className="z-[60] overflow-y-auto rounded-lg border border-hairline bg-white shadow-lg py-1 text-left whitespace-normal"
        >
          {options.map((opt, i) => {
            const isSelected = i === selectedIndex;
            return (
              <li
                key={String(opt.value)}
                role="option"
                aria-selected={isSelected}
                onClick={(e) => {
                  e.preventDefault(); // inside a <label>, a click would otherwise re-toggle the button
                  choose(opt);
                }}
                onMouseEnter={() => setActive(i)}
                className={`flex items-center gap-2 px-3 cursor-pointer ${sm ? "py-2" : "py-2.5"} ${
                  i === active ? "bg-primary-container" : ""
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-[13.5px] ${isSelected ? "font-semibold text-primary" : "text-ink-secondary"}`}>
                    {opt.label}
                  </span>
                  {opt.hint && <span className="block truncate text-[12px] text-ink-mute">{opt.hint}</span>}
                </span>
                {isSelected && <Check className="w-4 h-4 text-primary shrink-0" strokeWidth={2.5} />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

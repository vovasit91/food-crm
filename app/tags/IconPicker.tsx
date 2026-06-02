"use client";

import * as Icons from "lucide-react";
import { useState, useRef, useEffect } from "react";

const ALL_ICONS = Object.keys(Icons).filter(
  (k) => !k.endsWith("Icon") && k !== "createLucideIcon" && k !== "LucideProvider"
);

type LucideComponent = React.ComponentType<{ size?: number; className?: string }>;
const IconMap = Icons as unknown as Record<string, LucideComponent>;

type Props = {
  value: string;
  onChange: (name: string) => void;
};

export default function IconPicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const matches = ALL_ICONS.filter((n) =>
    search ? n.toLowerCase().includes(search.toLowerCase()) : true
  ).slice(0, 60);

  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const SelectedIcon = value ? IconMap[value] : null;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 border border-gray-300 rounded px-3 py-1.5 text-sm bg-white hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-left"
      >
        {SelectedIcon ? (
          <>
            <SelectedIcon size={16} className="text-gray-600 shrink-0" />
            <span className="text-gray-800">{value}</span>
          </>
        ) : (
          <span className="text-gray-400">Select icon...</span>
        )}
        <span className="ml-auto text-gray-400 text-xs">▾</span>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-80 bg-white border border-gray-200 rounded-lg shadow-lg">
          <div className="p-2 border-b border-gray-100 flex gap-2">
            <input
              ref={searchRef}
              className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="Search icons..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {value && (
              <button
                type="button"
                onClick={() => { onChange(""); setOpen(false); setSearch(""); }}
                className="text-xs text-red-500 hover:text-red-700 px-2"
              >
                Clear
              </button>
            )}
          </div>

          <div className="grid grid-cols-8 gap-1 p-2 max-h-72 overflow-y-auto">
            {matches.map((name) => {
              const Icon = IconMap[name];
              if (!Icon) return null;
              return (
                <button
                  key={name}
                  type="button"
                  title={name}
                  onClick={() => { onChange(name); setOpen(false); setSearch(""); }}
                  className={`flex items-center justify-center p-2.5 rounded hover:bg-indigo-50 transition-colors ${
                    value === name ? "bg-indigo-100" : ""
                  }`}
                >
                  <Icon size={20} className="text-gray-700" />
                </button>
              );
            })}
            {matches.length === 0 && (
              <p className="col-span-8 py-4 text-sm text-gray-400 text-center">No icons found</p>
            )}
          </div>

          {!search && (
            <p className="pb-2 text-xs text-gray-400 text-center">
              Showing 60 of {ALL_ICONS.length} — type to filter
            </p>
          )}
        </div>
      )}
    </div>
  );
}

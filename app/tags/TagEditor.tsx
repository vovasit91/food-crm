"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { createTag, updateTag, deleteTag } from "@/app/actions/tags";
import IconPicker from "@/app/tags/IconPicker";

type TagEditorProps = {
  mode: "create" | "edit";
  initial: {
    id: string;
    label: string;
    labelUa: string;
    icon: string;
    type: string;
  };
};

const INPUT = "w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500";
const LABEL = "block text-xs font-medium text-gray-500 mb-1";
const SAVE_BTN = "px-4 py-2 bg-indigo-600 text-white text-sm rounded font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors";

const KNOWN_TYPES = ["recipe", "category", "recipe_step"] as const;
type TagType = typeof KNOWN_TYPES[number];

export default function TagEditor({ mode, initial }: TagEditorProps) {
  const [isPending, startTransition] = useTransition();
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const [id, setId] = useState(initial.id);
  const [label, setLabel] = useState(initial.label);
  const [labelUa, setLabelUa] = useState(initial.labelUa);
  const [icon, setIcon] = useState(initial.icon);
  const [type, setType] = useState(initial.type || KNOWN_TYPES[0]);

  const showSaved = () => {
    setSavedMsg("Saved");
    setTimeout(() => setSavedMsg(null), 2000);
  };

  const handleSave = () => {
    startTransition(async () => {
      if (mode === "create") {
        await createTag({
          id: id.trim(),
          label: label.trim(),
          labelUa: labelUa.trim(),
          icon: icon.trim() || null,
          type: type.trim() || null,
        });
      } else {
        await updateTag(initial.id, {
          label: label.trim(),
          labelUa: labelUa.trim(),
          icon: icon.trim() || null,
          type: type.trim() || null,
        });
        showSaved();
      }
    });
  };

  const handleDelete = () => {
    if (!confirm(`Delete tag "${initial.id}"? This cannot be undone.`)) return;
    startTransition(() => deleteTag(initial.id));
  };

  return (
    <div className="p-6 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/tags" className="text-sm text-gray-400 hover:text-gray-600">
          Tags
        </Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-lg font-semibold text-gray-900">
          {mode === "create" ? "New Tag" : initial.id}
        </h1>
        {savedMsg && <span className="text-sm text-green-600 font-medium">{savedMsg}</span>}
        {mode === "edit" && (
          <button
            className="ml-auto px-3 py-1.5 text-sm font-medium text-red-600 border border-red-200 rounded hover:bg-red-50 transition-colors disabled:opacity-50"
            disabled={isPending}
            onClick={handleDelete}
          >
            Delete
          </button>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <label className={LABEL}>ID</label>
          <input
            className={INPUT + (mode === "edit" ? " bg-gray-50 text-gray-400" : "")}
            value={id}
            onChange={(e) => setId(e.target.value)}
            readOnly={mode === "edit"}
            placeholder="e.g. dont-overmix"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={LABEL}>Label (EN)</label>
            <input
              className={INPUT}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
          <div>
            <label className={LABEL}>Label (UA)</label>
            <input
              className={INPUT}
              value={labelUa}
              onChange={(e) => setLabelUa(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={LABEL}>Type</label>
            <select
              className={INPUT}
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              {KNOWN_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className={LABEL}>Icon</label>
            <IconPicker value={icon} onChange={setIcon} />
          </div>
        </div>

        <button
          className={SAVE_BTN}
          disabled={isPending || (mode === "create" && !id.trim())}
          onClick={handleSave}
        >
          {isPending ? "Saving..." : mode === "create" ? "Create" : "Save"}
        </button>
      </div>
    </div>
  );
}

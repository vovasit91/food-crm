"use client";

import { useRef, useState } from "react";
import { uploadImage } from "@/app/lib/upload";

type Props = {
  value: string | null;
  onChange: (url: string) => void;
  folder?: string;
};

export default function ImageUploader({ value, onChange, folder }: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setError(null);
    setUploading(true);
    try {
      onChange(await uploadImage(file, folder));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2 items-center">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded bg-gray-50 hover:bg-gray-100 disabled:opacity-50 transition-colors"
        >
          {uploading ? "Uploading..." : "Upload image"}
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="text-xs text-red-400 hover:text-red-600"
          >
            Remove
          </button>
        )}
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      {value && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt="" className="h-36 rounded object-cover" />
      )}
    </div>
  );
}

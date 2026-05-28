"use client";

import { useState } from "react";
import { generatePrompt } from "@/app/actions/generate-prompt";

export default function GeneratePromptPage() {
  const [url, setUrl] = useState("");
  const [prompt, setPrompt] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    setIsPending(true);
    setError("");
    setPrompt("");
    try {
      const result = await generatePrompt(url);
      setPrompt(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsPending(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-8 max-w-3xl space-y-6">
      <h1 className="text-xl font-semibold">Generate prompt</h1>

      <div className="flex gap-3">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/recipe"
          className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          onKeyDown={(e) => e.key === "Enter" && url.trim() && !isPending && handleGenerate()}
        />
        <button
          onClick={handleGenerate}
          disabled={isPending || !url.trim()}
          className="px-4 py-2 rounded text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
        >
          {isPending ? "Generating…" : "Generate"}
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      {prompt && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Prompt</span>
            <button
              onClick={handleCopy}
              className="px-3 py-1 rounded text-xs font-medium border border-gray-300 hover:bg-gray-50 transition-colors"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <textarea
            readOnly
            value={prompt}
            rows={24}
            className="w-full font-mono text-xs border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
          />
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { fetchAPI } from "../../../../utils/api";

export function OpenAIProviderCard({ className = "bg-card" }: { className?: string }) {
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

  useEffect(() => {
    setLoading(true);
    fetchAPI("/credentials?type=openai")
      .then((creds) => {
        if (creds && creds.length > 0) {
          setApiKey("************");
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setLoading(true);
    setStatus("idle");
    try {
      await fetchAPI("/credentials", {
        method: "POST",
        body: JSON.stringify({
          type: "openai",
          name: "OpenAI",
          data: { api_key: apiKey },
        }),
      });
      setStatus("success");
      setApiKey("************");
    } catch (e) {
      setStatus("error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`p-4 rounded-xl shadow-sm hover:shadow-md transition-shadow ${className}`}>
      <h3 className="font-medium text-lg">OpenAI</h3>
      <p className="text-sm text-muted-foreground mb-4">For using your OpenAI account</p>
      <label className="text-sm font-medium block mb-1.5">API Key</label>
      <input
        type="text"
        placeholder="Enter API Key"
        className="w-full h-9 px-3 rounded-full border bg-background text-sm"
        value={apiKey === "************" ? "" : apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        disabled={loading}
      />
      <div className="mt-4 flex justify-end">
        <button
          className="px-4 py-1.5 rounded-full bg-primary text-primary-foreground"
          onClick={handleSave}
          disabled={loading || !apiKey}
        >
          {loading ? "Saving..." : "Save"}
        </button>
      </div>
      {status === "success" && <div className="text-green-600 mt-2">Key saved!</div>}
      {status === "error" && <div className="text-red-600 mt-2">Failed to save key.</div>}
    </div>
  );
} 
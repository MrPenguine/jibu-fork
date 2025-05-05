import { useState } from "react";
import { APIKey } from "./page";
import { fetchAPI } from "../../../utils/api";

interface APIKeyItemProps {
  keyData: APIKey;
  tab: "private" | "public";
  onAction: () => void;
}

export function APIKeyItem({ keyData, tab, onAction }: APIKeyItemProps) {
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(keyData.id);
  };

  const handleDelete = async () => {
    setLoading(true);
    await fetchAPI(`/api-keys/${keyData.id}`, { method: "DELETE" });
    setLoading(false);
    onAction();
  };

  return (
    <div className="flex items-center justify-between bg-muted p-4 rounded-lg">
      <div>
        <div className="font-semibold flex items-center gap-2">
          {keyData.name}
          {keyData.isDefault && (
            <span className="ml-2 px-2 py-0.5 rounded bg-blue-100 text-blue-700 text-xs font-semibold">Default</span>
          )}
        </div>
        <div className="text-xs text-muted-foreground">
          {revealed ? keyData.id : "••••••••••••••••••••••••"}
        </div>
      </div>
      <div className="flex gap-2">
        <button className="btn" onClick={() => setRevealed(r => !r)}>{revealed ? "Hide" : "Reveal"}</button>
        <button className="btn" onClick={handleCopy}>Copy</button>
        <button className="btn btn-danger" onClick={handleDelete} disabled={loading}>Delete</button>
      </div>
    </div>
  );
} 
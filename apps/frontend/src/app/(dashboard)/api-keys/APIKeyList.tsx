import { APIKey } from "./page";
import { APIKeyItem } from "./APIKeyItem";

interface APIKeyListProps {
  keys: APIKey[];
  tab: "private" | "public";
  onAction: () => void;
}

export function APIKeyList({ keys, tab, onAction }: APIKeyListProps) {
  if (!keys.length) return <div className="text-muted-foreground">No {tab} keys found.</div>;
  return (
    <div className="space-y-4">
      {keys.map(key => (
        <APIKeyItem key={key.id} keyData={key} tab={tab} onAction={onAction} />
      ))}
    </div>
  );
} 
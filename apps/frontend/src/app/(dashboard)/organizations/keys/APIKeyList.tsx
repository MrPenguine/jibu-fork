import { APIKeyItem } from "./APIKeyItem";

export function APIKeyList({ keys, tab, onAction }) {
  if (!keys.length) return <div className="text-muted-foreground">No {tab} keys found.</div>;
  return (
    <div className="space-y-4">
      {keys.map(key => (
        <APIKeyItem key={key.id} keyData={key} tab={tab} onAction={onAction} />
      ))}
    </div>
  );
} 
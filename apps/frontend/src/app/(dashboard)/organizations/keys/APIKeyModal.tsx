import { useState } from "react";
import { fetchAPI } from "../../../../utils/api";

export function APIKeyModal({ tab, onClose, onCreated }) {
  const [name, setName] = useState("");
  const [origins, setOrigins] = useState("");
  const [assistants, setAssistants] = useState("");
  const [transient, setTransient] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    setLoading(true);
    await fetchAPI("/api-keys", {
      method: "POST",
      body: JSON.stringify({
        name,
        type: tab,
        allowedOrigins: origins,
        allowedAssistants: assistants,
        transient,
      }),
    });
    setLoading(false);
    onCreated();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-card p-6 rounded-xl w-full max-w-md">
        <h2 className="text-lg font-bold mb-4">New {tab === "private" ? "Private" : "Public"} API Key</h2>
        <label className="block mb-2">Name</label>
        <input className="input mb-4" value={name} onChange={e => setName(e.target.value)} placeholder="API Key Name" />
        <label className="block mb-2">Allowed Origins</label>
        <input className="input mb-4" value={origins} onChange={e => setOrigins(e.target.value)} placeholder="Allowed urls" />
        <label className="block mb-2">Allowed Assistants</label>
        <input className="input mb-4" value={assistants} onChange={e => setAssistants(e.target.value)} placeholder="Select Assistants" />
        <div className="flex items-center mb-4">
          <label className="mr-2">Transient Assistant</label>
          <input type="checkbox" checked={transient} onChange={e => setTransient(e.target.checked)} />
        </div>
        <button className="btn-primary w-full mb-2" onClick={handleCreate} disabled={loading || !name}>
          Create {tab === "private" ? "Private" : "Public"} Token
        </button>
        <button className="btn w-full" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
} 
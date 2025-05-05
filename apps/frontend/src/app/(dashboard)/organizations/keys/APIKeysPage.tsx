"use client";
import { useState, useEffect } from "react";
import { fetchAPI } from "../../../../utils/api";
import { APIKeyList } from "./APIKeyList";
import { APIKeyModal } from "./APIKeyModal";

export default function APIKeysPage() {
  const [tab, setTab] = useState<"private" | "public">("private");
  const [keys, setKeys] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);

  const loadKeys = () => {
    fetchAPI(`/api-keys?type=${tab}`)
      .then(setKeys)
      .catch(() => setKeys([]));
  };

  useEffect(() => {
    loadKeys();
  }, [tab, modalOpen]);

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div className="flex gap-2">
          <button onClick={() => setTab("private")} className={tab === "private" ? "font-bold" : ""}>Private</button>
          <button onClick={() => setTab("public")} className={tab === "public" ? "font-bold" : ""}>Public</button>
        </div>
        <button onClick={() => setModalOpen(true)} className="btn-primary">Add Key</button>
      </div>
      <APIKeyList keys={keys} tab={tab} onAction={loadKeys} />
      {modalOpen && <APIKeyModal tab={tab} onClose={() => setModalOpen(false)} onCreated={loadKeys} />}
    </div>
  );
} 
"use client";

import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

interface CreateAssistantModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (assistant: { id: string; name: string }) => void;
  agentId: string;
  create: (name: string, agentId: string) => Promise<{ id: string; name: string }>;
}

export const CreateAssistantModal: React.FC<CreateAssistantModalProps> = ({ open, onClose, onCreated, agentId, create }) => {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !agentId) return;
    setLoading(true);
    setError(null);
    try {
      const created = await create(name.trim(), agentId);
      onCreated(created);
      setName('');
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to create assistant');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-md shadow-lg w-full max-w-md p-4">
        <div className="flex items-center justify-between pb-2 border-b mb-3">
          <h3 className="text-lg font-semibold">Create Assistant</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="assistantName">Name</Label>
            <Input id="assistantName" placeholder="e.g. Customer support agent" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          {error && <div className="text-sm text-red-600">{error}</div>}
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={loading || !name.trim()}>
              {loading ? 'Creating...' : 'Create'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateAssistantModal;

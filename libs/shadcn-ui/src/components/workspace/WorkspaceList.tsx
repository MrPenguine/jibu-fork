"use client";

import { useEffect, useState } from 'react';
import { fetchAPI } from '../../../../../apps/frontend/src/utils/api';

interface Workspace {
  id: string;
  name: string;
  role: string;
  // Other workspace properties
}

export default function WorkspaceList() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchWorkspaces() {
      try {
        setLoading(true);
        const data = await fetchAPI('/workspaces');
        setWorkspaces(data);
        setError(null);
      } catch (err) {
        console.error('Error fetching workspaces:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch workspaces');
        setWorkspaces([]);
      } finally {
        setLoading(false);
      }
    }

    fetchWorkspaces();
  }, []);

  if (loading) {
    return <div>Loading workspaces...</div>;
  }

  if (error) {
    return <div className="text-red-500">Error: {error}</div>;
  }

  if (workspaces.length === 0) {
    return <div>No workspaces found.</div>;
  }

  return (
    <div className="p-4 bg-white rounded shadow">
      <h2 className="text-xl font-bold mb-4">My Workspaces</h2>
      <ul className="space-y-2">
        {workspaces.map((ws) => (
          <li key={ws.id} className="p-3 border rounded hover:bg-gray-50">
            <div className="font-semibold">{ws.name}</div>
            <div className="text-sm text-gray-500">
              Role: <span className="font-medium">{ws.role}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

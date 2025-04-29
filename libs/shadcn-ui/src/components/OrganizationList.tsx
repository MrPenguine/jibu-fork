"use client";

import { useEffect, useState } from 'react';
import { fetchAPI } from '../../../../apps/frontend/src/utils/api';

interface Organization {
  id: string;
  name: string;
  role: string;
  // Other organization properties
}

export default function OrganizationList() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchOrganizations() {
      try {
        setLoading(true);
        const data = await fetchAPI('/organizations');
        setOrganizations(data);
        setError(null);
      } catch (err) {
        console.error('Error fetching organizations:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch organizations');
        setOrganizations([]);
      } finally {
        setLoading(false);
      }
    }

    fetchOrganizations();
  }, []);

  if (loading) {
    return <div>Loading organizations...</div>;
  }

  if (error) {
    return <div className="text-red-500">Error: {error}</div>;
  }

  if (organizations.length === 0) {
    return <div>No organizations found.</div>;
  }

  return (
    <div className="p-4 bg-white rounded shadow">
      <h2 className="text-xl font-bold mb-4">My Organizations</h2>
      <ul className="space-y-2">
        {organizations.map((org) => (
          <li key={org.id} className="p-3 border rounded hover:bg-gray-50">
            <div className="font-semibold">{org.name}</div>
            <div className="text-sm text-gray-500">
              Role: <span className="font-medium">{org.role}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
} 
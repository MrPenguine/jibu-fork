import { useEffect, useState } from 'react';
import { fetchAPI } from '../utils/api';

interface UserData {
  id: string;
  email: string;
  // Other user properties
}

export default function UserProfile() {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUserData() {
      try {
        setLoading(true);
        const userData = await fetchAPI('/users/me');
        setUser(userData);
        setError(null);
      } catch (err) {
        console.error('Error fetching user data:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch user data');
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    fetchUserData();
  }, []);

  if (loading) {
    return <div>Loading user data...</div>;
  }

  if (error) {
    return <div className="text-red-500">Error: {error}</div>;
  }

  if (!user) {
    return <div>No user data available.</div>;
  }

  return (
    <div className="p-4 bg-white rounded shadow">
      <h2 className="text-xl font-bold mb-4">User Profile</h2>
      <div className="mb-2">
        <span className="font-semibold">ID:</span> {user.id}
      </div>
      <div className="mb-2">
        <span className="font-semibold">Email:</span> {user.email}
      </div>
      {/* Display other user properties as needed */}
    </div>
  );
} 
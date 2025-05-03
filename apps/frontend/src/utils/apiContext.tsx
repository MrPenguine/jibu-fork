"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { createClient } from './supabase/client';
import { API_BASE_URL } from './api';

// Define the user interface
interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
}

// Define the API context interface
interface ApiContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  refreshContext: () => Promise<void>;
  apiRequest: (endpoint: string, options?: RequestInit) => Promise<any>;
}

// Create the context with default values
const ApiContext = createContext<ApiContextType>({
  user: null,
  token: null,
  loading: true,
  error: null,
  refreshContext: async () => {},
  apiRequest: async () => ({}),
});

// Custom hook to use the API context
export const useApi = () => useContext(ApiContext);

// API provider component
export function ApiProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Standard API request function with auth token
  const apiRequest = async (endpoint: string, options: RequestInit = {}) => {
    if (!token) {
      throw new Error('No authentication token available');
    }
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    };
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });
    if (!response.ok) {
      let errorMessage = `API error: ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorMessage;
      } catch (e) {}
      throw new Error(errorMessage);
    }
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  };

  // Function to refresh user and token context
  const refreshContext = async () => {
    try {
      setLoading(true);
      setError(null);
      const supabase = createClient();
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        setUser(null);
        setToken(null);
        setLoading(false);
        return;
      }
      setToken(sessionData.session.access_token);
      // Option 1: Get user from Supabase directly
      // const { data: { user: supabaseUser } } = await supabase.auth.getUser();
      // if (supabaseUser) setUser({ id: supabaseUser.id, email: supabaseUser.email! });
      // Option 2: Fetch minimal user context if still needed
      try {
        const response = await fetch('/api/auth/get-user-context');
        if (response.ok) {
          const context = await response.json();
          setUser(context.user);
        } else {
          console.warn("Failed to fetch user context");
        }
      } catch (fetchErr) {
        console.error("Error fetching user context", fetchErr);
      }
    } catch (err) {
      console.error('[refreshContext] Error refreshing context:', err);
      setError(err instanceof Error ? err.message : 'Failed to refresh context');
      setUser(null);
      setToken(null);
    } finally {
      setLoading(false);
    }
  };

  // Initialize context on mount
  useEffect(() => {
    refreshContext();
    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      refreshContext();
    });
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Context value to provide
  const contextValue: ApiContextType = {
    user,
    token,
    loading,
    error,
    refreshContext,
    apiRequest,
  };

  return (
    <ApiContext.Provider value={contextValue}>
      {children}
    </ApiContext.Provider>
  );
} 
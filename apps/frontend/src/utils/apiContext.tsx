"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authClient } from './auth/client';
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
  isPlatformAdmin: boolean;
  refreshContext: () => Promise<void>;
  apiRequest: (endpoint: string, options?: RequestInit) => Promise<any>;
}

// Create the context with default values
const ApiContext = createContext<ApiContextType>({
  user: null,
  token: null,
  loading: true,
  error: null,
  isPlatformAdmin: false,
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
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const sessionState = authClient.useSession();

  // Standard API request function with auth token
  const apiRequest = async (endpoint: string, options: RequestInit = {}) => {
    const headers = {
      'Content-Type': 'application/json',
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
      if (!sessionState.data?.user) {
        setUser(null);
        setToken(null);
        setIsPlatformAdmin(false);
        setLoading(false);
        return;
      }

      setToken(null);
      // Fetch the application user context from the backend.
      try {
        const response = await fetch('/api/auth/get-user-context');
        if (response.ok) {
          const context = await response.json();
          setUser(context.user ?? null);
          const ctx: any = context.user ?? context;
          setIsPlatformAdmin(
            Boolean(
              ctx?.isPlatformAdmin ??
              ctx?.isAdmin ??
              context?.isPlatformAdmin ??
              context?.isAdmin ??
              false
            )
          );
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
      setIsPlatformAdmin(false);

    } finally {
      setLoading(false);
    }
  };

  // Initialize context on mount
  useEffect(() => {
    void refreshContext();
  }, [sessionState.data?.user?.id, sessionState.isPending]);

  // Context value to provide
  const contextValue: ApiContextType = {
    user,
    token,
    loading,
    error,
    isPlatformAdmin,
    refreshContext,
    apiRequest,
  };

  return (
    <ApiContext.Provider value={contextValue}>
      {children}
    </ApiContext.Provider>
  );
}
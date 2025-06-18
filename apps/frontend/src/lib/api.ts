/**
 * Get the backend API URL based on the environment
 */
export function getBackendUrl(): string {
  // Check if we're in a browser environment
  if (typeof window !== 'undefined') {
    // In development, we use the local backend
    if (process.env.NODE_ENV === 'development') {
      return 'http://localhost:4000';
    }
    
    // In production, we use the same host as the frontend
    return `${window.location.protocol}//${window.location.host}`;
  }
  
  // In server-side rendering, use environment variables
  return process.env.BACKEND_URL || 'http://localhost:4000';
} 
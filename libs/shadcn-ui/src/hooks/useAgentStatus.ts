import { useState, useEffect, useCallback } from 'react';
import { agentApiClient } from '../../../apps/frontend/src/utils/AgentApi';

interface UseAgentStatusProps {
  agentId: string;
}

export const useAgentStatus = ({ agentId }: UseAgentStatusProps) => {
  const [isAgentPublished, setIsAgentPublished] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  const checkAgentPublished = useCallback(async () => {
    if (!agentId) {
      setIsAgentPublished(false);
      setIsLoading(false);
      return false;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      
      const agent = await agentApiClient.getAgent(agentId);
      const isPublished = !!agent.isPublished;
      
      setIsAgentPublished(isPublished);
      setIsLoading(false);
      
      return isPublished;
    } catch (err) {
      console.error('Error checking agent publish status:', err);
      setError(err as Error);
      setIsAgentPublished(false);
      setIsLoading(false);
      return false;
    }
  }, [agentId]);
  
  // Check status on mount
  useEffect(() => {
    checkAgentPublished();
  }, [checkAgentPublished]);
  
  return {
    isAgentPublished,
    isLoading,
    error,
    checkAgentPublished
  };
};

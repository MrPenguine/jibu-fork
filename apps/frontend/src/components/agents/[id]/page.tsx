"use client";

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function AgentRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const agentId = params.id as string;

  useEffect(() => {
    // Redirect to the workflows section of the CMS page
    router.push(`/agents/${agentId}/cms/workflows`);
  }, [agentId, router]);

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <div className="mb-4">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
        </div>
        <p className="text-gray-600">Redirecting to agent configuration...</p>
      </div>
    </div>
  );
}

"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function AgentRootPage() {
  const params = useParams();
  const router = useRouter();
  const agentId = params?.agentId as string;

  useEffect(() => {
    if (agentId) {
      router.replace(`/agent/${agentId}/config`);
    } else {
      router.replace("/workspace");
    }
  }, [agentId, router]);

  return null;
}

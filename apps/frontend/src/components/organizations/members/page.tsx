"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useWorkspace } from "../../../../utils/workspaceContext"

export default function MembersPage() {
  const router = useRouter();
  const { activeWorkspace, loading } = useWorkspace();
  
  useEffect(() => {
    if (!loading && activeWorkspace?.id) {
      router.replace(`/workspace/${activeWorkspace.id}/settings/members`);
    }
  }, [loading, activeWorkspace?.id, router]);
  
  return null;
}

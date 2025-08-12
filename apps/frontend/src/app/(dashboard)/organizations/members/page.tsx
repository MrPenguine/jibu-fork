"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useOrganization } from "../../../../utils/organizationContext"

export default function MembersPage() {
  const router = useRouter();
  const { activeOrganization, loading } = useOrganization();
  
  useEffect(() => {
    if (!loading && activeOrganization?.id) {
      router.replace(`/workspace/${activeOrganization.id}/settings/members`);
    }
  }, [loading, activeOrganization?.id, router]);
  
  return null;
}

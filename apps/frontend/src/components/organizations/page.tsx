 "use client";
 
 import { useEffect } from "react";
 import { useRouter } from "next/navigation";
 import { useOrganization } from "../../../utils/organizationContext";
 
 export default function OrganizationsPage() {
   const router = useRouter();
   const { activeOrganization, loading } = useOrganization();
 
   useEffect(() => {
     if (!loading && activeOrganization?.id) {
       router.replace(`/workspace/${activeOrganization.id}/settings`);
     }
   }, [loading, activeOrganization?.id, router]);
 
   return null;
 }

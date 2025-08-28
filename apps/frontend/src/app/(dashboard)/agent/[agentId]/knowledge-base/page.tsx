"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  KnowledgeBaseHeader,
  KnowledgeBaseEmptyState,
  KnowledgeBaseList,
  type KnowledgeBaseSource,
  CreateFolderDialog,
  UrlImportDialog,
  type UrlImportPayload,
  SitemapImportDialog,
  type SitemapImportPayload,
  UploadFileDialog,
  type UploadFilePayload,
  PlainTextDialog,
  type PlainTextPayload,
} from "@libs/shadcn-ui";
import { Skeleton } from "@libs/shadcn-ui/components/ui/skeleton";

export default function AgentKnowledgeBasePage() {
  const params = useParams<{ agentId: string }>();
  const agentId = (params?.agentId as string) || "";
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [preview, setPreview] = useState(false);
  const [sources, setSources] = useState<KnowledgeBaseSource[]>([]);
  const [openCreateFolder, setOpenCreateFolder] = useState(false);
  const [openUrl, setOpenUrl] = useState(false);
  const [openSitemap, setOpenSitemap] = useState(false);
  const [openUpload, setOpenUpload] = useState(false);
  const [openPlainText, setOpenPlainText] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!agentId) {
        router.push("/workspace");
        return;
      }
      setIsLoading(true);
      try {
        // If backend endpoint exists, wire it here. For now, keep empty list to match the provided design.
        // Example:
        // const res = await fetchAPI(`/v1/agents/${agentId}/knowledge-base/sources`);
        // setSources(res?.items || []);
        setSources([]);
      } catch (e) {
        console.error("Failed to load knowledge base sources:", e);
        setSources([]);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [agentId, router]);

  const filtered = useMemo(() => {
    if (!search) return sources;
    const q = search.toLowerCase();
    return sources.filter((s) => s.name.toLowerCase().includes(q) || s.type.toLowerCase().includes(q));
  }, [sources, search]);

  const openCreateFolderDialog = () => setOpenCreateFolder(true);

  if (isLoading) {
    return (
      <div className="w-full px-6 pb-6 pt-0">
        <Skeleton className="h-10 w-1/3" />
        <div className="mt-6">
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <KnowledgeBaseHeader
        search={search}
        onSearchChange={setSearch}
        preview={preview}
        onTogglePreview={setPreview}
        onPickUrls={() => setOpenUrl(true)}
        onPickSitemap={() => setOpenSitemap(true)}
        onPickUpload={() => setOpenUpload(true)}
        onPickPlainText={() => setOpenPlainText(true)}
      />

      <div className="px-6 pb-6">
        {filtered.length === 0 ? (
          <KnowledgeBaseEmptyState
            onCreateFolder={openCreateFolderDialog}
            onPickUrls={() => setOpenUrl(true)}
            onPickSitemap={() => setOpenSitemap(true)}
            onPickUpload={() => setOpenUpload(true)}
            onPickPlainText={() => setOpenPlainText(true)}
          />
        ) : (
          <KnowledgeBaseList sources={filtered} onCreateFolder={openCreateFolderDialog} />
        )}
      </div>

      {/* Dialogs */}
      <CreateFolderDialog open={openCreateFolder} onOpenChange={setOpenCreateFolder} onCreate={(name: string) => {
        console.log('Create folder:', name);
        setOpenCreateFolder(false);
      }} />
      <UrlImportDialog open={openUrl} onOpenChange={setOpenUrl} onImport={(payload: UrlImportPayload) => {
        console.log('Import URLs:', payload, 'agent', agentId);
        setOpenUrl(false);
      }} />
      <SitemapImportDialog open={openSitemap} onOpenChange={setOpenSitemap} onImport={(payload: SitemapImportPayload) => {
        console.log('Sitemap import:', payload, 'agent', agentId);
        setOpenSitemap(false);
      }} />
      <UploadFileDialog open={openUpload} onOpenChange={setOpenUpload} onImport={(payload: UploadFilePayload) => {
        console.log('Upload files:', payload, 'agent', agentId);
        setOpenUpload(false);
      }} />
      <PlainTextDialog open={openPlainText} onOpenChange={setOpenPlainText} onImport={(payload: PlainTextPayload) => {
        console.log('Plain text import:', payload, 'agent', agentId);
        setOpenPlainText(false);
      }} />
    </div>
  );
}

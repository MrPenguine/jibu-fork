"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { listKnowledgeBases, createKnowledgeBase, listFoldersForKb, createFolderForKb, deleteFolderForKb, linkFileToKnowledgeBase, listKnowledgeBaseSources, deleteSourceFromKb } from "../../../../../utils/knowledgebaseApi";
import { uploadFile, getFileDownloadUrl } from "../../../../../utils/fileApi";
import { useWorkspace } from "../../../../../utils/workspaceContext";
import { toast } from "@libs/shadcn-ui/components/ui/use-toast";
import {
  KnowledgeBaseHeader,
  KnowledgeBaseEmptyState,
  KnowledgeBaseList,
  type KnowledgeBaseSource,
  FolderCard,
  CreateFolderDialog,
  UrlImportDialog,
  type UrlImportPayload,
  SitemapImportDialog,
  type SitemapImportPayload,
  UploadFileDialog,
  type UploadFilePayload,
  PlainTextDialog,
  type PlainTextPayload,
  KnowledgeBasePreviewDialog,
  KnowledgeBaseSettingsDialog,
  KnowledgeBaseTester,
  ZendeskDialog,
  KnowledgeApiDialog,
} from "@libs/shadcn-ui";
import { Skeleton } from "@libs/shadcn-ui/components/ui/skeleton";
import { Button } from "@libs/shadcn-ui/components/ui/button";
import { FileText, Download, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@libs/shadcn-ui/components/ui/alert-dialog";

export default function AgentKnowledgeBasePage() {
  const params = useParams<{ agentId: string }>();
  const agentId = (params?.agentId as string) || "";
  const router = useRouter();
  const { activeWorkspace } = useWorkspace();

  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [preview, setPreview] = useState(false);
  const [sources, setSources] = useState<KnowledgeBaseSource[]>([]);
  const [knowledgeBaseId, setKnowledgeBaseId] = useState<string | null>(null);
  const [folders, setFolders] = useState<{ id: string; name: string }[]>([]);
  const [openCreateFolder, setOpenCreateFolder] = useState(false);
  const [openUrl, setOpenUrl] = useState(false);
  const [openSitemap, setOpenSitemap] = useState(false);
  const [openUpload, setOpenUpload] = useState(false);
  const [openPlainText, setOpenPlainText] = useState(false);
  const [openPreview, setOpenPreview] = useState(false);
  const [openSettings, setOpenSettings] = useState(false);
  const [openZendesk, setOpenZendesk] = useState(false);
  const [openKnowledgeApi, setOpenKnowledgeApi] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<string | undefined>(undefined);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [allSourcesExpanded, setAllSourcesExpanded] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!agentId) {
        router.push("/workspace");
        return;
      }
      setIsLoading(true);
      try {
        // Get or create a knowledge base for this workspace
        // TODO: Link agent to specific KB once backend relationship is established
        let kbs = await listKnowledgeBases();
        let kbId: string;
        
        if (kbs.length === 0) {
          // Create a default knowledge base
          const newKb = await createKnowledgeBase(`KB for Agent ${agentId}`);
          kbId = newKb.id;
        } else {
          // Use the first available KB for now
          kbId = kbs[0].id;
        }
        
        setKnowledgeBaseId(kbId);
        
        // Load folders for this KB
        await loadFolders(kbId);
        
        // Load sources for this KB
        await loadSources(kbId);
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

  const loadFolders = async (kbId: string) => {
    try {
      const folderList = await listFoldersForKb(kbId);
      console.log('[loadFolders] Loaded folders:', folderList);
      setFolders(folderList);
    } catch (e) {
      console.error("Failed to load folders:", e);
      setFolders([]);
    }
  };

  const loadSources = async (kbId: string) => {
    try {
      const sourcesList = await listKnowledgeBaseSources(kbId);
      console.log('[loadSources] Loaded sources:', sourcesList);
      
      // Map API response to component format
      const mappedSources = sourcesList.map((source: any) => ({
        id: source.id,
        name: source.file?.name || 'Unknown',
        type: source.sourceType || 'file',
        folder: source.folder,
        fileId: source.file?.id,
        mimeType: source.file?.mimeType,
        sizeBytes: source.file?.sizeBytes,
        indexingStatus: source.indexingStatus,
        createdAt: source.createdAt,
      }));
      
      setSources(mappedSources);
    } catch (e) {
      console.error("Failed to load sources:", e);
      setSources([]);
    }
  };

  const handleCreateFolder = async (name: string) => {
    if (!knowledgeBaseId) {
      toast({
        title: "Error",
        description: "Knowledge base not initialized",
        variant: "destructive",
      });
      return;
    }
    
    try {
      console.log('[handleCreateFolder] Creating folder:', name, 'for KB:', knowledgeBaseId);
      const newFolder = await createFolderForKb(knowledgeBaseId, name);
      console.log('[handleCreateFolder] Created folder:', newFolder);
      if (newFolder) {
        toast({
          title: "Success",
          description: `Folder "${name}" created successfully`,
        });
        // Refresh folder list
        console.log('[handleCreateFolder] Refreshing folders...');
        await loadFolders(knowledgeBaseId);
        console.log('[handleCreateFolder] Folders after refresh:', folders);
        setOpenCreateFolder(false);
      } else {
        toast({
          title: "Error",
          description: "Failed to create folder",
          variant: "destructive",
        });
      }
    } catch (e) {
      console.error("Error creating folder:", e);
      toast({
        title: "Error",
        description: "Failed to create folder",
        variant: "destructive",
      });
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    if (!knowledgeBaseId) {
      toast({
        title: "Error",
        description: "Knowledge base not initialized",
        variant: "destructive",
      });
      return;
    }

    try {
      const success = await deleteFolderForKb(knowledgeBaseId, folderId);
      if (success) {
        toast({
          title: "Success",
          description: "Folder deleted successfully",
        });
        // Refresh folder list
        await loadFolders(knowledgeBaseId);
      } else {
        toast({
          title: "Error",
          description: "Failed to delete folder",
          variant: "destructive",
        });
      }
    } catch (e) {
      console.error("Error deleting folder:", e);
      toast({
        title: "Error",
        description: "Failed to delete folder",
        variant: "destructive",
      });
    }
  };

  const handleUploadFiles = async (payload: UploadFilePayload) => {
    if (!knowledgeBaseId) {
      toast({
        title: "Error",
        description: "Knowledge base not initialized",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    let successCount = 0;
    let failCount = 0;

    try {
      // Upload each file
      for (const file of payload.files) {
        try {
          console.log('[handleUploadFiles] Uploading file:', file.name);
          console.log('[handleUploadFiles] Payload folderId:', payload.folderId);
          
          // Upload file to storage with workspace context
          const uploadedFile = await uploadFile(file, undefined, activeWorkspace?.id);
          console.log('[handleUploadFiles] File uploaded:', uploadedFile);

          // Link file to knowledge base with optional folder
          // Support both UUID and CUID formats
          let validFolderId: string | undefined = undefined;
          if (payload.folderId && payload.folderId.trim() !== '') {
            const trimmedFolderId = payload.folderId.trim();
            // UUID format: 8-4-4-4-12 characters (e.g., 550e8400-e29b-41d4-a716-446655440000)
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            // CUID format: c + timestamp + counter + fingerprint (e.g., cjld2cjxh0000qzrmn831i7rn)
            const cuidRegex = /^c[a-z0-9]{24,}$/i;
            
            if (uuidRegex.test(trimmedFolderId) || cuidRegex.test(trimmedFolderId)) {
              validFolderId = trimmedFolderId;
            } else {
              console.warn('[handleUploadFiles] Invalid folder ID format:', trimmedFolderId);
            }
          }
          console.log('[handleUploadFiles] Validated folderId:', validFolderId);
          
          await linkFileToKnowledgeBase(
            knowledgeBaseId,
            uploadedFile.id,
            undefined,
            validFolderId
          );
          console.log('[handleUploadFiles] File linked to KB');

          successCount++;
        } catch (error: any) {
          console.error('[handleUploadFiles] Error uploading file:', file.name, error);
          console.error('[handleUploadFiles] Error details:', error?.message || error);
          failCount++;
        }
      }

      // Show result toast
      if (successCount > 0) {
        toast({
          title: "Success",
          description: `${successCount} file(s) uploaded successfully${failCount > 0 ? `, ${failCount} failed` : ''}`,
        });
        
        // Refresh sources list
        await loadSources(knowledgeBaseId);
      } else {
        toast({
          title: "Error",
          description: "Failed to upload files",
          variant: "destructive",
        });
      }

      setOpenUpload(false);
    } catch (error) {
      console.error('[handleUploadFiles] Upload error:', error);
      toast({
        title: "Error",
        description: "Failed to upload files",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteSource = async (sourceId: string) => {
    if (!knowledgeBaseId) {
      toast({
        title: "Error",
        description: "Knowledge base not initialized",
        variant: "destructive",
      });
      return;
    }

    try {
      const success = await deleteSourceFromKb(knowledgeBaseId, sourceId);
      if (success) {
        toast({
          title: "Success",
          description: "Source deleted successfully",
        });
        // Refresh sources list
        await loadSources(knowledgeBaseId);
      } else {
        toast({
          title: "Error",
          description: "Failed to delete source",
          variant: "destructive",
        });
      }
    } catch (e) {
      console.error("Error deleting source:", e);
      toast({
        title: "Error",
        description: "Failed to delete source",
        variant: "destructive",
      });
    }
  };

  const handleDownloadFile = async (fileId: string, fileName: string) => {
    try {
      console.log('[handleDownloadFile] Downloading file:', fileId, fileName);
      
      // Get download URL from backend using fileApi
      const downloadUrl = await getFileDownloadUrl(fileId, activeWorkspace?.id);
      console.log('[handleDownloadFile] Got download URL, opening...');
      
      // Open download URL in new tab (browser will handle the download)
      window.open(downloadUrl, '_blank');

      toast({
        title: "Success",
        description: `Downloading ${fileName}...`,
      });
    } catch (e: any) {
      console.error("Error downloading file:", e);
      toast({
        title: "Error",
        description: e.message || "Failed to download file",
        variant: "destructive",
      });
    }
  };

  const openCreateFolderDialog = () => setOpenCreateFolder(true);

  const handleAddSourceToFolder = (folderId: string) => {
    console.log('[handleAddSourceToFolder] Opening upload dialog for folder:', folderId);
    setSelectedFolderId(folderId);
    setOpenUpload(true);
  };

  const handleToggleFolderExpand = (folderId: string, expanded: boolean) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (expanded) {
        newSet.add(folderId);
      } else {
        newSet.delete(folderId);
      }
      return newSet;
    });
  };

  const getFileCountForFolder = (folderId: string): number => {
    return sources.filter(s => s.folder?.id === folderId).length;
  };

  const getFilesForFolder = (folderId: string) => {
    return sources.filter(s => s.folder?.id === folderId);
  };

  const handleToggleAllSources = () => {
    setAllSourcesExpanded(prev => !prev);
  };

  // When header toggles preview, open/close the preview dialog (UI only)
  const handleTogglePreview = (v: boolean) => {
    setPreview(v);
    setOpenPreview(v);
  };

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
        onTogglePreview={handleTogglePreview}
        onPickUrls={() => setOpenUrl(true)}
        onPickSitemap={() => setOpenSitemap(true)}
        onPickUpload={() => setOpenUpload(true)}
        onPickPlainText={() => setOpenPlainText(true)}
        onOpenSettings={() => setOpenSettings(true)}
        onPickZendesk={() => setOpenZendesk(true)}
        onOpenKnowledgeApi={() => setOpenKnowledgeApi(true)}
      />

      <div className="px-6 pb-6 space-y-6">
        {/* Folders Section */}
        {folders.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Folders</h2>
              <button
                onClick={openCreateFolderDialog}
                className="text-sm text-primary hover:underline"
              >
                + Create folder
              </button>
            </div>
            <div className="grid gap-3">
              {folders.map((folder) => {
                const folderFiles = getFilesForFolder(folder.id);
                const isExpanded = expandedFolders.has(folder.id);
                
                return (
                  <FolderCard
                    key={folder.id}
                    id={folder.id}
                    name={folder.name}
                    fileCount={getFileCountForFolder(folder.id)}
                    onDelete={handleDeleteFolder}
                    onAddSource={handleAddSourceToFolder}
                    onToggleExpand={handleToggleFolderExpand}
                    isExpanded={isExpanded}
                  >
                    {folderFiles.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b bg-muted/50">
                              <th className="text-left p-3 font-semibold">File Name</th>
                              <th className="text-left p-3 font-semibold">Type</th>
                              <th className="text-left p-3 font-semibold">File Size</th>
                              <th className="text-left p-3 font-semibold">Date Uploaded</th>
                              <th className="text-right p-3 font-semibold">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {folderFiles.map((source) => (
                              <tr key={source.id} className="border-b hover:bg-muted/30 transition-colors">
                                <td className="p-3">
                                  <div className="flex items-center gap-2">
                                    <FileText className="h-4 w-4 text-slate-500 flex-shrink-0" />
                                    <span className="font-medium truncate">{source.name}</span>
                                  </div>
                                </td>
                                <td className="p-3 text-slate-600">{source.type || 'N/A'}</td>
                                <td className="p-3 text-slate-600">
                                  {source.sizeBytes ? (() => {
                                    const bytes = source.sizeBytes;
                                    const k = 1024;
                                    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
                                    const i = Math.floor(Math.log(bytes) / Math.log(k));
                                    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
                                  })() : 'N/A'}
                                </td>
                                <td className="p-3 text-slate-600">
                                  {source.createdAt ? new Date(source.createdAt).toLocaleDateString() : 'N/A'}
                                </td>
                                <td className="p-3">
                                  <div className="flex gap-2 justify-end">
                                    {source.fileId && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8"
                                        onClick={() => handleDownloadFile(source.fileId!, source.name)}
                                      >
                                        <Download className="h-3 w-3 mr-1" />
                                        Download
                                      </Button>
                                    )}
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button variant="outline" size="sm" className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10">
                                          <Trash2 className="h-3 w-3 mr-1" />
                                          Delete
                                        </Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>Delete source?</AlertDialogTitle>
                                          <AlertDialogDescription>
                                            Are you sure you want to delete "{source.name}"? This action cannot be undone.
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                                          <AlertDialogAction onClick={() => handleDeleteSource(source.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                            Delete
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No files in this folder yet
                      </p>
                    )}
                  </FolderCard>
                );
              })}
            </div>
          </div>
        )}

        {/* Sources Section */}
        {filtered.length === 0 ? (
          <KnowledgeBaseEmptyState
            onCreateFolder={openCreateFolderDialog}
            onPickUrls={() => setOpenUrl(true)}
            onPickSitemap={() => setOpenSitemap(true)}
            onPickUpload={() => setOpenUpload(true)}
            onPickPlainText={() => setOpenPlainText(true)}
            onPickZendesk={() => setOpenZendesk(true)}
            onOpenKnowledgeApi={() => setOpenKnowledgeApi(true)}
          />
        ) : (
          <KnowledgeBaseList 
            sources={filtered} 
            onCreateFolder={openCreateFolderDialog}
            onDelete={handleDeleteSource}
            onDownload={handleDownloadFile}
            isExpanded={allSourcesExpanded}
            onToggleExpand={handleToggleAllSources}
          />
        )}
      </div>

      {/* Dialogs */}
      <CreateFolderDialog open={openCreateFolder} onOpenChange={setOpenCreateFolder} onCreate={handleCreateFolder} />
      <UrlImportDialog open={openUrl} onOpenChange={setOpenUrl} onImport={(payload: UrlImportPayload) => {
        console.log('Import URLs:', payload, 'agent', agentId);
        setOpenUrl(false);
      }} />
      <SitemapImportDialog open={openSitemap} onOpenChange={setOpenSitemap} onImport={(payload: SitemapImportPayload) => {
        console.log('Sitemap import:', payload, 'agent', agentId);
        setOpenSitemap(false);
      }} />
      <UploadFileDialog
        open={openUpload}
        onOpenChange={(open) => {
          setOpenUpload(open);
          if (!open) {
            // Clear selected folder when dialog closes
            setSelectedFolderId(undefined);
          }
        }}
        folders={folders}
        preselectedFolderId={selectedFolderId}
        onOpenCreateFolder={() => {
          console.log('[UploadFileDialog] Opening create folder dialog, current folders:', folders);
          setOpenCreateFolder(true);
        }}
        onImport={handleUploadFiles}
      />
      <PlainTextDialog open={openPlainText} onOpenChange={setOpenPlainText} onImport={(payload: PlainTextPayload) => {
        console.log('Plain text import:', payload, 'agent', agentId);
        setOpenPlainText(false);
      }} />

      {/* Preview and Settings (UI only) */}
      <KnowledgeBasePreviewDialog
        open={openPreview}
        onOpenChange={(v) => { setOpenPreview(v); if (!v) setPreview(false); }}
      />
      <KnowledgeBaseSettingsDialog
        open={openSettings}
        onOpenChange={setOpenSettings}
      />

      {/* Floating tester button and right-sheet demo chat (UI only) */}
      <KnowledgeBaseTester />

      {/* Integrations & API (UI only) */}
      <ZendeskDialog open={openZendesk} onOpenChange={setOpenZendesk} />
      <KnowledgeApiDialog open={openKnowledgeApi} onOpenChange={setOpenKnowledgeApi} />
    </div>
  );
}

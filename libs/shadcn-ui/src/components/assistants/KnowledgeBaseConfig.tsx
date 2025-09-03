"use client"

import { useState, useEffect, useCallback } from "react"
import {
  KnowledgeBase,
  KnowledgeBaseSource,
  listKnowledgeBases,
  listKnowledgeBaseSources,
  linkFileToKnowledgeBase,
  createKnowledgeBase,
  unlinkFileFromKnowledgeBase,
  linkKnowledgeBaseToAssistant
} from '../../../../../apps/frontend/src/utils/knowledgebaseApi'
import { 
  FileResponse, 
  listFiles 
} from '../../../../../apps/frontend/src/utils/fileApi'
import { API_BASE_URL, fetchAPI } from '../../../../../apps/frontend/src/utils/api'
import {
  Loader2,
  ChevronDown,
  ChevronsUpDown,
  Book,
  FileText,
  FilePlus2,
  File,
  ExternalLink,
  Plus,
  X,
  Search,
  Check,
  Edit3,
  RefreshCw
} from "lucide-react"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@libs/shadcn-ui/components/ui/accordion"
import { Button } from "@libs/shadcn-ui/components/ui/button"
import { Badge } from "@libs/shadcn-ui/components/ui/badge"
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@libs/shadcn-ui/components/ui/dialog"
import { Input } from "@libs/shadcn-ui/components/ui/input"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@libs/shadcn-ui/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@libs/shadcn-ui/components/ui/popover"
import { Card, CardContent, CardHeader, CardTitle } from "@libs/shadcn-ui/components/ui/card"
import { cn } from "@libs/shadcn-ui/lib/utils"
import { toast } from "@libs/shadcn-ui/components/ui/use-toast"
import { useWorkspace } from '../../../../../apps/frontend/src/utils/workspaceContext'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider
} from "@libs/shadcn-ui/components/ui/tooltip"
import { createClient } from '../../../../../apps/frontend/src/utils/supabase/client'

interface KnowledgeBaseConfigProps {
  assistantId?: string;
  knowledgeBaseId?: string;
  workspaceId?: string; // Optional explicit workspace override
  onKnowledgeBaseChange?: (knowledgeBaseId: string | null, knowledgeBaseName?: string) => void;
  maxFileHeight?: number; // Maximum number of files to show before scrolling
  showEditControls?: boolean; // Whether to show edit controls by default
  standalone?: boolean; // Whether this component is used standalone (not in assistant page)
}

// Define explicit types for our knowledge base data
type KnowledgeBaseInfo = KnowledgeBase;

type FileInfo = {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
};

type KnowledgeBaseSourceWithFile = KnowledgeBaseSource & {
  file?: FileInfo;
};

export function KnowledgeBaseConfig({
  assistantId,
  knowledgeBaseId,
  workspaceId: propWorkspaceId, // optional override
  onKnowledgeBaseChange,
  maxFileHeight = 4, // Default to 4 files before scrolling
  showEditControls = false, // Default to not showing edit controls
  standalone = false // Default to not standalone mode
}: KnowledgeBaseConfigProps) {
  // Get workspace from context
  const { activeWorkspace } = useWorkspace();
  
  // Use workspace ID from context if available, fallback to prop
  const workspaceId = activeWorkspace?.id || propWorkspaceId;
  
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBaseInfo[]>([])
  const [activeKnowledgeBase, setActiveKnowledgeBase] = useState<KnowledgeBaseInfo | null>(null)
  const [knowledgeBaseSources, setKnowledgeBaseSources] = useState<KnowledgeBaseSourceWithFile[]>([])
  const [isLoadingSources, setIsLoadingSources] = useState(false)
  const [sourcesError, setSourcesError] = useState<string | null>(null)
  const [isEditMode, setIsEditMode] = useState(showEditControls)
  
  // UI state
  const [openCombobox, setOpenCombobox] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [newKbName, setNewKbName] = useState("")
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isCreatingKb, setIsCreatingKb] = useState(false)
  const [workspaceFiles, setWorkspaceFiles] = useState<FileResponse[]>([])
  const [isLoadingFiles, setIsLoadingFiles] = useState(false)
  const [fileSearchQuery, setFileSearchQuery] = useState("")
  const [isUnlinkingFile, setIsUnlinkingFile] = useState(false)
  const [isLinkingKnowledgeBase, setIsLinkingKnowledgeBase] = useState(false)
  const [isUnlinkingKnowledgeBase, setIsUnlinkingKnowledgeBase] = useState(false)
  
  // Fetch all knowledge bases
  const fetchKnowledgeBases = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      console.log(`[KnowledgeBaseConfig] Fetching knowledge bases with workspaceId: ${workspaceId || 'none'}`);
      console.log(`[KnowledgeBaseConfig] Workspace source: ${activeWorkspace ? 'context' : 'prop'}`);
      
      // Fetch knowledge bases for the workspace
      const kbs = await listKnowledgeBases(workspaceId);
      console.log(`[KnowledgeBaseConfig] Retrieved ${kbs.length} knowledge bases`);
      
      setKnowledgeBases(kbs as KnowledgeBaseInfo[]);
      return kbs;
    } catch (err: any) {
      console.error("[KnowledgeBaseConfig] Error fetching knowledge bases:", err);
      setError(`Failed to fetch knowledge bases: ${err?.message || 'Unknown error'}`);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, activeWorkspace]);
  
  // Fetch knowledge base sources
  const fetchKnowledgeBaseSources = useCallback(async (kbId: string) => {
    if (!kbId) return [];
    
    try {
      setIsLoadingSources(true);
      setSourcesError(null);
      
      console.log(`[KnowledgeBaseConfig] Fetching sources for knowledge base ${kbId}`);
      
      // Fetch sources for the workspace
      const sources = await listKnowledgeBaseSources(kbId, workspaceId);
      console.log(`[KnowledgeBaseConfig] Retrieved ${sources.length} sources for knowledge base ${kbId}`);
      
      setKnowledgeBaseSources(sources as KnowledgeBaseSourceWithFile[]);
      return sources;
    } catch (err: any) {
      console.error(`[KnowledgeBaseConfig] Error fetching sources for knowledge base ${kbId}:`, err);
      setSourcesError(`Failed to fetch sources: ${err?.message || 'Unknown error'}`);
      return [];
    } finally {
      setIsLoadingSources(false);
    }
  }, [workspaceId]);
  
  // Load files for the workspace using the consistent workspace ID
  const loadWorkspaceFiles = useCallback(async () => {
    try {
      setIsLoadingFiles(true);
      
      console.log(`[KnowledgeBaseConfig] Loading files for workspace ID: ${workspaceId || 'none'}, source: ${activeWorkspace ? 'context' : 'prop'}`);
      
      // Load files for the current workspace
      const files = await listFiles(1, 100, workspaceId);
      console.log(`[KnowledgeBaseConfig] Loaded ${files.length} files for workspace`);
      
      setWorkspaceFiles(files);
    } catch (err: any) {
      console.error("[KnowledgeBaseConfig] Error loading files:", err);
      toast({
        title: "Error",
        description: `Failed to load files: ${err?.message || 'Unknown error'}`,
        variant: "destructive"
      });
    } finally {
      setIsLoadingFiles(false);
    }
  }, [workspaceId, activeWorkspace]);
  
  // Load knowledge bases on mount
  useEffect(() => {
    fetchKnowledgeBases();
  }, [fetchKnowledgeBases]);
  
  // Find and set active knowledge base when knowledgeBaseId changes
  useEffect(() => {
    if (knowledgeBaseId && knowledgeBases.length > 0) {
      const kb = knowledgeBases.find(kb => kb.id === knowledgeBaseId);
      setActiveKnowledgeBase(kb || null);
      
      if (kb) {
        fetchKnowledgeBaseSources(knowledgeBaseId);
      }
    } else {
      setActiveKnowledgeBase(null);
      setKnowledgeBaseSources([]);
    }
  }, [knowledgeBaseId, knowledgeBases, fetchKnowledgeBaseSources]);
  
  // Load files when edit mode is enabled
  useEffect(() => {
    if (isEditMode) {
      loadWorkspaceFiles();
    }
  }, [isEditMode, loadWorkspaceFiles]);

  // Filter knowledge bases based on search query
  const filteredKnowledgeBases = knowledgeBases
    .filter(kb => 
      kb.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    
  // Create new entry for "Create new knowledge base"
  const comboboxOptions = [
    { id: "create-new", name: "Create New Knowledge Base" },
    ...filteredKnowledgeBases
  ];

  // Direct function to handle Remove button clicks
  const handleRemoveButtonClick = async (source: KnowledgeBaseSource) => {
    if (!knowledgeBaseId) return;
    
    setIsUnlinkingFile(true);
    console.log(`[KnowledgeBaseConfig] Removing source ${source.id} from knowledge base ${knowledgeBaseId}`);
    console.log(`[KnowledgeBaseConfig] Using workspace ID: ${workspaceId || 'none'}, source: ${activeWorkspace ? 'context' : 'prop'}`);
    
    try {
      // Update UI immediately for better UX
      setKnowledgeBaseSources(prevSources => prevSources.filter(s => 
        !((s as KnowledgeBaseSource).id === source.id ||
          (s as KnowledgeBaseSource).sourceId === source.sourceId)
      ));
      
      try {
        // Make API call to unlink the file
        await unlinkFileFromKnowledgeBase(knowledgeBaseId, source.id, workspaceId);
        console.log(`[KnowledgeBaseConfig] Successfully unlinked source ${source.id}`);
        
        // Refresh knowledge base sources from server to ensure UI is up-to-date
        if (knowledgeBaseId) {
          const refreshedSources = await listKnowledgeBaseSources(knowledgeBaseId, workspaceId);
          setKnowledgeBaseSources(refreshedSources);
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes('404')) {
          // If we get a 404, the source is already gone, which is fine
          console.warn(`[KnowledgeBaseConfig] Source ${source.id} was not found (404), treating as already removed`);
        } else {
          console.error(`[KnowledgeBaseConfig] Error unlinking file:`, error);
          // Re-throw to be caught by outer try/catch
          throw error;
        }
      }
      
    } catch (error) {
      console.error(`[KnowledgeBaseConfig] Failed to remove source:`, error);
      toast({
        title: "Error removing file",
        description: "Could not remove the file from the knowledge base. Please try again.",
        variant: "destructive"
      });
      
      // Restore the original files in UI if API call failed
      if (knowledgeBaseId) {
        const refreshedSources = await listKnowledgeBaseSources(knowledgeBaseId, workspaceId);
        setKnowledgeBaseSources(refreshedSources);
      }
    } finally {
      setIsUnlinkingFile(false);
    }
  };
  
  // Function to handle knowledge base selection - supporting both standalone and assistant modes
  const handleSelectKnowledgeBase = async (knowledgeBaseId: string) => {
    // Check if this is the special "create-new" option
    if (knowledgeBaseId === "create-new") {
      setIsCreateDialogOpen(true);
      setOpenCombobox(false);
      return;
    }
    
    // Get the knowledge base name for the callback
    const selectedKB = knowledgeBases.find(kb => kb.id === knowledgeBaseId);
    const knowledgeBaseName = selectedKB?.name;

    try {
      // If no assistantId is provided or in standalone mode, just update the selected knowledge base
      if (!assistantId || standalone) {
        console.log(`[KnowledgeBaseConfig] Selecting knowledge base ${knowledgeBaseId} in standalone mode`);
        setActiveKnowledgeBase(selectedKB || null);
        // Notify parent component about the change
        if (onKnowledgeBaseChange) {
          onKnowledgeBaseChange(knowledgeBaseId, knowledgeBaseName);
        }
        
        // Refresh sources for the newly selected knowledge base
        try {
          const sources = await listKnowledgeBaseSources(knowledgeBaseId, workspaceId);
          setKnowledgeBaseSources(sources);
          setIsEditMode(true);
        } catch (sourceError) {
          console.error('[KnowledgeBaseConfig] Error fetching sources:', sourceError);
          setSourcesError('Failed to load files for this knowledge base');
        }
        return;
      }
      
      // If we get here, we're linking a knowledge base to an assistant
      setIsLinkingKnowledgeBase(true);
      
      // Make API call to link knowledge base to assistant using workspace-aware API
      await linkKnowledgeBaseToAssistant(knowledgeBaseId, assistantId, workspaceId || undefined);
      
      // Update local state
      setActiveKnowledgeBase(selectedKB || null);
      
      // Load the sources for the newly selected knowledge base
      try {
        const sources = await listKnowledgeBaseSources(knowledgeBaseId, workspaceId);
        setKnowledgeBaseSources(sources);
      } catch (sourceError) {
        console.error('[KnowledgeBaseConfig] Error fetching sources:', sourceError);
        setSourcesError('Failed to load files for this knowledge base');
      }
      
      // Notify parent component about the change
      if (onKnowledgeBaseChange) {
        onKnowledgeBaseChange(knowledgeBaseId, knowledgeBaseName);
      }
      
      // Show success toast
      toast({
        title: "Knowledge base connected",
        description: `Successfully linked ${knowledgeBaseName || "knowledge base"} to assistant`,
      });
      
    } catch (error) {
      console.error('[KnowledgeBaseConfig] Error setting knowledge base:', error);
      setError(`Failed to set knowledge base: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      toast({
        title: "Error setting knowledge base",
        description: assistantId 
          ? "Could not link the knowledge base to the assistant. Please try again."
          : "Could not set the knowledge base. Please try again.",
        variant: "destructive"
      });
      
      // Reset UI state on error
      setActiveKnowledgeBase(null);
      if (onKnowledgeBaseChange) {
        onKnowledgeBaseChange(null);
      }
    } finally {
      setIsLinkingKnowledgeBase(false);
      setOpenCombobox(false);
    }
  };
  
  // Function to handle unlinking knowledge base from an assistant
  const handleUnlinkKnowledgeBase = async () => {
    if (!assistantId || !activeKnowledgeBase?.id) return;
    
    setIsUnlinkingKnowledgeBase(true);
    console.log(`[KnowledgeBaseConfig] Unlinking knowledge base ${activeKnowledgeBase.id} from assistant ${assistantId}`);
    console.log(`[KnowledgeBaseConfig] Using workspace ID: ${workspaceId || 'none'}, source: ${activeWorkspace ? 'context' : 'prop'}`);
    
    try {
      // Use PATCH to update knowledgeBaseId to null instead of empty string
      await fetchAPI(`/assistants/${assistantId}`, {
        method: 'PATCH',
        headers: await getWorkspaceAuthHeaders(workspaceId || ''),
        body: JSON.stringify({
          knowledgeBaseId: null  // Set to null instead of empty string for UUID validation
        })
      });
      
      console.log(`[KnowledgeBaseConfig] Successfully unlinked knowledge base from assistant ${assistantId}`);
      
      // Notify parent component about the change
      if (onKnowledgeBaseChange) {
        onKnowledgeBaseChange(null);
      }
      
      // Update local state
      setActiveKnowledgeBase(null);
      setIsEditMode(false);
      
    } catch (error) {
      console.error('[KnowledgeBaseConfig] Error unlinking knowledge base from assistant:', error);
      toast({
        title: "Error removing knowledge base",
        description: "Could not unlink the knowledge base from the assistant. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsUnlinkingKnowledgeBase(false);
    }
  };
  
  // Create new knowledge base
  const handleCreateKnowledgeBase = async () => {
    if (!newKbName.trim()) {
      setError('Please enter a name for the knowledge base');
      return;
    }
    
    try {
      setIsCreatingKb(true);
      setError(null);
      
      console.log(`[KnowledgeBaseConfig] Creating knowledge base "${newKbName}" with workspace ID: ${workspaceId || 'none'}, source: ${activeWorkspace ? 'context' : 'prop'}`);
      
      // Create the knowledge base with the provided name
      const newKb = await createKnowledgeBase(newKbName, workspaceId);
      
      // Update the local state
      setKnowledgeBases(prev => [...prev, newKb]);
      
      // Close the dialog
      setIsCreateDialogOpen(false);
      
      // Reset the name
      setNewKbName('');
      
      // Always select the newly created knowledge base (works for both standalone mode and with assistant)
      await handleSelectKnowledgeBase(newKb.id);
      
      // Show success toast
      toast({
        title: 'Knowledge Base Created',
        description: `Successfully created knowledge base: ${newKb.name}`,
      });
      
    } catch (err: any) {
      console.error('[KnowledgeBaseConfig] Error creating knowledge base:', err);
      setError(`Failed to create knowledge base: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsCreatingKb(false);
    }
  };
  
  // Handle file selection to link with knowledge base
  const handleSelectFile = async (fileId: string) => {
    if (!activeKnowledgeBase) return;
    
    try {
      console.log(`[KnowledgeBaseConfig] Linking file ${fileId} to knowledge base ${activeKnowledgeBase.id}`);
      console.log(`[KnowledgeBaseConfig] Using workspace ID: ${workspaceId || 'none'}, source: ${activeWorkspace ? 'context' : 'prop'}`);
      
      // Make API call to link file
      const source = await linkFileToKnowledgeBase(
        activeKnowledgeBase.id,
        fileId,
        workspaceId
      );
      
      console.log(`[KnowledgeBaseConfig] Successfully linked file ${fileId} to knowledge base ${activeKnowledgeBase.id}`);
      
      // Update local state to show the file in the knowledge base
      setKnowledgeBaseSources(prev => [...prev, source]);
      
    } catch (err: any) {
      console.error('[KnowledgeBaseConfig] Error linking file to knowledge base:', err);
      toast({
        title: 'Error',
        description: `Failed to link file: ${err?.message || 'Unknown error'}`,
        variant: 'destructive',
      });
    }
  };
  
  // Filter files based on search query
  const filteredFiles = fileSearchQuery 
    ? workspaceFiles.filter(file => 
        file.name.toLowerCase().includes(fileSearchQuery.toLowerCase())
      )
    : workspaceFiles;
  
  // Check if a file is already linked to the knowledge base
  const isFileLinked = (fileId: string): boolean => {
    return knowledgeBaseSources.some(source => source.sourcePointer === fileId);
  };
  
  // Find the source object for a file
  const getSourceForFile = (fileId: string): KnowledgeBaseSourceWithFile | undefined => {
    return knowledgeBaseSources.find(source => source.sourcePointer === fileId);
  };
  
  // Update toggleFileSelection function to ensure it uses workspaceId consistently
  const toggleFileSelection = async (fileId: string) => {
    if (!activeKnowledgeBase) return;
    
    // Check if the file is already linked
    const isLinked = isFileLinked(fileId);
    
    if (isLinked) {
      // If linked, find the source and remove it
      const source = getSourceForFile(fileId);
      if (source) {
        console.log(`[KnowledgeBaseConfig] File ${fileId} is already linked, removing it`);
        console.log(`[KnowledgeBaseConfig] Unlinking using workspace ID: ${workspaceId || 'none'}, source: ${activeWorkspace ? 'context' : 'prop'}`);
        
        try {
          // Direct API call with explicit workspace ID to ensure consistency
          await unlinkFileFromKnowledgeBase(
            activeKnowledgeBase.id,
            source.id,
            workspaceId
          );
          
          // Update UI immediately
          setKnowledgeBaseSources(prev => prev.filter(s => s.id !== source.id));
          console.log(`[KnowledgeBaseConfig] Successfully unlinked source ${source.id}`);
          
          // Refresh knowledge base sources to ensure UI is accurate
          const refreshedSources = await listKnowledgeBaseSources(activeKnowledgeBase.id, workspaceId);
          setKnowledgeBaseSources(refreshedSources);
        } catch (error) {
          console.error(`[KnowledgeBaseConfig] Error unlinking file:`, error);
          // If we get a 404, the source is already gone, which is fine
          if (error instanceof Error && error.message.includes('404')) {
            console.warn(`[KnowledgeBaseConfig] Source ${source.id} not found (404), treating as already removed`);
          } else {
            // For other errors, show toast and refresh sources
            toast({
              title: "Error removing file",
              description: "Could not remove the file from the knowledge base. Please try again.",
              variant: "destructive"
            });
            
            // Refresh sources to ensure UI is accurate
            const refreshedSources = await listKnowledgeBaseSources(activeKnowledgeBase.id, workspaceId);
            setKnowledgeBaseSources(refreshedSources);
          }
        }
      }
    } else {
      // If not linked, add it
      console.log(`[KnowledgeBaseConfig] File ${fileId} is not linked, adding it`);
      console.log(`[KnowledgeBaseConfig] Using workspace ID: ${workspaceId || 'none'}, source: ${activeWorkspace ? 'context' : 'prop'}`);
      
      try {
        // Direct API call with explicit workspace ID to ensure consistency
        const source = await linkFileToKnowledgeBase(
          activeKnowledgeBase.id,
          fileId,
          workspaceId
        );
        
        // Update UI immediately
        setKnowledgeBaseSources(prev => [...prev, source]);
        console.log(`[KnowledgeBaseConfig] Successfully linked file ${fileId}`);
      } catch (err) {
        console.error('[KnowledgeBaseConfig] Error toggling file selection:', err);
        toast({
          title: "Error adding file",
          description: "Could not add the file to the knowledge base. Please try again.",
          variant: "destructive"
        });
      }
    }
  };
  
  // Helper function to get max height style for file lists
  const getScrollableStyle = (itemCount: number) => {
    if (itemCount > maxFileHeight) {
      // Each file item is roughly 32-36px in height
      return { maxHeight: `${maxFileHeight * 36}px`, overflowY: 'auto' as const };
    }
    return {};
  };
  
  // Function to calculate overall indexing status
  const getKnowledgeBaseIndexingStatus = () => {
    if (!knowledgeBaseSources || knowledgeBaseSources.length === 0) {
      return "COMPLETED"; // No sources means nothing to index
    }
    
    // Count sources by status
    const statusCounts = knowledgeBaseSources.reduce((counts, source) => {
      // Normalize status - treat INDEXED the same as COMPLETED for backward compatibility
      const normalizedStatus = source.indexingStatus === 'INDEXED' ? 'COMPLETED' : source.indexingStatus;
      counts[normalizedStatus] = (counts[normalizedStatus] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);
    
    // Calculate the overall status
    if (statusCounts["FAILED"] && statusCounts["FAILED"] === knowledgeBaseSources.length) {
      return "FAILED"; // All sources failed
    } else if (statusCounts["PENDING"] || statusCounts["PROCESSING"]) {
      return "PROCESSING"; // At least one source is still being processed
    } else if (statusCounts["COMPLETED"] === knowledgeBaseSources.length) {
      return "COMPLETED"; // All sources completed
    } else {
      return "MIXED"; // Mixed statuses
    }
  };

  // Function to get badge color based on indexing status
  const getIndexingStatusBadgeProps = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return { className: "bg-green-100 text-green-800", label: "Indexed" };
      case "PROCESSING":
      case "PENDING":
        return { className: "bg-yellow-100 text-yellow-800", label: "Indexing..." };
      case "FAILED":
        return { className: "bg-red-100 text-red-800", label: "Indexing Failed" };
      case "MIXED":
        return { className: "bg-orange-100 text-orange-800", label: "Partially Indexed" };
      default:
        return { className: "bg-gray-100 text-gray-800", label: "Unknown" };
    }
  };
  
  // Add a function to manually trigger indexing for a source
  const requestReindexing = async (source: KnowledgeBaseSource) => {
    if (!source || !source.id || !activeKnowledgeBase) return;
    
    console.log(`[KnowledgeBaseConfig] Requesting reindexing for source ${source.id}`);
    
    try {
      // Show loading state through UI
      setKnowledgeBaseSources(prev => 
        prev.map(s => 
          s.id === source.id 
            ? { ...s, indexingStatus: 'PENDING' } 
            : s
        )
      );
      
      // Send request to re-queue the source for indexing
      const response = await fetch(`${API_BASE_URL}/v1/queue/reindex-source`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(await getWorkspaceAuthHeaders(workspaceId || '')),
        },
        body: JSON.stringify({
          knowledgeBaseId: activeKnowledgeBase.id,
          sourceId: source.id,
          workspaceId: workspaceId
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to request reindexing: ${response.status} ${response.statusText}`);
      }
      
      toast({
        title: "Indexing requested",
        description: "Source has been queued for indexing",
        duration: 3000,
      });
      
      // Refresh status after a short delay to see the updated status
      setTimeout(async () => {
        if (activeKnowledgeBase) {
          const refreshedSources = await listKnowledgeBaseSources(activeKnowledgeBase.id, workspaceId);
          setKnowledgeBaseSources(refreshedSources);
        }
      }, 2000);
      
    } catch (error) {
      console.error(`[KnowledgeBaseConfig] Error requesting reindexing:`, error);
      toast({
        title: "Error",
        description: "Failed to request reindexing. Please try again.",
        variant: "destructive",
      });
      
      // Reset status on error
      const refreshedSources = await listKnowledgeBaseSources(activeKnowledgeBase.id, workspaceId);
      setKnowledgeBaseSources(refreshedSources);
    }
  };
  
  // Add a new function to request reindexing of all sources
  const requestReindexAll = async () => {
    if (!activeKnowledgeBase || knowledgeBaseSources.length === 0) return;
    
    console.log(`[KnowledgeBaseConfig] Requesting reindexing for all sources in knowledge base ${activeKnowledgeBase.id}`);
    
    try {
      // Show loading state through UI
      setIsLoadingSources(true);
      
      // Update all sources to PENDING in UI immediately for feedback
      setKnowledgeBaseSources(prev => 
        prev.map(s => ({ ...s, indexingStatus: 'PENDING' }))
      );
      
      // Queue each source for reindexing
      const reindexPromises = knowledgeBaseSources.map(async (source) => {
        try {
          await fetch(`${API_BASE_URL}/v1/queue/reindex-source`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(await getWorkspaceAuthHeaders(workspaceId || '')),
            },
            body: JSON.stringify({
              knowledgeBaseId: activeKnowledgeBase.id,
              sourceId: source.id,
              workspaceId: workspaceId
            }),
          });
          return true;
        } catch (error) {
          console.error(`[KnowledgeBaseConfig] Error reindexing source ${source.id}:`, error);
          return false;
        }
      });
      
      // Wait for all reindex requests to complete
      await Promise.all(reindexPromises);
      
      toast({
        title: "Reindexing all files",
        description: `${knowledgeBaseSources.length} files have been queued for indexing`,
        duration: 3000,
      });
      
      // Refresh sources after a short delay to get updated statuses
      setTimeout(async () => {
        if (activeKnowledgeBase) {
          const refreshedSources = await listKnowledgeBaseSources(activeKnowledgeBase.id, workspaceId);
          setKnowledgeBaseSources(refreshedSources);
        }
        
        setIsLoadingSources(false);
      }, 2000);
      
    } catch (error) {
      console.error(`[KnowledgeBaseConfig] Error reindexing all sources:`, error);
      toast({
        title: "Error",
        description: "Failed to reindex all files. Please try again.",
        variant: "destructive",
      });
      
      // Reset on error
      if (activeKnowledgeBase) {
        const refreshedSources = await listKnowledgeBaseSources(activeKnowledgeBase.id, workspaceId);
        setKnowledgeBaseSources(refreshedSources);
      }
      
      setIsLoadingSources(false);
    }
  };
  
  // Add a function to get authorization headers with token and workspace ID
  // We don't have access to this function from the other file, so we'll implement it here
  async function getWorkspaceAuthHeaders(wsId: string) {
    try {
      const supabase = createClient();
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      
      if (!token) {
        throw new Error('No authentication token available');
      }
      
      return {
        'Authorization': `Bearer ${token}`,
        'X-Workspace-ID': wsId,
        'workspace-id': wsId,
        'X-Force-Workspace-ID': wsId,
      };
    } catch (error) {
      console.error('[getWorkspaceAuthHeaders] Error getting auth headers:', error);
      throw error;
    }
  }
  
  // Render the selection component
  const renderKnowledgeBaseSelector = () => {
  return (
      <div className="space-y-4">
        <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
          <PopoverTrigger asChild>
          <Button 
              variant="outline"
              role="combobox"
              aria-expanded={openCombobox}
              className="w-full justify-between"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Loading knowledge bases...</span>
    </div>
              ) : knowledgeBaseId ? (
                <div className="flex items-center gap-2">
                  <Book className="h-4 w-4" />
                  <span>{activeKnowledgeBase?.name || "Unknown knowledge base"}</span>
              </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Book className="h-4 w-4" />
                  <span>Select knowledge base</span>
                </div>
              )}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full p-0" style={{ width: "var(--radix-popover-trigger-width)" }}>
            <Command>
              <CommandInput 
                placeholder="Search knowledge bases..." 
                value={searchQuery}
                onValueChange={setSearchQuery}
              />
              <CommandList>
                <CommandEmpty>No knowledge bases found.</CommandEmpty>
                <CommandGroup>
                  {comboboxOptions.map((kb) => (
                    <CommandItem
                      key={kb.id}
                      value={kb.id}
                      onSelect={() => {
                        if (kb.id === "create-new") {
                          setIsCreateDialogOpen(true);
                          setOpenCombobox(false);
                        } else {
                          handleSelectKnowledgeBase(kb.id);
                        }
                      }}
                      className="flex items-center justify-between"
                    >
                      {kb.id === "create-new" ? (
                        <div className="flex items-center">
                          <Plus className="mr-2 h-4 w-4" />
                          <span>{kb.name}</span>
                        </div>
                      ) : (
                        <>
                          <span>{kb.name}</span>
                          {kb.id === knowledgeBaseId && (
                            <Check className="h-4 w-4 text-green-600" />
                          )}
                        </>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        
        {error && (
          <div className="text-sm text-red-500 mt-2">
            {error}
          </div>
        )}
      </div>
    );
  };
  
  // Render card for connected knowledge base
  const renderConnectedKnowledgeBase = () => {
    if (!activeKnowledgeBase) return null;
    
    // In standalone mode, always show the edit controls by default
    const showEditOption = standalone;
    
    // Get overall indexing status
    const indexingStatus = getKnowledgeBaseIndexingStatus();
    const indexingBadge = getIndexingStatusBadgeProps(indexingStatus);
    
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Book className="h-5 w-5 text-blue-600" />
            <span className="text-lg font-medium">{activeKnowledgeBase.name}</span>
            <Badge className="bg-blue-100 text-blue-800">Connected</Badge>
            <Badge className={indexingBadge.className}>{indexingBadge.label}</Badge>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div 
                    className="ml-1 p-0 h-6 w-6 inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 cursor-pointer"
                    onClick={async () => {
                      if (!activeKnowledgeBase) return;
                      setIsLoadingSources(true);
                      try {
                        const refreshedSources = await listKnowledgeBaseSources(activeKnowledgeBase.id, workspaceId);
                        setKnowledgeBaseSources(refreshedSources);
                        console.log(`[KnowledgeBaseConfig] Refreshed indexing status, found ${refreshedSources.length} sources`);
                        toast({
                          title: "Refreshed",
                          description: "Indexing status updated",
                          duration: 3000,
                        });
                      } catch (error) {
                        console.error(`[KnowledgeBaseConfig] Error refreshing indexing status:`, error);
                        toast({
                          title: "Error",
                          description: "Failed to refresh indexing status",
                          variant: "destructive",
                        });
                      } finally {
                        setIsLoadingSources(false);
                      }
                    }}
                    aria-disabled={isLoadingSources}
                  >
                    <RefreshCw className={cn("h-3 w-3", isLoadingSources && "animate-spin")} />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Refresh indexing status</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="flex items-center gap-2">
              {(showEditOption || !standalone) && (
                <Button 
                  variant="ghost"
                  size="sm"
                  className="h-8 text-blue-600"
                  onClick={() => setIsEditMode(!isEditMode)}
                >
                  <Edit3 className="h-4 w-4 mr-1" />
                  {isEditMode ? "Done" : "Edit"}
                </Button>
              )}
              {!standalone ? (
                <Button 
                  variant="ghost"
                  size="sm"
                  className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={handleUnlinkKnowledgeBase}
                >
                  <X className="h-4 w-4 mr-1" />
                  Unlink
                </Button>
              ) : null}
            </div>
          </div>
          
        {isEditMode && (
          <Accordion type="single" collapsible defaultValue="kb-files" className="w-full">
            <AccordionItem value="kb-files" className="border-0">
              <AccordionTrigger className="py-2 hover:bg-gray-50">
                <div className="flex items-center">
                  <FileText className="h-4 w-4 mr-2" />
                  <span>Knowledge Base Files</span>
                  <Badge className="ml-2 bg-gray-100 text-gray-700">
                    {isLoadingSources ? '...' : knowledgeBaseSources.length}
                  </Badge>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div 
                          className="ml-2 p-0 h-6 w-6 inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 cursor-pointer"
                          onClick={async (e) => {
                            // Prevent accordion from toggling when clicking the refresh button
                            e.stopPropagation();
                            
                            if (!activeKnowledgeBase) return;
                            setIsLoadingSources(true);
                            try {
                              const refreshedSources = await listKnowledgeBaseSources(activeKnowledgeBase.id, workspaceId);
                              setKnowledgeBaseSources(refreshedSources);
                              console.log(`[KnowledgeBaseConfig] Refreshed sources, found ${refreshedSources.length}`);
                            } catch (error) {
                              console.error(`[KnowledgeBaseConfig] Error refreshing sources:`, error);
                              setSourcesError("Failed to refresh sources");
                            } finally {
                              setIsLoadingSources(false);
                            }
                          }}
                          aria-disabled={isLoadingSources}
                        >
                          <RefreshCw className={cn("h-3 w-3", isLoadingSources && "animate-spin")} />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Refresh list of files</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  
                  {knowledgeBaseSources.length > 0 && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div 
                            className="ml-1 p-0 h-6 w-6 inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 cursor-pointer"
                            onClick={(e) => {
                              // Prevent accordion from toggling
                              e.stopPropagation();
                              requestReindexAll();
                            }}
                            aria-disabled={isLoadingSources}
                          >
                            <RefreshCw className="h-3 w-3 text-blue-600" />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Reindex all files</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4">
                  {isLoadingSources ? (
                    <div className="flex items-center justify-center p-4">
                      <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                        </div>
                  ) : sourcesError ? (
                    <div className="text-red-500 text-sm">
                      {sourcesError}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <div className="text-sm font-medium">Currently linked files:</div>
                        {knowledgeBaseSources.length === 0 ? (
                          <div className="text-sm text-gray-500">
                            No files in this knowledge base.
                          </div>
                        ) : (
                          <div className="space-y-1" style={getScrollableStyle(knowledgeBaseSources.length)}>
                            {knowledgeBaseSources.map(source => (
                              <div key={source.id} className="flex items-center justify-between py-1">
                                <div className="flex items-center">
                                  <File className="h-4 w-4 mr-2 text-blue-500" />
                                  <span className="text-sm">
                                    {source.file?.name || source.sourcePointer?.substring(0, 8)}
                                    {getSourceStatusIndicator(source)}
                                  </span>
                                </div>
                                <div className="flex items-center">
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button 
                                          variant="ghost" 
                                          size="sm" 
                                          className="h-6 px-2 text-xs text-blue-600 hover:text-blue-700"
                                          onClick={() => requestReindexing(source)}
                                          disabled={isUnlinkingFile || source.indexingStatus === 'PROCESSING' || source.indexingStatus === 'PENDING'}
                                        >
                                          <RefreshCw className="h-3 w-3 mr-1" />
                                          Reindex
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Reindex this file</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-6 px-2 text-xs text-red-600 hover:text-red-700" 
                                    onClick={() => handleRemoveButtonClick(source)}
                                    disabled={isUnlinkingFile}
                                  >
                                    <X className="h-3 w-3 mr-1" />
                                    Remove
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-medium">Add files to knowledge base:</div>
                        </div>
                        <Input
                          placeholder="Search files..."
                          value={fileSearchQuery}
                          onChange={(e) => setFileSearchQuery(e.target.value)}
                          className="w-full"
                        />
                        
                        {isLoadingFiles ? (
                          <div className="flex justify-center p-4">
                            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                  </div>
                ) : (
                          filteredFiles.length === 0 ? (
                            <div className="text-center text-gray-500 text-sm py-2">
                              No files found
                      </div>
                    ) : (
                            <div className="space-y-1 max-h-60 overflow-y-auto" style={getScrollableStyle(filteredFiles.length)}>
                              {filteredFiles.map(file => {
                                const isLinked = isFileLinked(file.id);
                          return (
                                  <div
                                    key={file.id}
                                    className={cn(
                                      "flex items-center justify-between py-1 px-2 hover:bg-gray-50 cursor-pointer",
                                      isLinked ? "bg-blue-50" : ""
                                    )}
                                    onClick={() => toggleFileSelection(file.id)}
                                  >
                              <div className="flex items-center">
                                      <input
                                        type="checkbox"
                                        checked={isLinked}
                                        readOnly
                                        className="h-4 w-4 mr-2"
                                      />
                                      <File className="h-4 w-4 mr-2 text-blue-500" />
                                      <span className="text-sm">{file.name}</span>
                                  </div>
                                    <span className="text-xs text-gray-500">{file.size}</span>
                            </div>
                          );
                        })}
                      </div>
                          )
                    )}
                      </div>
                  </div>
                )}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}
        </div>
    );
  };
  
  // Render the create knowledge base dialog
  const renderCreateKBDialog = () => {
                        return (
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Create Knowledge Base</DialogTitle>
            <DialogDescription>
              Create a new knowledge base to manage your documents and files.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Input
                id="kb-name"
                placeholder="Knowledge Base Name"
                className="w-full"
                value={newKbName}
                onChange={(e) => setNewKbName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateKnowledgeBase}
              disabled={isCreatingKb || !newKbName.trim()}
              className="ml-2"
            >
              {isCreatingKb ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>Create</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };
  
  // Define a function to get status indicator for individual files
  const getSourceStatusIndicator = (source: KnowledgeBaseSource) => {
    // Explicitly type as string to avoid TypeScript issues with literal types
    const status: string = source.indexingStatus || 'UNKNOWN';
    
    // Use string comparison to avoid TypeScript issues
    if (status === 'COMPLETED' || status === 'INDEXED') {
      return <Badge className="ml-2 bg-green-100 text-green-800 text-xs">Indexed</Badge>;
    } else if (status === 'PROCESSING') {
      return <Badge className="ml-2 bg-yellow-100 text-yellow-800 text-xs">Processing</Badge>;
    } else if (status === 'PENDING') {
      return <Badge className="ml-2 bg-yellow-100 text-yellow-800 text-xs">Pending</Badge>;
    } else if (status === 'FAILED') {
      return <Badge className="ml-2 bg-red-100 text-red-800 text-xs">Failed</Badge>;
    } else {
      return <Badge className="ml-2 bg-gray-100 text-gray-800 text-xs">Unknown</Badge>;
    }
  };
  
  // Filter combobox options based on search query
  const filteredOptions = searchQuery
    ? comboboxOptions.filter((kb) =>
        kb.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : comboboxOptions;

  // Main render - conditionally show selector or connected knowledge base
  return (
    <div className="space-y-4">
      {knowledgeBaseId ? (
        renderConnectedKnowledgeBase()
      ) : (
        renderKnowledgeBaseSelector()
      )}
      {renderCreateKBDialog()}
      
      {/* Show instructions in standalone mode when nothing is selected */}
      {standalone && !knowledgeBaseId && (
        <div className="p-4 border border-dashed border-gray-300 rounded-md mt-4">
          <p className="text-sm text-gray-500">
            Select or create a knowledge base to use with this node. 
            Once connected, you'll be able to add files and manage the knowledge base directly here.
          </p>
        </div>
      )}
    </div>
  )
} 
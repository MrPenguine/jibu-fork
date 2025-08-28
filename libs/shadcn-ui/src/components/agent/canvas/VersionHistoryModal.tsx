"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "../../ui/dialog";
import { Button } from "../../ui/button";
import { ArrowLeft, ChevronDown, ChevronRight } from "lucide-react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "../../ui/select";
import { ReactFlow, Background, BackgroundVariant } from "reactflow";
import { nodeTypes, defaultEdgeOptions, edgeTypes } from "../constants";

export type VersionItem = {
  id: string;
  timestamp: string | number | Date; // ISO or epoch
  author?: string;
  title?: string; // e.g. "Current version" or custom label
  status?: "live" | "draft"; // optional; used by filter
};

export type VersionHistoryModalProps = {
  open: boolean;
  onClose: () => void;
  versions: VersionItem[];
  // ID of the current version to label in the list
  currentVersionId?: string | number;
  // Loader used to fetch version detail for read-only preview
  loadVersionDetail?: (version: VersionItem) => Promise<{ nodes: any[]; edges: any[]; viewport?: { x: number; y: number; zoom: number } | null | undefined }>;
  // Callback to request restoring the selected version into the main canvas
  onRestore?: (version: VersionItem) => void | Promise<void>;
};

function formatDayLabel(date: Date) {
  const now = new Date();
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return d.toLocaleDateString(undefined, { weekday: "long" });
  return d.toLocaleDateString(undefined, { month: "long" });
}

export function VersionHistoryModal({ open, onClose, versions, currentVersionId, loadVersionDetail, onRestore }: VersionHistoryModalProps) {
  // Group versions by day label
  const [filter, setFilter] = useState<"live" | "draft">("draft");
  const [selected, setSelected] = useState<VersionItem | null>(null);
  const [previewNodes, setPreviewNodes] = useState<any[]>([]);
  const [previewEdges, setPreviewEdges] = useState<any[]>([]);
  const [previewViewport, setPreviewViewport] = useState<{ x: number; y: number; zoom: number } | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const groups: Record<string, VersionItem[]> = {};
    const filtered = versions.filter((v) => ((v.status ?? "live") === filter));
    const sorted = [...filtered].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    for (const v of sorted) {
      const label = formatDayLabel(new Date(v.timestamp));
      if (!groups[label]) groups[label] = [];
      groups[label].push(v);
    }
    return groups;
  }, [versions, filter]);

  const initialOpen: Record<string, boolean> = Object.fromEntries(Object.keys(grouped).map((k) => [k, true]));
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(initialOpen);

  // Keep openGroups keys in sync with grouped days; default new days to collapsed
  useEffect(() => {
    setOpenGroups((prev) => {
      const next: Record<string, boolean> = { ...prev };
      for (const key of Object.keys(grouped)) {
        if (next[key] === undefined) next[key] = false;
      }
      // Remove keys that no longer exist
      for (const key of Object.keys(next)) {
        if (!grouped[key]) delete next[key];
      }
      return next;
    });
  }, [grouped]);

  // When opening, default to Drafts and reset selection/preview
  useEffect(() => {
    if (open) {
      setFilter("draft");
      setSelected(null);
      setPreviewNodes([]);
      setPreviewEdges([]);
      setPreviewViewport(null);
      setPreviewError(null);
    }
  }, [open]);

  const handleSelectVersion = async (v: VersionItem) => {
    if (!loadVersionDetail) return;
    setSelected(v);
    setLoadingPreview(true);
    setPreviewError(null);
    try {
      const detail = await loadVersionDetail(v);
      setPreviewNodes(Array.isArray(detail?.nodes) ? detail.nodes : []);
      setPreviewEdges(Array.isArray(detail?.edges) ? detail.edges : []);
      const vp = (detail as any)?.viewport;
      setPreviewViewport(vp && typeof vp === 'object' ? vp : null);
    } catch (e: any) {
      setPreviewError(e?.message || 'Failed to load version preview');
    } finally {
      setLoadingPreview(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => (!val ? onClose() : null)}>
      <DialogContent className="max-w-screen-xl w-[90vw] h-[85vh] p-0 overflow-hidden rounded-2xl border-0 shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={onClose}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <DialogTitle className="font-medium">Version history</DialogTitle>
          <div className="ml-auto pr-2 w-40">
            <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
              <SelectTrigger className="h-8">
                <SelectValue placeholder="Drafts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Drafts</SelectItem>
                <SelectItem value="live">Live</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex h-[calc(85vh-49px)]">
          {/* Left: read-only canvas preview area */}
          <div className="flex-1 bg-gray-50 flex items-center justify-center relative">
            {selected ? (
              <div className="w-full h-full">
                {loadingPreview && (
                  <div className="absolute top-2 left-2 text-xs text-gray-500">Loading preview…</div>
                )}
                {previewError && (
                  <div className="p-4 text-sm text-red-600">{previewError}</div>
                )}
                <ReactFlow
                  nodes={previewNodes as any}
                  edges={previewEdges as any}
                  nodeTypes={nodeTypes}
                  edgeTypes={edgeTypes as any}
                  defaultEdgeOptions={defaultEdgeOptions}
                  fitView
                  nodesDraggable={false}
                  nodesConnectable={false}
                  elementsSelectable={false}
                  panOnDrag={[0, 1]}
                  zoomOnScroll
                  defaultViewport={previewViewport || undefined}
                  proOptions={{ hideAttribution: true } as any}
                  className="w-full h-full"
                >
                  <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#cbd5e1" />
                </ReactFlow>
                {/* Restore action - only when viewing a non-current version */}
                {selected && String(selected.id) !== String(currentVersionId ?? '') && (
                  <div className="absolute bottom-4 left-4">
                    <Button
                      onClick={() => onRestore && onRestore(selected)}
                      disabled={!!loadingPreview}
                    >
                      Restore this version
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-gray-400">Select a version to preview</div>
            )}
          </div>

          {/* Right: versions navigation */}
          <aside className="w-96 h-full overflow-y-auto p-3 bg-gray-50">
            <div className="text-sm font-semibold mb-2">{filter === 'live' ? 'Live versions' : 'Draft versions'}</div>
            <div className="space-y-4">
              {Object.keys(grouped).map((label) => {
                const list = grouped[label] || [];
                if (list.length === 0) return null;
                const latest = list[0];
                const latestDate = new Date(latest.timestamp);
                const latestTime = latestDate.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
                return (
                  <div key={label}>
                    <div className="text-xs text-gray-500 mb-2">{label}</div>
                    {/* Top card for the day (always visible) */}
                    <button
                      className={`w-full text-left rounded-xl bg-white shadow-sm hover:shadow transition-shadow ${selected?.id === latest.id ? 'ring-2 ring-indigo-500' : ''}`}
                      onClick={() => handleSelectVersion(latest)}
                    >
                      <div className="flex items-start justify-between p-3">
                        <div>
                          <div className="text-sm font-medium">
                            {latestDate.toLocaleDateString(undefined, { month: "long", day: "numeric" })}, {latestTime}
                          </div>
                          <div className="text-xs text-gray-500 flex items-center gap-2">
                            <span>{latest.title || "Saved version"}</span>
                            {String(latest.id) === String(currentVersionId ?? '') && (
                              <span className="px-2 py-0.5 text-[10px] rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Current version</span>
                            )}
                          </div>
                          {latest.author && (
                            <div className="text-xs text-gray-500 mt-1">{latest.author}</div>
                          )}
                        </div>
                        <span
                          role="button"
                          tabIndex={0}
                          className="p-1 text-gray-500 hover:text-gray-700"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenGroups((s) => ({ ...s, [label]: !s[label] }));
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              e.stopPropagation();
                              setOpenGroups((s) => ({ ...s, [label]: !s[label] }));
                            }
                          }}
                          aria-label={openGroups[label] ? 'Collapse' : 'Expand'}
                          aria-pressed={openGroups[label]}
                        >
                          {openGroups[label] ? (
                            <ChevronDown className="w-4 h-4 mt-1 text-gray-500" />
                          ) : (
                            <ChevronRight className="w-4 h-4 mt-1 text-gray-500" />
                          )}
                        </span>
                      </div>
                    </button>

                    {/* Additional versions for the day (visible only when expanded) */}
                    {openGroups[label] && list.length > 1 && (
                      <div className="mt-2 space-y-2">
                        {list.slice(1).map((v) => {
                          const d = new Date(v.timestamp);
                          const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
                          return (
                            <button
                              key={v.id}
                              className={`w-full text-left rounded-xl bg-white shadow-sm hover:shadow transition-shadow ${selected?.id === v.id ? 'ring-2 ring-indigo-500' : ''}`}
                              onClick={() => handleSelectVersion(v)}
                            >
                              <div className="flex items-start justify-between p-3">
                                <div>
                                  <div className="text-sm font-medium">
                                    {d.toLocaleDateString(undefined, { month: "long", day: "numeric" })}, {time}
                                  </div>
                                  <div className="text-xs text-gray-500 flex items-center gap-2">
                                    <span>{v.title || "Saved version"}</span>
                                    {String(v.id) === String(currentVersionId ?? '') && (
                                      <span className="px-2 py-0.5 text-[10px] rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Current version</span>
                                    )}
                                  </div>
                                  {v.author && (
                                    <div className="text-xs text-gray-500 mt-1">{v.author}</div>
                                  )}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-4">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" className="accent-blue-600" defaultChecked />
                Highlight changes
              </label>
            </div>
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default VersionHistoryModal;

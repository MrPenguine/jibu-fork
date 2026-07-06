"use client";

import React from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../ui/dialog";
import { Button } from "../../ui/button";
import { Textarea } from "../../ui/textarea";
import { Separator } from "../../ui/separator";

export interface ChunkView {
  id: string;
  vectorId: string;
  sourceId: string;
  chunkIndex: number;
  chunkType?: string;
  strategies?: string[];
  textPreview?: string;
  text?: string;
  source?: { id: string; title?: string; sourceType?: string; sourceUrl?: string };
}

interface ChunkBrowserDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  items: ChunkView[];
  total: number;
  page: number;
  pageSize: number;
  loading?: boolean;
  onPageChange: (page: number) => void;
  /** Fetch the full text for a chunk (Qdrant payload). */
  onView: (chunkId: string) => Promise<ChunkView>;
  onSaveEdit: (chunkId: string, text: string) => Promise<void>;
  onDelete: (chunkId: string) => Promise<void>;
}

export function ChunkBrowserDialog({
  open,
  onOpenChange,
  items,
  total,
  page,
  pageSize,
  loading = false,
  onPageChange,
  onView,
  onSaveEdit,
  onDelete,
}: ChunkBrowserDialogProps) {
  const [selected, setSelected] = React.useState<ChunkView | null>(null);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [editText, setEditText] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setSelected(null);
      setEditing(false);
      setEditText("");
    }
  }, [open]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const openChunk = async (chunkId: string) => {
    setDetailLoading(true);
    setEditing(false);
    try {
      const full = await onView(chunkId);
      setSelected(full);
      setEditText(full.text || full.textPreview || "");
    } catch {
      // keep prior selection on failure
    } finally {
      setDetailLoading(false);
    }
  };

  const saveEdit = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await onSaveEdit(selected.id, editText);
      setEditing(false);
    } finally {
      setBusy(false);
    }
  };

  const deleteChunk = async (chunkId: string) => {
    setBusy(true);
    try {
      await onDelete(chunkId);
      if (selected?.id === chunkId) setSelected(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Chunks</DialogTitle>
          <DialogDescription>
            Browse, edit and delete the chunks stored for this knowledge base. Editing re-embeds the chunk.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2" style={{ minHeight: 360 }}>
          {/* List */}
          <div className="flex max-h-[55vh] flex-col overflow-y-auto rounded-md border border-slate-200">
            {loading ? (
              <div className="space-y-2 p-3">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-12 w-full animate-pulse rounded bg-slate-100" />
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500">No chunks yet.</div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {items.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => openChunk(c.id)}
                      className={`w-full px-3 py-2 text-left hover:bg-slate-50 ${
                        selected?.id === c.id ? "bg-slate-50" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span className="rounded bg-slate-100 px-1.5 py-0.5">{c.chunkType || "content"}</span>
                        <span className="truncate max-w-[160px]">
                          {c.source?.title || c.source?.sourceUrl || c.sourceId}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm text-slate-700">{c.textPreview}</p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Detail */}
          <div className="flex max-h-[55vh] flex-col overflow-y-auto rounded-md border border-slate-200 p-3">
            {detailLoading ? (
              <div className="space-y-2">
                <div className="h-4 w-1/3 animate-pulse rounded bg-slate-100" />
                <div className="h-24 w-full animate-pulse rounded bg-slate-100" />
              </div>
            ) : !selected ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">
                Select a chunk to view its full text.
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-[11px] text-slate-500">
                  <div>Chunk #{selected.chunkIndex}</div>
                  <div className="font-mono break-all">vector: {selected.vectorId}</div>
                  {selected.strategies && selected.strategies.length > 0 && (
                    <div>strategies: {selected.strategies.join(", ")}</div>
                  )}
                </div>
                <Separator />
                {editing ? (
                  <Textarea rows={12} value={editText} onChange={(e) => setEditText(e.target.value)} />
                ) : (
                  <p className="whitespace-pre-wrap text-sm text-slate-700">
                    {selected.text || selected.textPreview}
                  </p>
                )}

                <div className="flex flex-wrap gap-2">
                  {editing ? (
                    <>
                      <Button size="sm" onClick={saveEdit} disabled={busy}>
                        {busy ? "Re-embedding…" : "Save & re-embed"}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditing(false)} disabled={busy}>
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button size="sm" variant="outline" onClick={() => setEditing(true)} disabled={busy}>
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => deleteChunk(selected.id)}
                        disabled={busy}
                      >
                        Delete
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-2 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            {total} chunk{total === 1 ? "" : "s"} · page {page} / {totalPages}
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1 || loading}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages || loading}
            >
              Next
            </Button>
            <Button size="sm" variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

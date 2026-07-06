"use client";

import React from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../ui/dialog";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Separator } from "../../ui/separator";

export interface RetrievedChunkView {
  vectorId: string;
  score: number;
  text: string;
  chunkType: string;
  sourceUrl?: string | null;
  fileName?: string | null;
}

export interface RetrieveResultView {
  question: string;
  embeddingModel: string;
  topK: number;
  chunks: RetrievedChunkView[];
  answer: string;
}

interface KnowledgeBasePreviewDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAsk?: (question: string) => Promise<RetrieveResultView>;
}

export function KnowledgeBasePreviewDialog({ open, onOpenChange, onAsk }: KnowledgeBasePreviewDialogProps) {
  const [question, setQuestion] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<RetrieveResultView | null>(null);

  React.useEffect(() => {
    if (!open) {
      setQuestion("");
      setResult(null);
      setError(null);
      setLoading(false);
    }
  }, [open]);

  const run = async () => {
    if (!onAsk || !question.trim() || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await onAsk(question.trim());
      setResult(res);
    } catch (e: any) {
      setError(e?.message || "Retrieval test failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Test retrieval</DialogTitle>
          <DialogDescription>
            Ask a question to see the exact chunks retrieved from this knowledge base and the grounded answer.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Question</label>
          <div className="flex gap-2">
            <Input
              placeholder="e.g. What is the refund policy?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") run();
              }}
              disabled={loading}
            />
            <Button onClick={run} disabled={loading || !question.trim()} className="shrink-0">
              {loading ? "Searching…" : "Ask"}
            </Button>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}

        {loading && (
          <div className="mt-4 space-y-3">
            <div className="h-16 w-full animate-pulse rounded bg-slate-100" />
            <div className="h-16 w-full animate-pulse rounded bg-slate-100" />
          </div>
        )}

        {result && !loading && (
          <div className="mt-4 space-y-4">
            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Answer</div>
              <div className="whitespace-pre-wrap rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800">
                {result.answer || "No answer generated."}
              </div>
            </div>

            <Separator />

            <div>
              <div className="mb-2 flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Retrieved chunks ({result.chunks.length})
                </div>
                <div className="text-[10px] text-slate-400">
                  {result.embeddingModel} · top-K {result.topK}
                </div>
              </div>
              {result.chunks.length === 0 ? (
                <div className="rounded-md border border-dashed border-slate-200 p-4 text-center text-sm text-slate-500">
                  No chunks matched this query.
                </div>
              ) : (
                <div className="space-y-2">
                  {result.chunks.map((c, i) => (
                    <div key={`${c.vectorId}-${i}`} className="rounded-md border border-slate-200 p-3">
                      <div className="mb-1 flex items-center justify-between text-[11px] text-slate-500">
                        <span className="inline-flex items-center gap-2">
                          <span className="rounded bg-slate-100 px-1.5 py-0.5">{c.chunkType}</span>
                          <span className="truncate max-w-[220px]">
                            {c.fileName || c.sourceUrl || c.vectorId}
                          </span>
                        </span>
                        <span className="font-mono">score {c.score.toFixed(3)}</span>
                      </div>
                      <p className="text-sm text-slate-700 line-clamp-4 whitespace-pre-wrap">{c.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

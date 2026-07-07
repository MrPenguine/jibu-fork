"use client";

import React from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../../ui/sheet";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { Badge } from "../../ui/badge";
import { Progress } from "../../ui/progress";
import { Search, Bot, MessageSquare, FileStack, Loader2, AlertCircle, X } from "lucide-react";

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

export interface AskOptions {
  answerProvider?: string;
  answerModel?: string;
}

interface KnowledgeBasePreviewDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAsk?: (question: string, opts: AskOptions) => Promise<RetrieveResultView>;
}

const PROVIDER_PRESETS: Record<string, { label: string; color: string; defaultModel: string; examples: string }> = {
  google: {
    label: "Gemini",
    color: "bg-blue-50 text-blue-700 border-blue-100",
    defaultModel: "gemini-2.0-flash",
    examples: "gemini-2.0-flash, gemini-1.5-pro",
  },
  openrouter: {
    label: "OpenRouter",
    color: "bg-violet-50 text-violet-700 border-violet-100",
    defaultModel: "openai/gpt-4o-mini",
    examples: "openai/gpt-4o-mini, anthropic/claude-3.5-sonnet",
  },
  ollama: {
    label: "Ollama",
    color: "bg-emerald-50 text-emerald-700 border-emerald-100",
    defaultModel: "llama3.2",
    examples: "llama3.2, qwen2.5, mistral",
  },
};

export function KnowledgeBasePreviewDialog({ open, onOpenChange, onAsk }: KnowledgeBasePreviewDialogProps) {
  const [question, setQuestion] = React.useState("");
  const [answerProvider, setAnswerProvider] = React.useState("google");
  const [answerModel, setAnswerModel] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<RetrieveResultView | null>(null);

  const preset = PROVIDER_PRESETS[answerProvider] || PROVIDER_PRESETS.google;

  React.useEffect(() => {
    if (!open) {
      setQuestion("");
      setAnswerProvider("google");
      setAnswerModel("");
      setResult(null);
      setError(null);
      setLoading(false);
      setProgress(0);
    }
  }, [open]);

  React.useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (loading) {
      setProgress(0);
      timer = setInterval(() => {
        setProgress((prev) => (prev >= 90 ? prev : prev + 5));
      }, 400);
    } else {
      setProgress(0);
    }
    return () => clearInterval(timer);
  }, [loading]);

  React.useEffect(() => {
    setAnswerModel(preset.defaultModel);
  }, [answerProvider, preset.defaultModel]);

  const run = async () => {
    if (!onAsk || !question.trim() || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await onAsk(question.trim(), {
        answerProvider,
        answerModel: answerModel.trim() || preset.defaultModel,
      });
      setResult(res);
    } catch (e: any) {
      setError(e?.message || "Retrieval test failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !loading && onOpenChange(v)} modal={false}>
      <SheetContent side="right" className="w-full sm:max-w-2xl lg:max-w-3xl max-h-[100vh] overflow-y-auto border-l-0 bg-white p-0 shadow-2xl">
        <SheetHeader className="sticky top-0 z-10 bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-5 text-white">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-white/20 p-2">
              <Search className="h-5 w-5 text-white" />
            </div>
            <div>
              <SheetTitle className="text-lg font-semibold text-white">Test retrieval</SheetTitle>
              <SheetDescription className="text-indigo-100">
                Ask a question to see the exact chunks retrieved and the grounded answer.
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="px-6 py-5 space-y-5">
          <Card className="border-0 shadow-sm bg-slate-50/60 rounded-xl overflow-hidden">
            <CardHeader className="pb-3 pt-4 px-5">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-800">
                <Bot className="h-4 w-4 text-violet-500" />
                Answer model
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-slate-700 text-sm">Provider</Label>
                  <Select value={answerProvider} onValueChange={setAnswerProvider} disabled={loading}>
                    <SelectTrigger className="rounded-xl border-slate-200 bg-white focus:ring-indigo-500">
                      <SelectValue placeholder="Select provider" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {Object.entries(PROVIDER_PRESETS).map(([key, p]) => (
                        <SelectItem key={key} value={key} className="rounded-lg">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={p.color}>
                              {p.label}
                            </Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-700 text-sm">Model</Label>
                  <Input
                    value={answerModel}
                    onChange={(e) => setAnswerModel(e.target.value)}
                    placeholder={preset.defaultModel}
                    className="rounded-xl border-slate-200 bg-white focus-visible:ring-indigo-500"
                    disabled={loading}
                  />
                  <p className="text-[11px] text-slate-400">Examples: {preset.examples}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-2">
            <Label className="text-slate-700 font-medium flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-indigo-500" />
              Question
            </Label>
            <div className="flex gap-2">
              <Input
                placeholder="e.g. What is the refund policy?"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") run();
                }}
                disabled={loading}
                className="rounded-xl border-slate-200 focus-visible:ring-indigo-500"
              />
              <Button
                onClick={run}
                disabled={loading || !question.trim()}
                className="shrink-0 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                {loading ? "Searching…" : "Ask"}
              </Button>
            </div>
          </div>

          {loading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-medium text-slate-600">
                <span className="flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-600" />
                  Retrieving chunks and generating answer…
                </span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2 rounded-full bg-slate-100" />
            </div>
          )}

          {error && (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 border border-red-100 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {result && !loading && (
            <div className="space-y-5">
              <Card className="border-0 shadow-sm bg-emerald-50/40 rounded-xl overflow-hidden">
                <CardHeader className="pb-2 pt-4 px-5">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2 text-emerald-800">
                    <Bot className="h-4 w-4 text-emerald-600" />
                    Answer
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-5 pb-5">
                  <div className="whitespace-pre-wrap rounded-xl bg-white p-4 text-sm text-slate-800 shadow-sm">
                    {result.answer || "No answer generated."}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm bg-slate-50/60 rounded-xl overflow-hidden">
                <CardHeader className="pb-3 pt-4 px-5">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-800">
                      <FileStack className="h-4 w-4 text-indigo-500" />
                      Retrieved chunks ({result.chunks.length})
                    </CardTitle>
                    <Badge variant="outline" className="text-slate-500 border-slate-200 bg-white">
                      {result.embeddingModel} · top-K {result.topK}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="px-5 pb-5">
                  {result.chunks.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-500 bg-white">
                      No chunks matched this query.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {result.chunks.map((c, i) => (
                        <div
                          key={`${c.vectorId}-${i}`}
                          className="rounded-xl bg-white p-4 shadow-sm border border-slate-100"
                        >
                          <div className="mb-2 flex items-center justify-between text-[11px] text-slate-500">
                            <span className="inline-flex items-center gap-2">
                              <Badge variant="secondary" className="font-normal">
                                {c.chunkType}
                              </Badge>
                              <span className="truncate max-w-[260px]">
                                {c.fileName || c.sourceUrl || c.vectorId}
                              </span>
                            </span>
                            <span className="font-mono text-slate-600">score {c.score.toFixed(3)}</span>
                          </div>
                          <p className="text-sm text-slate-700 line-clamp-4 whitespace-pre-wrap">{c.text}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 border-t border-slate-100 bg-white/80 backdrop-blur px-6 py-4 flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl border-slate-200 gap-2">
            <X className="h-4 w-4" />
            Close
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

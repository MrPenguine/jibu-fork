"use client";

import React from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../../ui/sheet";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Textarea } from "../../ui/textarea";
import { Label } from "../../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import { Progress } from "../../ui/progress";
import { Badge } from "../../ui/badge";
import { Card, CardContent } from "../../ui/card";
import { useDropzone } from "react-dropzone";
import {
  Plus,
  Upload,
  Link,
  Map,
  FileText,
  MessageSquare,
  Database,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  X,
  FolderPlus,
} from "lucide-react";

export type SourceType =
  | "upload"
  | "url"
  | "sitemap"
  | "plainText"
  | "zendesk"
  | "knowledgeApi";

export interface UploadFilePayload {
  files: File[];
  chunkingStrategy?: string;
  chunkSize?: number;
  chunkOverlap?: number;
  folderId?: string;
}

export interface UrlImportPayload {
  urls: string[];
  refreshRate: string;
  chunkingStrategy?: string;
  folderId?: string;
}

export interface SitemapImportPayload {
  sitemapUrl: string;
  refreshRate: string;
  chunkingStrategy?: string;
  folderId?: string;
}

export interface PlainTextPayload {
  text: string;
  chunkingStrategy?: string;
  folderId?: string;
}

export type ChunkingStrategyKey =
  | "smart"
  | "faq"
  | "clean_html"
  | "headers"
  | "summarize";

const CHUNKING_STRATEGIES: Array<{
  key: ChunkingStrategyKey;
  label: string;
  description: string;
}> = [
  {
    key: "smart",
    label: "Smart",
    description: "Logical sections by topic",
  },
  {
    key: "faq",
    label: "FAQ",
    description: "Optimize for questions",
  },
  {
    key: "clean_html",
    label: "Clean HTML",
    description: "Remove markup noise",
  },
  {
    key: "headers",
    label: "Headers",
    description: "Add topic summaries",
  },
  {
    key: "summarize",
    label: "Summarize",
    description: "Keep only key points",
  },
];

const SOURCE_OPTIONS: Array<{
  id: SourceType;
  label: string;
  description: string;
  icon: React.ReactNode;
  badge?: string;
}> = [
  {
    id: "upload",
    label: "Upload file",
    description: "PDF, TXT, DOCX, CSV, Markdown",
    icon: <Upload className="h-5 w-5" />,
  },
  {
    id: "url",
    label: "URL(s)",
    description: "Import one or more web pages",
    icon: <Link className="h-5 w-5" />,
  },
  {
    id: "sitemap",
    label: "Sitemap",
    description: "Bulk import from a sitemap.xml",
    icon: <Map className="h-5 w-5" />,
  },
  {
    id: "plainText",
    label: "Plain text",
    description: "Paste or type content directly",
    icon: <FileText className="h-5 w-5" />,
  },
  {
    id: "zendesk",
    label: "Zendesk",
    description: "Sync help center articles",
    icon: <MessageSquare className="h-5 w-5" />,
    badge: "Integration",
  },
  {
    id: "knowledgeApi",
    label: "Knowledge API",
    description: "Add sources programmatically",
    icon: <Database className="h-5 w-5" />,
    badge: "API",
  },
];

interface AddDataSourceDrawerProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  folders?: { id: string; name: string }[];
  onUploadFiles?: (payload: UploadFilePayload) => void | Promise<void>;
  onImportUrls?: (payload: UrlImportPayload) => void | Promise<void>;
  onImportSitemap?: (payload: SitemapImportPayload) => void | Promise<void>;
  onImportPlainText?: (payload: PlainTextPayload) => void | Promise<void>;
  onOpenCreateFolder?: () => void;
  onConnectZendesk?: () => void;
}

function ChunkingStrategyBox({
  value,
  onChange,
}: {
  value: ChunkingStrategyKey[];
  onChange: (keys: ChunkingStrategyKey[]) => void;
}) {
  const toggle = (k: ChunkingStrategyKey) => {
    if (value.includes(k)) onChange(value.filter((v) => v !== k));
    else onChange([...value, k]);
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {CHUNKING_STRATEGIES.map((s) => {
        const selected = value.includes(s.key);
        return (
          <button
            key={s.key}
            type="button"
            onClick={() => toggle(s.key)}
            className={`flex flex-col items-start gap-1 rounded-2xl border p-3 text-left transition-all ${
              selected
                ? "border-primary bg-emerald-50 text-primary shadow-sm"
                : "border-slate-100 bg-white hover:border-primary/30 hover:bg-slate-50"
            }`}
          >
            <span className={`text-sm font-semibold ${selected ? "text-primary" : "text-slate-800"}`}>
              {s.label}
            </span>
            <span className="text-xs text-slate-500 leading-snug">{s.description}</span>
          </button>
        );
      })}
    </div>
  );
}

function FolderSelect({
  value,
  onChange,
  folders = [],
  onOpenCreateFolder,
}: {
  value?: string;
  onChange: (v: string) => void;
  folders?: { id: string; name: string }[];
  onOpenCreateFolder?: () => void;
}) {
  return (
    <div className="grid gap-2">
      <Label className="text-slate-700 font-medium">Folder</Label>
      <Select value={value || "__none__"} onValueChange={(v) => onChange(v === "__none__" ? "" : v)}>
        <SelectTrigger className="rounded-xl border-slate-200">
          <SelectValue placeholder="Select folder" />
        </SelectTrigger>
        <SelectContent className="rounded-xl">
          <SelectItem value="__none__" className="rounded-lg">No folder</SelectItem>
          {folders.map((f) => (
            <SelectItem key={f.id} value={f.id} className="rounded-lg">
              {f.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {onOpenCreateFolder && (
        <button
          type="button"
          className="self-start text-sm text-primary hover:text-primary/80 font-medium flex items-center gap-1"
          onClick={onOpenCreateFolder}
        >
          <FolderPlus className="h-3.5 w-3.5" />
          Create folder
        </button>
      )}
    </div>
  );
}

function RefreshRateSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="grid gap-2">
      <Label className="text-slate-700 font-medium">Refresh rate</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="rounded-xl border-slate-200">
          <SelectValue placeholder="Select refresh rate" />
        </SelectTrigger>
        <SelectContent className="rounded-xl">
          <SelectItem value="never" className="rounded-lg">Never</SelectItem>
          <SelectItem value="daily" className="rounded-lg">Daily</SelectItem>
          <SelectItem value="weekly" className="rounded-lg">Weekly</SelectItem>
          <SelectItem value="monthly" className="rounded-lg">Monthly</SelectItem>
        </SelectContent>
      </Select>
      <p className="text-xs text-slate-500">How often the data source will sync automatically.</p>
    </div>
  );
}

export function AddDataSourceDrawer({
  open,
  onOpenChange,
  folders = [],
  onUploadFiles,
  onImportUrls,
  onImportSitemap,
  onImportPlainText,
  onOpenCreateFolder,
  onConnectZendesk,
}: AddDataSourceDrawerProps) {
  const [page, setPage] = React.useState<"home" | SourceType>("home");

  // Upload state
  const [uploadFiles, setUploadFiles] = React.useState<File[]>([]);
  const [uploadChunking, setUploadChunking] = React.useState<ChunkingStrategyKey[]>([]);
  const [uploadFolder, setUploadFolder] = React.useState("");
  const [uploadChunkSize, setUploadChunkSize] = React.useState(1000);
  const [uploadChunkOverlap, setUploadChunkOverlap] = React.useState(200);
  const [uploadProgress, setUploadProgress] = React.useState<Record<string, number>>({});
  const [uploadSubmitting, setUploadSubmitting] = React.useState(false);

  // URL state
  const [urlsText, setUrlsText] = React.useState("");
  const [urlRefreshRate, setUrlRefreshRate] = React.useState("never");
  const [urlChunking, setUrlChunking] = React.useState<ChunkingStrategyKey[]>([]);
  const [urlFolder, setUrlFolder] = React.useState("");
  const [urlSubmitting, setUrlSubmitting] = React.useState(false);

  // Sitemap state
  const [sitemapUrl, setSitemapUrl] = React.useState("");
  const [sitemapRefreshRate, setSitemapRefreshRate] = React.useState("never");
  const [sitemapChunking, setSitemapChunking] = React.useState<ChunkingStrategyKey[]>([]);
  const [sitemapFolder, setSitemapFolder] = React.useState("");
  const [sitemapSubmitting, setSitemapSubmitting] = React.useState(false);

  // Plain text state
  const [plainText, setPlainText] = React.useState("");
  const [plainChunking, setPlainChunking] = React.useState<ChunkingStrategyKey[]>([]);
  const [plainFolder, setPlainFolder] = React.useState("");
  const [plainSubmitting, setPlainSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setPage("home");
      setUploadFiles([]);
      setUploadChunking([]);
      setUploadFolder("");
      setUploadChunkSize(1000);
      setUploadChunkOverlap(200);
      setUploadProgress({});
      setUploadSubmitting(false);
      setUrlsText("");
      setUrlRefreshRate("never");
      setUrlChunking([]);
      setUrlFolder("");
      setUrlSubmitting(false);
      setSitemapUrl("");
      setSitemapRefreshRate("never");
      setSitemapChunking([]);
      setSitemapFolder("");
      setSitemapSubmitting(false);
      setPlainText("");
      setPlainChunking([]);
      setPlainFolder("");
      setPlainSubmitting(false);
    }
  }, [open]);

  const navigate = (next: "home" | SourceType) => setPage(next);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => {
      setUploadFiles((prev) => [...prev, ...acceptedFiles]);
    },
  });

  const removeUploadFile = (name: string) => {
    setUploadFiles((prev) => prev.filter((f) => f.name !== name));
  };

  const handleUpload = async () => {
    if (!onUploadFiles || uploadFiles.length === 0) return;
    setUploadSubmitting(true);
    // Simulate progress per file
    const timers = uploadFiles.map((file, i) => {
      return setInterval(() => {
        setUploadProgress((prev) => {
          const current = prev[file.name] || 0;
          return { ...prev, [file.name]: Math.min(current + 10, 90) };
        });
      }, 300 + i * 100);
    });
    try {
      await onUploadFiles({
        files: uploadFiles,
        chunkingStrategy: uploadChunking.join(","),
        chunkSize: uploadChunkSize,
        chunkOverlap: uploadChunkOverlap,
        folderId: uploadFolder || undefined,
      });
      uploadFiles.forEach((f) => setUploadProgress((prev) => ({ ...prev, [f.name]: 100 })));
      setTimeout(() => onOpenChange(false), 600);
    } finally {
      timers.forEach(clearInterval);
      setUploadSubmitting(false);
    }
  };

  const handleUrlImport = async () => {
    if (!onImportUrls) return;
    const urls = urlsText
      .split(/\n/)
      .map((u) => u.trim())
      .filter(Boolean);
    if (urls.length === 0) return;
    setUrlSubmitting(true);
    try {
      await onImportUrls({
        urls,
        refreshRate: urlRefreshRate,
        chunkingStrategy: urlChunking.join(","),
        folderId: urlFolder || undefined,
      });
      onOpenChange(false);
    } finally {
      setUrlSubmitting(false);
    }
  };

  const handleSitemapImport = async () => {
    if (!onImportSitemap || !sitemapUrl.trim()) return;
    setSitemapSubmitting(true);
    try {
      await onImportSitemap({
        sitemapUrl: sitemapUrl.trim(),
        refreshRate: sitemapRefreshRate,
        chunkingStrategy: sitemapChunking.join(","),
        folderId: sitemapFolder || undefined,
      });
      onOpenChange(false);
    } finally {
      setSitemapSubmitting(false);
    }
  };

  const handlePlainTextImport = async () => {
    if (!onImportPlainText || !plainText.trim()) return;
    setPlainSubmitting(true);
    try {
      await onImportPlainText({
        text: plainText.trim(),
        chunkingStrategy: plainChunking.join(","),
        folderId: plainFolder || undefined,
      });
      onOpenChange(false);
    } finally {
      setPlainSubmitting(false);
    }
  };

  const handleZendeskConnect = () => {
    onConnectZendesk?.();
    onOpenChange(false);
  };

  const titleForPage: Record<SourceType, string> = {
    upload: "Upload file",
    url: "Import URL(s)",
    sitemap: "Import sitemap",
    plainText: "Import plain text",
    zendesk: "Connect Zendesk",
    knowledgeApi: "Knowledge API",
  };

  const descriptionForPage: Record<SourceType, string> = {
    upload: "Upload PDF, TXT, DOCX, CSV, or Markdown files.",
    url: "Add one or more web pages as sources.",
    sitemap: "Bulk import pages from a sitemap.xml file.",
    plainText: "Paste or type content directly into the knowledge base.",
    zendesk: "Sync help center articles from Zendesk.",
    knowledgeApi: "Add and query sources using the Knowledge API.",
  };

  const iconForPage: Record<SourceType, React.ReactNode> = {
    upload: <Upload className="h-5 w-5" />,
    url: <Link className="h-5 w-5" />,
    sitemap: <Map className="h-5 w-5" />,
    plainText: <FileText className="h-5 w-5" />,
    zendesk: <MessageSquare className="h-5 w-5" />,
    knowledgeApi: <Database className="h-5 w-5" />,
  };

  const curl = `curl -X POST https://api.example.com/knowledge-base/query \\
  -H "Authorization: Bearer \$TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "query": "What is the refund policy?",
    "filters": { "product": "console" },
    "top_k": 5
  }'`;

  return (
    <Sheet open={open} onOpenChange={(v) => !uploadSubmitting && !urlSubmitting && !sitemapSubmitting && !plainSubmitting && onOpenChange(v)} modal={false}>
      <SheetContent side="right" className="w-full sm:max-w-xl lg:max-w-2xl border-l-0 bg-white p-0 shadow-2xl flex flex-col">
        <SheetHeader className="sticky top-0 z-10 bg-gradient-to-r from-primary to-emerald-600 px-6 py-5 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-white/20 p-2">
              {page === "home" ? <Plus className="h-5 w-5 text-white" /> : iconForPage[page]}
            </div>
            <div>
              <SheetTitle className="text-lg font-semibold text-white">
                {page === "home" ? "Add data source" : titleForPage[page]}
              </SheetTitle>
              <SheetDescription className="text-emerald-50">
                {page === "home"
                  ? "Choose how you want to add knowledge to this agent."
                  : descriptionForPage[page]}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {page !== "home" && (
          <div className="px-6 py-3 border-b border-slate-100 bg-slate-50/50 shrink-0">
            <button
              type="button"
              onClick={() => navigate("home")}
              className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-primary transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to sources
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {page === "home" && (
            <div className="grid gap-3">
              {SOURCE_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  onClick={() => navigate(option.id)}
                  className="group flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-4 text-left shadow-sm transition-all hover:border-primary/30 hover:shadow-md hover:bg-emerald-50/30"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-primary transition-colors group-hover:bg-primary group-hover:text-white">
                    {option.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-800">{option.label}</span>
                      {option.badge && (
                        <Badge variant="outline" className="text-[10px] border-slate-200 bg-slate-50 text-slate-500">
                          {option.badge}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-slate-500">{option.description}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-300 transition-colors group-hover:text-primary" />
                </button>
              ))}
            </div>
          )}

          {page === "upload" && (
            <div className="grid gap-6">
              <div className="grid gap-2">
                <Label className="text-slate-700 font-medium">Files</Label>
                <div
                  {...getRootProps()}
                  className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-colors ${
                    isDragActive ? "border-primary bg-emerald-50" : "border-slate-200 hover:border-primary/50 bg-slate-50/50"
                  }`}
                >
                  <input {...getInputProps()} />
                  <div className="flex flex-col items-center gap-2">
                    <div className="rounded-xl bg-emerald-50 p-3 text-primary">
                      <Upload className="h-6 w-6" />
                    </div>
                    <p className="text-slate-600 font-medium">Drop files here or click to browse</p>
                    <p className="text-xs text-slate-400">PDF, TXT, MD, CSV, DOCX — up to 10 MB each</p>
                  </div>
                </div>

                {uploadFiles.length > 0 && (
                  <div className="space-y-2 mt-2">
                    {uploadFiles.map((file) => {
                      const progress = uploadProgress[file.name] || 0;
                      const done = progress >= 100;
                      return (
                        <div
                          key={file.name}
                          className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm flex flex-col gap-2"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                              <FileText className="h-4 w-4 text-primary shrink-0" />
                              <span className="text-sm font-medium text-slate-700 truncate">{file.name}</span>
                              <span className="text-xs text-slate-400 shrink-0">
                                {(file.size / 1024).toFixed(1)} KB
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeUploadFile(file.name)}
                              disabled={uploadSubmitting}
                              className="text-slate-400 hover:text-red-500 disabled:opacity-50"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                          {uploadSubmitting ? (
                            <div className="space-y-1">
                              <Progress value={progress} className="h-1.5 rounded-full bg-slate-100" />
                              <div className="flex items-center justify-between text-[11px] text-slate-500">
                                <span className="flex items-center gap-1">
                                  {done ? (
                                    <>
                                      <CheckCircle2 className="h-3 w-3 text-primary" /> Done
                                    </>
                                  ) : (
                                    <>
                                      <Loader2 className="h-3 w-3 animate-spin" /> Uploading…
                                    </>
                                  )}
                                </span>
                                <span>{Math.round(progress)}%</span>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="grid gap-2">
                <Label className="text-slate-700 font-medium">Chunking strategy</Label>
                <ChunkingStrategyBox value={uploadChunking} onChange={setUploadChunking} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label className="text-slate-700 font-medium">Chunk size</Label>
                  <Input
                    type="number"
                    min={100}
                    max={8000}
                    step={100}
                    value={uploadChunkSize}
                    onChange={(e) => setUploadChunkSize(Number(e.target.value))}
                    className="rounded-xl border-slate-200 focus-visible:ring-primary"
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="text-slate-700 font-medium">Chunk overlap</Label>
                  <Input
                    type="number"
                    min={0}
                    max={2000}
                    step={50}
                    value={uploadChunkOverlap}
                    onChange={(e) => setUploadChunkOverlap(Number(e.target.value))}
                    className="rounded-xl border-slate-200 focus-visible:ring-primary"
                  />
                </div>
              </div>

              <FolderSelect value={uploadFolder} onChange={setUploadFolder} folders={folders} onOpenCreateFolder={onOpenCreateFolder} />
            </div>
          )}

          {page === "url" && (
            <div className="grid gap-6">
              <div className="grid gap-2">
                <Label className="text-slate-700 font-medium">URL(s)</Label>
                <Textarea
                  value={urlsText}
                  onChange={(e) => setUrlsText(e.target.value)}
                  className="h-32 resize-y rounded-xl border-slate-200 focus-visible:ring-primary"
                  placeholder="https://example.com/page-1\nhttps://example.com/page-2"
                />
                <p className="text-xs text-slate-500">One URL per line.</p>
              </div>
              <RefreshRateSelect value={urlRefreshRate} onChange={setUrlRefreshRate} />
              <div className="grid gap-2">
                <Label className="text-slate-700 font-medium">Chunking strategy</Label>
                <ChunkingStrategyBox value={urlChunking} onChange={setUrlChunking} />
              </div>
              <FolderSelect value={urlFolder} onChange={setUrlFolder} folders={folders} onOpenCreateFolder={onOpenCreateFolder} />
            </div>
          )}

          {page === "sitemap" && (
            <div className="grid gap-6">
              <div className="grid gap-2">
                <Label className="text-slate-700 font-medium">Sitemap URL</Label>
                <Input
                  value={sitemapUrl}
                  onChange={(e) => setSitemapUrl(e.target.value)}
                  placeholder="https://example.com/sitemap.xml"
                  className="rounded-xl border-slate-200 focus-visible:ring-primary"
                />
                <p className="text-xs text-slate-500">e.g. https://www.domain.com/sitemap.xml</p>
              </div>
              <RefreshRateSelect value={sitemapRefreshRate} onChange={setSitemapRefreshRate} />
              <div className="grid gap-2">
                <Label className="text-slate-700 font-medium">Chunking strategy</Label>
                <ChunkingStrategyBox value={sitemapChunking} onChange={setSitemapChunking} />
              </div>
              <FolderSelect value={sitemapFolder} onChange={setSitemapFolder} folders={folders} onOpenCreateFolder={onOpenCreateFolder} />
            </div>
          )}

          {page === "plainText" && (
            <div className="grid gap-6">
              <div className="grid gap-2">
                <Label className="text-slate-700 font-medium">Content</Label>
                <Textarea
                  value={plainText}
                  onChange={(e) => setPlainText(e.target.value)}
                  className="h-48 resize-y rounded-xl border-slate-200 focus-visible:ring-primary"
                  placeholder="Paste or type text here..."
                />
              </div>
              <div className="grid gap-2">
                <Label className="text-slate-700 font-medium">Chunking strategy</Label>
                <ChunkingStrategyBox value={plainChunking} onChange={setPlainChunking} />
              </div>
              <FolderSelect value={plainFolder} onChange={setPlainFolder} folders={folders} onOpenCreateFolder={onOpenCreateFolder} />
            </div>
          )}

          {page === "zendesk" && (
            <div className="grid gap-6">
              <Card className="border-0 shadow-sm bg-slate-50/60 rounded-2xl">
                <CardContent className="p-5 space-y-4">
                  <div className="grid gap-2">
                    <Label className="text-slate-700 font-medium">Platform</Label>
                    <Select defaultValue="zendesk-help-center">
                      <SelectTrigger className="rounded-xl border-slate-200 bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="zendesk-help-center" className="rounded-lg">Zendesk help center</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-slate-700 font-medium">Subdomain URL</Label>
                    <Input
                      placeholder="https://company.zendesk.com"
                      className="rounded-xl border-slate-200 focus-visible:ring-primary"
                    />
                    <p className="text-xs text-slate-500">e.g. https://company.zendesk.com</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {page === "knowledgeApi" && (
            <div className="grid gap-4">
              <p className="text-sm text-slate-600">
                Use the Knowledge API to upload, query, and manage sources programmatically.
              </p>
              <div className="rounded-2xl bg-slate-950 p-4 overflow-auto">
                <pre className="text-xs text-slate-100 whitespace-pre-wrap">
                  <code>{curl}</code>
                </pre>
              </div>
              <p className="text-sm text-slate-600">
                Authentication uses Bearer tokens with project or agent credentials.
              </p>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 border-t border-slate-100 bg-white/90 backdrop-blur px-6 py-4 flex justify-between shrink-0">
          <Button
            variant="outline"
            onClick={() => (page === "home" ? onOpenChange(false) : navigate("home"))}
            disabled={uploadSubmitting || urlSubmitting || sitemapSubmitting || plainSubmitting}
            className="rounded-xl border-slate-200 gap-2"
          >
            {page === "home" ? "Cancel" : <><ArrowLeft className="h-4 w-4" /> Back</>}
          </Button>

          {page === "upload" && (
            <Button
              onClick={handleUpload}
              disabled={uploadFiles.length === 0 || uploadSubmitting}
              className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
            >
              {uploadSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {uploadSubmitting ? "Uploading…" : `Upload ${uploadFiles.length > 0 ? uploadFiles.length : ""} file${uploadFiles.length === 1 ? "" : "s"}`}
            </Button>
          )}

          {page === "url" && (
            <Button
              onClick={handleUrlImport}
              disabled={urlsText.trim().length === 0 || urlSubmitting}
              className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
            >
              {urlSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {urlSubmitting ? "Importing…" : "Import URLs"}
            </Button>
          )}

          {page === "sitemap" && (
            <Button
              onClick={handleSitemapImport}
              disabled={!sitemapUrl.trim() || sitemapSubmitting}
              className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
            >
              {sitemapSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {sitemapSubmitting ? "Importing…" : "Import sitemap"}
            </Button>
          )}

          {page === "plainText" && (
            <Button
              onClick={handlePlainTextImport}
              disabled={!plainText.trim() || plainSubmitting}
              className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
            >
              {plainSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {plainSubmitting ? "Importing…" : "Import text"}
            </Button>
          )}

          {page === "zendesk" && (
            <Button
              onClick={handleZendeskConnect}
              className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
            >
              Connect
            </Button>
          )}

          {page === "knowledgeApi" && (
            <Button
              variant="outline"
              onClick={() => window.open("https://docs.example.com/knowledge-api", "_blank")}
              className="rounded-xl border-slate-200"
            >
              Open docs
            </Button>
          )}

          {page === "home" && <div />}
        </div>
      </SheetContent>
    </Sheet>
  );
}

"use client";

import React from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../ui/dialog";
import { Button } from "../../ui/button";
import { Label } from "../../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import { Slider } from "../../ui/slider";
import { Input } from "../../ui/input";
import { Textarea } from "../../ui/textarea";
import { Separator } from "../../ui/separator";

interface KnowledgeBaseSettingsDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function KnowledgeBaseSettingsDialog({ open, onOpenChange }: KnowledgeBaseSettingsDialogProps) {
  const [temperature, setTemperature] = React.useState([0.1]);
  const [chunkLimit, setChunkLimit] = React.useState([3]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Knowledge base settings</DialogTitle>
          <DialogDescription />
        </DialogHeader>
        <div className="space-y-6">
          <div className="space-y-2">
            <Label className="text-slate-700">AI model</Label>
            <Select defaultValue="claude-sonnet">
              <SelectTrigger>
                <SelectValue placeholder="Select a model" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="claude-sonnet">Claude 4 - Sonnet</SelectItem>
                <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                <SelectItem value="gpt-4.1">GPT-4.1</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-slate-700">Temperature</Label>
              <span className="text-xs text-slate-500">{temperature[0].toFixed(2)}</span>
            </div>
            <Slider min={0} max={1} step={0.01} value={temperature} onValueChange={setTemperature} />
            <div className="flex justify-between text-xs text-slate-500">
              <span>Deterministic</span>
              <span>Random</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-slate-700">Max tokens</Label>
            <Input type="number" min={10} max={24000} defaultValue={500} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-slate-700">Chunk limit</Label>
              <span className="text-xs text-slate-500">{chunkLimit[0]}</span>
            </div>
            <Slider min={1} max={10} step={1} value={chunkLimit} onValueChange={setChunkLimit} />
            <div className="flex justify-between text-xs text-slate-500">
              <span>1</span>
              <span>10</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-slate-700">System</Label>
            <Textarea rows={6} defaultValue={`You are an FAQ AI chat agent. Information will be provided to help answer the user's questions. Always summarize your response to be as brief as possible and be extremely concise. Your responses should be fewer than a couple of sentences.`} />
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <Button variant="ghost" onClick={() => { setTemperature([0.1]); setChunkLimit([3]); }}>Reset to default</Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={() => onOpenChange(false)}>Save</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

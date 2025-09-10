"use client";

import React from "react";
import { Button } from "../ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../ui/sheet";
import { Input } from "../ui/input";
import { Separator } from "../ui/separator";

export function KnowledgeBaseTester() {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <div className="fixed bottom-4 right-4 z-40">
        <Button className="shadow-lg" onClick={() => setOpen(true)}>
          <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/20">💬</span>
          Test your agent
        </Button>
      </div>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="p-0 w-[380px] sm:w-[420px]">
          <div className="flex h-full flex-col">
            <div className="p-3 bg-blue-600 text-white rounded-t-lg">
              <div className="flex items-center justify-between">
                <SheetTitle className="text-white">Demo agent</SheetTitle>
                <div className="flex items-center gap-2 opacity-80">
                  <span className="text-xs">↻</span>
                  <span className="text-xs">↪</span>
                </div>
              </div>
            </div>
            <div className="p-4">
              <div className="flex items-center justify-center mb-3">
                <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">⚙️</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-slate-900">Demo agent</div>
                <div className="text-xs text-slate-500">Learn the Voiceflow basics</div>
              </div>
              <div className="mt-4">
                <div className="rounded-md bg-slate-100 inline-block px-3 py-2 text-sm text-slate-700">Hi, I'm Connor. An AI agent that will demonstrate some key c</div>
              </div>
            </div>
            <div className="mt-auto p-4">
              <Separator className="mb-3" />
              <div className="flex items-center gap-2">
                <Input placeholder="Message..." className="flex-1" />
                <Button className="shrink-0">➤</Button>
              </div>
              <div className="mt-2 text-[10px] text-slate-400 text-center">Powered by Voiceflow</div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

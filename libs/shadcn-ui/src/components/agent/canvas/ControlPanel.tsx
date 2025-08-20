"use client";

import React from 'react';
import { Button } from '../../ui/button';
import { ZoomIn, ZoomOut, Maximize, RotateCcw, Grid } from 'lucide-react';

export type ControlPanelProps = {
  onZoomOut: () => void;
  onZoomIn: () => void;
  onFitView: () => void;
  onReset: () => void;
  onToggleGrid: () => void;
};

export function ControlPanel({ onZoomOut, onZoomIn, onFitView, onReset, onToggleGrid }: ControlPanelProps) {
  return (
    <div className="fixed bottom-4 left-20 flex items-center gap-1 bg-white rounded-lg border border-gray-200 p-1 shadow-sm z-20">
      <Button variant="ghost" size="sm" className="w-8 h-8 p-0" onClick={onZoomOut}>
        <ZoomOut className="w-4 h-4" />
      </Button>
      <Button variant="ghost" size="sm" className="w-8 h-8 p-0" onClick={onZoomIn}>
        <ZoomIn className="w-4 h-4" />
      </Button>
      <Button variant="ghost" size="sm" className="w-8 h-8 p-0" onClick={onFitView}>
        <Maximize className="w-4 h-4" />
      </Button>
      <Button variant="ghost" size="sm" className="w-8 h-8 p-0" onClick={onReset}>
        <RotateCcw className="w-4 h-4" />
      </Button>
      <Button variant="ghost" size="sm" className="w-8 h-8 p-0" onClick={onToggleGrid}>
        <Grid className="w-4 h-4" />
      </Button>
    </div>
  );
}

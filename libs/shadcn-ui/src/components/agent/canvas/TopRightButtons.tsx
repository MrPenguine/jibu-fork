"use client";

import React from 'react';
import { Button } from '../../ui/button';
import { Avatar, AvatarFallback } from '../../ui/avatar';
import { Share, Phone, Play, Upload, Plus, Loader2 } from 'lucide-react';

export type TopRightButtonsProps = {
  onRun?: () => void;
  onPublish?: () => void;
  isPublishing?: boolean;
  isSaving?: boolean;
  isPublished?: boolean;
};

export function TopRightButtons({
  onRun,
  onPublish,
  isPublishing = false,
  isSaving = false,
  isPublished = false,
}: TopRightButtonsProps) {
  return (
    <div className="fixed top-4 right-4 flex items-center gap-2 z-30">
      <Button variant="ghost" size="sm" className="text-gray-600 hover:text-gray-900">
        <Plus className="w-4 h-4 mr-1" />
        <span className="text-sm">1</span>
      </Button>

      {/* Avatar placed next to +1 */}
      <Avatar className="w-8 h-8">
        <AvatarFallback className="bg-orange-500 text-white text-sm">D</AvatarFallback>
      </Avatar>

      <Button variant="outline" size="sm" className="text-gray-700 bg-transparent">
        <Share className="w-4 h-4 mr-2" />
        Share
      </Button>

      <Button variant="outline" size="sm" className="text-gray-700 bg-transparent">
        <Phone className="w-4 h-4 mr-2" />
        Call
      </Button>

      <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={onRun}>
        <Play className="w-4 h-4 mr-2" />
        Run
      </Button>

      <Button
        size="sm"
        className="bg-green-600 hover:bg-green-700 text-white"
        onClick={onPublish}
        disabled={isPublishing || isSaving}
      >
        {isPublishing ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <Upload className="w-4 h-4 mr-2" />
        )}
        {isPublished ? 'Published' : 'Publish'}
      </Button>
    </div>
  );
}

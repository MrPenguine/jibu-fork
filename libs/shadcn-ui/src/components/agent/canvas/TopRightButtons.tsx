"use client";

import React from 'react';
import { Button } from '../../ui/button';
import { Avatar, AvatarFallback } from '../../ui/avatar';
import { Share, Phone, Play, Upload, Plus, Loader2, History, Save } from 'lucide-react';

export type TopRightButtonsProps = {
  onRun?: () => void;
  onPublish?: () => void;
  isPublishing?: boolean;
  isSaving?: boolean;
  isPublished?: boolean;
  onOpenVersionHistory?: () => void;
  onSave?: () => void;
  hasUnsavedChanges?: boolean;
  lastSavedAt?: Date | null;
};

export function TopRightButtons({
  onRun,
  onPublish,
  isPublishing = false,
  isSaving = false,
  isPublished = false,
  onOpenVersionHistory,
  onSave,
  hasUnsavedChanges = false,
  lastSavedAt = null,
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

      {/* Version History and Last Saved */}
      <Button
        variant="outline"
        size="sm"
        className="text-gray-700 bg-transparent"
        onClick={onOpenVersionHistory}
      >
        <History className="w-4 h-4 mr-2" />
        History
      </Button>
      {lastSavedAt && (
        <div className="text-xs text-gray-500 ml-1 mr-1 whitespace-nowrap">
          Saved {lastSavedAt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
        </div>
      )}

      {/* Save Button */}
      <Button
        size="sm"
        className="bg-indigo-600 hover:bg-indigo-700 text-white"
        onClick={onSave}
        disabled={isSaving || !hasUnsavedChanges}
      >
        {isSaving ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <Save className="w-4 h-4 mr-2" />
        )}
        Save
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

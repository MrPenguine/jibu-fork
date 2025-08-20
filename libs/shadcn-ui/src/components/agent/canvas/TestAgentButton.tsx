"use client";

import React from 'react';
import { Button } from '../../ui/button';
import { Play } from 'lucide-react';

export type TestAgentButtonProps = {
  onClick?: () => void;
};

export function TestAgentButton({ onClick }: TestAgentButtonProps) {
  return (
    <div className="fixed bottom-4 right-4 z-20">
      <Button
        size="lg"
        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg shadow-lg"
        onClick={onClick}
      >
        <Play className="w-4 h-4 mr-2" />
        Test your agent
      </Button>
    </div>
  );
}

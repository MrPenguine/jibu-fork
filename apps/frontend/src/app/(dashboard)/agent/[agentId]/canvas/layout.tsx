"use client";

import React, { ReactNode } from 'react';

export default function CanvasLayout({ 
  children
}: { 
  children: ReactNode;
}) {
  // Minimal layout that relies on the parent agent layout for the sidebar
  return children;
}

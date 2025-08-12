"use client";

import { useEffect } from "react";

export default function MswLoader() {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_API_MOCKING === "enabled") {
      import("../mocks").then(({ initMocks }) => initMocks());
    }
  }, []);
  return null;
}

"use client";

import { ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";

export function Portal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {(async () => setMounted(true))()}, []);
  if (!mounted) return null;

  return createPortal(children, document.body);
}

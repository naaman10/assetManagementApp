"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { usePathname } from "next/navigation";

type MobileSearchControls = {
  expanded: boolean;
  toggle: () => void;
  expand: () => void;
  close: () => void;
};

const MobileSearchContext = createContext<MobileSearchControls | null>(null);

export function MobileSearchProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(false);
  const [expandedOnPath, setExpandedOnPath] = useState(pathname);
  const toggle = useCallback(() => {
    setExpanded((current) => !current);
  }, []);
  const expand = useCallback(() => {
    setExpanded(true);
  }, []);
  const close = useCallback(() => {
    setExpanded(false);
  }, []);

  if (pathname !== expandedOnPath) {
    setExpandedOnPath(pathname);
    setExpanded(false);
  }

  return (
    <MobileSearchContext.Provider value={{ expanded, toggle, expand, close }}>
      {children}
    </MobileSearchContext.Provider>
  );
}

export function useMobileSearch(): MobileSearchControls {
  const controls = useContext(MobileSearchContext);

  if (!controls) {
    throw new Error("useMobileSearch must be used within MobileSearchProvider");
  }

  return controls;
}

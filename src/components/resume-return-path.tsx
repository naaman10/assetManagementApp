"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AUTH_RETURN_PATH_KEY, safeReturnPath } from "@/lib/return-path";

export function ResumeReturnPath() {
  const router = useRouter();

  useEffect(() => {
    let stored: string | null = null;

    try {
      stored = sessionStorage.getItem(AUTH_RETURN_PATH_KEY);
      sessionStorage.removeItem(AUTH_RETURN_PATH_KEY);
    } catch {
      return;
    }

    if (!stored) {
      return;
    }

    const path = safeReturnPath(stored);

    if (path !== "/") {
      router.replace(path);
    }
  }, [router]);

  return null;
}

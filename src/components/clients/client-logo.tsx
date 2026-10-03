"use client";

import { useRef, useState } from "react";
import { safeLogoUrl } from "@/lib/clients";

export function ClientLogo({
  name,
  logoUrl,
  size,
  onReload,
}: {
  name: string;
  logoUrl: string | null;
  size: "list" | "detail";
  onReload?: () => Promise<string | null>;
}) {
  const source = safeLogoUrl(logoUrl);
  const retries = useRef(0);
  const [brokenUrl, setBrokenUrl] = useState<string | null>(null);
  const frame =
    size === "detail"
      ? "size-24 rounded-card"
      : "size-12 rounded-2xl";

  if (!source || brokenUrl === source) {
    return <LogoPlaceholder name={name} className={frame} />;
  }

  return (
    // Signed logo URLs expire, so they are not run through the image optimizer.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={source}
      alt=""
      className={`${frame} shrink-0 bg-surface-warm object-cover`}
      onError={() => {
        if (!onReload || retries.current >= 1) {
          setBrokenUrl(source);
          return;
        }

        retries.current += 1;
        void onReload()
          .then((next) => {
            const refreshed = safeLogoUrl(next);

            if (!refreshed || refreshed === source) {
              setBrokenUrl(source);
            }
          })
          .catch(() => {
            setBrokenUrl(source);
          });
      }}
    />
  );
}

function LogoPlaceholder({
  name,
  className,
}: {
  name: string;
  className: string;
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <span
      aria-label="No logo"
      className={`${className} grid shrink-0 place-items-center bg-inverse text-sm font-medium text-inverse-foreground`}
    >
      {initials || "—"}
    </span>
  );
}

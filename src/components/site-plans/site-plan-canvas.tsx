"use client";

import { useEffect, useRef, useState } from "react";
import {
  isPlanImage,
  isPlanPdf,
  planFeatureLabel,
  toPlanPoint,
  type DraftRect,
  type LocalPlanFeature,
} from "@/lib/site-plans";

export function SitePlanCanvas({
  url,
  contentType,
  features,
  canDraw,
  selectedKey,
  draftRect,
  onDraftChange,
  onDraftComplete,
  onSelectFeature,
  onUrlExpired,
}: {
  url: string;
  contentType: string;
  features: LocalPlanFeature[];
  canDraw: boolean;
  selectedKey: string | null;
  draftRect: DraftRect | null;
  onDraftChange: (rect: DraftRect | null) => void;
  onDraftComplete: (rect: DraftRect) => void;
  onSelectFeature: (feature: LocalPlanFeature) => void;
  onUrlExpired: () => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const retriedRef = useRef(false);
  const onUrlExpiredRef = useRef(onUrlExpired);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfReady, setPdfReady] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const showImage = isPlanImage(contentType);
  const showPdf = isPlanPdf(contentType);

  useEffect(() => {
    onUrlExpiredRef.current = onUrlExpired;
  }, [onUrlExpired]);

  useEffect(() => {
    const box = boxRef.current;

    if (!box) {
      return;
    }

    function syncWidth(width: number) {
      const next = Math.floor(width);

      if (next > 0) {
        setContainerWidth((current) => (current === next ? current : next));
      }
    }

    syncWidth(box.clientWidth);

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];

      if (!entry) {
        return;
      }

      syncWidth(entry.contentRect.width);
    });

    observer.observe(box);

    return () => {
      observer.disconnect();
    };
  }, [showPdf, showImage, url]);

  useEffect(() => {
    if (!showPdf || containerWidth <= 0) {
      return;
    }

    let cancelled = false;
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    async function renderPdf(target: HTMLCanvasElement) {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const loadingTask = pdfjs.getDocument({ url });
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);
        const baseViewport = page.getViewport({ scale: 1 });
        const scale = containerWidth / baseViewport.width;
        const viewport = page.getViewport({ scale });
        const outputScale = window.devicePixelRatio || 1;

        // Backing store matches CSS box; keep CSS width 100% so overlay and
        // canvas always share the same measured box as the container resizes.
        target.width = Math.floor(viewport.width * outputScale);
        target.height = Math.floor(viewport.height * outputScale);
        target.style.width = "100%";
        target.style.height = "auto";
        target.style.aspectRatio = `${viewport.width} / ${viewport.height}`;

        const context = target.getContext("2d");

        if (!context) {
          throw new Error("Could not create a canvas context.");
        }

        const transform =
          outputScale === 1 ? undefined : [outputScale, 0, 0, outputScale, 0, 0];

        await page.render({
          canvas: target,
          canvasContext: context,
          viewport,
          transform,
        }).promise;

        if (!cancelled) {
          setPdfReady(true);
          setPdfError(null);
        }
      } catch {
        if (!cancelled) {
          setPdfReady(false);
          setPdfError("The PDF could not be rendered.");

          if (!retriedRef.current) {
            retriedRef.current = true;
            onUrlExpiredRef.current();
          }
        }
      }
    }

    void renderPdf(canvas);

    return () => {
      cancelled = true;
    };
  }, [showPdf, url, containerWidth]);

  function handleMediaError() {
    if (retriedRef.current) {
      return;
    }

    retriedRef.current = true;
    onUrlExpiredRef.current();
  }

  function pointerToDraft(
    event: React.PointerEvent<SVGSVGElement>,
    start: DraftRect | null,
  ): DraftRect | null {
    const box = boxRef.current?.getBoundingClientRect();

    if (!box || box.width <= 0 || box.height <= 0) {
      return null;
    }

    const [x, y] = toPlanPoint(event.clientX, event.clientY, box);

    if (!start) {
      return { x0: x, y0: y, x1: x, y1: y };
    }

    return { ...start, x1: x, y1: y };
  }

  const overlay = (
    <svg
      viewBox="0 0 1 1"
      preserveAspectRatio="none"
      className={`absolute inset-0 h-full w-full ${canDraw ? "cursor-crosshair" : ""} ${
        canDraw || features.length > 0 ? "" : "pointer-events-none"
      }`}
      role="img"
      aria-label="Room overlays"
      onPointerDown={(event) => {
        if (!canDraw || event.button !== 0) {
          return;
        }

        if ((event.target as Element).closest("[data-plan-feature]")) {
          return;
        }

        const next = pointerToDraft(event, null);

        if (!next) {
          return;
        }

        drawingRef.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        onDraftChange(next);
      }}
      onPointerMove={(event) => {
        if (!drawingRef.current || !draftRect) {
          return;
        }

        const next = pointerToDraft(event, draftRect);

        if (next) {
          onDraftChange(next);
        }
      }}
      onPointerUp={(event) => {
        if (!drawingRef.current || !draftRect) {
          return;
        }

        drawingRef.current = false;

        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }

        const next = pointerToDraft(event, draftRect) ?? draftRect;
        onDraftComplete(next);
      }}
      onPointerCancel={() => {
        drawingRef.current = false;
        onDraftChange(null);
      }}
    >
      {features.map((feature) => {
        const ring = feature.geometry.coordinates[0] ?? [];
        const points = ring.map(([x, y]) => `${x},${y}`).join(" ");
        const selected = feature.key === selectedKey;
        const label = planFeatureLabel(feature);
        const centroid = polygonCentroid(ring);

        return (
          <g key={feature.key} data-plan-feature="">
            <polygon
              points={points}
              className={
                selected
                  ? "fill-brand-500/35 stroke-brand-600"
                  : "fill-brand-500/15 stroke-brand-500/70 hover:fill-brand-500/25"
              }
              strokeWidth={selected ? 0.004 : 0.002}
              vectorEffect="non-scaling-stroke"
              role="button"
              tabIndex={0}
              aria-label={label}
              aria-pressed={selected}
              style={{ cursor: "pointer", pointerEvents: "auto" }}
              onClick={(event) => {
                event.stopPropagation();
                onSelectFeature(feature);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelectFeature(feature);
                }
              }}
            />
            {centroid ? (
              <text
                x={centroid.x}
                y={centroid.y}
                textAnchor="middle"
                dominantBaseline="middle"
                className="pointer-events-none fill-gray-800"
                style={{ fontSize: 0.028 }}
              >
                {label}
              </text>
            ) : null}
          </g>
        );
      })}
      {draftRect ? (
        <rect
          x={Math.min(draftRect.x0, draftRect.x1)}
          y={Math.min(draftRect.y0, draftRect.y1)}
          width={Math.abs(draftRect.x1 - draftRect.x0)}
          height={Math.abs(draftRect.y1 - draftRect.y0)}
          className="fill-brand-500/20 stroke-brand-600"
          strokeWidth={0.003}
          vectorEffect="non-scaling-stroke"
          pointerEvents="none"
        />
      ) : null}
    </svg>
  );

  return (
    <div className="relative min-w-0 overflow-hidden rounded-lg border border-gray-200 bg-white">
      {showPdf ? (
        <div ref={boxRef} className="relative w-full bg-gray-100">
          <canvas ref={canvasRef} className="block w-full" />
          {!pdfReady && !pdfError ? (
            <p className="absolute inset-0 flex items-center justify-center text-sm text-gray-500">
              Rendering PDF…
            </p>
          ) : null}
          {pdfError ? (
            <p className="absolute inset-0 flex items-center justify-center p-4 text-sm text-error-600">
              {pdfError}
            </p>
          ) : null}
          {overlay}
        </div>
      ) : null}

      {showImage ? (
        <div ref={boxRef} className="relative w-full bg-gray-100">
          {/* eslint-disable-next-line @next/next/no-img-element -- signed plan URL from API */}
          <img
            src={url}
            alt="Site plan"
            className="block h-auto w-full"
            draggable={false}
            onError={handleMediaError}
          />
          {overlay}
        </div>
      ) : null}

      {!showImage && !showPdf ? (
        <p className="p-4 text-sm text-gray-500">
          Unsupported plan type ({contentType}).
        </p>
      ) : null}
    </div>
  );
}

function polygonCentroid(ring: number[][]): { x: number; y: number } | null {
  if (ring.length === 0) {
    return null;
  }

  let sumX = 0;
  let sumY = 0;
  let count = 0;

  for (const point of ring) {
    const x = point[0];
    const y = point[1];

    if (typeof x !== "number" || typeof y !== "number") {
      continue;
    }

    sumX += x;
    sumY += y;
    count += 1;
  }

  if (count === 0) {
    return null;
  }

  return { x: sumX / count, y: sumY / count };
}

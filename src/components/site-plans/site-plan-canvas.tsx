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

type MediaSize = {
  width: number;
  height: number;
};

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
  const frameRef = useRef<HTMLDivElement>(null);
  const mediaRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const retriedRef = useRef(false);
  const onUrlExpiredRef = useRef(onUrlExpired);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfReady, setPdfReady] = useState(false);
  const [frameWidth, setFrameWidth] = useState(0);
  const [mediaSize, setMediaSize] = useState<MediaSize | null>(null);
  const showImage = isPlanImage(contentType);
  const showPdf = isPlanPdf(contentType);

  useEffect(() => {
    onUrlExpiredRef.current = onUrlExpired;
  }, [onUrlExpired]);

  useEffect(() => {
    const frame = frameRef.current;

    if (!frame) {
      return;
    }

    function syncWidth(width: number) {
      const next = Math.floor(width);

      if (next > 0) {
        setFrameWidth((current) => (current === next ? current : next));
      }
    }

    syncWidth(frame.clientWidth);

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];

      if (!entry) {
        return;
      }

      syncWidth(entry.contentRect.width);
    });

    observer.observe(frame);

    return () => {
      observer.disconnect();
    };
  }, [showPdf, showImage, url]);

  useEffect(() => {
    if (!showPdf || frameWidth <= 0) {
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
        const cssScale = frameWidth / baseViewport.width;
        const outputScale = window.devicePixelRatio || 1;
        const viewport = page.getViewport({ scale: cssScale * outputScale });
        const cssWidth = Math.floor(baseViewport.width * cssScale);
        const cssHeight = Math.floor(baseViewport.height * cssScale);

        target.width = Math.floor(viewport.width);
        target.height = Math.floor(viewport.height);
        // Explicit CSS pixel size — do not use width:100%/auto (canvas
        // attributes otherwise fight the overlay box).
        target.style.width = `${cssWidth}px`;
        target.style.height = `${cssHeight}px`;

        const context = target.getContext("2d");

        if (!context) {
          throw new Error("Could not create a canvas context.");
        }

        context.setTransform(1, 0, 0, 1, 0, 0);
        context.clearRect(0, 0, target.width, target.height);

        await page.render({
          canvas: target,
          canvasContext: context,
          viewport,
        }).promise;

        if (!cancelled) {
          setMediaSize({ width: cssWidth, height: cssHeight });
          setPdfReady(true);
          setPdfError(null);
        }
      } catch {
        if (!cancelled) {
          setPdfReady(false);
          setPdfError("The PDF could not be rendered.");
          setMediaSize(null);

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
  }, [showPdf, url, frameWidth]);

  function handleMediaError() {
    if (retriedRef.current) {
      return;
    }

    retriedRef.current = true;
    onUrlExpiredRef.current();
  }

  function handleImageLoad(event: React.SyntheticEvent<HTMLImageElement>) {
    const image = event.currentTarget;
    const width = Math.floor(image.clientWidth);
    const height = Math.floor(image.clientHeight);

    if (width > 0 && height > 0) {
      setMediaSize({ width, height });
    }
  }

  useEffect(() => {
    if (!showImage || frameWidth <= 0) {
      return;
    }

    const image = mediaRef.current?.querySelector("img");

    if (!image || image.clientWidth <= 0 || image.clientHeight <= 0) {
      return;
    }

    setMediaSize({
      width: Math.floor(image.clientWidth),
      height: Math.floor(image.clientHeight),
    });
  }, [showImage, frameWidth, url]);

  function pointerToDraft(
    event: React.PointerEvent<SVGSVGElement>,
    start: DraftRect | null,
  ): DraftRect | null {
    const box = mediaRef.current?.getBoundingClientRect();

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
      <div ref={frameRef} className="w-full bg-gray-100">
        {showPdf ? (
          <div
            ref={mediaRef}
            className="relative mx-auto"
            style={
              mediaSize
                ? { width: mediaSize.width, height: mediaSize.height }
                : { width: "100%", minHeight: 240 }
            }
          >
            <canvas ref={canvasRef} className="block" />
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
            {mediaSize ? overlay : null}
          </div>
        ) : null}

        {showImage ? (
          <div ref={mediaRef} className="relative w-full">
            {/* eslint-disable-next-line @next/next/no-img-element -- signed plan URL from API */}
            <img
              src={url}
              alt="Site plan"
              className="block h-auto w-full"
              draggable={false}
              onLoad={handleImageLoad}
              onError={handleMediaError}
            />
            {mediaSize ? overlay : null}
          </div>
        ) : null}

        {!showImage && !showPdf ? (
          <p className="p-4 text-sm text-gray-500">
            Unsupported plan type ({contentType}).
          </p>
        ) : null}
      </div>
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

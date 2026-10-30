"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  isNearPlanPoint,
  isPlanImage,
  isPlanPdf,
  planFeatureLabel,
  toPlanPoint,
  type DraftPolygon,
  type LocalPlanFeature,
  type PlanPoint,
} from "@/lib/site-plans";

type OverlayBox = {
  left: number;
  top: number;
  width: number;
  height: number;
};

/** Normalized crop of the source page (0–1), matching stored feature coords. */
type PageCrop = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const FULL_PAGE_CROP: PageCrop = { x: 0, y: 0, width: 1, height: 1 };

export function SitePlanCanvas({
  url,
  contentType,
  features,
  canDraw,
  selectedKey,
  draftPolygon,
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
  draftPolygon: DraftPolygon | null;
  onDraftChange: (draft: DraftPolygon | null) => void;
  onDraftComplete: (draft: DraftPolygon) => void;
  onSelectFeature: (feature: LocalPlanFeature) => void;
  onUrlExpired: () => void;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const mediaRef = useRef<HTMLCanvasElement | HTMLImageElement | null>(null);
  const pointerDownRef = useRef<{
    pointerId: number;
    clientX: number;
    clientY: number;
  } | null>(null);
  const suppressClickRef = useRef(false);
  const draftPolygonRef = useRef(draftPolygon);
  const onDraftChangeRef = useRef(onDraftChange);
  const onDraftCompleteRef = useRef(onDraftComplete);
  const retriedRef = useRef(false);
  const onUrlExpiredRef = useRef(onUrlExpired);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfReady, setPdfReady] = useState(false);
  const [frameWidth, setFrameWidth] = useState(0);
  const [imageReady, setImageReady] = useState(false);
  const [loadedImageUrl, setLoadedImageUrl] = useState<string | null>(null);
  const [overlayBox, setOverlayBox] = useState<OverlayBox | null>(null);
  const [pageCrop, setPageCrop] = useState<PageCrop>(FULL_PAGE_CROP);
  const [cursorPoint, setCursorPoint] = useState<PlanPoint | null>(null);
  const pageCropRef = useRef(pageCrop);
  const showImage = isPlanImage(contentType);
  const showPdf = isPlanPdf(contentType);
  const imageIsReady = imageReady && loadedImageUrl === url;
  const mediaReady = showPdf ? pdfReady : imageIsReady;

  if (!mediaReady && overlayBox !== null) {
    setOverlayBox(null);
  }

  useEffect(() => {
    pageCropRef.current = pageCrop;
  }, [pageCrop]);

  useEffect(() => {
    draftPolygonRef.current = draftPolygon;
  }, [draftPolygon]);

  useEffect(() => {
    onDraftChangeRef.current = onDraftChange;
  }, [onDraftChange]);

  useEffect(() => {
    onDraftCompleteRef.current = onDraftComplete;
  }, [onDraftComplete]);

  useEffect(() => {
    onUrlExpiredRef.current = onUrlExpired;
  }, [onUrlExpired]);

  useEffect(() => {
    if (!canDraw) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onDraftChangeRef.current(null);
        setCursorPoint(null);
        return;
      }

      if (event.key !== "Enter") {
        return;
      }

      const draft = draftPolygonRef.current;

      if (!draft || draft.points.length < 3) {
        return;
      }

      event.preventDefault();
      onDraftCompleteRef.current(draft);
      setCursorPoint(null);
    }

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [canDraw]);

  const activeCursorPoint = canDraw ? cursorPoint : null;

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
    let renderTask: { cancel: () => void } | null = null;
    const canvas = mediaRef.current;

    if (!(canvas instanceof HTMLCanvasElement)) {
      return;
    }

    setPdfReady(false);
    setPdfError(null);
    setOverlayBox(null);
    setPageCrop(FULL_PAGE_CROP);

    async function renderPdf(target: HTMLCanvasElement) {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const loadingTask = pdfjs.getDocument({ url });
        const pdf = await loadingTask.promise;

        if (cancelled) {
          return;
        }

        const page = await pdf.getPage(1);
        const baseViewport = page.getViewport({ scale: 1 });
        // Render a bit wider than the frame so crop+fit stays sharp.
        const renderCssWidth = Math.max(frameWidth, 640);
        const scale = renderCssWidth / baseViewport.width;
        const viewport = page.getViewport({ scale });
        const outputScale = window.devicePixelRatio || 1;
        const fullCssWidth = Math.floor(viewport.width);
        const fullCssHeight = Math.floor(viewport.height);

        const full = document.createElement("canvas");
        full.width = Math.floor(fullCssWidth * outputScale);
        full.height = Math.floor(fullCssHeight * outputScale);

        const fullContext = full.getContext("2d");

        if (!fullContext) {
          throw new Error("Could not create a canvas context.");
        }

        const transform =
          outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;

        const task = page.render({
          canvas: full,
          canvasContext: fullContext,
          viewport,
          ...(transform ? { transform } : {}),
        });
        renderTask = task;
        await task.promise;

        if (cancelled) {
          return;
        }

        const ink = findInkBounds(full);
        const crop = inkToPageCrop(ink, full.width, full.height);
        const srcX = Math.floor(crop.x * full.width);
        const srcY = Math.floor(crop.y * full.height);
        const srcW = Math.max(1, Math.ceil(crop.width * full.width));
        const srcH = Math.max(1, Math.ceil(crop.height * full.height));
        // Use the live frame width so width/height stay in proportion if the
        // column is narrower than the width that triggered this render.
        const displayWidth = Math.max(
          1,
          Math.floor(frameRef.current?.clientWidth || frameWidth),
        );
        const cssWidth = displayWidth;
        const cssHeight = Math.max(
          1,
          Math.round(displayWidth * (srcH / srcW)),
        );

        target.width = Math.floor(cssWidth * outputScale);
        target.height = Math.floor(cssHeight * outputScale);
        target.style.width = "100%";
        target.style.height = "auto";
        target.style.aspectRatio = `${cssWidth} / ${cssHeight}`;

        const context = target.getContext("2d");

        if (!context) {
          throw new Error("Could not create a canvas context.");
        }

        context.setTransform(1, 0, 0, 1, 0, 0);
        context.clearRect(0, 0, target.width, target.height);
        context.drawImage(
          full,
          srcX,
          srcY,
          srcW,
          srcH,
          0,
          0,
          target.width,
          target.height,
        );

        if (!cancelled) {
          setPageCrop(crop);
          setPdfReady(true);
          setPdfError(null);
        }
      } catch (caught) {
        if (cancelled) {
          return;
        }

        const message =
          caught && typeof caught === "object" && "name" in caught
            ? String((caught as { name?: string }).name)
            : "";

        if (message === "RenderingCancelledException") {
          return;
        }

        setPdfReady(false);
        setPdfError("The PDF could not be rendered.");
        setOverlayBox(null);
        setPageCrop(FULL_PAGE_CROP);

        if (!retriedRef.current) {
          retriedRef.current = true;
          onUrlExpiredRef.current();
        }
      }
    }

    void renderPdf(canvas);

    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [showPdf, url, frameWidth]);

  // Pin the SVG to the media element's real laid-out box (relative to frame).
  useLayoutEffect(() => {
    if (!mediaReady) {
      return;
    }

    const frame = frameRef.current;
    const media = mediaRef.current;

    if (!frame || !media) {
      return;
    }

    function syncOverlayBox() {
      if (!frame || !media) {
        return;
      }

      const frameRect = frame.getBoundingClientRect();
      const mediaRect = media.getBoundingClientRect();

      if (mediaRect.width <= 0 || mediaRect.height <= 0) {
        return;
      }

      const next: OverlayBox = {
        left: mediaRect.left - frameRect.left,
        top: mediaRect.top - frameRect.top,
        width: mediaRect.width,
        height: mediaRect.height,
      };

      setOverlayBox((current) => {
        if (
          current &&
          Math.abs(current.left - next.left) < 0.5 &&
          Math.abs(current.top - next.top) < 0.5 &&
          Math.abs(current.width - next.width) < 0.5 &&
          Math.abs(current.height - next.height) < 0.5
        ) {
          return current;
        }

        return next;
      });
    }

    syncOverlayBox();

    const observer = new ResizeObserver(() => {
      syncOverlayBox();
    });

    observer.observe(frame);
    observer.observe(media);
    window.addEventListener("scroll", syncOverlayBox, true);

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", syncOverlayBox, true);
    };
  }, [mediaReady, frameWidth, url, showPdf, showImage]);

  function handleMediaError() {
    if (retriedRef.current) {
      return;
    }

    retriedRef.current = true;
    onUrlExpiredRef.current();
  }

  function eventToPlanPoint(
    event: Pick<React.PointerEvent<SVGSVGElement>, "clientX" | "clientY" | "currentTarget">,
  ): PlanPoint | null {
    const box = event.currentTarget.getBoundingClientRect();

    if (box.width <= 0 || box.height <= 0) {
      return null;
    }

    const [localX, localY] = toPlanPoint(event.clientX, event.clientY, box);
    const crop = pageCropRef.current;

    return [
      crop.x + localX * crop.width,
      crop.y + localY * crop.height,
    ] as const;
  }

  function completeDraft(points: PlanPoint[]) {
    if (points.length < 3) {
      return;
    }

    onDraftComplete({ points });
    setCursorPoint(null);
  }

  function addDraftVertex(point: PlanPoint) {
    const current = draftPolygonRef.current;
    const points = current?.points ?? [];

    if (
      points.length >= 3 &&
      isNearPlanPoint(point, points[0]!)
    ) {
      completeDraft(points);
      return;
    }

    onDraftChange({ points: [...points, point] });
  }

  const draftPoints = draftPolygon?.points ?? [];
  const canCloseDraft = draftPoints.length >= 3;
  const draftPreviewPoints =
    activeCursorPoint && draftPoints.length > 0
      ? [...draftPoints, activeCursorPoint]
      : draftPoints;
  const draftPolyline = draftPreviewPoints
    .map(([x, y]) => `${x},${y}`)
    .join(" ");
  const draftFillPoints =
    canCloseDraft && activeCursorPoint
      ? [...draftPoints, activeCursorPoint]
      : canCloseDraft
        ? draftPoints
        : null;

  const overlay =
    overlayBox == null ? null : (
      <svg
        viewBox={`${pageCrop.x} ${pageCrop.y} ${pageCrop.width} ${pageCrop.height}`}
        preserveAspectRatio="none"
        className={`${canDraw ? "cursor-crosshair" : ""} ${
          canDraw || features.length > 0 ? "" : "pointer-events-none"
        }`}
        style={{
          position: "absolute",
          left: overlayBox.left,
          top: overlayBox.top,
          width: overlayBox.width,
          height: overlayBox.height,
          zIndex: 10,
        }}
        role="img"
        aria-label="Room overlays"
        onPointerDown={(event) => {
          if (!canDraw || event.button !== 0) {
            return;
          }

          if ((event.target as Element).closest("[data-plan-feature]")) {
            return;
          }

          suppressClickRef.current = false;
          pointerDownRef.current = {
            pointerId: event.pointerId,
            clientX: event.clientX,
            clientY: event.clientY,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!canDraw) {
            return;
          }

          const down = pointerDownRef.current;

          if (
            down &&
            down.pointerId === event.pointerId &&
            Math.hypot(event.clientX - down.clientX, event.clientY - down.clientY) >
              6
          ) {
            suppressClickRef.current = true;
          }

          const point = eventToPlanPoint(event);

          if (point) {
            setCursorPoint(point);
          }
        }}
        onPointerUp={(event) => {
          const down = pointerDownRef.current;

          if (!down || down.pointerId !== event.pointerId) {
            return;
          }

          pointerDownRef.current = null;

          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        }}
        onPointerLeave={() => {
          setCursorPoint(null);
        }}
        onPointerCancel={() => {
          pointerDownRef.current = null;
          suppressClickRef.current = true;
        }}
        onClick={(event) => {
          if (!canDraw || event.button !== 0) {
            return;
          }

          // Second click of a double-click — close via onDoubleClick instead.
          if (event.detail > 1) {
            return;
          }

          if (suppressClickRef.current) {
            return;
          }

          if ((event.target as Element).closest("[data-plan-feature]")) {
            return;
          }

          const point = eventToPlanPoint(event);

          if (!point) {
            return;
          }

          addDraftVertex(point);
        }}
        onDoubleClick={(event) => {
          if (!canDraw) {
            return;
          }

          event.preventDefault();
          const draft = draftPolygonRef.current;

          if (draft && draft.points.length >= 3) {
            completeDraft(draft.points);
          }
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
        {draftFillPoints && draftFillPoints.length >= 3 ? (
          <polygon
            points={draftFillPoints.map(([x, y]) => `${x},${y}`).join(" ")}
            className="fill-brand-500/15 stroke-none"
            pointerEvents="none"
          />
        ) : null}
        {draftPolyline ? (
          <polyline
            points={draftPolyline}
            className="fill-none stroke-brand-600"
            strokeWidth={0.003}
            vectorEffect="non-scaling-stroke"
            pointerEvents="none"
          />
        ) : null}
        {draftPoints.map(([x, y], index) => {
          const isFirst = index === 0;
          const emphasize = isFirst && canCloseDraft;

          return (
            <circle
              key={`draft-vertex-${index}`}
              cx={x}
              cy={y}
              r={emphasize ? 0.008 : 0.005}
              className={
                emphasize
                  ? "fill-brand-600 stroke-white"
                  : "fill-brand-500 stroke-white"
              }
              strokeWidth={0.002}
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
            />
          );
        })}
      </svg>
    );

  return (
    <div className="relative w-full min-w-0 self-start overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div ref={frameRef} className="relative w-full leading-none">
        {showPdf ? (
          <>
            <canvas
              ref={(node) => {
                mediaRef.current = node;
              }}
              className={`block h-auto w-full ${pdfReady ? "" : "invisible absolute"}`}
            />
            {overlay}
            {!pdfReady && !pdfError ? (
              <p className="flex min-h-48 items-center justify-center bg-gray-50 text-sm text-gray-500">
                Rendering PDF…
              </p>
            ) : null}
            {pdfError ? (
              <p className="flex min-h-48 items-center justify-center bg-gray-50 p-4 text-sm text-error-600">
                {pdfError}
              </p>
            ) : null}
          </>
        ) : null}

        {showImage ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- signed plan URL from API */}
            <img
              ref={(node) => {
                mediaRef.current = node;
              }}
              src={url}
              alt="Site plan"
              className="block h-auto w-full"
              draggable={false}
              onLoad={() => {
                setLoadedImageUrl(url);
                setImageReady(true);
              }}
              onError={handleMediaError}
            />
            {overlay}
          </>
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

type InkBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

function findInkBounds(source: HTMLCanvasElement): InkBounds | null {
  const context = source.getContext("2d", { willReadFrequently: true });

  if (!context) {
    return null;
  }

  const { width, height } = source;

  if (width <= 0 || height <= 0) {
    return null;
  }

  let data: Uint8ClampedArray;

  try {
    data = context.getImageData(0, 0, width, height).data;
  } catch {
    return null;
  }

  const step = Math.max(1, Math.floor(Math.min(width, height) / 500));
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const index = (y * width + x) * 4;
      const alpha = data[index + 3] ?? 0;
      const red = data[index] ?? 255;
      const green = data[index + 1] ?? 255;
      const blue = data[index + 2] ?? 255;

      // Treat near-white / transparent as empty page margin.
      if (alpha < 8 || (red > 248 && green > 248 && blue > 248)) {
        continue;
      }

      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < minX || maxY < minY) {
    return null;
  }

  return { minX, minY, maxX, maxY };
}

function inkToPageCrop(
  ink: InkBounds | null,
  width: number,
  height: number,
): PageCrop {
  if (!ink || width <= 0 || height <= 0) {
    return FULL_PAGE_CROP;
  }

  const padX = Math.max(2, Math.round(width * 0.012));
  const padY = Math.max(2, Math.round(height * 0.012));
  const minX = Math.max(0, ink.minX - padX);
  const minY = Math.max(0, ink.minY - padY);
  const maxX = Math.min(width - 1, ink.maxX + padX);
  const maxY = Math.min(height - 1, ink.maxY + padY);
  const cropWidth = maxX - minX + 1;
  const cropHeight = maxY - minY + 1;

  // Keep the full page when trim would barely change anything.
  if (cropWidth / width > 0.97 && cropHeight / height > 0.97) {
    return FULL_PAGE_CROP;
  }

  return {
    x: minX / width,
    y: minY / height,
    width: cropWidth / width,
    height: cropHeight / height,
  };
}

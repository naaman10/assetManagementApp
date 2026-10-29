"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  FormBanner,
  secondaryButtonClassName,
} from "@/components/form-controls";
import { asApiError } from "@/lib/api-client";
import { safePhotoUrl } from "@/lib/maintenance-history";

export type RecordPhotoItem = {
  id: string;
  url: string;
  contentType: string;
  createdAt: string;
  caption?: string | null;
};

export function RecordPhotos({
  photos,
  canEdit,
  disabled = false,
  disabledMessage,
  pendingLabel = "Uploading…",
  emptyLabel = "No photos yet.",
  countLabel,
  accept = "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp",
  onUpload,
  onDelete,
  onRefresh,
}: {
  photos: RecordPhotoItem[];
  canEdit: boolean;
  disabled?: boolean;
  disabledMessage?: string | null;
  pendingLabel?: string;
  emptyLabel?: string;
  countLabel?: string | null;
  accept?: string;
  onUpload: (files: File[]) => Promise<string | null>;
  onDelete?: (photoId: string) => Promise<string | null>;
  onRefresh?: () => Promise<boolean>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const refreshed = useRef(false);
  const [dragging, setDragging] = useState(false);
  const [pending, setPending] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const uploadDisabled = !canEdit || disabled || pending;

  async function uploadFiles(files: File[]) {
    if (uploadDisabled || files.length === 0) {
      return;
    }

    setPending(true);
    setMessage(null);

    try {
      const problem = await onUpload(files);

      if (problem) {
        setMessage(problem);
      }
    } catch (caught) {
      setMessage(asApiError(caught).message);
    } finally {
      setPending(false);
      setDragging(false);

      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  async function deletePhoto(photoId: string) {
    if (!onDelete || !canEdit || pending || deletingId) {
      return;
    }

    if (!window.confirm("Delete this photo?")) {
      return;
    }

    setDeletingId(photoId);
    setMessage(null);

    try {
      const problem = await onDelete(photoId);

      if (problem) {
        setMessage(problem);
      }
    } catch (caught) {
      setMessage(asApiError(caught).message);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="grid gap-5">
      {countLabel ? <p className="text-sm text-gray-500">{countLabel}</p> : null}
      {canEdit && disabled && disabledMessage ? (
        <p className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500">
          {disabledMessage}
        </p>
      ) : null}
      {canEdit && !disabled ? (
        <div
          onDragOver={(event) => {
            event.preventDefault();

            if (!pending) {
              setDragging(true);
            }
          }}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
              setDragging(false);
            }
          }}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            void uploadFiles([...event.dataTransfer.files]);
          }}
          className={`rounded-lg border border-dashed px-4 py-6 text-center ${
            dragging ? "border-brand-500 bg-gray-50" : "border-gray-300"
          }`}
        >
          <p className="text-sm text-gray-500">Drop photos here, or choose files</p>
          <label className={`${secondaryButtonClassName} mt-3`}>
            Choose photos
            <input
              ref={inputRef}
              type="file"
              accept={accept}
              multiple
              disabled={uploadDisabled}
              className="sr-only"
              onChange={(event) => {
                void uploadFiles([...(event.target.files ?? [])]);
              }}
            />
          </label>
          {pending ? <p className="mt-3 text-sm text-gray-500">{pendingLabel}</p> : null}
        </div>
      ) : null}
      <FormBanner message={message} />
      {photos.length === 0 ? (
        <p className="text-sm text-gray-500">{emptyLabel}</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {photos.map((photo) => (
            <RecordPhoto
              key={photo.id}
              photo={photo}
              canDelete={Boolean(canEdit && onDelete)}
              deleting={deletingId === photo.id}
              onDelete={() => {
                void deletePhoto(photo.id);
              }}
              onReload={() => {
                if (!onRefresh || refreshed.current) {
                  return Promise.resolve(false);
                }

                refreshed.current = true;
                return onRefresh();
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function RecordPhoto({
  photo,
  canDelete,
  deleting,
  onDelete,
  onReload,
}: {
  photo: RecordPhotoItem;
  canDelete: boolean;
  deleting: boolean;
  onDelete: () => void;
  onReload: () => Promise<boolean>;
}) {
  const source = safePhotoUrl(photo.url);
  const [brokenUrl, setBrokenUrl] = useState<string | null>(null);
  const [enlarged, setEnlarged] = useState(false);
  const alt = photo.caption ?? "Photo";
  const filename = photoFilename(photo.contentType);

  function onError() {
    if (!source) {
      return;
    }

    void onReload()
      .then((reloaded) => {
        if (!reloaded) {
          setBrokenUrl(source);
        }
      })
      .catch(() => {
        setBrokenUrl(source);
      });
  }

  if (!source || brokenUrl === source) {
    if (!photo.caption) {
      return null;
    }

    return (
      <li>
        <p className="text-sm text-gray-500">{photo.caption}</p>
      </li>
    );
  }

  return (
    <li>
      <PhotoFrame
        source={source}
        alt={alt}
        filename={filename}
        canDelete={canDelete}
        deleting={deleting}
        onOpen={() => {
          setEnlarged(true);
        }}
        onDelete={onDelete}
        onError={onError}
      />
      {photo.caption ? <p className="mt-2 text-sm text-gray-500">{photo.caption}</p> : null}
      {enlarged ? (
        <PhotoView
          source={source}
          alt={alt}
          filename={filename}
          onClose={() => {
            setEnlarged(false);
          }}
          onError={onError}
        />
      ) : null}
    </li>
  );
}

function PhotoFrame({
  source,
  alt,
  filename,
  canDelete,
  deleting,
  onOpen,
  onDelete,
  onError,
}: {
  source: string;
  alt: string;
  filename: string;
  canDelete: boolean;
  deleting: boolean;
  onOpen: () => void;
  onDelete: () => void;
  onError: () => void;
}) {
  return (
    <div className="group relative">
      <button
        type="button"
        aria-label="View photo"
        className="block w-full cursor-zoom-in text-left"
        onClick={onOpen}
      >
        <PhotoImage
          source={source}
          alt={alt}
          className="h-44 w-full rounded-lg object-cover"
          onError={onError}
        />
      </button>
      <div className="pointer-events-none absolute top-2 right-2 flex gap-2 opacity-0 transition group-hover:pointer-events-auto group-hover:opacity-100 focus-within:pointer-events-auto focus-within:opacity-100">
        {canDelete ? (
          <button
            type="button"
            aria-label="Delete photo"
            disabled={deleting}
            className="grid size-8 place-items-center rounded-lg bg-gray-900/80 text-white shadow-theme-xs transition hover:bg-gray-900 disabled:opacity-50"
            onClick={(event) => {
              event.stopPropagation();
              onDelete();
            }}
          >
            ×
          </button>
        ) : null}
        <DownloadPhotoButton source={source} filename={filename} />
      </div>
    </div>
  );
}

function PhotoView({
  source,
  alt,
  filename,
  onClose,
  onError,
}: {
  source: string;
  alt: string;
  filename: string;
  onClose: () => void;
  onError: () => void;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog || dialog.open) {
      return;
    }

    dialog.showModal();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      className="m-auto h-fit w-[min(64rem,calc(100vw-2rem))] max-h-[calc(100vh-2rem)] overflow-y-auto rounded-2xl border border-gray-200 bg-white p-6 text-gray-800 shadow-theme-xs backdrop:bg-gray-900/40"
      onCancel={(event) => {
        event.preventDefault();
        onCloseRef.current();
      }}
      onMouseDown={(event) => {
        if (event.target === dialogRef.current) {
          onCloseRef.current();
        }
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <h2 id={titleId} className="text-lg font-semibold text-gray-800">
          {alt}
        </h2>
        <button
          type="button"
          aria-label="Close"
          className="rounded-lg px-2 py-1 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-800"
          onClick={() => {
            onCloseRef.current();
          }}
        >
          ×
        </button>
      </div>
      <div className="mt-6 flex justify-center">
        <div className="group relative max-w-full">
          <PhotoImage
            source={source}
            alt={alt}
            className="max-h-[70vh] max-w-full rounded-lg object-contain"
            onError={onError}
          />
          <div className="pointer-events-none absolute top-2 right-2 opacity-0 transition group-hover:pointer-events-auto group-hover:opacity-100 focus-within:pointer-events-auto focus-within:opacity-100">
            <DownloadPhotoButton source={source} filename={filename} />
          </div>
        </div>
      </div>
    </dialog>
  );
}

function PhotoImage({
  source,
  alt,
  className,
  onError,
}: {
  source: string;
  alt: string;
  className: string;
  onError: () => void;
}) {
  return (
    // Signed photo URLs expire, so they are not run through the image optimizer.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={source} alt={alt} className={className} onError={onError} />
  );
}

function DownloadPhotoButton({ source, filename }: { source: string; filename: string }) {
  return (
    <button
      type="button"
      aria-label="Download photo"
      className="grid size-8 place-items-center rounded-lg bg-gray-900/80 text-white shadow-theme-xs transition hover:bg-gray-900"
      onClick={(event) => {
        event.stopPropagation();
        void downloadPhoto(source, filename);
      }}
    >
      <DownloadIcon />
    </button>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-4" fill="none" aria-hidden="true">
      <path d="M8 2.5v7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path
        d="M5.2 7.2 8 10l2.8-2.8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M3 12.5h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function photoFilename(contentType: string) {
  if (contentType === "image/png") {
    return "photo.png";
  }

  if (contentType === "image/webp") {
    return "photo.webp";
  }

  return "photo.jpg";
}

async function downloadPhoto(url: string, filename: string) {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error("The photo could not be downloaded.");
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

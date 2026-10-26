"use client";

import { useEffect, useRef } from "react";

export function Modal({
  title,
  onClose,
  children,
  size = "default",
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  size?: "default" | "lg";
}) {
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

  const sizeClass =
    size === "lg"
      ? "h-[min(48rem,calc(100vh-2rem))] w-[min(48rem,calc(100vw-2rem))]"
      : "h-fit max-h-[calc(100vh-2rem)] w-[min(42rem,calc(100vw-2rem))]";

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="modal-title"
      className={`m-auto flex ${sizeClass} flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white p-6 text-gray-800 shadow-theme-xs backdrop:bg-gray-900/40`}
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
      <div className="flex shrink-0 items-start justify-between gap-4">
        <h2 id="modal-title" className="text-lg font-semibold text-gray-800">
          {title}
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
      <div className="mt-6 min-h-0 flex-1 overflow-y-auto overflow-x-visible">{children}</div>
    </dialog>
  );
}

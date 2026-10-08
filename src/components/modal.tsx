"use client";

import { useEffect, useRef } from "react";

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
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

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="modal-title"
      className="m-auto h-fit w-[min(42rem,calc(100vw-2rem))] max-h-[calc(100vh-2rem)] overflow-y-auto rounded-2xl border border-gray-200 bg-white p-6 text-gray-800 shadow-theme-xs backdrop:bg-gray-900/40"
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
      <div className="mt-6">{children}</div>
    </dialog>
  );
}

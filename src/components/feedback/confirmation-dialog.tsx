"use client";

import type { ReactNode } from "react";
import { useRef } from "react";

import { ActionButton, AppDialog } from "@/components/ui";

export type ConfirmationDialogProps = {
  cancelLabel: string;
  children?: ReactNode;
  closeLabel: string;
  confirmLabel: string;
  danger?: boolean;
  description: ReactNode;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  open: boolean;
  title: ReactNode;
};

export function ConfirmationDialog({
  cancelLabel,
  children,
  closeLabel,
  confirmLabel,
  danger = false,
  description,
  loading = false,
  onCancel,
  onConfirm,
  open,
  title,
}: ConfirmationDialogProps) {
  const cancelActionRef = useRef<HTMLButtonElement>(null);

  return (
    <AppDialog
      actions={
        <>
          <ActionButton autoFocus disabled={loading} ref={cancelActionRef} onClick={onCancel}>
            {cancelLabel}
          </ActionButton>
          <ActionButton
            color={danger ? "error" : "primary"}
            disabled={loading}
            loading={loading}
            variant="contained"
            onClick={onConfirm}
          >
            {confirmLabel}
          </ActionButton>
        </>
      }
      closeLabel={closeLabel}
      description={description}
      maxWidth="xs"
      open={open}
      slotProps={{ transition: { onEntered: () => cancelActionRef.current?.focus() } }}
      title={title}
      onClose={onCancel}
    >
      {children}
    </AppDialog>
  );
}

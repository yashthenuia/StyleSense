"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

interface BaseProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
}

export function ConfirmDialog({
  open, onClose, title, description, confirmLabel = "Confirm", cancelLabel = "Cancel",
  destructive = false, onConfirm,
}: BaseProps & {
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
}) {
  return (
    <AnimatePresence>
      {open && (
        <Backdrop onClose={onClose}>
          <DialogBox title={title} description={description} onClose={onClose}>
            <div className="flex justify-end gap-2 mt-5">
              <button className="btn-secondary" onClick={onClose}>{cancelLabel}</button>
              <button
                className={destructive ? "btn-secondary" : "btn-primary"}
                style={destructive ? { color: "var(--red)", borderColor: "var(--red)" } : undefined}
                onClick={async () => { await onConfirm(); onClose(); }}
              >
                {confirmLabel}
              </button>
            </div>
          </DialogBox>
        </Backdrop>
      )}
    </AnimatePresence>
  );
}

export function PromptDialog({
  open, onClose, title, description, placeholder, defaultValue = "",
  confirmLabel = "Save", onSubmit,
}: BaseProps & {
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  onSubmit: (value: string) => void | Promise<void>;
}) {
  const [value, setValue] = useState(defaultValue);
  useEffect(() => { if (open) setValue(defaultValue); }, [open, defaultValue]);

  async function submit() {
    if (!value.trim()) return;
    await onSubmit(value.trim());
    onClose();
  }

  return (
    <AnimatePresence>
      {open && (
        <Backdrop onClose={onClose}>
          <DialogBox title={title} description={description} onClose={onClose}>
            <input
              className="input mt-3"
              placeholder={placeholder}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              autoFocus
            />
            <div className="flex justify-end gap-2 mt-4">
              <button className="btn-secondary" onClick={onClose}>Cancel</button>
              <button className="btn-primary" onClick={submit} disabled={!value.trim()}>{confirmLabel}</button>
            </div>
          </DialogBox>
        </Backdrop>
      )}
    </AnimatePresence>
  );
}

function Backdrop({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 flex items-center justify-center px-4"
      style={{ background: "rgba(8,8,13,0.85)", zIndex: 200 }}
      onClick={onClose}
    >
      {children}
    </motion.div>
  );
}

function DialogBox({
  title, description, onClose, children,
}: { title: string; description?: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95 }}
      className="surface p-6 w-full"
      style={{ maxWidth: 420 }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-display text-2xl">{title}</h3>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer" }}>
          <X size={18} />
        </button>
      </div>
      {description && <p className="text-sm" style={{ color: "var(--text-muted)" }}>{description}</p>}
      {children}
    </motion.div>
  );
}

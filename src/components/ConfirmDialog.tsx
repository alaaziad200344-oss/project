interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmText = "تأكيد",
  cancelText = "إلغاء",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative card max-w-sm w-full p-6 animate-fade-in">
        <h3 className="text-lg font-bold text-slate-800 mb-2">{title}</h3>
        <p className="text-sm text-slate-500 mb-5">{message}</p>
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="btn-secondary">
            {cancelText}
          </button>
          <button onClick={onConfirm} className="btn-danger">
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

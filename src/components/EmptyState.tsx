interface EmptyStateProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
}

export function EmptyState({ title, subtitle, icon }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon && (
        <div className="mb-4 w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
          {icon}
        </div>
      )}
      <p className="font-semibold text-slate-600">{title}</p>
      {subtitle && <p className="text-sm text-slate-400 mt-1">{subtitle}</p>}
    </div>
  );
}

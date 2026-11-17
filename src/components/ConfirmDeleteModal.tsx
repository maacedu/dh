import { AlertTriangle, Trash2, X } from 'lucide-react';

interface ConfirmDeleteModalProps {
  title: string;
  targetName: string;
  warning?: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmDeleteModal({
  title,
  targetName,
  warning,
  busy = false,
  onCancel,
  onConfirm,
}: ConfirmDeleteModalProps) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-xl border border-slate-200/90 dark:border-white/[0.09] bg-white dark:bg-[#0F1520] shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-white/[0.07] px-6 py-4">
          <div className="flex items-center gap-2.5 text-sm font-semibold text-slate-900 dark:text-white">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-500/12 text-red-600 dark:text-red-400">
              <AlertTriangle className="h-4 w-4" />
            </span>
            <span>{title}</span>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="rounded-lg p-1.5 text-slate-400 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] hover:text-slate-700 dark:hover:text-white"
            aria-label="Fechar confirmação"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 p-6 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
          <p>
            Tem certeza que deseja excluir{' '}
            <span className="font-semibold text-slate-900 dark:text-white">{targetName}</span>?
          </p>
          {warning && (
            <div className="rounded-lg border border-slate-200 dark:border-white/[0.09] bg-slate-50 dark:bg-[#0B0F17] px-3.5 py-2.5 text-slate-800 dark:text-white">
              {warning}
            </div>
          )}
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Esta ação remove o registro permanentemente do banco de dados.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2.5 border-t border-slate-200/80 dark:border-white/[0.07] px-6 py-4">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="rounded-lg border border-slate-300 dark:border-white/[0.1] bg-white dark:bg-white/[0.04] px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.08] disabled:opacity-50 whitespace-nowrap"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-xs font-medium text-white hover:bg-red-500 disabled:opacity-50 whitespace-nowrap"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {busy ? 'Excluindo...' : 'Confirmar Exclusão'}
          </button>
        </div>
      </div>
    </div>
  );
}

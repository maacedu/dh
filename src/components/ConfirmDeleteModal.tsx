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
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-md rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 px-5 py-3.5">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-zinc-100">
            <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
            <span>{title}</span>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="rounded p-1 text-slate-400 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-slate-700 dark:hover:text-zinc-100"
            aria-label="Fechar confirmação"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 p-5 text-xs text-slate-600 dark:text-zinc-300">
          <p>
            Tem certeza que deseja excluir{' '}
            <span className="font-semibold text-slate-900 dark:text-white">{targetName}</span>?
          </p>
          {warning && (
            <div className="rounded-md border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/40 px-3 py-2 text-amber-800 dark:text-amber-300">
              {warning}
            </div>
          )}
          <p className="text-[11px] text-slate-500 dark:text-zinc-400">
            Esta ação remove o registro permanentemente do banco de dados.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2.5 border-t border-slate-200 dark:border-zinc-800 px-5 py-3.5">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="rounded-md border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3.5 py-1.5 text-xs font-medium text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {busy ? 'Excluindo...' : 'Confirmar Exclusão'}
          </button>
        </div>
      </div>
    </div>
  );
}

import { AlertCircle, CheckCircle2, Clock, XCircle } from 'lucide-react';
import type { SituacaoCadastral, StatusDocumento } from '../types/fleet';
import { SITUACAO_LABELS, STATUS_DOC_LABELS } from '../lib/compliance';

interface SituacaoIndicatorProps {
  situacao: SituacaoCadastral;
}

export function SituacaoIndicator({ situacao }: SituacaoIndicatorProps) {
  switch (situacao) {
    case 'aprovado':
      return (
        <span className="inline-flex w-fit items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/12 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 whitespace-nowrap">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{SITUACAO_LABELS.aprovado}</span>
        </span>
      );
    case 'em_analise':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-800 dark:text-white whitespace-nowrap">
          <Clock className="h-3.5 w-3.5 text-slate-600 dark:text-white shrink-0" />
          <span>{SITUACAO_LABELS.em_analise}</span>
        </span>
      );
    case 'pendente':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-orange-700 dark:text-orange-400 whitespace-nowrap">
          <AlertCircle className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400 shrink-0" />
          <span>{SITUACAO_LABELS.pendente}</span>
        </span>
      );
    case 'documentacao_vencida':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700 dark:text-red-400 whitespace-nowrap">
          <XCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400 shrink-0" />
          <span>{SITUACAO_LABELS.documentacao_vencida}</span>
        </span>
      );
  }
}

interface DocStatusIndicatorProps {
  status: StatusDocumento;
}

export function DocStatusIndicator({ status }: DocStatusIndicatorProps) {
  switch (status) {
    case 'valido':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{STATUS_DOC_LABELS.valido}</span>
        </span>
      );
    case 'a_vencer':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-800 dark:text-white whitespace-nowrap">
          <Clock className="h-3.5 w-3.5 text-slate-600 dark:text-white shrink-0" />
          <span>{STATUS_DOC_LABELS.a_vencer}</span>
        </span>
      );
    case 'em_analise':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 dark:text-blue-400 whitespace-nowrap">
          <Clock className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
          <span>{STATUS_DOC_LABELS.em_analise}</span>
        </span>
      );
    case 'pendente':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-orange-700 dark:text-orange-400 whitespace-nowrap">
          <AlertCircle className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400 shrink-0" />
          <span>{STATUS_DOC_LABELS.pendente}</span>
        </span>
      );
    case 'vencido':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700 dark:text-red-400 whitespace-nowrap">
          <XCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400 shrink-0" />
          <span>{STATUS_DOC_LABELS.vencido}</span>
        </span>
      );
  }
}

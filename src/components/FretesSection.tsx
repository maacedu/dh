import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type {
  Frete,
  Motorista,
  Proprietario,
  StatusFrete,
  Veiculo,
} from '../types/fleet';
import { formatBrl, formatDatePtBr, STATUS_FRETE_LABELS } from '../lib/compliance';
import { deleteFrete, updateFrete } from '../lib/fleetService';
import { EditableCell } from './EditableCell';

interface FretesSectionProps {
  fretes: Frete[];
  proprietarios: Proprietario[];
  motoristas: Motorista[];
  veiculos: Veiculo[];
  searchQuery: string;
  onNewFrete: () => void;
  onToast: (type: 'success' | 'error', text: string) => void;
}

const statusColorMap: Record<StatusFrete, string> = {
  agendado: 'text-slate-700 dark:text-white',
  em_transito: 'text-blue-700 dark:text-blue-400',
  entregue: 'text-emerald-700 dark:text-emerald-400',
  faturado: 'text-emerald-800 dark:text-emerald-300',
  cancelado: 'text-red-700 dark:text-red-400',
};

const inlineSelectCls =
  'w-full rounded-md border border-transparent bg-transparent px-2 py-1 text-xs text-slate-800 dark:text-slate-200 hover:border-slate-300 dark:hover:border-white/[0.12] hover:bg-white dark:hover:bg-[#0B0F17] focus:border-blue-500 focus:bg-white dark:focus:bg-[#0B0F17] focus:outline-none';

const statusSelectCls =
  'rounded-md border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-[#0B0F17] px-2 py-1 text-[11px] font-medium focus:border-blue-500 focus:outline-none';

export function FretesSection({
  fretes,
  proprietarios,
  motoristas,
  veiculos,
  searchQuery,
  onNewFrete,
  onToast,
}: FretesSectionProps) {
  const [statusFilter, setStatusFilter] = useState<'todos' | StatusFrete>('todos');

  const propMap = useMemo(() => new Map(proprietarios.map((p) => [p.id, p])), [proprietarios]);
  const motMap = useMemo(() => new Map(motoristas.map((m) => [m.id, m])), [motoristas]);
  const veiMap = useMemo(() => new Map(veiculos.map((v) => [v.id, v])), [veiculos]);

  const filteredFretes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return fretes.filter((f) => {
      if (statusFilter !== 'todos' && f.status !== statusFilter) return false;
      if (!q) return true;
      const propName = propMap.get(f.proprietarioId)?.nomeCompleto.toLowerCase() || '';
      const motName = motMap.get(f.motoristaId)?.nomeCompleto.toLowerCase() || '';
      const veiPlaca = veiMap.get(f.veiculoId)?.placa.toLowerCase() || '';
      return (
        f.cliente.toLowerCase().includes(q) ||
        f.origem.toLowerCase().includes(q) ||
        f.destino.toLowerCase().includes(q) ||
        propName.includes(q) ||
        motName.includes(q) ||
        veiPlaca.includes(q)
      );
    });
  }, [fretes, statusFilter, searchQuery, propMap, motMap, veiMap]);

  const summary = useMemo(() => {
    let ativos = 0;
    let bruto = 0;
    let repasse = 0;
    for (const f of fretes) {
      if (f.status === 'cancelado') continue;
      if (f.status === 'agendado' || f.status === 'em_transito') ativos += 1;
      bruto += f.valorFrete;
      repasse += f.valorRepasse;
    }
    return {
      total: fretes.length,
      ativos,
      bruto,
      repasse,
    };
  }, [fretes]);

  return (
    <div className="space-y-6">
      {/* KPI Strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200/90 dark:border-white/[0.08] bg-white dark:bg-[#0F1520] p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Fretes Registrados
          </p>
          <p className="mt-2 font-mono text-2xl font-semibold text-slate-900 dark:text-white tabular-nums">
            {summary.total}
          </p>
          <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400">
            {summary.ativos} em trânsito ou agendados
          </p>
        </div>

        <div className="rounded-xl border border-slate-200/90 dark:border-white/[0.08] bg-white dark:bg-[#0F1520] p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Faturamento Bruto de Fretes
          </p>
          <p className="mt-2 font-mono text-2xl font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">
            {formatBrl(summary.bruto)}
          </p>
          <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400">
            Soma dos fretes ativos e faturados
          </p>
        </div>

        <div className="rounded-xl border border-slate-200/90 dark:border-white/[0.08] bg-white dark:bg-[#0F1520] p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Repasses Vinculados
          </p>
          <p className="mt-2 font-mono text-2xl font-semibold text-slate-900 dark:text-white tabular-nums">
            {formatBrl(summary.repasse)}
          </p>
          <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400">
            Repasses a proprietários e motoristas
          </p>
        </div>

        <div className="rounded-xl border border-slate-200/90 dark:border-white/[0.08] bg-white dark:bg-[#0F1520] p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Margem Bruta Operacional
          </p>
          <p className="mt-2 font-mono text-2xl font-semibold text-blue-700 dark:text-blue-400 tabular-nums">
            {formatBrl(summary.bruto - summary.repasse)}
          </p>
          <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400">
            Diferença entre frete e repasse
          </p>
        </div>
      </div>

      {/* Filters + Add */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 rounded-xl border border-slate-200/90 dark:border-white/[0.08] bg-slate-100/90 dark:bg-white/[0.03] p-1">
          {(['todos', 'agendado', 'em_transito', 'entregue', 'faturado', 'cancelado'] as const).map(
            (st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  statusFilter === st
                    ? 'bg-white dark:bg-[#182234] text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {st === 'todos' ? 'Todos' : STATUS_FRETE_LABELS[st]}
              </button>
            )
          )}
        </div>

        <button
          type="button"
          onClick={onNewFrete}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-medium text-white shadow-xs hover:bg-blue-500 whitespace-nowrap"
        >
          <Plus className="h-3.5 w-3.5" />
          Novo Frete / Rota
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200/90 dark:border-white/[0.08] bg-white dark:bg-[#0F1520]">
        <div className="border-b border-slate-200/80 dark:border-white/[0.07] bg-slate-50/80 dark:bg-white/[0.02] px-4 py-2.5 text-[11px] text-slate-500 dark:text-slate-400">
          Controle operacional de fretes e rotas integrado aos cadastros de proprietários, motoristas e veículos.
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200/80 dark:border-white/[0.07] bg-slate-50/90 dark:bg-white/[0.025] text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                <th className="px-3.5 py-3">Cliente</th>
                <th className="px-3.5 py-3">Origem</th>
                <th className="px-3.5 py-3">Destino</th>
                <th className="px-3.5 py-3">Saída</th>
                <th className="px-3.5 py-3">Proprietário</th>
                <th className="px-3.5 py-3">Motorista</th>
                <th className="px-3.5 py-3">Veículo</th>
                <th className="px-3.5 py-3">Frete (R$)</th>
                <th className="px-3.5 py-3">Repasse (R$)</th>
                <th className="px-3.5 py-3">Status</th>
                <th className="px-3.5 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/75 dark:divide-white/[0.06]">
              {filteredFretes.length === 0 ? (
                <tr>
                  <td
                    colSpan={11}
                    className="px-4 py-12 text-center text-xs text-slate-500 dark:text-slate-400"
                  >
                    Nenhum frete ou rota cadastrado ainda.
                  </td>
                </tr>
              ) : (
                filteredFretes.map((f) => (
                  <tr
                    key={f.id}
                    className="transition-colors hover:bg-slate-50/90 dark:hover:bg-white/[0.025]"
                  >
                    <td className="px-2.5 py-2 min-w-[155px]">
                      <EditableCell
                        value={f.cliente}
                        onSave={async (val) => {
                          await updateFrete(f.id, { cliente: val });
                        }}
                      />
                    </td>
                    <td className="px-2.5 py-2 min-w-[115px]">
                      <EditableCell
                        value={f.origem}
                        requiredPending={false}
                        onSave={async (val) => {
                          await updateFrete(f.id, { origem: val });
                        }}
                      />
                    </td>
                    <td className="px-2.5 py-2 min-w-[115px]">
                      <EditableCell
                        value={f.destino}
                        requiredPending={false}
                        onSave={async (val) => {
                          await updateFrete(f.id, { destino: val });
                        }}
                      />
                    </td>
                    <td className="px-2.5 py-2 min-w-[115px]">
                      <EditableCell
                        value={f.dataSaida}
                        type="date"
                        mono
                        requiredPending={false}
                        displayValue={f.dataSaida ? formatDatePtBr(f.dataSaida) : 'Sem data'}
                        onSave={async (val) => {
                          await updateFrete(f.id, { dataSaida: val });
                        }}
                      />
                    </td>
                    <td className="px-2.5 py-2 min-w-[140px]">
                      <select
                        value={f.proprietarioId}
                        onChange={async (e) => {
                          await updateFrete(f.id, { proprietarioId: e.target.value });
                        }}
                        className={inlineSelectCls}
                      >
                        <option value="">Sem vínculo</option>
                        {proprietarios.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nomeCompleto}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2.5 py-2 min-w-[140px]">
                      <select
                        value={f.motoristaId}
                        onChange={async (e) => {
                          await updateFrete(f.id, { motoristaId: e.target.value });
                        }}
                        className={inlineSelectCls}
                      >
                        <option value="">Sem vínculo</option>
                        {motoristas.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.nomeCompleto}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2.5 py-2 min-w-[110px]">
                      <select
                        value={f.veiculoId}
                        onChange={async (e) => {
                          await updateFrete(f.id, { veiculoId: e.target.value });
                        }}
                        className={inlineSelectCls}
                      >
                        <option value="">Sem vínculo</option>
                        {veiculos.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.placa}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2.5 py-2 min-w-[110px]">
                      <EditableCell
                        value={String(f.valorFrete)}
                        mono
                        requiredPending={false}
                        displayValue={formatBrl(f.valorFrete)}
                        onSave={async (val) => {
                          const parsed = Number(val.replace(',', '.'));
                          if (Number.isFinite(parsed) && parsed >= 0) {
                            await updateFrete(f.id, { valorFrete: parsed });
                          }
                        }}
                      />
                    </td>
                    <td className="px-2.5 py-2 min-w-[110px]">
                      <EditableCell
                        value={String(f.valorRepasse)}
                        mono
                        requiredPending={false}
                        displayValue={formatBrl(f.valorRepasse)}
                        onSave={async (val) => {
                          const parsed = Number(val.replace(',', '.'));
                          if (Number.isFinite(parsed) && parsed >= 0) {
                            await updateFrete(f.id, { valorRepasse: parsed });
                          }
                        }}
                      />
                    </td>
                    <td className="px-2.5 py-2 min-w-[120px]">
                      <select
                        value={f.status}
                        onChange={async (e) => {
                          await updateFrete(f.id, { status: e.target.value as StatusFrete });
                        }}
                        className={`${statusSelectCls} ${statusColorMap[f.status]}`}
                      >
                        {(Object.keys(STATUS_FRETE_LABELS) as StatusFrete[]).map((st) => (
                          <option key={st} value={st}>
                            {STATUS_FRETE_LABELS[st]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3.5 py-2 text-right">
                      <button
                        type="button"
                        onClick={async () => {
                          await deleteFrete(f.id);
                          onToast('success', 'Frete removido.');
                        }}
                        className="rounded-md p-1.5 text-slate-400 dark:text-slate-500 hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400"
                        title="Excluir frete"
                        aria-label={`Excluir frete ${f.cliente}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

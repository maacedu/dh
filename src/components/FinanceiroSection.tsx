import { useMemo, useState, type FormEvent } from 'react';
import { FolderPlus, Plus, Tag, Trash2 } from 'lucide-react';
import type {
  CategoriaFinanceira,
  LancamentoFinanceiro,
  Motorista,
  Proprietario,
  StatusFinanceiro,
  TipoLancamento,
  Veiculo,
} from '../types/fleet';
import {
  DEFAULT_CATEGORIAS_FINANCEIRAS,
  formatBrl,
  formatDatePtBr,
  STATUS_FINANCEIRO_LABELS,
  TIPO_LANCAMENTO_LABELS,
} from '../lib/compliance';
import {
  createCategoriaFinanceira,
  deleteCategoriaFinanceira,
  deleteLancamentoFinanceiro,
  updateLancamentoFinanceiro,
} from '../lib/fleetService';
import { EditableCell } from './EditableCell';
import { ScrollableTableCard } from './ScrollableTableCard';

interface FinanceiroSectionProps {
  uid: string;
  lancamentos: LancamentoFinanceiro[];
  categoriasFinanceiras: CategoriaFinanceira[];
  proprietarios: Proprietario[];
  motoristas: Motorista[];
  veiculos: Veiculo[];
  searchQuery: string;
  onNewLancamento: () => void;
  onToast: (type: 'success' | 'error', text: string) => void;
}

const statusColorMap: Record<StatusFinanceiro, string> = {
  pago: 'text-emerald-700 dark:text-emerald-400',
  pendente: 'text-slate-800 dark:text-white',
  atrasado: 'text-red-700 dark:text-red-400',
  cancelado: 'text-slate-500 dark:text-slate-500',
};

const inlineSelectCls =
  'w-full rounded-md border border-transparent bg-transparent px-2 py-1 text-xs text-slate-800 dark:text-slate-200 hover:border-slate-300 dark:hover:border-white/[0.12] hover:bg-white dark:hover:bg-[#0B0F17] focus:border-blue-500 focus:bg-white dark:focus:bg-[#0B0F17] focus:outline-none';

const statusSelectCls =
  'rounded-md border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-[#0B0F17] px-2 py-1 text-[11px] font-medium focus:border-blue-500 focus:outline-none';

export function FinanceiroSection({
  uid,
  lancamentos,
  categoriasFinanceiras,
  proprietarios,
  motoristas,
  veiculos,
  searchQuery,
  onNewLancamento,
  onToast,
}: FinanceiroSectionProps) {
  const [subTab, setSubTab] = useState<'lancamentos' | 'categorias'>('lancamentos');
  const [tipoFilter, setTipoFilter] = useState<'todos' | TipoLancamento>('todos');
  const [statusFilter, setStatusFilter] = useState<'todos' | StatusFinanceiro>('todos');

  // Nova Categoria form
  const [catNome, setCatNome] = useState('');
  const [catTipo, setCatTipo] = useState<TipoLancamento>('despesa');
  const [catDesc, setCatDesc] = useState('');
  const [savingCat, setSavingCat] = useState(false);

  const propMap = useMemo(() => new Map(proprietarios.map((p) => [p.id, p])), [proprietarios]);
  const motMap = useMemo(() => new Map(motoristas.map((m) => [m.id, m])), [motoristas]);
  const veiMap = useMemo(() => new Map(veiculos.map((v) => [v.id, v])), [veiculos]);

  const allCategoryNames = useMemo(() => {
    const names = new Set<string>(DEFAULT_CATEGORIAS_FINANCEIRAS.map((c) => c.nome));
    for (const c of categoriasFinanceiras) {
      if (c.nome) names.add(c.nome);
    }
    return Array.from(names);
  }, [categoriasFinanceiras]);

  const filteredLancamentos = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return lancamentos.filter((l) => {
      if (tipoFilter !== 'todos' && l.tipo !== tipoFilter) return false;
      if (statusFilter !== 'todos' && l.status !== statusFilter) return false;
      if (!q) return true;
      const propName = propMap.get(l.proprietarioId)?.nomeCompleto.toLowerCase() || '';
      const motName = motMap.get(l.motoristaId)?.nomeCompleto.toLowerCase() || '';
      const veiPlaca = veiMap.get(l.veiculoId)?.placa.toLowerCase() || '';
      return (
        l.descricao.toLowerCase().includes(q) ||
        l.categoria.toLowerCase().includes(q) ||
        propName.includes(q) ||
        motName.includes(q) ||
        veiPlaca.includes(q)
      );
    });
  }, [lancamentos, tipoFilter, statusFilter, searchQuery, propMap, motMap, veiMap]);

  const summary = useMemo(() => {
    let receitas = 0;
    let saidas = 0;
    let pendentes = 0;
    let pendentesCount = 0;

    for (const l of lancamentos) {
      if (l.status === 'cancelado') continue;
      if (l.tipo === 'receita') {
        receitas += l.valor;
      } else {
        saidas += l.valor;
      }
      if (l.status === 'pendente' || l.status === 'atrasado') {
        pendentes += l.valor;
        pendentesCount += 1;
      }
    }
    return {
      receitas,
      saidas,
      saldo: receitas - saidas,
      pendentes,
      pendentesCount,
    };
  }, [lancamentos]);

  async function handleCreateCategory(e: FormEvent) {
    e.preventDefault();
    if (!catNome.trim()) return;
    setSavingCat(true);
    try {
      await createCategoriaFinanceira(uid, {
        nome: catNome,
        tipoPadrao: catTipo,
        descricao: catDesc,
      });
      setCatNome('');
      setCatDesc('');
      onToast('success', `Categoria "${catNome.trim()}" criada com sucesso.`);
    } catch (err) {
      onToast('error', err instanceof Error ? err.message : 'Erro ao criar categoria.');
    } finally {
      setSavingCat(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* KPI Strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200/90 dark:border-white/[0.08] bg-white dark:bg-[#0F1520] p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Receitas Registradas
          </p>
          <p className="mt-2 font-mono text-2xl font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">
            {formatBrl(summary.receitas)}
          </p>
          <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400">
            Fretes e entradas faturadas
          </p>
        </div>

        <div className="rounded-xl border border-slate-200/90 dark:border-white/[0.08] bg-white dark:bg-[#0F1520] p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Despesas e Repasses
          </p>
          <p className="mt-2 font-mono text-2xl font-semibold text-slate-900 dark:text-white tabular-nums">
            {formatBrl(summary.saidas)}
          </p>
          <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400">
            Pagamentos a proprietários, motoristas e custos
          </p>
        </div>

        <div className="rounded-xl border border-slate-200/90 dark:border-white/[0.08] bg-white dark:bg-[#0F1520] p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Saldo Previsto
          </p>
          <p
            className={`mt-2 font-mono text-2xl font-semibold tabular-nums ${
              summary.saldo >= 0
                ? 'text-blue-700 dark:text-blue-400'
                : 'text-red-700 dark:text-red-400'
            }`}
          >
            {formatBrl(summary.saldo)}
          </p>
          <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400">
            Resultado operacional líquido
          </p>
        </div>

        <div className="rounded-xl border border-slate-200/90 dark:border-white/[0.08] bg-white dark:bg-[#0F1520] p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Em Aberto / Atrasados
          </p>
          <p className="mt-2 font-mono text-2xl font-semibold text-slate-900 dark:text-white tabular-nums">
            {formatBrl(summary.pendentes)}
          </p>
          <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400 tabular-nums">
            {summary.pendentesCount} lançamento(s) aguardando liquidação
          </p>
        </div>
      </div>

      {/* Sub-tabs + Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-xl border border-slate-200/90 dark:border-white/[0.08] bg-slate-100/90 dark:bg-white/[0.03] p-1">
          <button
            type="button"
            onClick={() => setSubTab('lancamentos')}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              subTab === 'lancamentos'
                ? 'bg-white dark:bg-[#182234] text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Lançamentos ({filteredLancamentos.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('categorias')}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              subTab === 'categorias'
                ? 'bg-white dark:bg-[#182234] text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Categorias ({allCategoryNames.length})
          </button>
        </div>

        {subTab === 'lancamentos' && (
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={tipoFilter}
              onChange={(e) => setTipoFilter(e.target.value as 'todos' | TipoLancamento)}
              className="rounded-lg border border-slate-300 dark:border-white/[0.1] bg-white dark:bg-[#0F1520] px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 focus:border-blue-500 focus:outline-none"
            >
              <option value="todos">Todos os Tipos</option>
              <option value="receita">Receitas</option>
              <option value="despesa">Despesas</option>
              <option value="repasse">Repasses</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'todos' | StatusFinanceiro)}
              className="rounded-lg border border-slate-300 dark:border-white/[0.1] bg-white dark:bg-[#0F1520] px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 focus:border-blue-500 focus:outline-none"
            >
              <option value="todos">Todos os Status</option>
              <option value="pendente">Em Aberto</option>
              <option value="pago">Pago</option>
              <option value="atrasado">Atrasado</option>
              <option value="cancelado">Cancelado</option>
            </select>
            <button
              type="button"
              onClick={onNewLancamento}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-medium text-white shadow-xs hover:bg-blue-500 whitespace-nowrap"
            >
              <Plus className="h-3.5 w-3.5" />
              Novo Lançamento
            </button>
          </div>
        )}
      </div>

      {subTab === 'lancamentos' ? (
        <ScrollableTableCard header="Planilha financeira editável: vincule lançamentos e repasses diretamente a proprietários, motoristas e veículos.">
          <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200/80 dark:border-white/[0.07] bg-slate-50/90 dark:bg-white/[0.025] text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  <th className="px-3.5 py-3">Descrição</th>
                  <th className="px-3.5 py-3">Tipo</th>
                  <th className="px-3.5 py-3">Categoria</th>
                  <th className="px-3.5 py-3">Proprietário</th>
                  <th className="px-3.5 py-3">Motorista</th>
                  <th className="px-3.5 py-3">Veículo</th>
                  <th className="px-3.5 py-3">Vencimento</th>
                  <th className="px-3.5 py-3">Valor (R$)</th>
                  <th className="px-3.5 py-3">Status</th>
                  <th className="px-3.5 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/75 dark:divide-white/[0.06]">
                {filteredLancamentos.length === 0 ? (
                  <tr>
                    <td
                      colSpan={10}
                      className="px-4 py-12 text-center text-xs text-slate-500 dark:text-slate-400"
                    >
                      Nenhum lançamento financeiro registrado ainda. Clique em "Novo Lançamento" para iniciar.
                    </td>
                  </tr>
                ) : (
                  filteredLancamentos.map((l) => (
                    <tr
                      key={l.id}
                      className="transition-colors hover:bg-slate-50/90 dark:hover:bg-white/[0.025]"
                    >
                      <td className="px-2.5 py-2 min-w-[180px]">
                        <EditableCell
                          value={l.descricao}
                          onSave={async (val) => {
                            await updateLancamentoFinanceiro(l.id, { descricao: val });
                          }}
                        />
                      </td>
                      <td className="px-2.5 py-2 min-w-[100px]">
                        <select
                          value={l.tipo}
                          onChange={async (e) => {
                            await updateLancamentoFinanceiro(l.id, {
                              tipo: e.target.value as TipoLancamento,
                            });
                          }}
                          className={inlineSelectCls}
                        >
                          {(Object.keys(TIPO_LANCAMENTO_LABELS) as TipoLancamento[]).map((t) => (
                            <option key={t} value={t}>
                              {TIPO_LANCAMENTO_LABELS[t]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2.5 py-2 min-w-[140px]">
                        <select
                          value={l.categoria}
                          onChange={async (e) => {
                            await updateLancamentoFinanceiro(l.id, { categoria: e.target.value });
                          }}
                          className={inlineSelectCls}
                        >
                          {allCategoryNames.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                          {!allCategoryNames.includes(l.categoria) && (
                            <option value={l.categoria}>{l.categoria}</option>
                          )}
                        </select>
                      </td>
                      <td className="px-2.5 py-2 min-w-[145px]">
                        <select
                          value={l.proprietarioId}
                          onChange={async (e) => {
                            await updateLancamentoFinanceiro(l.id, {
                              proprietarioId: e.target.value,
                            });
                          }}
                          className={inlineSelectCls}
                        >
                          <option value="">Nenhum</option>
                          {proprietarios.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.nomeCompleto}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2.5 py-2 min-w-[140px]">
                        <select
                          value={l.motoristaId}
                          onChange={async (e) => {
                            await updateLancamentoFinanceiro(l.id, {
                              motoristaId: e.target.value,
                            });
                          }}
                          className={inlineSelectCls}
                        >
                          <option value="">Nenhum</option>
                          {motoristas.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.nomeCompleto}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2.5 py-2 min-w-[115px]">
                        <select
                          value={l.veiculoId}
                          onChange={async (e) => {
                            await updateLancamentoFinanceiro(l.id, {
                              veiculoId: e.target.value,
                            });
                          }}
                          className={inlineSelectCls}
                        >
                          <option value="">Nenhum</option>
                          {veiculos.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.placa}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2.5 py-2 min-w-[115px]">
                        <EditableCell
                          value={l.dataVencimento}
                          type="date"
                          mono
                          requiredPending={false}
                          displayValue={
                            l.dataVencimento ? formatDatePtBr(l.dataVencimento) : 'Sem data'
                          }
                          onSave={async (val) => {
                            await updateLancamentoFinanceiro(l.id, { dataVencimento: val });
                          }}
                        />
                      </td>
                      <td className="px-2.5 py-2 min-w-[115px]">
                        <EditableCell
                          value={String(l.valor)}
                          mono
                          requiredPending={false}
                          displayValue={formatBrl(l.valor)}
                          onSave={async (val) => {
                            const parsed = Number(val.replace(',', '.'));
                            if (Number.isFinite(parsed) && parsed >= 0) {
                              await updateLancamentoFinanceiro(l.id, { valor: parsed });
                            }
                          }}
                        />
                      </td>
                      <td className="px-2.5 py-2 min-w-[115px]">
                        <select
                          value={l.status}
                          onChange={async (e) => {
                            await updateLancamentoFinanceiro(l.id, {
                              status: e.target.value as StatusFinanceiro,
                            });
                          }}
                          className={`${statusSelectCls} ${statusColorMap[l.status]}`}
                        >
                          {(Object.keys(STATUS_FINANCEIRO_LABELS) as StatusFinanceiro[]).map(
                            (st) => (
                              <option key={st} value={st}>
                                {STATUS_FINANCEIRO_LABELS[st]}
                              </option>
                            )
                          )}
                        </select>
                      </td>
                      <td className="px-3.5 py-2 text-right">
                        <button
                          type="button"
                          onClick={async () => {
                            await deleteLancamentoFinanceiro(l.id);
                            onToast('success', 'Lançamento financeiro removido.');
                          }}
                          className="rounded-md p-1.5 text-slate-400 dark:text-slate-500 hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400"
                          title="Excluir lançamento"
                          aria-label={`Excluir lançamento ${l.descricao}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
        </ScrollableTableCard>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Nova Categoria Form */}
          <div className="rounded-xl border border-slate-200/90 dark:border-white/[0.08] bg-white dark:bg-[#0F1520] p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
              <FolderPlus className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              Criar Nova Categoria
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Adicione categorias personalizadas para classificar os lançamentos financeiros da transportadora.
            </p>
            <form onSubmit={handleCreateCategory} className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Nome da Categoria *
                </label>
                <input
                  type="text"
                  required
                  value={catNome}
                  onChange={(e) => setCatNome(e.target.value)}
                  placeholder="Ex.: Pedágio / Tag, Seguro Frota..."
                  className="w-full rounded-lg border border-slate-300 dark:border-white/[0.1] bg-white dark:bg-[#0B0F17] px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Tipo Padrão
                </label>
                <select
                  value={catTipo}
                  onChange={(e) => setCatTipo(e.target.value as TipoLancamento)}
                  className="w-full rounded-lg border border-slate-300 dark:border-white/[0.1] bg-white dark:bg-[#0B0F17] px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none"
                >
                  <option value="receita">Receita</option>
                  <option value="despesa">Despesa</option>
                  <option value="repasse">Repasse</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Descrição
                </label>
                <input
                  type="text"
                  value={catDesc}
                  onChange={(e) => setCatDesc(e.target.value)}
                  placeholder="Opcional"
                  className="w-full rounded-lg border border-slate-300 dark:border-white/[0.1] bg-white dark:bg-[#0B0F17] px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={savingCat || !catNome.trim()}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" />
                {savingCat ? 'Criando...' : 'Adicionar Categoria'}
              </button>
            </form>
          </div>

          {/* Lista de Categorias */}
          <div className="rounded-xl border border-slate-200/90 dark:border-white/[0.08] bg-white dark:bg-[#0F1520] lg:col-span-2">
            <div className="border-b border-slate-200/80 dark:border-white/[0.07] px-5 py-4">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Categorias Cadastradas
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Categorias padrão da transportadora e personalizadas criadas pela equipe
              </p>
            </div>
            <div className="divide-y divide-slate-200/75 dark:divide-white/[0.06]">
              {categoriasFinanceiras.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-3 px-5 py-3 text-xs"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Tag className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {c.nome}
                      </span>
                      <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400">
                        · {TIPO_LANCAMENTO_LABELS[c.tipoPadrao]} · Personalizada
                      </span>
                    </div>
                    {c.descricao && (
                      <p className="mt-0.5 text-slate-500 dark:text-slate-400">{c.descricao}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await deleteCategoriaFinanceira(c.id);
                      onToast('success', `Categoria "${c.nome}" removida.`);
                    }}
                    className="rounded-md p-1.5 text-slate-400 dark:text-slate-500 hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400"
                    title="Excluir categoria"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}

              {DEFAULT_CATEGORIAS_FINANCEIRAS.map((defCat) => (
                <div
                  key={defCat.nome}
                  className="flex items-center justify-between gap-3 px-5 py-3 text-xs"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Tag className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                      <span className="font-medium text-slate-800 dark:text-slate-200">
                        {defCat.nome}
                      </span>
                      <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500">
                        · {TIPO_LANCAMENTO_LABELS[defCat.tipoPadrao]} · Padrão
                      </span>
                    </div>
                    <p className="mt-0.5 text-slate-500 dark:text-slate-400">{defCat.descricao}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

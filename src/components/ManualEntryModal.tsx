import { useMemo, useState, type FormEvent } from 'react';
import { Check, Search, Users, X } from 'lucide-react';
import type {
  CategoriaFinanceira,
  Motorista,
  Proprietario,
  SituacaoCadastral,
  StatusFinanceiro,
  StatusFrete,
  TipoLancamento,
  TipoVeiculo,
  Veiculo,
} from '../types/fleet';
import {
  createFrete,
  createLancamentoFinanceiro,
  createMotorista,
  createProprietario,
  createVeiculo,
  updateMotorista,
} from '../lib/fleetService';
import {
  DEFAULT_CATEGORIAS_FINANCEIRAS,
  getTodayIso,
  suggestSituacaoMotorista,
  suggestSituacaoVeiculo,
} from '../lib/compliance';

export type ManualModalMode =
  | 'motorista'
  | 'veiculo'
  | 'proprietario'
  | 'financeiro'
  | 'frete';

interface ManualEntryModalProps {
  mode: ManualModalMode;
  uid: string;
  proprietarios: Proprietario[];
  motoristas: Motorista[];
  veiculos?: Veiculo[];
  categoriasFinanceiras?: CategoriaFinanceira[];
  onClose: () => void;
  onCreated: (message: string) => void;
}

const inputCls =
  'w-full rounded-lg border border-slate-300 dark:border-white/[0.1] bg-white dark:bg-[#0B0F17] px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-blue-600 dark:focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20';

const labelCls = 'mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300';

export function ManualEntryModal({
  mode,
  uid,
  proprietarios,
  motoristas,
  veiculos = [],
  categoriasFinanceiras = [],
  onClose,
  onCreated,
}: ManualEntryModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Proprietario state
  const [propNome, setPropNome] = useState('');
  const [propCpfCnpj, setPropCpfCnpj] = useState('');
  const [propContato, setPropContato] = useState('');
  const [propSelectedMotIds, setPropSelectedMotIds] = useState<string[]>([]);
  const [motPickerSearch, setMotPickerSearch] = useState('');

  // Motorista state
  const [motNome, setMotNome] = useState('');
  const [motCpf, setMotCpf] = useState('');
  const [motCnh, setMotCnh] = useState('');
  const [motCategoria, setMotCategoria] = useState('');
  const [motValidade, setMotValidade] = useState('');
  const [motTelefone, setMotTelefone] = useState('');
  const [motPlaca, setMotPlaca] = useState('');
  const [motRotaPadrao, setMotRotaPadrao] = useState('');
  const [motValorDiariaPadrao, setMotValorDiariaPadrao] = useState('');
  const [motPropId, setMotPropId] = useState('');

  // Veiculo state
  const [veiPlaca, setVeiPlaca] = useState('');
  const [veiMarca, setVeiMarca] = useState('');
  const [veiModelo, setVeiModelo] = useState('');
  const [veiAno, setVeiAno] = useState('');
  const [veiRenavam, setVeiRenavam] = useState('');
  const [veiTipo, setVeiTipo] = useState<TipoVeiculo>('');
  const [veiPropId, setVeiPropId] = useState('');
  const [veiMotId, setVeiMotId] = useState('');
  const [veiValidadeCrlv, setVeiValidadeCrlv] = useState('');

  // Financeiro state
  const [finDescricao, setFinDescricao] = useState('');
  const [finTipo, setFinTipo] = useState<TipoLancamento>('despesa');
  const [finCategoria, setFinCategoria] = useState(DEFAULT_CATEGORIAS_FINANCEIRAS[0].nome);
  const [finValor, setFinValor] = useState('');
  const [finVencimento, setFinVencimento] = useState(getTodayIso());
  const [finPagamento, setFinPagamento] = useState('');
  const [finStatus, setFinStatus] = useState<StatusFinanceiro>('pendente');
  const [finPropId, setFinPropId] = useState('');
  const [finMotId, setFinMotId] = useState('');
  const [finVeiId, setFinVeiId] = useState('');

  // Frete state
  const [freteCliente, setFreteCliente] = useState('');
  const [freteOrigem, setFreteOrigem] = useState('');
  const [freteDestino, setFreteDestino] = useState('');
  const [freteDataSaida, setFreteDataSaida] = useState(getTodayIso());
  const [freteValor, setFreteValor] = useState('');
  const [freteRepasse, setFreteRepasse] = useState('');
  const [freteStatus, setFreteStatus] = useState<StatusFrete>('agendado');
  const [fretePropId, setFretePropId] = useState('');
  const [freteMotId, setFreteMotId] = useState('');
  const [freteVeiId, setFreteVeiId] = useState('');

  const [situacao, setSituacao] = useState<SituacaoCadastral>('em_analise');
  const [observacoes, setObservacoes] = useState('');

  const propMap = useMemo(
    () => new Map(proprietarios.map((p) => [p.id, p])),
    [proprietarios]
  );

  const filteredMotoristasForPicker = useMemo(() => {
    const q = motPickerSearch.trim().toLowerCase();
    if (!q) return motoristas;
    return motoristas.filter(
      (m) =>
        m.nomeCompleto.toLowerCase().includes(q) ||
        m.cpf.toLowerCase().includes(q) ||
        m.cnh.toLowerCase().includes(q)
    );
  }, [motoristas, motPickerSearch]);

  const allCategoryNames = useMemo(() => {
    const names = new Set<string>(DEFAULT_CATEGORIAS_FINANCEIRAS.map((c) => c.nome));
    for (const c of categoriasFinanceiras) {
      if (c.nome) names.add(c.nome);
    }
    return Array.from(names);
  }, [categoriasFinanceiras]);

  function toggleProprietarioMotorista(motId: string) {
    setPropSelectedMotIds((prev) =>
      prev.includes(motId) ? prev.filter((id) => id !== motId) : [...prev, motId]
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      if (mode === 'proprietario') {
        if (!propNome.trim()) {
          setError('Informe o nome completo ou razão social do proprietário.');
          setSubmitting(false);
          return;
        }
        const newPropId = await createProprietario(uid, {
          nomeCompleto: propNome,
          cpfCnpj: propCpfCnpj,
          contato: propContato,
          situacaoCadastral: situacao,
          observacoes,
        });

        for (const motId of propSelectedMotIds) {
          const targetMot = motoristas.find((m) => m.id === motId);
          if (targetMot) {
            await updateMotorista(targetMot.id, targetMot, { proprietarioId: newPropId });
          }
        }

        const extraMsg =
          propSelectedMotIds.length > 0
            ? ` e ${propSelectedMotIds.length} motorista(s) vinculado(s)`
            : '';
        onCreated(`Proprietário "${propNome.trim()}" cadastrado com sucesso${extraMsg}.`);
      } else if (mode === 'motorista') {
        if (!motNome.trim()) {
          setError('Informe o nome completo do motorista.');
          setSubmitting(false);
          return;
        }
        const computedSituacao = suggestSituacaoMotorista({
          nomeCompleto: motNome,
          cpf: motCpf,
          cnh: motCnh,
          categoriaCnh: motCategoria,
          validadeCnh: motValidade,
          telefone: motTelefone,
          situacaoCadastral: situacao,
        });
        await createMotorista(uid, {
          nomeCompleto: motNome,
          cpf: motCpf,
          cnh: motCnh,
          categoriaCnh: motCategoria,
          validadeCnh: motValidade,
          telefone: motTelefone,
          placa: motPlaca,
          rotaPadrao: motRotaPadrao,
          valorDiariaPadrao: Number(motValorDiariaPadrao.replace(',', '.')) || 0,
          proprietarioId: motPropId,
          situacaoCadastral: computedSituacao,
          observacoes,
        });
        onCreated(`Motorista "${motNome.trim()}" cadastrado com sucesso.`);
      } else if (mode === 'veiculo') {
        if (!veiPlaca.trim()) {
          setError('Informe a placa do veículo.');
          setSubmitting(false);
          return;
        }
        const computedSituacao = suggestSituacaoVeiculo({
          placa: veiPlaca,
          marca: veiMarca,
          modelo: veiModelo,
          ano: veiAno,
          renavam: veiRenavam,
          tipoVeiculo: veiTipo,
          proprietarioId: veiPropId,
          validadeCrlv: veiValidadeCrlv,
          situacaoCadastral: situacao,
        });
        await createVeiculo(uid, {
          placa: veiPlaca,
          marca: veiMarca,
          modelo: veiModelo,
          ano: veiAno,
          renavam: veiRenavam,
          tipoVeiculo: veiTipo,
          proprietarioId: veiPropId,
          motoristaId: veiMotId,
          validadeCrlv: veiValidadeCrlv,
          situacaoCadastral: computedSituacao,
          observacoes,
        });
        onCreated(`Veículo "${veiPlaca.trim().toUpperCase()}" cadastrado com sucesso.`);
      } else if (mode === 'financeiro') {
        if (!finDescricao.trim()) {
          setError('Informe a descrição do lançamento.');
          setSubmitting(false);
          return;
        }
        const numericVal = Number(finValor.replace(',', '.')) || 0;
        await createLancamentoFinanceiro(uid, {
          descricao: finDescricao,
          tipo: finTipo,
          categoria: finCategoria || 'Outro',
          valor: numericVal,
          dataVencimento: finVencimento,
          dataPagamento: finStatus === 'pago' ? finPagamento || getTodayIso() : finPagamento,
          status: finStatus,
          proprietarioId: finPropId,
          motoristaId: finMotId,
          veiculoId: finVeiId,
          observacoes,
        });
        onCreated(`Lançamento "${finDescricao.trim()}" salvo no Financeiro.`);
      } else {
        if (!freteCliente.trim()) {
          setError('Informe o cliente ou embarcador do frete.');
          setSubmitting(false);
          return;
        }
        const numericFrete = Number(freteValor.replace(',', '.')) || 0;
        const numericRepasse = Number(freteRepasse.replace(',', '.')) || 0;
        await createFrete(uid, {
          cliente: freteCliente,
          origem: freteOrigem,
          destino: freteDestino,
          dataSaida: freteDataSaida,
          valorFrete: numericFrete,
          valorRepasse: numericRepasse,
          proprietarioId: fretePropId,
          motoristaId: freteMotId,
          veiculoId: freteVeiId,
          status: freteStatus,
          observacoes,
        });
        onCreated(`Frete para "${freteCliente.trim()}" cadastrado com sucesso.`);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar cadastro.');
    } finally {
      setSubmitting(false);
    }
  }

  const titles: Record<ManualModalMode, string> = {
    proprietario: 'Novo Cadastro de Proprietário',
    motorista: 'Novo Cadastro de Motorista',
    veiculo: 'Novo Cadastro de Veículo',
    financeiro: 'Novo Lançamento Financeiro',
    frete: 'Novo Registro de Frete / Rota',
  };

  const showSituacaoField =
    mode === 'proprietario' || mode === 'motorista' || mode === 'veiculo';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
      <div className="flex max-h-[92vh] w-full max-w-xl flex-col rounded-xl border border-slate-200/90 dark:border-white/[0.09] bg-white dark:bg-[#0F1520] shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-white/[0.07] px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            {titles[mode]}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] hover:text-slate-700 dark:hover:text-white"
            aria-label="Fechar janela"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 space-y-4 overflow-y-auto p-6">
          {error && (
            <div className="rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/50 px-3.5 py-2.5 text-xs text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {mode === 'proprietario' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className={labelCls}>Nome Completo / Razão Social *</label>
                  <input
                    type="text"
                    value={propNome}
                    onChange={(e) => setPropNome(e.target.value)}
                    placeholder="Ex.: Carlos Alberto Mendes"
                    className={inputCls}
                    required
                  />
                </div>
                <div>
                  <label className={labelCls}>CPF / CNPJ</label>
                  <input
                    type="text"
                    value={propCpfCnpj}
                    onChange={(e) => setPropCpfCnpj(e.target.value)}
                    placeholder="000.000.000-00 (opcional)"
                    className={`${inputCls} font-mono`}
                  />
                </div>
                <div>
                  <label className={labelCls}>Contato</label>
                  <input
                    type="text"
                    value={propContato}
                    onChange={(e) => setPropContato(e.target.value)}
                    placeholder="(11) 99999-9999 / e-mail"
                    className={inputCls}
                  />
                </div>
              </div>

              {/* Selecionar Motoristas Cadastrados */}
              <div className="rounded-xl border border-slate-200/90 dark:border-white/[0.08] bg-slate-50/80 dark:bg-[#0B0F17] p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-white">
                    <Users className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                    Motoristas do Proprietário (Selecionar dos cadastrados)
                  </label>
                  {propSelectedMotIds.length > 0 && (
                    <span className="font-mono text-[11px] font-medium text-blue-700 dark:text-blue-400">
                      {propSelectedMotIds.length} selecionado(s)
                    </span>
                  )}
                </div>

                {motoristas.length === 0 ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Nenhum motorista cadastrado ainda. Você poderá vincular motoristas posteriormente na tabela de Proprietários.
                  </p>
                ) : (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                      <input
                        type="search"
                        value={motPickerSearch}
                        onChange={(e) => setMotPickerSearch(e.target.value)}
                        placeholder="Filtrar motorista cadastrado por nome, CPF ou CNH..."
                        className="w-full rounded-lg border border-slate-300 dark:border-white/[0.1] bg-white dark:bg-[#0F1520] py-1.5 pl-8 pr-2.5 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#0F1520] p-1.5">
                      {filteredMotoristasForPicker.length === 0 ? (
                        <p className="px-2 py-2 text-center text-xs text-slate-500 dark:text-slate-400">
                          Nenhum motorista encontrado para a busca.
                        </p>
                      ) : (
                        filteredMotoristasForPicker.map((m) => {
                          const checked = propSelectedMotIds.includes(m.id);
                          const currentOwner = m.proprietarioId
                            ? propMap.get(m.proprietarioId)?.nomeCompleto
                            : '';
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => toggleProprietarioMotorista(m.id)}
                              className={`flex w-full items-center justify-between gap-2 rounded px-2.5 py-1.5 text-left text-xs transition-colors ${
                                checked
                                  ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-900 dark:text-blue-100'
                                  : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.04]'
                              }`}
                            >
                              <div className="min-w-0">
                                <p className="truncate font-medium">{m.nomeCompleto}</p>
                                <p className="truncate font-mono text-[10px] text-slate-500 dark:text-slate-400">
                                  CPF: {m.cpf || '—'} · CNH: {m.cnh || '—'}
                                  {currentOwner ? ` · Atual: ${currentOwner}` : ''}
                                </p>
                              </div>
                              <span
                                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                                  checked
                                    ? 'border-blue-600 bg-blue-600 text-white'
                                    : 'border-slate-300 dark:border-slate-600'
                                }`}
                              >
                                {checked && <Check className="h-3 w-3" />}
                              </span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {mode === 'motorista' && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={labelCls}>Nome Completo *</label>
                <input
                  type="text"
                  value={motNome}
                  onChange={(e) => setMotNome(e.target.value)}
                  className={inputCls}
                  required
                />
              </div>
              <div>
                <label className={labelCls}>CPF</label>
                <input
                  type="text"
                  value={motCpf}
                  onChange={(e) => setMotCpf(e.target.value)}
                  placeholder="000.000.000-00"
                  className={`${inputCls} font-mono`}
                />
              </div>
              <div>
                <label className={labelCls}>Nº da CNH</label>
                <input
                  type="text"
                  value={motCnh}
                  onChange={(e) => setMotCnh(e.target.value)}
                  className={`${inputCls} font-mono`}
                />
              </div>
              <div>
                <label className={labelCls}>Categoria CNH</label>
                <input
                  type="text"
                  value={motCategoria}
                  onChange={(e) => setMotCategoria(e.target.value)}
                  placeholder="B, C, D, E, AD..."
                  className={`${inputCls} font-mono uppercase`}
                />
              </div>
              <div>
                <label className={labelCls}>Validade da CNH</label>
                <input
                  type="date"
                  value={motValidade}
                  onChange={(e) => setMotValidade(e.target.value)}
                  className={`${inputCls} font-mono`}
                />
              </div>
              <div>
                <label className={labelCls}>Telefone</label>
                <input
                  type="text"
                  value={motTelefone}
                  onChange={(e) => setMotTelefone(e.target.value)}
                  placeholder="(11) 90000-0000"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Placa do Veículo</label>
                <input
                  type="text"
                  list="manual-mot-placas"
                  value={motPlaca}
                  onChange={(e) => setMotPlaca(e.target.value.toUpperCase())}
                  placeholder="ABC1D23 (opcional)"
                  className={`${inputCls} font-mono uppercase`}
                />
                <datalist id="manual-mot-placas">
                  {veiculos.map((v) => (
                    <option key={v.id} value={v.placa}>
                      {v.modelo ? `${v.placa} · ${v.modelo}` : v.placa}
                    </option>
                  ))}
                </datalist>
              </div>
              <div>
                <label className={labelCls}>Rota Padrão (Opcional)</label>
                <input
                  type="text"
                  value={motRotaPadrao}
                  onChange={(e) => setMotRotaPadrao(e.target.value)}
                  placeholder="Ex.: DHL Cajamar · Grande SP"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Diária Padrão (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={motValorDiariaPadrao}
                  onChange={(e) => setMotValorDiariaPadrao(e.target.value)}
                  placeholder="0,00"
                  className={`${inputCls} font-mono`}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Proprietário Vinculado</label>
                <select
                  value={motPropId}
                  onChange={(e) => setMotPropId(e.target.value)}
                  className={inputCls}
                >
                  <option value="">Sem vínculo (ou selecionar)</option>
                  {proprietarios.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nomeCompleto}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {mode === 'veiculo' && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Placa *</label>
                <input
                  type="text"
                  value={veiPlaca}
                  onChange={(e) => setVeiPlaca(e.target.value)}
                  placeholder="ABC1D23"
                  className={`${inputCls} font-mono uppercase`}
                  required
                />
              </div>
              <div>
                <label className={labelCls}>Tipo de Veículo</label>
                <select
                  value={veiTipo}
                  onChange={(e) => setVeiTipo(e.target.value as TipoVeiculo)}
                  className={inputCls}
                >
                  <option value="">Sem categoria</option>
                  <option value="Van">Van</option>
                  <option value="HR">HR</option>
                  <option value="VUC">VUC</option>
                  <option value="Médio">Médio</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Marca</label>
                <input
                  type="text"
                  value={veiMarca}
                  onChange={(e) => setVeiMarca(e.target.value)}
                  placeholder="Ex.: Hyundai, Mercedes-Benz"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Modelo</label>
                <input
                  type="text"
                  value={veiModelo}
                  onChange={(e) => setVeiModelo(e.target.value)}
                  placeholder="Ex.: HR 2.5, Sprinter 416"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Ano</label>
                <input
                  type="text"
                  value={veiAno}
                  onChange={(e) => setVeiAno(e.target.value)}
                  placeholder="2023/2024"
                  className={`${inputCls} font-mono`}
                />
              </div>
              <div>
                <label className={labelCls}>RENAVAM</label>
                <input
                  type="text"
                  value={veiRenavam}
                  onChange={(e) => setVeiRenavam(e.target.value)}
                  className={`${inputCls} font-mono`}
                />
              </div>
              <div>
                <label className={labelCls}>Validade CRLV</label>
                <input
                  type="date"
                  value={veiValidadeCrlv}
                  onChange={(e) => setVeiValidadeCrlv(e.target.value)}
                  className={`${inputCls} font-mono`}
                />
              </div>
              <div>
                <label className={labelCls}>Proprietário</label>
                <select
                  value={veiPropId}
                  onChange={(e) => setVeiPropId(e.target.value)}
                  className={inputCls}
                >
                  <option value="">Sem vínculo</option>
                  {proprietarios.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nomeCompleto}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Motorista Principal (Opcional)</label>
                <select
                  value={veiMotId}
                  onChange={(e) => setVeiMotId(e.target.value)}
                  className={inputCls}
                >
                  <option value="">Não vinculado</option>
                  {motoristas.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nomeCompleto}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {mode === 'financeiro' && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={labelCls}>Descrição *</label>
                <input
                  type="text"
                  value={finDescricao}
                  onChange={(e) => setFinDescricao(e.target.value)}
                  placeholder="Ex.: Repasse quinzenal rota SP / Abastecimento"
                  className={inputCls}
                  required
                />
              </div>
              <div>
                <label className={labelCls}>Tipo</label>
                <select
                  value={finTipo}
                  onChange={(e) => setFinTipo(e.target.value as TipoLancamento)}
                  className={inputCls}
                >
                  <option value="receita">Receita (Entrada)</option>
                  <option value="despesa">Despesa (Saída)</option>
                  <option value="repasse">Repasse (Proprietário / Motorista)</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Categoria</label>
                <select
                  value={finCategoria}
                  onChange={(e) => setFinCategoria(e.target.value)}
                  className={inputCls}
                >
                  {allCategoryNames.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Valor (R$) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={finValor}
                  onChange={(e) => setFinValor(e.target.value)}
                  placeholder="0,00"
                  className={`${inputCls} font-mono`}
                  required
                />
              </div>
              <div>
                <label className={labelCls}>Status</label>
                <select
                  value={finStatus}
                  onChange={(e) => setFinStatus(e.target.value as StatusFinanceiro)}
                  className={inputCls}
                >
                  <option value="pendente">Em Aberto</option>
                  <option value="pago">Pago</option>
                  <option value="atrasado">Atrasado</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Data de Vencimento</label>
                <input
                  type="date"
                  value={finVencimento}
                  onChange={(e) => setFinVencimento(e.target.value)}
                  className={`${inputCls} font-mono`}
                />
              </div>
              <div>
                <label className={labelCls}>Data de Pagamento</label>
                <input
                  type="date"
                  value={finPagamento}
                  onChange={(e) => setFinPagamento(e.target.value)}
                  className={`${inputCls} font-mono`}
                />
              </div>
              <div>
                <label className={labelCls}>Proprietário (Opcional)</label>
                <select
                  value={finPropId}
                  onChange={(e) => setFinPropId(e.target.value)}
                  className={inputCls}
                >
                  <option value="">Nenhum</option>
                  {proprietarios.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nomeCompleto}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Motorista (Opcional)</label>
                <select
                  value={finMotId}
                  onChange={(e) => setFinMotId(e.target.value)}
                  className={inputCls}
                >
                  <option value="">Nenhum</option>
                  {motoristas.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nomeCompleto}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Veículo (Opcional)</label>
                <select
                  value={finVeiId}
                  onChange={(e) => setFinVeiId(e.target.value)}
                  className={inputCls}
                >
                  <option value="">Nenhum</option>
                  {veiculos.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.placa} {v.modelo ? `· ${v.modelo}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {mode === 'frete' && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={labelCls}>Cliente / Embarcador *</label>
                <input
                  type="text"
                  value={freteCliente}
                  onChange={(e) => setFreteCliente(e.target.value)}
                  placeholder="Ex.: DHL Supply Chain / Mercado Livre"
                  className={inputCls}
                  required
                />
              </div>
              <div>
                <label className={labelCls}>Origem</label>
                <input
                  type="text"
                  value={freteOrigem}
                  onChange={(e) => setFreteOrigem(e.target.value)}
                  placeholder="Ex.: Cajamar - SP"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Destino</label>
                <input
                  type="text"
                  value={freteDestino}
                  onChange={(e) => setFreteDestino(e.target.value)}
                  placeholder="Ex.: Campinas - SP"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Data de Saída</label>
                <input
                  type="date"
                  value={freteDataSaida}
                  onChange={(e) => setFreteDataSaida(e.target.value)}
                  className={`${inputCls} font-mono`}
                />
              </div>
              <div>
                <label className={labelCls}>Status</label>
                <select
                  value={freteStatus}
                  onChange={(e) => setFreteStatus(e.target.value as StatusFrete)}
                  className={inputCls}
                >
                  <option value="agendado">Agendado</option>
                  <option value="em_transito">Em Trânsito</option>
                  <option value="entregue">Entregue</option>
                  <option value="faturado">Faturado</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Valor Frete (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={freteValor}
                  onChange={(e) => setFreteValor(e.target.value)}
                  placeholder="0,00"
                  className={`${inputCls} font-mono`}
                />
              </div>
              <div>
                <label className={labelCls}>Valor Repasse (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={freteRepasse}
                  onChange={(e) => setFreteRepasse(e.target.value)}
                  placeholder="0,00"
                  className={`${inputCls} font-mono`}
                />
              </div>
              <div>
                <label className={labelCls}>Proprietário</label>
                <select
                  value={fretePropId}
                  onChange={(e) => setFretePropId(e.target.value)}
                  className={inputCls}
                >
                  <option value="">Selecionar proprietário...</option>
                  {proprietarios.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nomeCompleto}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Motorista</label>
                <select
                  value={freteMotId}
                  onChange={(e) => setFreteMotId(e.target.value)}
                  className={inputCls}
                >
                  <option value="">Selecionar motorista...</option>
                  {motoristas.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nomeCompleto}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Veículo</label>
                <select
                  value={freteVeiId}
                  onChange={(e) => setFreteVeiId(e.target.value)}
                  className={inputCls}
                >
                  <option value="">Selecionar veículo...</option>
                  {veiculos.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.placa} {v.modelo ? `· ${v.modelo}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {showSituacaoField && (
              <div>
                <label className={labelCls}>Situação Cadastral</label>
                <select
                  value={situacao}
                  onChange={(e) => setSituacao(e.target.value as SituacaoCadastral)}
                  className={inputCls}
                >
                  <option value="em_analise">Em Análise</option>
                  <option value="aprovado">Aprovado</option>
                  <option value="pendente">Em Revisão</option>
                  <option value="documentacao_vencida">Documentação Vencida</option>
                </select>
              </div>
            )}
            <div className={showSituacaoField ? '' : 'sm:col-span-2'}>
              <label className={labelCls}>Observações</label>
              <input
                type="text"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Notas internas (opcional)"
                className={inputCls}
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-200/80 dark:border-white/[0.07] pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 dark:border-white/[0.1] bg-white dark:bg-white/[0.04] px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.08] whitespace-nowrap"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white shadow-xs hover:bg-blue-500 disabled:opacity-50 whitespace-nowrap"
            >
              {submitting ? 'Salvando...' : 'Salvar Cadastro'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

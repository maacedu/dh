import { useMemo, useState, type FormEvent } from 'react';
import { Check, Search, Trash2, Users, X } from 'lucide-react';
import type {
  Motorista,
  Proprietario,
  SituacaoCadastral,
  TipoVeiculo,
  Veiculo,
} from '../types/fleet';
import {
  evaluateDateStatus,
  SITUACAO_LABELS,
  suggestSituacaoMotorista,
  suggestSituacaoVeiculo,
} from '../lib/compliance';
import {
  updateMotorista,
  updateProprietario,
  updateVeiculo,
} from '../lib/fleetService';

export type EditableEntity =
  | { type: 'motorista'; data: Motorista }
  | { type: 'veiculo'; data: Veiculo }
  | { type: 'proprietario'; data: Proprietario };

interface EditEntityModalProps {
  entity: EditableEntity;
  proprietarios: Proprietario[];
  motoristas: Motorista[];
  veiculos?: Veiculo[];
  onClose: () => void;
  onSaved: (message: string) => void;
  onRequestDelete: (entity: EditableEntity) => void;
}

const inputCls =
  'w-full rounded-lg border border-slate-300 dark:border-white/[0.1] bg-white dark:bg-[#0B0F17] px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-blue-600 dark:focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20';

const labelCls = 'mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300';

const SITUACAO_KEYS: SituacaoCadastral[] = [
  'aprovado',
  'em_analise',
  'pendente',
  'documentacao_vencida',
];

export function EditEntityModal({
  entity,
  proprietarios,
  motoristas,
  veiculos = [],
  onClose,
  onSaved,
  onRequestDelete,
}: EditEntityModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const propIdsSet = useMemo(() => new Set(proprietarios.map((p) => p.id)), [proprietarios]);
  const motIdsSet = useMemo(() => new Set(motoristas.map((m) => m.id)), [motoristas]);
  const propMap = useMemo(
    () => new Map(proprietarios.map((p) => [p.id, p])),
    [proprietarios]
  );

  // Motorista fields
  const initMot = entity.type === 'motorista' ? entity.data : null;
  const [motNome, setMotNome] = useState(initMot?.nomeCompleto ?? '');
  const [motCpf, setMotCpf] = useState(initMot?.cpf ?? '');
  const [motCnh, setMotCnh] = useState(initMot?.cnh ?? '');
  const [motCategoria, setMotCategoria] = useState(initMot?.categoriaCnh ?? '');
  const [motValidade, setMotValidade] = useState(initMot?.validadeCnh ?? '');
  const [motTelefone, setMotTelefone] = useState(initMot?.telefone ?? '');
  const [motPlaca, setMotPlaca] = useState(() => {
    if (!initMot) return '';
    if (initMot.placa) return initMot.placa;
    return veiculos.find((v) => v.motoristaId === initMot.id)?.placa ?? '';
  });
  const [motPropId, setMotPropId] = useState(
    initMot && propIdsSet.has(initMot.proprietarioId) ? initMot.proprietarioId : ''
  );

  // Veiculo fields
  const initVei = entity.type === 'veiculo' ? entity.data : null;
  const [veiPlaca, setVeiPlaca] = useState(initVei?.placa ?? '');
  const [veiTipo, setVeiTipo] = useState<TipoVeiculo>(initVei?.tipoVeiculo ?? '');
  const [veiMarca, setVeiMarca] = useState(initVei?.marca ?? '');
  const [veiModelo, setVeiModelo] = useState(initVei?.modelo ?? '');
  const [veiAno, setVeiAno] = useState(initVei?.ano ?? '');
  const [veiRenavam, setVeiRenavam] = useState(initVei?.renavam ?? '');
  const [veiValidadeCrlv, setVeiValidadeCrlv] = useState(initVei?.validadeCrlv ?? '');
  const [veiPropId, setVeiPropId] = useState(
    initVei && propIdsSet.has(initVei.proprietarioId) ? initVei.proprietarioId : ''
  );
  const [veiMotId, setVeiMotId] = useState(
    initVei && motIdsSet.has(initVei.motoristaId) ? initVei.motoristaId : ''
  );

  // Proprietario fields
  const initProp = entity.type === 'proprietario' ? entity.data : null;
  const [propNome, setPropNome] = useState(initProp?.nomeCompleto ?? '');
  const [propCpfCnpj, setPropCpfCnpj] = useState(initProp?.cpfCnpj ?? '');
  const [propContato, setPropContato] = useState(initProp?.contato ?? '');
  const [propSelectedMotIds, setPropSelectedMotIds] = useState<string[]>(() =>
    initProp ? motoristas.filter((m) => m.proprietarioId === initProp.id).map((m) => m.id) : []
  );
  const [motPickerSearch, setMotPickerSearch] = useState('');

  // Shared status + notes
  const [situacao, setSituacao] = useState<SituacaoCadastral>(entity.data.situacaoCadastral);
  const [observacoes, setObservacoes] = useState(entity.data.observacoes ?? '');

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

  function toggleProprietarioMotorista(motId: string) {
    setPropSelectedMotIds((prev) =>
      prev.includes(motId) ? prev.filter((id) => id !== motId) : [...prev, motId]
    );
  }

  function applySuggestedMotStatus() {
    const suggested = suggestSituacaoMotorista({
      nomeCompleto: motNome,
      cpf: motCpf,
      cnh: motCnh,
      categoriaCnh: motCategoria,
      validadeCnh: motValidade,
      telefone: motTelefone,
      situacaoCadastral: 'aprovado',
    });
    setSituacao(suggested);
  }

  function applySuggestedVeiStatus() {
    const suggested = suggestSituacaoVeiculo({
      placa: veiPlaca,
      marca: veiMarca,
      modelo: veiModelo,
      ano: veiAno,
      renavam: veiRenavam,
      tipoVeiculo: veiTipo,
      proprietarioId: veiPropId,
      validadeCrlv: veiValidadeCrlv,
      situacaoCadastral: 'aprovado',
    });
    setSituacao(suggested);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      if (entity.type === 'motorista') {
        if (!motNome.trim()) {
          setError('Informe o nome completo do motorista.');
          setSubmitting(false);
          return;
        }
        const safePropId = motPropId && propIdsSet.has(motPropId) ? motPropId : '';
        await updateMotorista(entity.data.id, entity.data, {
          nomeCompleto: motNome,
          cpf: motCpf,
          cnh: motCnh,
          categoriaCnh: motCategoria,
          validadeCnh: motValidade,
          telefone: motTelefone,
          placa: motPlaca,
          proprietarioId: safePropId,
          situacaoCadastral: situacao,
          observacoes,
        });
        onSaved(`Cadastro do motorista "${motNome.trim()}" atualizado.`);
      } else if (entity.type === 'veiculo') {
        if (!veiPlaca.trim()) {
          setError('Informe a placa do veículo.');
          setSubmitting(false);
          return;
        }
        const safePropId = veiPropId && propIdsSet.has(veiPropId) ? veiPropId : '';
        const safeMotId = veiMotId && motIdsSet.has(veiMotId) ? veiMotId : '';
        await updateVeiculo(entity.data.id, entity.data, {
          placa: veiPlaca,
          tipoVeiculo: veiTipo,
          marca: veiMarca,
          modelo: veiModelo,
          ano: veiAno,
          renavam: veiRenavam,
          validadeCrlv: veiValidadeCrlv,
          proprietarioId: safePropId,
          motoristaId: safeMotId,
          situacaoCadastral: situacao,
          observacoes,
        });
        onSaved(`Cadastro do veículo "${veiPlaca.trim().toUpperCase()}" atualizado.`);
      } else {
        if (!propNome.trim()) {
          setError('Informe o nome completo ou razão social do proprietário.');
          setSubmitting(false);
          return;
        }
        await updateProprietario(entity.data.id, {
          nomeCompleto: propNome,
          cpfCnpj: propCpfCnpj,
          contato: propContato,
          situacaoCadastral: situacao,
          observacoes,
        });

        const ownerId = entity.data.id;
        for (const m of motoristas) {
          const shouldBeLinked = propSelectedMotIds.includes(m.id);
          const isCurrentlyLinked = m.proprietarioId === ownerId;
          if (shouldBeLinked && !isCurrentlyLinked) {
            await updateMotorista(m.id, m, { proprietarioId: ownerId });
          } else if (!shouldBeLinked && isCurrentlyLinked) {
            await updateMotorista(m.id, m, { proprietarioId: '' });
          }
        }
        onSaved(`Cadastro do proprietário "${propNome.trim()}" atualizado.`);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar cadastro.');
    } finally {
      setSubmitting(false);
    }
  }

  const titles: Record<EditableEntity['type'], string> = {
    motorista: 'Editar Motorista e Situação Cadastral',
    veiculo: 'Editar Veículo e Documentação',
    proprietario: 'Editar Proprietário e Vínculos',
  };

  const cnhStatus = entity.type === 'motorista' ? evaluateDateStatus(motValidade) : null;
  const crlvStatus = entity.type === 'veiculo' ? evaluateDateStatus(veiValidadeCrlv) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
      <div className="flex max-h-[92vh] w-full max-w-xl flex-col rounded-xl border border-slate-200/90 dark:border-white/[0.09] bg-white dark:bg-[#0F1520] shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-white/[0.07] px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            {titles[entity.type]}
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

          {/* Situação Cadastral Highlighted Block */}
          <div className="rounded-xl border border-slate-200/90 dark:border-white/[0.08] bg-slate-50/80 dark:bg-[#0B0F17] p-4 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-semibold text-slate-800 dark:text-white">
                Situação Cadastral / Status
              </label>
              {entity.type === 'motorista' && (
                <button
                  type="button"
                  onClick={applySuggestedMotStatus}
                  className="text-[11px] font-medium text-blue-700 dark:text-blue-400 hover:underline"
                >
                  Calcular automático pela CNH
                </button>
              )}
              {entity.type === 'veiculo' && (
                <button
                  type="button"
                  onClick={applySuggestedVeiStatus}
                  className="text-[11px] font-medium text-blue-700 dark:text-blue-400 hover:underline"
                >
                  Calcular automático pelo CRLV
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {SITUACAO_KEYS.map((st) => {
                const active = situacao === st;
                const activeTone =
                  st === 'aprovado'
                    ? 'border-emerald-600 bg-emerald-600/15 text-emerald-700 dark:text-emerald-300'
                    : st === 'documentacao_vencida'
                      ? 'border-red-600 bg-red-600/15 text-red-700 dark:text-red-300'
                      : st === 'pendente'
                        ? 'border-slate-500 dark:border-white/80 bg-slate-200/70 dark:bg-white/10 text-slate-900 dark:text-white'
                        : 'border-blue-600 bg-blue-600/15 text-blue-700 dark:text-blue-300';
                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setSituacao(st)}
                    className={`rounded-lg border px-2.5 py-2 text-[11px] font-medium transition-colors text-center ${
                      active
                        ? activeTone
                        : 'border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#0F1520] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {SITUACAO_LABELS[st]}
                  </button>
                );
              })}
            </div>
          </div>

          {entity.type === 'motorista' && (
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
                {cnhStatus === 'vencido' && (
                  <p className="mt-1 text-[11px] font-medium text-red-700 dark:text-red-400">
                    Atenção: CNH vencida nesta data.
                  </p>
                )}
                {cnhStatus === 'a_vencer' && (
                  <p className="mt-1 text-[11px] font-medium text-slate-700 dark:text-white">
                    Atenção: CNH vence nos próximos 30 dias.
                  </p>
                )}
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
                  list="edit-mot-placas"
                  value={motPlaca}
                  onChange={(e) => setMotPlaca(e.target.value.toUpperCase())}
                  placeholder="ABC1D23 (opcional)"
                  className={`${inputCls} font-mono uppercase`}
                />
                <datalist id="edit-mot-placas">
                  {veiculos.map((v) => (
                    <option key={v.id} value={v.placa}>
                      {v.modelo ? `${v.placa} · ${v.modelo}` : v.placa}
                    </option>
                  ))}
                </datalist>
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Proprietário Vinculado</label>
                <select
                  value={motPropId}
                  onChange={(e) => setMotPropId(e.target.value)}
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
            </div>
          )}

          {entity.type === 'veiculo' && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Placa *</label>
                <input
                  type="text"
                  value={veiPlaca}
                  onChange={(e) => setVeiPlaca(e.target.value)}
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
                  <option value="">Pendente</option>
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
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Modelo</label>
                <input
                  type="text"
                  value={veiModelo}
                  onChange={(e) => setVeiModelo(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Ano</label>
                <input
                  type="text"
                  value={veiAno}
                  onChange={(e) => setVeiAno(e.target.value)}
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
                {crlvStatus === 'vencido' && (
                  <p className="mt-1 text-[11px] font-medium text-red-700 dark:text-red-400">
                    Atenção: CRLV vencido nesta data.
                  </p>
                )}
              </div>
              <div>
                <label className={labelCls}>Proprietário</label>
                <select
                  value={veiPropId}
                  onChange={(e) => setVeiPropId(e.target.value)}
                  className={inputCls}
                >
                  <option value="">Pendente de vínculo</option>
                  {proprietarios.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nomeCompleto}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Motorista Principal</label>
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

          {entity.type === 'proprietario' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className={labelCls}>Nome Completo / Razão Social *</label>
                  <input
                    type="text"
                    value={propNome}
                    onChange={(e) => setPropNome(e.target.value)}
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
                    className={`${inputCls} font-mono`}
                  />
                </div>
                <div>
                  <label className={labelCls}>Contato</label>
                  <input
                    type="text"
                    value={propContato}
                    onChange={(e) => setPropContato(e.target.value)}
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="rounded-xl border border-slate-200/90 dark:border-white/[0.08] bg-slate-50/80 dark:bg-[#0B0F17] p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-white">
                    <Users className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                    Motoristas Vinculados ({propSelectedMotIds.length})
                  </label>
                </div>

                {motoristas.length === 0 ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Nenhum motorista cadastrado.
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
                    <div className="max-h-36 space-y-1 overflow-y-auto rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#0F1520] p-1.5">
                      {filteredMotoristasForPicker.map((m) => {
                        const checked = propSelectedMotIds.includes(m.id);
                        const otherOwner =
                          m.proprietarioId && m.proprietarioId !== entity.data.id
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
                                CPF: {m.cpf || 'Pendente'} · CNH: {m.cnh || 'Pendente'}
                                {otherOwner ? ` · Atual: ${otherOwner}` : ''}
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
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div>
            <label className={labelCls}>Observações</label>
            <textarea
              rows={2}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Anotações internas sobre documentação, pendências ou histórico..."
              className={inputCls}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/80 dark:border-white/[0.07] pt-4">
            <button
              type="button"
              disabled={submitting}
              onClick={() => onRequestDelete(entity)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 px-3.5 py-2 text-xs font-medium text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-950/70 disabled:opacity-50 whitespace-nowrap"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Excluir Cadastro
            </button>

            <div className="flex items-center gap-2.5">
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
                {submitting ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

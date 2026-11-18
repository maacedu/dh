import { useState } from 'react';
import { Link2, Truck, Unlink, UserCheck, X } from 'lucide-react';
import type { Documento, Motorista, Proprietario, Veiculo } from '../types/fleet';
import { formatDatePtBr } from '../lib/compliance';
import { updateMotorista, updateVeiculo } from '../lib/fleetService';
import { DocStatusIndicator, SituacaoIndicator } from './StatusTag';

interface OwnerDetailDrawerProps {
  proprietario: Proprietario;
  proprietarios?: Proprietario[];
  motoristas: Motorista[];
  veiculos: Veiculo[];
  documentos: Documento[];
  onClose: () => void;
}

export function OwnerDetailDrawer({
  proprietario,
  proprietarios = [],
  motoristas,
  veiculos,
  documentos,
  onClose,
}: OwnerDetailDrawerProps) {
  const [selectedMotoristaId, setSelectedMotoristaId] = useState('');
  const [selectedVeiculoId, setSelectedVeiculoId] = useState('');
  const [busyId, setBusyId] = useState('');

  const propNameMap = new Map(proprietarios.map((p) => [p.id, p.nomeCompleto]));

  const linkedMotoristas = motoristas.filter((m) => m.proprietarioId === proprietario.id);
  const availableMotoristas = motoristas.filter((m) => m.proprietarioId !== proprietario.id);

  const linkedVeiculos = veiculos.filter((v) => v.proprietarioId === proprietario.id);
  const availableVeiculos = veiculos.filter((v) => v.proprietarioId !== proprietario.id);

  const ownerDocs = documentos.filter(
    (d) =>
      (d.entidadeTipo === 'proprietario' && d.entidadeId === proprietario.id) ||
      (d.entidadeTipo === 'motorista' && linkedMotoristas.some((m) => m.id === d.entidadeId)) ||
      (d.entidadeTipo === 'veiculo' && linkedVeiculos.some((v) => v.id === d.entidadeId))
  );

  async function handleLinkMotorista() {
    if (!selectedMotoristaId) return;
    const target = motoristas.find((m) => m.id === selectedMotoristaId);
    if (!target) return;
    setBusyId(target.id);
    try {
      await updateMotorista(target.id, target, { proprietarioId: proprietario.id });
      setSelectedMotoristaId('');
    } finally {
      setBusyId('');
    }
  }

  async function handleUnlinkMotorista(m: Motorista) {
    setBusyId(m.id);
    try {
      await updateMotorista(m.id, m, { proprietarioId: '' });
    } finally {
      setBusyId('');
    }
  }

  async function handleLinkVeiculo() {
    if (!selectedVeiculoId) return;
    const target = veiculos.find((v) => v.id === selectedVeiculoId);
    if (!target) return;
    setBusyId(target.id);
    try {
      await updateVeiculo(target.id, target, { proprietarioId: proprietario.id });
      setSelectedVeiculoId('');
    } finally {
      setBusyId('');
    }
  }

  async function handleUnlinkVeiculo(v: Veiculo) {
    setBusyId(v.id);
    try {
      await updateVeiculo(v.id, v, { proprietarioId: '' });
    } finally {
      setBusyId('');
    }
  }

  const selectCls =
    'rounded-lg border border-slate-300 dark:border-white/[0.1] bg-white dark:bg-[#0B0F17] px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:border-blue-500 focus:outline-none';

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/75 backdrop-blur-xs">
      <div className="flex h-full w-full max-w-2xl flex-col border-l border-slate-200/90 dark:border-white/[0.08] bg-white dark:bg-[#0F1520] shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200/80 dark:border-white/[0.07] px-6 py-5">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Ficha do Proprietário
            </p>
            <h2 className="mt-0.5 text-lg font-semibold text-slate-900 dark:text-white">
              {proprietario.nomeCompleto}
            </h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
              <span className="font-mono tabular-nums">
                {proprietario.cpfCnpj || 'CPF/CNPJ não informado'}
              </span>
              <span aria-hidden="true">·</span>
              <span>{proprietario.contato || 'Contato não informado'}</span>
              <span aria-hidden="true">·</span>
              <SituacaoIndicator situacao={proprietario.situacaoCadastral} />
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] hover:text-slate-700 dark:hover:text-white"
            aria-label="Fechar ficha"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          {/* Motoristas Vinculados */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                <UserCheck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                Motoristas Vinculados ({linkedMotoristas.length})
              </h3>
              <div className="flex items-center gap-2">
                <select
                  value={selectedMotoristaId}
                  onChange={(e) => setSelectedMotoristaId(e.target.value)}
                  className={`max-w-[260px] ${selectCls}`}
                >
                  <option value="">Selecionar motorista cadastrado...</option>
                  {availableMotoristas.map((m) => {
                    const otherOwner = m.proprietarioId ? propNameMap.get(m.proprietarioId) : '';
                    return (
                      <option key={m.id} value={m.id}>
                        {m.nomeCompleto}
                        {m.cpf ? ` (${m.cpf})` : ''}
                        {otherOwner ? ` · Atual: ${otherOwner}` : ''}
                      </option>
                    );
                  })}
                </select>
                <button
                  type="button"
                  disabled={!selectedMotoristaId || Boolean(busyId)}
                  onClick={handleLinkMotorista}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-45 whitespace-nowrap"
                >
                  <Link2 className="h-3.5 w-3.5" />
                  Vincular
                </button>
              </div>
            </div>

            {linkedMotoristas.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-200 dark:border-white/[0.1] px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                Nenhum motorista vinculado a este proprietário.
              </p>
            ) : (
              <div className="divide-y divide-slate-200/80 dark:divide-white/[0.06] overflow-hidden rounded-lg border border-slate-200/90 dark:border-white/[0.08] bg-white dark:bg-[#0B0F17]">
                {linkedMotoristas.map((m) => {
                  const approved = m.situacaoCadastral === 'aprovado';
                  return (
                    <div
                      key={m.id}
                      className={`flex items-center justify-between gap-3 px-4 py-3 text-xs ${
                        approved
                          ? 'bg-emerald-50/85 dark:bg-emerald-950/35'
                          : ''
                      }`}
                    >
                      <div>
                        <p
                          className={`font-medium ${
                            approved
                              ? 'text-emerald-800 dark:text-emerald-300'
                              : 'text-slate-900 dark:text-white'
                          }`}
                        >
                          {m.nomeCompleto}
                        </p>
                        <p
                          className={`mt-0.5 font-mono tabular-nums ${
                            approved
                              ? 'text-emerald-700/90 dark:text-emerald-300/80'
                              : 'text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          CPF: {m.cpf || '—'} · CNH: {m.cnh || '—'} ({m.categoriaCnh || '-'}) · Validade: {formatDatePtBr(m.validadeCnh)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <SituacaoIndicator situacao={m.situacaoCadastral} />
                        <button
                          type="button"
                          disabled={busyId === m.id}
                          onClick={() => handleUnlinkMotorista(m)}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-white/[0.1] px-2.5 py-1 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.05] hover:text-red-700 dark:hover:text-red-400"
                          title="Desvincular motorista"
                        >
                          <Unlink className="h-3 w-3" />
                          Desvincular
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Veículos Vinculados */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                <Truck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                Veículos Vinculados ({linkedVeiculos.length})
              </h3>
              <div className="flex items-center gap-2">
                <select
                  value={selectedVeiculoId}
                  onChange={(e) => setSelectedVeiculoId(e.target.value)}
                  className={selectCls}
                >
                  <option value="">Selecionar veículo para vincular...</option>
                  {availableVeiculos.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.placa} {v.modelo ? `· ${v.modelo}` : ''}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!selectedVeiculoId || Boolean(busyId)}
                  onClick={handleLinkVeiculo}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-45 whitespace-nowrap"
                >
                  <Link2 className="h-3.5 w-3.5" />
                  Vincular
                </button>
              </div>
            </div>

            {linkedVeiculos.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-200 dark:border-white/[0.1] px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                Nenhum veículo vinculado a este proprietário.
              </p>
            ) : (
              <div className="divide-y divide-slate-200/80 dark:divide-white/[0.06] overflow-hidden rounded-lg border border-slate-200/90 dark:border-white/[0.08] bg-white dark:bg-[#0B0F17]">
                {linkedVeiculos.map((v) => (
                  <div
                    key={v.id}
                    className="flex items-center justify-between gap-3 px-4 py-3 text-xs"
                  >
                    <div>
                      <p className="font-medium text-slate-900 dark:text-white">
                        <span className="font-mono">{v.placa}</span> · {v.marca || 'Marca não informada'}{' '}
                        {v.modelo || ''} ({v.tipoVeiculo || 'Sem categoria'})
                      </p>
                      <p className="mt-0.5 font-mono tabular-nums text-slate-500 dark:text-slate-400">
                        RENAVAM: {v.renavam || '—'} · Ano: {v.ano || '—'} · CRLV: {formatDatePtBr(v.validadeCrlv)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <SituacaoIndicator situacao={v.situacaoCadastral} />
                      <button
                        type="button"
                        disabled={busyId === v.id}
                        onClick={() => handleUnlinkVeiculo(v)}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-white/[0.1] px-2.5 py-1 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.05] hover:text-red-700 dark:hover:text-red-400"
                        title="Desvincular veículo"
                      >
                        <Unlink className="h-3 w-3" />
                        Desvincular
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Documentos do Grupo */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Documentação Associada ({ownerDocs.length})
            </h3>
            {ownerDocs.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-200 dark:border-white/[0.1] px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                Nenhum documento anexado para este proprietário ou sua frota.
              </p>
            ) : (
              <div className="divide-y divide-slate-200/80 dark:divide-white/[0.06] overflow-hidden rounded-lg border border-slate-200/90 dark:border-white/[0.08] bg-white dark:bg-[#0B0F17]">
                {ownerDocs.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center justify-between gap-3 px-4 py-3 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900 dark:text-white">
                        {d.tipoDocumento} · {d.nomeArquivo}
                      </p>
                      <p className="mt-0.5 text-slate-500 dark:text-slate-400">
                        Vínculo: {d.entidadeNome} · Validade:{' '}
                        <span className="font-mono tabular-nums">
                          {formatDatePtBr(d.dataValidade)}
                        </span>
                      </p>
                    </div>
                    <DocStatusIndicator status={d.statusDocumento} />
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

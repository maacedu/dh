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

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-[2px]">
      <div className="flex h-full w-full max-w-2xl flex-col border-l border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 dark:border-zinc-800 px-6 py-4">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-zinc-400">
              Ficha do Proprietário
            </p>
            <h2 className="mt-0.5 text-lg font-semibold text-slate-900 dark:text-zinc-100">
              {proprietario.nomeCompleto}
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-zinc-400">
              <span className="font-mono tabular-nums">
                {proprietario.cpfCnpj || 'CPF/CNPJ Pendente'}
              </span>
              <span aria-hidden="true">·</span>
              <span>{proprietario.contato || 'Contato Pendente'}</span>
              <span aria-hidden="true">·</span>
              <SituacaoIndicator situacao={proprietario.situacaoCadastral} />
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1.5 text-slate-400 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-slate-700 dark:hover:text-zinc-100"
            aria-label="Fechar ficha"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          {/* Motoristas Vinculados */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-zinc-100">
                <UserCheck className="h-4 w-4 text-slate-600 dark:text-zinc-400" />
                Motoristas Vinculados ({linkedMotoristas.length})
              </h3>
              <div className="flex items-center gap-2">
                <select
                  value={selectedMotoristaId}
                  onChange={(e) => setSelectedMotoristaId(e.target.value)}
                  className="max-w-[260px] rounded-md border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-2.5 py-1.5 text-xs text-slate-800 dark:text-zinc-200 focus:border-blue-500 focus:outline-none"
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
                  className="inline-flex items-center gap-1 rounded-md bg-blue-700 dark:bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-800 dark:hover:bg-blue-500 disabled:opacity-45 whitespace-nowrap"
                >
                  <Link2 className="h-3.5 w-3.5" />
                  Vincular
                </button>
              </div>
            </div>

            {linkedMotoristas.length === 0 ? (
              <p className="rounded-md border border-dashed border-slate-200 dark:border-zinc-800 px-4 py-3 text-xs text-slate-500 dark:text-zinc-400">
                Nenhum motorista vinculado a este proprietário.
              </p>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-zinc-800 rounded-md border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/60">
                {linkedMotoristas.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between gap-3 px-4 py-2.5 text-xs"
                  >
                    <div>
                      <p className="font-medium text-slate-900 dark:text-zinc-100">
                        {m.nomeCompleto}
                      </p>
                      <p className="mt-0.5 font-mono tabular-nums text-slate-500 dark:text-zinc-400">
                        CPF: {m.cpf || 'Pendente'} · CNH: {m.cnh || 'Pendente'} ({m.categoriaCnh || '-'}) · Validade: {formatDatePtBr(m.validadeCnh)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <SituacaoIndicator situacao={m.situacaoCadastral} />
                      <button
                        type="button"
                        disabled={busyId === m.id}
                        onClick={() => handleUnlinkMotorista(m)}
                        className="inline-flex items-center gap-1 rounded border border-slate-200 dark:border-zinc-700 px-2 py-1 text-xs text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 hover:text-red-700 dark:hover:text-red-400"
                        title="Desvincular motorista"
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

          {/* Veículos Vinculados */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-zinc-100">
                <Truck className="h-4 w-4 text-slate-600 dark:text-zinc-400" />
                Veículos Vinculados ({linkedVeiculos.length})
              </h3>
              <div className="flex items-center gap-2">
                <select
                  value={selectedVeiculoId}
                  onChange={(e) => setSelectedVeiculoId(e.target.value)}
                  className="rounded-md border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-2.5 py-1.5 text-xs text-slate-800 dark:text-zinc-200 focus:border-blue-500 focus:outline-none"
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
                  className="inline-flex items-center gap-1 rounded-md bg-blue-700 dark:bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-800 dark:hover:bg-blue-500 disabled:opacity-45 whitespace-nowrap"
                >
                  <Link2 className="h-3.5 w-3.5" />
                  Vincular
                </button>
              </div>
            </div>

            {linkedVeiculos.length === 0 ? (
              <p className="rounded-md border border-dashed border-slate-200 dark:border-zinc-800 px-4 py-3 text-xs text-slate-500 dark:text-zinc-400">
                Nenhum veículo vinculado a este proprietário.
              </p>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-zinc-800 rounded-md border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/60">
                {linkedVeiculos.map((v) => (
                  <div
                    key={v.id}
                    className="flex items-center justify-between gap-3 px-4 py-2.5 text-xs"
                  >
                    <div>
                      <p className="font-medium text-slate-900 dark:text-zinc-100">
                        <span className="font-mono">{v.placa}</span> · {v.marca || 'Marca pendente'}{' '}
                        {v.modelo || ''} ({v.tipoVeiculo || 'Tipo pendente'})
                      </p>
                      <p className="mt-0.5 font-mono tabular-nums text-slate-500 dark:text-zinc-400">
                        RENAVAM: {v.renavam || 'Pendente'} · Ano: {v.ano || 'Pendente'} · CRLV: {formatDatePtBr(v.validadeCrlv)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <SituacaoIndicator situacao={v.situacaoCadastral} />
                      <button
                        type="button"
                        disabled={busyId === v.id}
                        onClick={() => handleUnlinkVeiculo(v)}
                        className="inline-flex items-center gap-1 rounded border border-slate-200 dark:border-zinc-700 px-2 py-1 text-xs text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 hover:text-red-700 dark:hover:text-red-400"
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
            <h3 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
              Documentação Associada ({ownerDocs.length})
            </h3>
            {ownerDocs.length === 0 ? (
              <p className="rounded-md border border-dashed border-slate-200 dark:border-zinc-800 px-4 py-3 text-xs text-slate-500 dark:text-zinc-400">
                Nenhum documento anexado para este proprietário ou sua frota.
              </p>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-zinc-800 rounded-md border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/60">
                {ownerDocs.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center justify-between gap-3 px-4 py-2.5 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900 dark:text-zinc-100">
                        {d.tipoDocumento} · {d.nomeArquivo}
                      </p>
                      <p className="mt-0.5 text-slate-500 dark:text-zinc-400">
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

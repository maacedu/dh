import { useState, type ChangeEvent, type DragEvent } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Loader2,
  Upload,
  X,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import type {
  EntidadeTipo,
  ExtractionResponse,
  Motorista,
  Proprietario,
  SituacaoCadastral,
  StatusDocumento,
  TipoDocumento,
  TipoVeiculo,
  Veiculo,
} from '../types/fleet';
import {
  computeMotoristaPendingFields,
  computeProprietarioPendingFields,
  computeVeiculoPendingFields,
  evaluateDateStatus,
  suggestSituacaoMotorista,
  suggestSituacaoVeiculo,
} from '../lib/compliance';
import {
  createDocumento,
  createMotorista,
  createProprietario,
  createVeiculo,
  updateMotorista,
  updateProprietario,
  updateVeiculo,
} from '../lib/fleetService';

interface DocumentUploadModalProps {
  user: User;
  proprietarios: Proprietario[];
  motoristas: Motorista[];
  veiculos: Veiculo[];
  onClose: () => void;
  onSaved: (message: string) => void;
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Falha ao ler o arquivo.'));
      }
    };
    reader.onerror = () => reject(new Error('Erro na leitura do arquivo.'));
    reader.readAsDataURL(file);
  });
}

function normalizeDigits(s: string): string {
  return s.replace(/\D/g, '');
}

function normalizePlate(s: string): string {
  return s.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

const fieldInputCls =
  'w-full rounded-lg border border-slate-300 dark:border-white/[0.1] bg-white dark:bg-[#0B0F17] px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-400 focus:border-blue-500 focus:outline-none';

export function DocumentUploadModal({
  user,
  proprietarios,
  motoristas,
  veiculos,
  onClose,
  onSaved,
}: DocumentUploadModalProps) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [hintTipo, setHintTipo] = useState<string>('');
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Editable review state populated strictly from document extraction
  const [reviewReady, setReviewReady] = useState(false);
  const [tipoDoc, setTipoDoc] = useState<TipoDocumento>('Outro');
  const [entidadePrincipal, setEntidadePrincipal] = useState<EntidadeTipo>('motorista');
  const [dataValidadeDoc, setDataValidadeDoc] = useState('');
  const [resumoExtracao, setResumoExtracao] = useState('');
  const [camposNaoIdentificados, setCamposNaoIdentificados] = useState<string[]>([]);

  // Motorista review fields
  const [includeMotorista, setIncludeMotorista] = useState(false);
  const [targetMotoristaId, setTargetMotoristaId] = useState<string>('__new__');
  const [motNome, setMotNome] = useState('');
  const [motCpf, setMotCpf] = useState('');
  const [motCnh, setMotCnh] = useState('');
  const [motCategoria, setMotCategoria] = useState('');
  const [motValidade, setMotValidade] = useState('');
  const [motTelefone, setMotTelefone] = useState('');
  const [motPlaca, setMotPlaca] = useState('');

  // Proprietario review fields
  const [includeProprietario, setIncludeProprietario] = useState(false);
  const [targetProprietarioId, setTargetProprietarioId] = useState<string>('__none__');
  const [propNome, setPropNome] = useState('');
  const [propCpfCnpj, setPropCpfCnpj] = useState('');
  const [propContato, setPropContato] = useState('');
  const [linkedRegisteredMotoristaId, setLinkedRegisteredMotoristaId] = useState('');

  // Veiculo review fields
  const [includeVeiculo, setIncludeVeiculo] = useState(false);
  const [targetVeiculoId, setTargetVeiculoId] = useState<string>('__new__');
  const [veiPlaca, setVeiPlaca] = useState('');
  const [veiMarca, setVeiMarca] = useState('');
  const [veiModelo, setVeiModelo] = useState('');
  const [veiAno, setVeiAno] = useState('');
  const [veiRenavam, setVeiRenavam] = useState('');
  const [veiTipo, setVeiTipo] = useState<TipoVeiculo>('');
  const [veiValidadeCrlv, setVeiValidadeCrlv] = useState('');

  async function processFile(file: File) {
    setError('');
    const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setError('Formato inválido. Envie apenas PDF, PNG, JPG ou WEBP.');
      return;
    }
    if (file.size > 14 * 1024 * 1024) {
      setError('Arquivo muito grande. O limite máximo é 14 MB.');
      return;
    }

    setSelectedFile(file);
    setExtracting(true);
    setReviewReady(false);

    try {
      const idToken = await user.getIdToken();
      const sessionToken = localStorage.getItem('elnathan_session_token') || '';
      const base64DataUrl = await readFileAsBase64(file);

      const res = await fetch('/api/extract-document', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
          'X-Session-Token': sessionToken,
        },
        body: JSON.stringify({
          fileBase64: base64DataUrl,
          mimeType: file.type,
          fileName: file.name,
          hintTipoDocumento: hintTipo || undefined,
        }),
      });

      const rawResponse = await res.text();
      let payload: { extracted?: ExtractionResponse; error?: string } = {};
      try {
        payload = rawResponse ? (JSON.parse(rawResponse) as typeof payload) : {};
      } catch {
        payload = {};
      }
      if (res.status === 413) {
        throw new Error(
          'Arquivo excedeu o limite de envio do servidor (aprox. 4,5 MB). Reduza o tamanho do PDF ou da imagem e tente novamente.'
        );
      }
      if (!res.ok || !payload.extracted) {
        throw new Error(payload.error || 'Não foi possível extrair os dados do documento.');
      }

      const ext = payload.extracted;
      const validDocTypes: TipoDocumento[] = [
        'CNH',
        'CRLV',
        'Comprovante de Endereço',
        'ANTT / RNTRC',
        'Contrato / Procuração',
        'Outro',
      ];
      const detectedDoc: TipoDocumento = validDocTypes.includes(ext.tipoDocumentoDetectado)
        ? ext.tipoDocumentoDetectado
        : 'Outro';

      setTipoDoc(detectedDoc);
      setEntidadePrincipal(
        ['motorista', 'veiculo', 'proprietario'].includes(ext.entidadePrincipal)
          ? ext.entidadePrincipal
          : 'motorista'
      );
      setDataValidadeDoc(ext.dataValidadeDocumento || '');
      setResumoExtracao(ext.resumoExtracao || '');
      setCamposNaoIdentificados(ext.camposNaoIdentificados || []);

      // Populate Motorista strictly from extraction
      const hasMot = Boolean(
        ext.motorista?.presenteNoDocumento ||
          ext.motorista?.nomeCompleto ||
          ext.motorista?.cpf ||
          ext.motorista?.cnh
      );
      setIncludeMotorista(hasMot);
      setLinkedRegisteredMotoristaId('');
      setMotNome(ext.motorista?.nomeCompleto || '');
      setMotCpf(ext.motorista?.cpf || '');
      setMotCnh(ext.motorista?.cnh || '');
      setMotCategoria((ext.motorista?.categoriaCnh || '').toUpperCase());
      setMotValidade(ext.motorista?.validadeCnh || '');
      setMotTelefone(ext.motorista?.telefone || '');
      setMotPlaca((ext.veiculo?.placa || '').toUpperCase());

      if (hasMot) {
        const cpfNorm = normalizeDigits(ext.motorista?.cpf || '');
        const matchedMot = motoristas.find(
          (m) =>
            (cpfNorm && normalizeDigits(m.cpf) === cpfNorm) ||
            (ext.motorista?.nomeCompleto &&
              m.nomeCompleto.toLowerCase() === ext.motorista.nomeCompleto.toLowerCase())
        );
        setTargetMotoristaId(matchedMot ? matchedMot.id : '__new__');
      }

      // Populate Proprietario strictly from extraction
      const hasProp = Boolean(
        ext.proprietario?.presenteNoDocumento ||
          ext.proprietario?.nomeCompleto ||
          ext.proprietario?.cpfCnpj
      );
      setIncludeProprietario(hasProp);
      setPropNome(ext.proprietario?.nomeCompleto || '');
      setPropCpfCnpj(ext.proprietario?.cpfCnpj || '');
      setPropContato(ext.proprietario?.contato || '');

      if (hasProp) {
        const docNorm = normalizeDigits(ext.proprietario?.cpfCnpj || '');
        const matchedProp = proprietarios.find(
          (p) =>
            (docNorm && normalizeDigits(p.cpfCnpj) === docNorm) ||
            (ext.proprietario?.nomeCompleto &&
              p.nomeCompleto.toLowerCase() === ext.proprietario.nomeCompleto.toLowerCase())
        );
        setTargetProprietarioId(matchedProp ? matchedProp.id : '__new__');
      } else {
        setTargetProprietarioId('__none__');
      }

      // Populate Veiculo strictly from extraction
      const hasVei = Boolean(
        ext.veiculo?.presenteNoDocumento || ext.veiculo?.placa || ext.veiculo?.renavam
      );
      setIncludeVeiculo(hasVei);
      setVeiPlaca((ext.veiculo?.placa || '').toUpperCase());
      setVeiMarca(ext.veiculo?.marca || '');
      setVeiModelo(ext.veiculo?.modelo || '');
      setVeiAno(ext.veiculo?.ano || '');
      setVeiRenavam(ext.veiculo?.renavam || '');
      setVeiTipo(
        ['Van', 'HR', 'VUC', 'Médio'].includes(ext.veiculo?.tipoVeiculo)
          ? ext.veiculo.tipoVeiculo
          : ''
      );
      setVeiValidadeCrlv(ext.veiculo?.validadeCrlv || '');

      if (hasVei) {
        const placaNorm = normalizePlate(ext.veiculo?.placa || '');
        const matchedVei = veiculos.find((v) => placaNorm && normalizePlate(v.placa) === placaNorm);
        setTargetVeiculoId(matchedVei ? matchedVei.id : '__new__');
      }

      setReviewReady(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao extrair informações do documento.');
    } finally {
      setExtracting(false);
    }
  }

  function handleFileInput(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      void processFile(file);
    }
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      void processFile(file);
    }
  }

  async function handleSaveExtraction() {
    if (!selectedFile) return;
    setError('');
    setSaving(true);

    try {
      let resolvedProprietarioId = '';
      let resolvedProprietarioName = '';

      if (includeProprietario || (targetProprietarioId !== '__none__' && targetProprietarioId !== '')) {
        if (targetProprietarioId === '__new__') {
          if (propNome.trim() || propCpfCnpj.trim()) {
            const propMissing = computeProprietarioPendingFields({
              nomeCompleto: propNome,
              cpfCnpj: propCpfCnpj,
              contato: propContato,
            });
            const situacaoProp: SituacaoCadastral = propMissing.length > 0 ? 'pendente' : 'em_analise';
            resolvedProprietarioId = await createProprietario(user.uid, {
              nomeCompleto: propNome.trim() || 'Proprietário (A preencher)',
              cpfCnpj: propCpfCnpj,
              contato: propContato,
              situacaoCadastral: situacaoProp,
              observacoes: '',
            });
            resolvedProprietarioName = propNome.trim() || 'Proprietário';
          }
        } else if (targetProprietarioId !== '__none__') {
          resolvedProprietarioId = targetProprietarioId;
          const existingProp = proprietarios.find((p) => p.id === targetProprietarioId);
          resolvedProprietarioName = existingProp?.nomeCompleto || '';
          if (existingProp && includeProprietario) {
            await updateProprietario(existingProp.id, {
              nomeCompleto: propNome.trim() || existingProp.nomeCompleto,
              cpfCnpj: propCpfCnpj.trim() || existingProp.cpfCnpj,
              contato: propContato.trim() || existingProp.contato,
            });
          }
        }
      }

      let resolvedMotoristaId = '';
      let resolvedMotoristaName = '';
      if (includeMotorista) {
        if (targetMotoristaId === '__new__') {
          const motSituacao = suggestSituacaoMotorista({
            nomeCompleto: motNome || 'Motorista (A preencher)',
            cpf: motCpf,
            cnh: motCnh,
            categoriaCnh: motCategoria,
            validadeCnh: motValidade,
            telefone: motTelefone,
            situacaoCadastral: 'em_analise',
          });
          resolvedMotoristaId = await createMotorista(user.uid, {
            nomeCompleto: motNome.trim() || 'Motorista (A preencher)',
            cpf: motCpf,
            cnh: motCnh,
            categoriaCnh: motCategoria,
            validadeCnh: motValidade,
            telefone: motTelefone,
            placa: motPlaca,
            proprietarioId: resolvedProprietarioId,
            situacaoCadastral: motSituacao,
            observacoes: '',
          });
          resolvedMotoristaName = motNome.trim() || 'Motorista';
        } else {
          const existingMot = motoristas.find((m) => m.id === targetMotoristaId);
          if (existingMot) {
            resolvedMotoristaId = existingMot.id;
            resolvedMotoristaName = motNome.trim() || existingMot.nomeCompleto;
            const nextPropId = resolvedProprietarioId || existingMot.proprietarioId;
            const nextValidade = motValidade.trim() || existingMot.validadeCnh;
            const merged = {
              nomeCompleto: motNome.trim() || existingMot.nomeCompleto,
              cpf: motCpf.trim() || existingMot.cpf,
              cnh: motCnh.trim() || existingMot.cnh,
              categoriaCnh: motCategoria.trim() || existingMot.categoriaCnh,
              validadeCnh: nextValidade,
              telefone: motTelefone.trim() || existingMot.telefone,
              placa: motPlaca.trim().toUpperCase() || existingMot.placa || '',
              proprietarioId: nextPropId,
            };
            await updateMotorista(existingMot.id, existingMot, {
              ...merged,
              situacaoCadastral: suggestSituacaoMotorista({
                ...merged,
                situacaoCadastral: existingMot.situacaoCadastral,
              }),
            });
          }
        }
      } else if (linkedRegisteredMotoristaId) {
        const selectedMot = motoristas.find((m) => m.id === linkedRegisteredMotoristaId);
        if (selectedMot) {
          resolvedMotoristaId = selectedMot.id;
          resolvedMotoristaName = selectedMot.nomeCompleto;
          if (resolvedProprietarioId && selectedMot.proprietarioId !== resolvedProprietarioId) {
            await updateMotorista(selectedMot.id, selectedMot, {
              proprietarioId: resolvedProprietarioId,
            });
          }
        }
      }

      let resolvedVeiculoId = '';
      let resolvedVeiculoName = '';
      if (includeVeiculo) {
        if (targetVeiculoId === '__new__') {
          const veiSituacao = suggestSituacaoVeiculo({
            placa: veiPlaca || 'PENDENTE',
            marca: veiMarca,
            modelo: veiModelo,
            ano: veiAno,
            renavam: veiRenavam,
            tipoVeiculo: veiTipo,
            proprietarioId: resolvedProprietarioId,
            validadeCrlv: veiValidadeCrlv,
            situacaoCadastral: 'em_analise',
          });
          resolvedVeiculoId = await createVeiculo(user.uid, {
            placa: veiPlaca.trim() || 'PENDENTE',
            marca: veiMarca,
            modelo: veiModelo,
            ano: veiAno,
            renavam: veiRenavam,
            tipoVeiculo: veiTipo,
            proprietarioId: resolvedProprietarioId,
            motoristaId: resolvedMotoristaId,
            validadeCrlv: veiValidadeCrlv,
            situacaoCadastral: veiSituacao,
            observacoes: '',
          });
          resolvedVeiculoName = `${veiPlaca.trim().toUpperCase() || 'PENDENTE'}${
            veiModelo ? ` · ${veiModelo.trim()}` : ''
          }`;
        } else {
          const existingVei = veiculos.find((v) => v.id === targetVeiculoId);
          if (existingVei) {
            resolvedVeiculoId = existingVei.id;
            resolvedVeiculoName = veiPlaca.trim().toUpperCase() || existingVei.placa;
            const merged = {
              placa: veiPlaca.trim() || existingVei.placa,
              marca: veiMarca.trim() || existingVei.marca,
              modelo: veiModelo.trim() || existingVei.modelo,
              ano: veiAno.trim() || existingVei.ano,
              renavam: veiRenavam.trim() || existingVei.renavam,
              tipoVeiculo: veiTipo || existingVei.tipoVeiculo,
              proprietarioId: resolvedProprietarioId || existingVei.proprietarioId,
              motoristaId: resolvedMotoristaId || existingVei.motoristaId,
              validadeCrlv: veiValidadeCrlv.trim() || existingVei.validadeCrlv,
            };
            await updateVeiculo(existingVei.id, existingVei, {
              ...merged,
              situacaoCadastral: suggestSituacaoVeiculo({
                ...merged,
                situacaoCadastral: existingVei.situacaoCadastral,
              }),
            });
          }
        }
      }

      let docEntidadeTipo: EntidadeTipo = entidadePrincipal;
      let docEntidadeId = '';
      let docEntidadeNome = '';

      if (entidadePrincipal === 'veiculo' && resolvedVeiculoId) {
        docEntidadeTipo = 'veiculo';
        docEntidadeId = resolvedVeiculoId;
        docEntidadeNome = resolvedVeiculoName;
      } else if (entidadePrincipal === 'motorista' && resolvedMotoristaId) {
        docEntidadeTipo = 'motorista';
        docEntidadeId = resolvedMotoristaId;
        docEntidadeNome = resolvedMotoristaName;
      } else if (resolvedProprietarioId) {
        docEntidadeTipo = 'proprietario';
        docEntidadeId = resolvedProprietarioId;
        docEntidadeNome = resolvedProprietarioName;
      } else if (resolvedMotoristaId) {
        docEntidadeTipo = 'motorista';
        docEntidadeId = resolvedMotoristaId;
        docEntidadeNome = resolvedMotoristaName;
      } else if (resolvedVeiculoId) {
        docEntidadeTipo = 'veiculo';
        docEntidadeId = resolvedVeiculoId;
        docEntidadeNome = resolvedVeiculoName;
      }

      if (!docEntidadeId) {
        setError(
          'Selecione ou preencha ao menos um Motorista, Veículo ou Proprietário para vincular o documento.'
        );
        setSaving(false);
        return;
      }

      const effectiveExpiry =
        dataValidadeDoc ||
        (docEntidadeTipo === 'motorista' ? motValidade : docEntidadeTipo === 'veiculo' ? veiValidadeCrlv : '');
      const statusDoc: StatusDocumento = effectiveExpiry
        ? evaluateDateStatus(effectiveExpiry)
        : camposNaoIdentificados.length > 0
          ? 'pendente'
          : 'em_analise';

      const pendingList = Array.from(
        new Set([
          ...camposNaoIdentificados,
          ...(includeMotorista
            ? computeMotoristaPendingFields({
                nomeCompleto: motNome,
                cpf: motCpf,
                cnh: motCnh,
                categoriaCnh: motCategoria,
                validadeCnh: motValidade,
                telefone: motTelefone,
              })
            : []),
          ...(includeVeiculo
            ? computeVeiculoPendingFields({
                placa: veiPlaca,
                modelo: veiModelo,
                marca: veiMarca,
                ano: veiAno,
                renavam: veiRenavam,
                tipoVeiculo: veiTipo,
                proprietarioId: resolvedProprietarioId,
                validadeCrlv: veiValidadeCrlv,
              })
            : []),
        ])
      ).slice(0, 15);

      await createDocumento(user.uid, {
        tipoDocumento: tipoDoc,
        nomeArquivo: selectedFile.name,
        mimeType: selectedFile.type,
        entidadeTipo: docEntidadeTipo,
        entidadeId: docEntidadeId,
        entidadeNome: docEntidadeNome,
        dataValidade: effectiveExpiry,
        statusDocumento: statusDoc,
        camposPendentes: pendingList,
        resumoExtracao,
        observacoes: '',
      });

      onSaved(`Documento "${selectedFile.name}" processado e cadastro salvo com sucesso.`);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar os dados extraídos.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col rounded-xl border border-slate-200/90 dark:border-white/[0.09] bg-white dark:bg-[#0F1520] shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-white/[0.07] px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Enviar Documento e Extrair Informações
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              PDF ou imagem (CNH, CRLV, Comprovantes, ANTT). Apenas dados visíveis no documento serão extraídos.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] hover:text-slate-700 dark:hover:text-white"
            aria-label="Fechar modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-6">
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/50 px-3.5 py-2.5 text-xs text-red-700 dark:text-red-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Upload Zone */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="md:col-span-2">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
                className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors ${
                  dragActive
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-slate-300 dark:border-white/[0.12] bg-slate-50/70 dark:bg-[#0B0F17] hover:border-blue-400/60 dark:hover:border-white/[0.22]'
                }`}
              >
                {extracting ? (
                  <div className="flex flex-col items-center gap-2 py-2">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-600 dark:text-blue-400" />
                    <p className="text-sm font-medium text-slate-800 dark:text-white">
                      Lendo documento e extraindo informações...
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{selectedFile?.name}</p>
                  </div>
                ) : (
                  <>
                    <div className="mb-2.5 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                      <Upload className="h-5 w-5" />
                    </div>
                    <p className="text-sm font-medium text-slate-800 dark:text-white">
                      {selectedFile
                        ? `Arquivo selecionado: ${selectedFile.name}`
                        : 'Arraste um PDF ou imagem aqui'}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Formatos aceitos: PDF, PNG, JPG, WEBP (máx. 14 MB)
                    </p>
                    <label className="mt-3 cursor-pointer rounded-lg border border-slate-300 dark:border-white/[0.1] bg-white dark:bg-[#0F1520] px-4 py-1.5 text-xs font-medium text-slate-800 dark:text-white shadow-xs hover:bg-slate-50 dark:hover:bg-white/[0.06]">
                      Selecionar Arquivo
                      <input
                        type="file"
                        accept=".pdf,image/png,image/jpeg,image/webp"
                        onChange={handleFileInput}
                        className="hidden"
                      />
                    </label>
                  </>
                )}
              </div>
            </div>

            <div className="flex flex-col justify-between rounded-xl border border-slate-200/90 dark:border-white/[0.08] bg-slate-50/80 dark:bg-[#0B0F17] p-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Tipo de Documento (Opcional)
                </label>
                <select
                  value={hintTipo}
                  onChange={(e) => setHintTipo(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-white/[0.1] bg-white dark:bg-[#0F1520] px-2.5 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-blue-600 focus:outline-none"
                >
                  <option value="">Detectar automaticamente</option>
                  <option value="CNH">CNH (Motorista)</option>
                  <option value="CRLV">CRLV (Veículo e Proprietário)</option>
                  <option value="Comprovante de Endereço">Comprovante de Endereço</option>
                  <option value="ANTT / RNTRC">ANTT / RNTRC</option>
                  <option value="Contrato / Procuração">Contrato / Procuração</option>
                  <option value="Outro">Outro Comprovante</option>
                </select>
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                Campos não identificados no documento permanecem em branco como pendentes para preenchimento manual.
              </p>
            </div>
          </div>

          {/* Extraction Review */}
          {reviewReady && (
            <div className="space-y-5 border-t border-slate-200/80 dark:border-white/[0.07] pt-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Conferência dos Dados Extraídos
                  </h3>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <label className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                    Documento:
                    <select
                      value={tipoDoc}
                      onChange={(e) => setTipoDoc(e.target.value as TipoDocumento)}
                      className="rounded-md border border-slate-300 dark:border-white/[0.1] bg-white dark:bg-[#0B0F17] px-2.5 py-1 text-xs font-medium text-slate-900 dark:text-slate-100"
                    >
                      <option value="CNH">CNH</option>
                      <option value="CRLV">CRLV</option>
                      <option value="Comprovante de Endereço">Comprovante de Endereço</option>
                      <option value="ANTT / RNTRC">ANTT / RNTRC</option>
                      <option value="Contrato / Procuração">Contrato / Procuração</option>
                      <option value="Outro">Outro</option>
                    </select>
                  </label>
                  <label className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                    Validade Doc.:
                    <input
                      type="date"
                      value={dataValidadeDoc}
                      onChange={(e) => setDataValidadeDoc(e.target.value)}
                      className="rounded-md border border-slate-300 dark:border-white/[0.1] bg-white dark:bg-[#0B0F17] px-2.5 py-1 font-mono text-xs text-slate-900 dark:text-slate-100"
                    />
                  </label>
                </div>
              </div>

              {resumoExtracao && (
                <div className="flex items-start gap-2 rounded-lg border border-slate-200/90 dark:border-white/[0.08] bg-slate-50 dark:bg-[#0B0F17] px-3.5 py-2.5 text-xs text-slate-700 dark:text-slate-300">
                  <FileText className="mt-0.5 h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" />
                  <div>
                    <span className="font-medium text-slate-900 dark:text-white">
                      Leitura do documento:{' '}
                    </span>
                    {resumoExtracao}
                  </div>
                </div>
              )}

              {camposNaoIdentificados.length > 0 && (
                <div className="rounded-lg border border-slate-300 dark:border-white/[0.1] bg-slate-100 dark:bg-[#0B0F17] px-3.5 py-2.5 text-xs text-slate-800 dark:text-white">
                  <span className="font-semibold">Campos pendentes (não presentes no documento): </span>
                  {camposNaoIdentificados.join(' · ')}
                </div>
              )}

              {/* Entity Toggle Strip */}
              <div className="flex flex-wrap items-center gap-4 border-b border-slate-200/80 dark:border-white/[0.07] pb-3 text-xs">
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  Cadastros vinculados neste documento:
                </span>
                <label className="inline-flex items-center gap-1.5 font-medium text-slate-800 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={includeMotorista}
                    onChange={(e) => setIncludeMotorista(e.target.checked)}
                    className="rounded border-slate-300 dark:border-white/[0.2] text-blue-600"
                  />
                  Motorista
                </label>
                <label className="inline-flex items-center gap-1.5 font-medium text-slate-800 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={includeProprietario}
                    onChange={(e) => setIncludeProprietario(e.target.checked)}
                    className="rounded border-slate-300 dark:border-white/[0.2] text-blue-600"
                  />
                  Proprietário do Veículo
                </label>
                <label className="inline-flex items-center gap-1.5 font-medium text-slate-800 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={includeVeiculo}
                    onChange={(e) => setIncludeVeiculo(e.target.checked)}
                    className="rounded border-slate-300 dark:border-white/[0.2] text-blue-600"
                  />
                  Veículo
                </label>
              </div>

              {/* Proprietario Section */}
              {(includeProprietario || includeMotorista || includeVeiculo) && (
                <div className="rounded-xl border border-slate-200/90 dark:border-white/[0.08] bg-slate-50/70 dark:bg-[#0B0F17] p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-xs font-semibold text-slate-700 dark:text-white">
                      Proprietário do Veículo (Vínculo)
                    </h4>
                    <select
                      value={targetProprietarioId}
                      onChange={(e) => {
                        const val = e.target.value;
                        setTargetProprietarioId(val);
                        if (val === '__new__') setIncludeProprietario(true);
                      }}
                      className="rounded-lg border border-slate-300 dark:border-white/[0.1] bg-white dark:bg-[#0F1520] px-2.5 py-1 text-xs text-slate-800 dark:text-slate-200"
                    >
                      <option value="__none__">Sem vínculo no momento</option>
                      <option value="__new__">+ Criar novo proprietário</option>
                      {proprietarios.map((p) => (
                        <option key={p.id} value={p.id}>
                          Vincular a: {p.nomeCompleto} {p.cpfCnpj ? `(${p.cpfCnpj})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {(includeProprietario || targetProprietarioId === '__new__') &&
                    targetProprietarioId !== '__none__' && (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div>
                          <label className="mb-1 block text-[11px] font-medium text-slate-600 dark:text-slate-400">
                            Nome Completo / Razão Social
                          </label>
                          <input
                            type="text"
                            value={propNome}
                            onChange={(e) => setPropNome(e.target.value)}
                            placeholder="Pendente"
                            className={fieldInputCls}
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-[11px] font-medium text-slate-600 dark:text-slate-400">
                            CPF / CNPJ
                          </label>
                          <input
                            type="text"
                            value={propCpfCnpj}
                            onChange={(e) => setPropCpfCnpj(e.target.value)}
                            placeholder="Pendente"
                            className={`${fieldInputCls} font-mono`}
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-[11px] font-medium text-slate-600 dark:text-slate-400">
                            Contato
                          </label>
                          <input
                            type="text"
                            value={propContato}
                            onChange={(e) => setPropContato(e.target.value)}
                            placeholder="Pendente (preencher manual)"
                            className={fieldInputCls}
                          />
                        </div>
                      </div>
                    )}

                  {!includeMotorista && motoristas.length > 0 && (
                    <div className="mt-3 border-t border-slate-200/80 dark:border-white/[0.07] pt-3">
                      <label className="mb-1 block text-[11px] font-medium text-slate-600 dark:text-slate-400">
                        Motorista Cadastrado Vinculado (Opcional)
                      </label>
                      <select
                        value={linkedRegisteredMotoristaId}
                        onChange={(e) => setLinkedRegisteredMotoristaId(e.target.value)}
                        className={fieldInputCls}
                      >
                        <option value="">Selecionar motorista já cadastrado (opcional)...</option>
                        {motoristas.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.nomeCompleto} {m.cpf ? `(${m.cpf})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}

              {/* Motorista Section */}
              {includeMotorista && (
                <div className="rounded-xl border border-slate-200/90 dark:border-white/[0.08] bg-slate-50/70 dark:bg-[#0B0F17] p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-xs font-semibold text-slate-700 dark:text-white">
                      Dados do Motorista
                    </h4>
                    <select
                      value={targetMotoristaId}
                      onChange={(e) => setTargetMotoristaId(e.target.value)}
                      className="rounded-lg border border-slate-300 dark:border-white/[0.1] bg-white dark:bg-[#0F1520] px-2.5 py-1 text-xs text-slate-800 dark:text-slate-200"
                    >
                      <option value="__new__">+ Criar novo motorista</option>
                      {motoristas.map((m) => (
                        <option key={m.id} value={m.id}>
                          Atualizar: {m.nomeCompleto} {m.cpf ? `(${m.cpf})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-[11px] font-medium text-slate-600 dark:text-slate-400">
                        Nome Completo
                      </label>
                      <input
                        type="text"
                        value={motNome}
                        onChange={(e) => setMotNome(e.target.value)}
                        placeholder="Pendente"
                        className={fieldInputCls}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-slate-600 dark:text-slate-400">
                        CPF
                      </label>
                      <input
                        type="text"
                        value={motCpf}
                        onChange={(e) => setMotCpf(e.target.value)}
                        placeholder="Pendente"
                        className={`${fieldInputCls} font-mono`}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-slate-600 dark:text-slate-400">
                        CNH
                      </label>
                      <input
                        type="text"
                        value={motCnh}
                        onChange={(e) => setMotCnh(e.target.value)}
                        placeholder="Pendente"
                        className={`${fieldInputCls} font-mono`}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-slate-600 dark:text-slate-400">
                        Categoria
                      </label>
                      <input
                        type="text"
                        value={motCategoria}
                        onChange={(e) => setMotCategoria(e.target.value)}
                        placeholder="Pendente"
                        className={`${fieldInputCls} font-mono uppercase`}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-slate-600 dark:text-slate-400">
                        Validade da CNH
                      </label>
                      <input
                        type="date"
                        value={motValidade}
                        onChange={(e) => setMotValidade(e.target.value)}
                        className={`${fieldInputCls} font-mono`}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-[11px] font-medium text-slate-600 dark:text-slate-400">
                        Telefone
                      </label>
                      <input
                        type="text"
                        value={motTelefone}
                        onChange={(e) => setMotTelefone(e.target.value)}
                        placeholder="Pendente (preencher manualmente se não constar no documento)"
                        className={fieldInputCls}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-slate-600 dark:text-slate-400">
                        Placa do Veículo
                      </label>
                      <input
                        type="text"
                        value={motPlaca}
                        onChange={(e) => setMotPlaca(e.target.value.toUpperCase())}
                        placeholder="Opcional"
                        className={`${fieldInputCls} font-mono uppercase`}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Veiculo Section */}
              {includeVeiculo && (
                <div className="rounded-xl border border-slate-200/90 dark:border-white/[0.08] bg-slate-50/70 dark:bg-[#0B0F17] p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-xs font-semibold text-slate-700 dark:text-white">
                      Dados do Veículo
                    </h4>
                    <select
                      value={targetVeiculoId}
                      onChange={(e) => setTargetVeiculoId(e.target.value)}
                      className="rounded-lg border border-slate-300 dark:border-white/[0.1] bg-white dark:bg-[#0F1520] px-2.5 py-1 text-xs text-slate-800 dark:text-slate-200"
                    >
                      <option value="__new__">+ Criar novo veículo</option>
                      {veiculos.map((v) => (
                        <option key={v.id} value={v.id}>
                          Atualizar: {v.placa} {v.modelo ? `(${v.modelo})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-slate-600 dark:text-slate-400">
                        Placa
                      </label>
                      <input
                        type="text"
                        value={veiPlaca}
                        onChange={(e) => setVeiPlaca(e.target.value)}
                        placeholder="Pendente"
                        className={`${fieldInputCls} font-mono uppercase`}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-slate-600 dark:text-slate-400">
                        Marca
                      </label>
                      <input
                        type="text"
                        value={veiMarca}
                        onChange={(e) => setVeiMarca(e.target.value)}
                        placeholder="Pendente"
                        className={fieldInputCls}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-[11px] font-medium text-slate-600 dark:text-slate-400">
                        Modelo
                      </label>
                      <input
                        type="text"
                        value={veiModelo}
                        onChange={(e) => setVeiModelo(e.target.value)}
                        placeholder="Pendente"
                        className={fieldInputCls}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-slate-600 dark:text-slate-400">
                        Ano
                      </label>
                      <input
                        type="text"
                        value={veiAno}
                        onChange={(e) => setVeiAno(e.target.value)}
                        placeholder="Pendente"
                        className={`${fieldInputCls} font-mono`}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-slate-600 dark:text-slate-400">
                        RENAVAM
                      </label>
                      <input
                        type="text"
                        value={veiRenavam}
                        onChange={(e) => setVeiRenavam(e.target.value)}
                        placeholder="Pendente"
                        className={`${fieldInputCls} font-mono`}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-slate-600 dark:text-slate-400">
                        Tipo de Veículo
                      </label>
                      <select
                        value={veiTipo}
                        onChange={(e) => setVeiTipo(e.target.value as TipoVeiculo)}
                        className={fieldInputCls}
                      >
                        <option value="">Pendente</option>
                        <option value="Van">Van</option>
                        <option value="HR">HR</option>
                        <option value="VUC">VUC</option>
                        <option value="Médio">Médio</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-slate-600 dark:text-slate-400">
                        Validade CRLV
                      </label>
                      <input
                        type="date"
                        value={veiValidadeCrlv}
                        onChange={(e) => setVeiValidadeCrlv(e.target.value)}
                        className={`${fieldInputCls} font-mono`}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/80 dark:border-white/[0.07] px-6 py-4">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Os dados pessoais e documentos são salvos com acesso restrito ao usuário autenticado.
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 dark:border-white/[0.1] bg-white dark:bg-white/[0.04] px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.08] whitespace-nowrap"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={!reviewReady || saving}
              onClick={handleSaveExtraction}
              className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white shadow-xs hover:bg-blue-500 disabled:opacity-45 whitespace-nowrap"
            >
              {saving ? 'Salvando...' : 'Confirmar e Salvar Cadastro'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

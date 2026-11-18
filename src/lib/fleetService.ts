import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import {
  computeMotoristaPendingFields,
  computeVeiculoPendingFields,
} from './compliance';
import type {
  CategoriaFinanceira,
  DiaTrabalhado,
  Documento,
  Frete,
  LancamentoFinanceiro,
  Motorista,
  Proprietario,
  SituacaoCadastral,
  TipoVeiculo,
  Veiculo,
} from '../types/fleet';

function clampMoney(val: number | undefined | null): number {
  const num = Number(val);
  if (!Number.isFinite(num) || num < 0) return 0;
  return Math.min(Math.round(num * 100) / 100, 100000000);
}

function clip(val: string | undefined | null, max: number): string {
  return (val || '').trim().slice(0, max);
}

function generateDocId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `rec_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function subscribeFleetData(
  uid: string,
  isAdminUser: boolean,
  callbacks: {
    onProprietarios: (items: Proprietario[]) => void;
    onMotoristas: (items: Motorista[]) => void;
    onVeiculos: (items: Veiculo[]) => void;
    onDocumentos: (items: Documento[]) => void;
    onFinanceiro?: (items: LancamentoFinanceiro[]) => void;
    onCategoriasFinanceiras?: (items: CategoriaFinanceira[]) => void;
    onFretes?: (items: Frete[]) => void;
    onDiasTrabalhados?: (items: DiaTrabalhado[]) => void;
    onError: (err: Error) => void;
  }
): Unsubscribe {
  const propQuery = isAdminUser
    ? collection(db, 'proprietarios')
    : query(collection(db, 'proprietarios'), where('ownerUid', '==', uid));

  const motQuery = isAdminUser
    ? collection(db, 'motoristas')
    : query(collection(db, 'motoristas'), where('ownerUid', '==', uid));

  const veiQuery = isAdminUser
    ? collection(db, 'veiculos')
    : query(collection(db, 'veiculos'), where('ownerUid', '==', uid));

  const docQuery = isAdminUser
    ? collection(db, 'documentos')
    : query(collection(db, 'documentos'), where('ownerUid', '==', uid));

  const finQuery = isAdminUser
    ? collection(db, 'financeiro')
    : query(collection(db, 'financeiro'), where('ownerUid', '==', uid));

  const catQuery = isAdminUser
    ? collection(db, 'categorias_financeiras')
    : query(collection(db, 'categorias_financeiras'), where('ownerUid', '==', uid));

  const freteQuery = isAdminUser
    ? collection(db, 'fretes')
    : query(collection(db, 'fretes'), where('ownerUid', '==', uid));

  const diasQuery = isAdminUser
    ? collection(db, 'dias_trabalhados')
    : query(collection(db, 'dias_trabalhados'), where('ownerUid', '==', uid));

  const unsub1 = onSnapshot(
    propQuery,
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Proprietario);
      list.sort((a, b) => a.nomeCompleto.localeCompare(b.nomeCompleto, 'pt-BR'));
      callbacks.onProprietarios(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'proprietarios');
      } catch (e) {
        callbacks.onError(e as Error);
      }
    }
  );

  const unsub2 = onSnapshot(
    motQuery,
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Motorista);
      list.sort((a, b) => a.nomeCompleto.localeCompare(b.nomeCompleto, 'pt-BR'));
      callbacks.onMotoristas(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'motoristas');
      } catch (e) {
        callbacks.onError(e as Error);
      }
    }
  );

  const unsub3 = onSnapshot(
    veiQuery,
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Veiculo);
      list.sort((a, b) => a.placa.localeCompare(b.placa, 'pt-BR'));
      callbacks.onVeiculos(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'veiculos');
      } catch (e) {
        callbacks.onError(e as Error);
      }
    }
  );

  const unsub4 = onSnapshot(
    docQuery,
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Documento);
      callbacks.onDocumentos(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'documentos');
      } catch (e) {
        callbacks.onError(e as Error);
      }
    }
  );

  const unsub5 = onSnapshot(
    finQuery,
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as LancamentoFinanceiro);
      list.sort((a, b) => (b.dataVencimento || '').localeCompare(a.dataVencimento || ''));
      callbacks.onFinanceiro?.(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'financeiro');
      } catch (e) {
        callbacks.onError(e as Error);
      }
    }
  );

  const unsub6 = onSnapshot(
    catQuery,
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as CategoriaFinanceira);
      list.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
      callbacks.onCategoriasFinanceiras?.(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'categorias_financeiras');
      } catch (e) {
        callbacks.onError(e as Error);
      }
    }
  );

  const unsub7 = onSnapshot(
    freteQuery,
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Frete);
      list.sort((a, b) => (b.dataSaida || '').localeCompare(a.dataSaida || ''));
      callbacks.onFretes?.(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'fretes');
      } catch (e) {
        callbacks.onError(e as Error);
      }
    }
  );

  const unsub8 = onSnapshot(
    diasQuery,
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as DiaTrabalhado);
      list.sort((a, b) => (b.data || '').localeCompare(a.data || ''));
      callbacks.onDiasTrabalhados?.(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'dias_trabalhados');
      } catch (e) {
        callbacks.onError(e as Error);
      }
    }
  );

  return () => {
    unsub1();
    unsub2();
    unsub3();
    unsub4();
    unsub5();
    unsub6();
    unsub7();
    unsub8();
  };
}

export async function createProprietario(
  uid: string,
  input: Omit<Proprietario, 'id' | 'ownerUid' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const id = generateDocId();
  const path = `proprietarios/${id}`;
  try {
    await setDoc(doc(db, 'proprietarios', id), {
      ownerUid: uid,
      nomeCompleto: clip(input.nomeCompleto, 200) || 'Proprietário Sem Nome',
      cpfCnpj: clip(input.cpfCnpj, 32),
      contato: clip(input.contato, 120),
      situacaoCadastral: input.situacaoCadastral,
      observacoes: clip(input.observacoes, 500),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateProprietario(
  id: string,
  patch: Partial<Pick<Proprietario, 'nomeCompleto' | 'cpfCnpj' | 'contato' | 'situacaoCadastral' | 'observacoes'>>
): Promise<void> {
  const path = `proprietarios/${id}`;
  const clean: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (patch.nomeCompleto !== undefined) {
    clean.nomeCompleto = clip(patch.nomeCompleto, 200) || 'Proprietário Sem Nome';
  }
  if (patch.cpfCnpj !== undefined) clean.cpfCnpj = clip(patch.cpfCnpj, 32);
  if (patch.contato !== undefined) clean.contato = clip(patch.contato, 120);
  if (patch.situacaoCadastral !== undefined) clean.situacaoCadastral = patch.situacaoCadastral;
  if (patch.observacoes !== undefined) clean.observacoes = clip(patch.observacoes, 500);

  try {
    await updateDoc(doc(db, 'proprietarios', id), clean);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteProprietario(id: string): Promise<void> {
  const path = `proprietarios/${id}`;
  try {
    await deleteDoc(doc(db, 'proprietarios', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function createMotorista(
  uid: string,
  input: Omit<Motorista, 'id' | 'ownerUid' | 'camposPendentes' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const id = generateDocId();
  const path = `motoristas/${id}`;
  const nowIso = new Date().toISOString().slice(0, 19) + 'Z';
  const payload = {
    ownerUid: uid,
    nomeCompleto: clip(input.nomeCompleto, 200) || 'Motorista Sem Nome',
    cpf: clip(input.cpf, 20),
    cnh: clip(input.cnh, 30),
    categoriaCnh: clip(input.categoriaCnh, 10).toUpperCase(),
    validadeCnh: clip(input.validadeCnh, 20),
    telefone: clip(input.telefone, 40),
    placa: clip(input.placa, 16).toUpperCase(),
    proprietarioId: clip(input.proprietarioId, 128),
    situacaoCadastral: input.situacaoCadastral,
    observacoes: clip(input.observacoes, 500),
    rotaPadrao: clip(input.rotaPadrao, 160),
    valorDiariaPadrao: Math.min(clampMoney(input.valorDiariaPadrao), 1000000),
    statusAtualizadoEm: nowIso,
  };
  const camposPendentes = computeMotoristaPendingFields(payload).slice(0, 15);

  try {
    await setDoc(doc(db, 'motoristas', id), {
      ...payload,
      camposPendentes,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateMotorista(
  id: string,
  current: Motorista,
  patch: Partial<
    Pick<
      Motorista,
      | 'nomeCompleto'
      | 'cpf'
      | 'cnh'
      | 'categoriaCnh'
      | 'validadeCnh'
      | 'telefone'
      | 'placa'
      | 'proprietarioId'
      | 'situacaoCadastral'
      | 'observacoes'
      | 'rotaPadrao'
      | 'valorDiariaPadrao'
    >
  >
): Promise<void> {
  const path = `motoristas/${id}`;
  const statusChanged =
    patch.situacaoCadastral !== undefined &&
    patch.situacaoCadastral !== current.situacaoCadastral;
  const nextStatusTimestamp = statusChanged
    ? new Date().toISOString().slice(0, 19) + 'Z'
    : current.statusAtualizadoEm || '';

  const merged: Motorista = {
    ...current,
    ...patch,
    nomeCompleto:
      patch.nomeCompleto !== undefined
        ? clip(patch.nomeCompleto, 200) || current.nomeCompleto
        : current.nomeCompleto,
    cpf: patch.cpf !== undefined ? clip(patch.cpf, 20) : current.cpf,
    cnh: patch.cnh !== undefined ? clip(patch.cnh, 30) : current.cnh,
    categoriaCnh:
      patch.categoriaCnh !== undefined
        ? clip(patch.categoriaCnh, 10).toUpperCase()
        : current.categoriaCnh,
    validadeCnh: patch.validadeCnh !== undefined ? clip(patch.validadeCnh, 20) : current.validadeCnh,
    telefone: patch.telefone !== undefined ? clip(patch.telefone, 40) : current.telefone,
    placa:
      patch.placa !== undefined
        ? clip(patch.placa, 16).toUpperCase()
        : (current.placa || ''),
    proprietarioId:
      patch.proprietarioId !== undefined ? clip(patch.proprietarioId, 128) : current.proprietarioId,
    observacoes: patch.observacoes !== undefined ? clip(patch.observacoes, 500) : current.observacoes || '',
    rotaPadrao:
      patch.rotaPadrao !== undefined ? clip(patch.rotaPadrao, 160) : current.rotaPadrao || '',
    valorDiariaPadrao:
      patch.valorDiariaPadrao !== undefined
        ? Math.min(clampMoney(patch.valorDiariaPadrao), 1000000)
        : Math.min(clampMoney(current.valorDiariaPadrao), 1000000),
    statusAtualizadoEm: nextStatusTimestamp,
  };
  const camposPendentes = computeMotoristaPendingFields(merged).slice(0, 15);

  try {
    await updateDoc(doc(db, 'motoristas', id), {
      nomeCompleto: merged.nomeCompleto,
      cpf: merged.cpf,
      cnh: merged.cnh,
      categoriaCnh: merged.categoriaCnh,
      validadeCnh: merged.validadeCnh,
      telefone: merged.telefone,
      placa: merged.placa || '',
      proprietarioId: merged.proprietarioId,
      situacaoCadastral: merged.situacaoCadastral,
      observacoes: merged.observacoes || '',
      rotaPadrao: merged.rotaPadrao || '',
      valorDiariaPadrao: merged.valorDiariaPadrao ?? 0,
      statusAtualizadoEm: nextStatusTimestamp,
      camposPendentes,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteMotorista(id: string): Promise<void> {
  const path = `motoristas/${id}`;
  try {
    await deleteDoc(doc(db, 'motoristas', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function createVeiculo(
  uid: string,
  input: Omit<Veiculo, 'id' | 'ownerUid' | 'camposPendentes' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const id = generateDocId();
  const path = `veiculos/${id}`;
  const validTipo: TipoVeiculo = ['Van', 'HR', 'VUC', 'Médio'].includes(input.tipoVeiculo)
    ? input.tipoVeiculo
    : '';
  const payload = {
    ownerUid: uid,
    placa: clip(input.placa, 16).toUpperCase() || 'SEM PLACA',
    modelo: clip(input.modelo, 120),
    marca: clip(input.marca, 80),
    ano: clip(input.ano, 12),
    renavam: clip(input.renavam, 30),
    tipoVeiculo: validTipo,
    proprietarioId: clip(input.proprietarioId, 128),
    motoristaId: clip(input.motoristaId, 128),
    validadeCrlv: clip(input.validadeCrlv, 20),
    situacaoCadastral: input.situacaoCadastral,
    observacoes: clip(input.observacoes, 500),
  };
  const camposPendentes = computeVeiculoPendingFields(payload).slice(0, 15);

  try {
    await setDoc(doc(db, 'veiculos', id), {
      ...payload,
      camposPendentes,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateVeiculo(
  id: string,
  current: Veiculo,
  patch: Partial<
    Pick<
      Veiculo,
      | 'placa'
      | 'modelo'
      | 'marca'
      | 'ano'
      | 'renavam'
      | 'tipoVeiculo'
      | 'proprietarioId'
      | 'motoristaId'
      | 'validadeCrlv'
      | 'situacaoCadastral'
      | 'observacoes'
    >
  >
): Promise<void> {
  const path = `veiculos/${id}`;
  const nextTipo =
    patch.tipoVeiculo !== undefined
      ? (['', 'Van', 'HR', 'VUC', 'Médio'].includes(patch.tipoVeiculo)
          ? patch.tipoVeiculo
          : '')
      : current.tipoVeiculo;

  const merged: Veiculo = {
    ...current,
    ...patch,
    placa:
      patch.placa !== undefined
        ? clip(patch.placa, 16).toUpperCase() || current.placa
        : current.placa,
    modelo: patch.modelo !== undefined ? clip(patch.modelo, 120) : current.modelo,
    marca: patch.marca !== undefined ? clip(patch.marca, 80) : current.marca,
    ano: patch.ano !== undefined ? clip(patch.ano, 12) : current.ano,
    renavam: patch.renavam !== undefined ? clip(patch.renavam, 30) : current.renavam,
    tipoVeiculo: nextTipo,
    proprietarioId:
      patch.proprietarioId !== undefined ? clip(patch.proprietarioId, 128) : current.proprietarioId,
    motoristaId:
      patch.motoristaId !== undefined ? clip(patch.motoristaId, 128) : current.motoristaId,
    validadeCrlv:
      patch.validadeCrlv !== undefined ? clip(patch.validadeCrlv, 20) : current.validadeCrlv,
    observacoes: patch.observacoes !== undefined ? clip(patch.observacoes, 500) : current.observacoes || '',
  };
  const camposPendentes = computeVeiculoPendingFields(merged).slice(0, 15);

  try {
    await updateDoc(doc(db, 'veiculos', id), {
      placa: merged.placa,
      modelo: merged.modelo,
      marca: merged.marca,
      ano: merged.ano,
      renavam: merged.renavam,
      tipoVeiculo: merged.tipoVeiculo,
      proprietarioId: merged.proprietarioId,
      motoristaId: merged.motoristaId,
      validadeCrlv: merged.validadeCrlv,
      situacaoCadastral: merged.situacaoCadastral,
      observacoes: merged.observacoes || '',
      camposPendentes,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteVeiculo(id: string): Promise<void> {
  const path = `veiculos/${id}`;
  try {
    await deleteDoc(doc(db, 'veiculos', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function createDocumento(
  uid: string,
  input: Omit<Documento, 'id' | 'ownerUid' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const id = generateDocId();
  const path = `documentos/${id}`;
  try {
    await setDoc(doc(db, 'documentos', id), {
      ownerUid: uid,
      tipoDocumento: input.tipoDocumento,
      nomeArquivo: clip(input.nomeArquivo, 200) || 'documento',
      mimeType: clip(input.mimeType, 100) || 'application/octet-stream',
      entidadeTipo: input.entidadeTipo,
      entidadeId: clip(input.entidadeId, 128),
      entidadeNome: clip(input.entidadeNome, 200),
      dataValidade: clip(input.dataValidade, 20),
      statusDocumento: input.statusDocumento,
      camposPendentes: (input.camposPendentes || []).map((c) => clip(c, 60)).slice(0, 15),
      resumoExtracao: clip(input.resumoExtracao, 600),
      observacoes: clip(input.observacoes, 500),
      ...(input.arquivoUrl ? { arquivoUrl: clip(input.arquivoUrl, 1200) } : {}),
      ...(input.storagePath ? { storagePath: clip(input.storagePath, 300) } : {}),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateDocumento(
  id: string,
  patch: Partial<Pick<Documento, 'dataValidade' | 'statusDocumento' | 'observacoes' | 'tipoDocumento'>>
): Promise<void> {
  const path = `documentos/${id}`;
  const clean: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (patch.dataValidade !== undefined) clean.dataValidade = clip(patch.dataValidade, 20);
  if (patch.statusDocumento !== undefined) clean.statusDocumento = patch.statusDocumento;
  if (patch.observacoes !== undefined) clean.observacoes = clip(patch.observacoes, 500);
  if (patch.tipoDocumento !== undefined) clean.tipoDocumento = patch.tipoDocumento;

  try {
    await updateDoc(doc(db, 'documentos', id), clean);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteDocumento(id: string): Promise<void> {
  const path = `documentos/${id}`;
  try {
    await deleteDoc(doc(db, 'documentos', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function updateSituacaoByEntity(
  entidadeTipo: 'motorista' | 'veiculo' | 'proprietario',
  id: string,
  situacao: SituacaoCadastral
): Promise<void> {
  const collectionName =
    entidadeTipo === 'motorista'
      ? 'motoristas'
      : entidadeTipo === 'veiculo'
        ? 'veiculos'
        : 'proprietarios';
  const path = `${collectionName}/${id}`;
  try {
    await updateDoc(doc(db, collectionName, id), {
      situacaoCadastral: situacao,
      ...(entidadeTipo === 'motorista'
        ? { statusAtualizadoEm: new Date().toISOString().slice(0, 19) + 'Z' }
        : {}),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function createLancamentoFinanceiro(
  uid: string,
  input: Omit<LancamentoFinanceiro, 'id' | 'ownerUid' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const id = generateDocId();
  const path = `financeiro/${id}`;
  try {
    await setDoc(doc(db, 'financeiro', id), {
      ownerUid: uid,
      descricao: clip(input.descricao, 200) || 'Lançamento Financeiro',
      tipo: input.tipo,
      categoria: clip(input.categoria, 80) || 'Outro',
      valor: clampMoney(input.valor),
      dataVencimento: clip(input.dataVencimento, 20),
      dataPagamento: clip(input.dataPagamento, 20),
      status: input.status,
      proprietarioId: clip(input.proprietarioId, 128),
      motoristaId: clip(input.motoristaId, 128),
      veiculoId: clip(input.veiculoId, 128),
      observacoes: clip(input.observacoes, 500),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateLancamentoFinanceiro(
  id: string,
  patch: Partial<
    Pick<
      LancamentoFinanceiro,
      | 'descricao'
      | 'tipo'
      | 'categoria'
      | 'valor'
      | 'dataVencimento'
      | 'dataPagamento'
      | 'status'
      | 'proprietarioId'
      | 'motoristaId'
      | 'veiculoId'
      | 'observacoes'
    >
  >
): Promise<void> {
  const path = `financeiro/${id}`;
  const clean: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (patch.descricao !== undefined) {
    clean.descricao = clip(patch.descricao, 200) || 'Lançamento Financeiro';
  }
  if (patch.tipo !== undefined) clean.tipo = patch.tipo;
  if (patch.categoria !== undefined) clean.categoria = clip(patch.categoria, 80) || 'Outro';
  if (patch.valor !== undefined) clean.valor = clampMoney(patch.valor);
  if (patch.dataVencimento !== undefined) clean.dataVencimento = clip(patch.dataVencimento, 20);
  if (patch.dataPagamento !== undefined) clean.dataPagamento = clip(patch.dataPagamento, 20);
  if (patch.status !== undefined) clean.status = patch.status;
  if (patch.proprietarioId !== undefined) clean.proprietarioId = clip(patch.proprietarioId, 128);
  if (patch.motoristaId !== undefined) clean.motoristaId = clip(patch.motoristaId, 128);
  if (patch.veiculoId !== undefined) clean.veiculoId = clip(patch.veiculoId, 128);
  if (patch.observacoes !== undefined) clean.observacoes = clip(patch.observacoes, 500);

  try {
    await updateDoc(doc(db, 'financeiro', id), clean);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteLancamentoFinanceiro(id: string): Promise<void> {
  const path = `financeiro/${id}`;
  try {
    await deleteDoc(doc(db, 'financeiro', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function createCategoriaFinanceira(
  uid: string,
  input: Omit<CategoriaFinanceira, 'id' | 'ownerUid' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const id = generateDocId();
  const path = `categorias_financeiras/${id}`;
  try {
    await setDoc(doc(db, 'categorias_financeiras', id), {
      ownerUid: uid,
      nome: clip(input.nome, 80) || 'Nova Categoria',
      tipoPadrao: input.tipoPadrao,
      descricao: clip(input.descricao, 200),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteCategoriaFinanceira(id: string): Promise<void> {
  const path = `categorias_financeiras/${id}`;
  try {
    await deleteDoc(doc(db, 'categorias_financeiras', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function createFrete(
  uid: string,
  input: Omit<Frete, 'id' | 'ownerUid' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const id = generateDocId();
  const path = `fretes/${id}`;
  try {
    await setDoc(doc(db, 'fretes', id), {
      ownerUid: uid,
      cliente: clip(input.cliente, 160) || 'Cliente não informado',
      origem: clip(input.origem, 120),
      destino: clip(input.destino, 120),
      dataSaida: clip(input.dataSaida, 20),
      valorFrete: clampMoney(input.valorFrete),
      valorRepasse: clampMoney(input.valorRepasse),
      proprietarioId: clip(input.proprietarioId, 128),
      motoristaId: clip(input.motoristaId, 128),
      veiculoId: clip(input.veiculoId, 128),
      status: input.status,
      observacoes: clip(input.observacoes, 500),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateFrete(
  id: string,
  patch: Partial<
    Pick<
      Frete,
      | 'cliente'
      | 'origem'
      | 'destino'
      | 'dataSaida'
      | 'valorFrete'
      | 'valorRepasse'
      | 'proprietarioId'
      | 'motoristaId'
      | 'veiculoId'
      | 'status'
      | 'observacoes'
    >
  >
): Promise<void> {
  const path = `fretes/${id}`;
  const clean: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (patch.cliente !== undefined) clean.cliente = clip(patch.cliente, 160) || 'Cliente';
  if (patch.origem !== undefined) clean.origem = clip(patch.origem, 120);
  if (patch.destino !== undefined) clean.destino = clip(patch.destino, 120);
  if (patch.dataSaida !== undefined) clean.dataSaida = clip(patch.dataSaida, 20);
  if (patch.valorFrete !== undefined) clean.valorFrete = clampMoney(patch.valorFrete);
  if (patch.valorRepasse !== undefined) clean.valorRepasse = clampMoney(patch.valorRepasse);
  if (patch.proprietarioId !== undefined) clean.proprietarioId = clip(patch.proprietarioId, 128);
  if (patch.motoristaId !== undefined) clean.motoristaId = clip(patch.motoristaId, 128);
  if (patch.veiculoId !== undefined) clean.veiculoId = clip(patch.veiculoId, 128);
  if (patch.status !== undefined) clean.status = patch.status;
  if (patch.observacoes !== undefined) clean.observacoes = clip(patch.observacoes, 500);

  try {
    await updateDoc(doc(db, 'fretes', id), clean);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteFrete(id: string): Promise<void> {
  const path = `fretes/${id}`;
  try {
    await deleteDoc(doc(db, 'fretes', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function createDiaTrabalhado(
  uid: string,
  input: Omit<DiaTrabalhado, 'id' | 'ownerUid' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const id = generateDocId();
  const path = `dias_trabalhados/${id}`;
  try {
    await setDoc(doc(db, 'dias_trabalhados', id), {
      ownerUid: uid,
      motoristaId: clip(input.motoristaId, 128),
      proprietarioId: clip(input.proprietarioId, 128),
      veiculoId: clip(input.veiculoId, 128),
      placa: clip(input.placa, 16).toUpperCase(),
      data: clip(input.data, 20),
      rota: clip(input.rota, 160),
      turno: input.turno,
      valorDiaria: clampMoney(input.valorDiaria),
      status: input.status,
      observacoes: clip(input.observacoes, 500),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateDiaTrabalhado(
  id: string,
  patch: Partial<
    Pick<
      DiaTrabalhado,
      | 'motoristaId'
      | 'proprietarioId'
      | 'veiculoId'
      | 'placa'
      | 'data'
      | 'rota'
      | 'turno'
      | 'valorDiaria'
      | 'status'
      | 'observacoes'
    >
  >
): Promise<void> {
  const path = `dias_trabalhados/${id}`;
  const clean: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (patch.motoristaId !== undefined) clean.motoristaId = clip(patch.motoristaId, 128);
  if (patch.proprietarioId !== undefined) clean.proprietarioId = clip(patch.proprietarioId, 128);
  if (patch.veiculoId !== undefined) clean.veiculoId = clip(patch.veiculoId, 128);
  if (patch.placa !== undefined) clean.placa = clip(patch.placa, 16).toUpperCase();
  if (patch.data !== undefined) clean.data = clip(patch.data, 20);
  if (patch.rota !== undefined) clean.rota = clip(patch.rota, 160);
  if (patch.turno !== undefined) clean.turno = patch.turno;
  if (patch.valorDiaria !== undefined) clean.valorDiaria = clampMoney(patch.valorDiaria);
  if (patch.status !== undefined) clean.status = patch.status;
  if (patch.observacoes !== undefined) clean.observacoes = clip(patch.observacoes, 500);

  try {
    await updateDoc(doc(db, 'dias_trabalhados', id), clean);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteDiaTrabalhado(id: string): Promise<void> {
  const path = `dias_trabalhados/${id}`;
  try {
    await deleteDoc(doc(db, 'dias_trabalhados', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

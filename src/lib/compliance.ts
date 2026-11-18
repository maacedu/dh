import * as XLSX from 'xlsx';
import type {
  DiaTrabalhado,
  Documento,
  Frete,
  LancamentoFinanceiro,
  Motorista,
  PendenciaItem,
  Proprietario,
  SituacaoCadastral,
  StatusDiaTrabalhado,
  StatusDocumento,
  StatusFinanceiro,
  StatusFrete,
  TipoLancamento,
  TurnoTrabalho,
  Veiculo,
} from '../types/fleet';

export const SITUACAO_LABELS: Record<SituacaoCadastral, string> = {
  aprovado: 'Aprovado',
  em_analise: 'Em Análise',
  pendente: 'Em Revisão',
  documentacao_vencida: 'Documentação Vencida',
};

export const STATUS_DOC_LABELS: Record<StatusDocumento, string> = {
  valido: 'Válido',
  vencido: 'Vencido',
  a_vencer: 'A Vencer (30d)',
  pendente: 'Em Revisão',
  em_analise: 'Em Análise',
};

export const TIPO_LANCAMENTO_LABELS: Record<TipoLancamento, string> = {
  receita: 'Receita',
  despesa: 'Despesa',
  repasse: 'Repasse',
};

export const STATUS_FINANCEIRO_LABELS: Record<StatusFinanceiro, string> = {
  pago: 'Pago',
  pendente: 'Em Aberto',
  atrasado: 'Atrasado',
  cancelado: 'Cancelado',
};

export const STATUS_FRETE_LABELS: Record<StatusFrete, string> = {
  agendado: 'Agendado',
  em_transito: 'Em Trânsito',
  entregue: 'Entregue',
  faturado: 'Faturado',
  cancelado: 'Cancelado',
};

export const TURNO_TRABALHO_LABELS: Record<TurnoTrabalho, string> = {
  dia_completo: 'Dia Completo',
  meia_diaria: 'Meia Diária',
  extra: 'Diária Extra',
};

export const STATUS_DIA_LABELS: Record<StatusDiaTrabalhado, string> = {
  trabalhado: 'Trabalhado',
  folga: 'Folga',
  falta: 'Falta',
  feriado: 'Feriado',
};

export const DEFAULT_CATEGORIAS_FINANCEIRAS: Array<{
  nome: string;
  tipoPadrao: TipoLancamento;
  descricao: string;
}> = [
  { nome: 'Frete / Faturamento', tipoPadrao: 'receita', descricao: 'Receitas de transporte e viagens' },
  { nome: 'Repasse Proprietário', tipoPadrao: 'repasse', descricao: 'Repasse de valores a agregados e proprietários' },
  { nome: 'Pagamento Motorista', tipoPadrao: 'repasse', descricao: 'Comissões, diárias e pagamentos de motoristas' },
  { nome: 'Combustível', tipoPadrao: 'despesa', descricao: 'Abastecimento e vale-combustível da frota' },
  { nome: 'Manutenção', tipoPadrao: 'despesa', descricao: 'Oficina, peças, pneus e revisões preventivas' },
  { nome: 'Documentação / Taxas', tipoPadrao: 'despesa', descricao: 'CRLV, IPVA, ANTT, seguros e licenciamento' },
];

export function formatBrl(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number.isFinite(value) ? value : 0);
}

export function getTodayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function evaluateDateStatus(dateStr: string): 'valido' | 'a_vencer' | 'vencido' | 'pendente' {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return 'pendente';
  }
  const today = new Date(`${getTodayIso()}T00:00:00`);
  const target = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(target.getTime())) return 'pendente';

  const diffDays = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'vencido';
  if (diffDays <= 30) return 'a_vencer';
  return 'valido';
}

export function formatDatePtBr(dateStr: string): string {
  if (!dateStr) return '—';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) return dateStr;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

export function computeMotoristaPendingFields(m: Partial<Motorista>): string[] {
  const missing: string[] = [];
  if (!m.nomeCompleto?.trim()) missing.push('Nome completo');
  if (!m.cpf?.trim()) missing.push('CPF');
  if (!m.cnh?.trim()) missing.push('CNH');
  if (!m.categoriaCnh?.trim()) missing.push('Categoria CNH');
  if (!m.validadeCnh?.trim()) missing.push('Validade da CNH');
  if (!m.telefone?.trim()) missing.push('Telefone');
  return missing;
}

export function computeVeiculoPendingFields(v: Partial<Veiculo>): string[] {
  const missing: string[] = [];
  if (!v.placa?.trim()) missing.push('Placa');
  if (!v.modelo?.trim()) missing.push('Modelo');
  if (!v.marca?.trim()) missing.push('Marca');
  if (!v.ano?.trim()) missing.push('Ano');
  if (!v.renavam?.trim()) missing.push('RENAVAM');
  if (!v.tipoVeiculo?.trim()) missing.push('Tipo de veículo');
  if (!v.proprietarioId?.trim()) missing.push('Proprietário');
  if (!v.validadeCrlv?.trim()) missing.push('Validade CRLV');
  return missing;
}

export function computeProprietarioPendingFields(p: Partial<Proprietario>): string[] {
  const missing: string[] = [];
  if (!p.nomeCompleto?.trim()) missing.push('Nome completo');
  if (!p.cpfCnpj?.trim()) missing.push('CPF/CNPJ');
  if (!p.contato?.trim()) missing.push('Contato');
  return missing;
}

export function suggestSituacaoMotorista(m: Partial<Motorista>): SituacaoCadastral {
  const validadeStatus = evaluateDateStatus(m.validadeCnh || '');
  if (validadeStatus === 'vencido') return 'documentacao_vencida';
  return m.situacaoCadastral || 'em_analise';
}

export function suggestSituacaoVeiculo(v: Partial<Veiculo>): SituacaoCadastral {
  const validadeStatus = evaluateDateStatus(v.validadeCrlv || '');
  if (validadeStatus === 'vencido') return 'documentacao_vencida';
  return v.situacaoCadastral || 'em_analise';
}

export function generatePendencias(
  motoristas: Motorista[],
  veiculos: Veiculo[],
  _proprietarios: Proprietario[],
  documentos: Documento[]
): PendenciaItem[] {
  const items: PendenciaItem[] = [];

  for (const m of motoristas) {
    const cnhValidity = evaluateDateStatus(m.validadeCnh);
    if (cnhValidity === 'vencido') {
      items.push({
        id: `mot-cnh-vencida-${m.id}`,
        entidadeTipo: 'motorista',
        entidadeId: m.id,
        entidadeTitulo: m.nomeCompleto,
        categoria: 'vencido',
        descricao: `CNH vencida em ${formatDatePtBr(m.validadeCnh)}.`,
        dataReferencia: m.validadeCnh,
      });
    } else if (cnhValidity === 'a_vencer') {
      items.push({
        id: `mot-cnh-avencer-${m.id}`,
        entidadeTipo: 'motorista',
        entidadeId: m.id,
        entidadeTitulo: m.nomeCompleto,
        categoria: 'a_vencer',
        descricao: `CNH vence em ${formatDatePtBr(m.validadeCnh)}.`,
        dataReferencia: m.validadeCnh,
      });
    }
  }

  for (const v of veiculos) {
    const crlvValidity = evaluateDateStatus(v.validadeCrlv);
    if (crlvValidity === 'vencido') {
      items.push({
        id: `vei-crlv-vencido-${v.id}`,
        entidadeTipo: 'veiculo',
        entidadeId: v.id,
        entidadeTitulo: `${v.placa}${v.modelo ? ` · ${v.modelo}` : ''}`,
        categoria: 'vencido',
        descricao: `CRLV vencido em ${formatDatePtBr(v.validadeCrlv)}.`,
        dataReferencia: v.validadeCrlv,
      });
    } else if (crlvValidity === 'a_vencer') {
      items.push({
        id: `vei-crlv-avencer-${v.id}`,
        entidadeTipo: 'veiculo',
        entidadeId: v.id,
        entidadeTitulo: `${v.placa}${v.modelo ? ` · ${v.modelo}` : ''}`,
        categoria: 'a_vencer',
        descricao: `CRLV vence em ${formatDatePtBr(v.validadeCrlv)}.`,
        dataReferencia: v.validadeCrlv,
      });
    }
  }

  for (const docItem of documentos) {
    const docStatus = docItem.dataValidade
      ? evaluateDateStatus(docItem.dataValidade)
      : docItem.statusDocumento;
    if (
      docStatus === 'vencido' &&
      !(docItem.entidadeTipo === 'motorista' && docItem.tipoDocumento === 'CNH') &&
      !(docItem.entidadeTipo === 'veiculo' && docItem.tipoDocumento === 'CRLV')
    ) {
      items.push({
        id: `doc-vencido-${docItem.id}`,
        entidadeTipo: docItem.entidadeTipo,
        entidadeId: docItem.entidadeId,
        entidadeTitulo: `${docItem.tipoDocumento} · ${docItem.entidadeNome}`,
        categoria: 'vencido',
        descricao: `Documento "${docItem.nomeArquivo}" vencido em ${formatDatePtBr(docItem.dataValidade)}.`,
        dataReferencia: docItem.dataValidade,
      });
    }
  }

  const orderWeight: Record<PendenciaItem['categoria'], number> = {
    vencido: 0,
    a_vencer: 1,
    faltante: 2,
    campo_pendente: 3,
  };

  return items.sort((a, b) => orderWeight[a.categoria] - orderWeight[b.categoria]);
}

export function exportFleetToExcel(
  motoristas: Motorista[],
  veiculos: Veiculo[],
  proprietarios: Proprietario[],
  documentos: Documento[],
  pendencias: PendenciaItem[],
  lancamentos: LancamentoFinanceiro[] = [],
  fretes: Frete[] = [],
  diasTrabalhados: DiaTrabalhado[] = []
): void {
  const propMap = new Map(proprietarios.map((p) => [p.id, p]));
  const motMap = new Map(motoristas.map((m) => [m.id, m]));
  const veiMap = new Map(veiculos.map((v) => [v.id, v]));

  const motoristasRows = motoristas.map((m) => {
    const linkedVeiPlaca = veiculos.find((v) => v.motoristaId === m.id)?.placa || '';
    return {
      'Nome Completo': m.nomeCompleto || '—',
      CPF: m.cpf || '—',
      CNH: m.cnh || '—',
      Categoria: m.categoriaCnh || '—',
      'Validade CNH': formatDatePtBr(m.validadeCnh),
      Telefone: m.telefone || '—',
      Placa: m.placa || linkedVeiPlaca || '—',
      'Proprietário Vinculado': m.proprietarioId
        ? propMap.get(m.proprietarioId)?.nomeCompleto || m.proprietarioId
        : 'Sem vínculo',
      'Situação Cadastral': SITUACAO_LABELS[m.situacaoCadastral] || m.situacaoCadastral,
      Observações: m.observacoes || '',
    };
  });

  const veiculosRows = veiculos.map((v) => ({
    Placa: v.placa || '—',
    Marca: v.marca || '—',
    Modelo: v.modelo || '—',
    Ano: v.ano || '—',
    RENAVAM: v.renavam || '—',
    'Tipo de Veículo': v.tipoVeiculo || '—',
    'Proprietário': v.proprietarioId
      ? propMap.get(v.proprietarioId)?.nomeCompleto || v.proprietarioId
      : 'Sem vínculo',
    'Motorista Vinculado': v.motoristaId
      ? motMap.get(v.motoristaId)?.nomeCompleto || v.motoristaId
      : 'Não vinculado',
    'Validade CRLV': formatDatePtBr(v.validadeCrlv),
    'Situação Cadastral': SITUACAO_LABELS[v.situacaoCadastral] || v.situacaoCadastral,
    Observações: v.observacoes || '',
  }));

  const proprietariosRows = proprietarios.map((p) => {
    const linkedVeis = veiculos.filter((v) => v.proprietarioId === p.id);
    const linkedMots = motoristas.filter((m) => m.proprietarioId === p.id);
    return {
      'Nome Completo / Razão Social': p.nomeCompleto || '—',
      'CPF / CNPJ': p.cpfCnpj || '—',
      Contato: p.contato || '—',
      'Veículos Vinculados (Qtd)': linkedVeis.length,
      'Placas Vinculadas': linkedVeis.map((v) => v.placa).join(', ') || 'Nenhum',
      'Motoristas Vinculados (Qtd)': linkedMots.length,
      'Nomes dos Motoristas': linkedMots.map((m) => m.nomeCompleto).join(', ') || 'Nenhum',
      'Situação Cadastral': SITUACAO_LABELS[p.situacaoCadastral] || p.situacaoCadastral,
      Observações: p.observacoes || '',
    };
  });

  const documentosRows = documentos.map((d) => ({
    'Tipo de Documento': d.tipoDocumento,
    Arquivo: d.nomeArquivo,
    'Vínculo (Tipo)': d.entidadeTipo.toUpperCase(),
    'Vínculo (Nome/Placa)': d.entidadeNome,
    Validade: formatDatePtBr(d.dataValidade),
    Status: STATUS_DOC_LABELS[d.statusDocumento] || d.statusDocumento,
    Resumo: d.resumoExtracao || '',
  }));

  const vencimentosRows = pendencias.map((pen) => ({
    Alerta: pen.categoria === 'vencido' ? 'Vencido' : 'A Vencer (30d)',
    'Tipo de Cadastro': pen.entidadeTipo.toUpperCase(),
    'Identificação': pen.entidadeTitulo,
    Descrição: pen.descricao,
    'Data Referência': pen.dataReferencia ? formatDatePtBr(pen.dataReferencia) : '—',
  }));

  const financeiroRows = lancamentos.map((l) => ({
    Descrição: l.descricao,
    Tipo: TIPO_LANCAMENTO_LABELS[l.tipo] || l.tipo,
    Categoria: l.categoria,
    Valor: l.valor,
    Vencimento: l.dataVencimento ? formatDatePtBr(l.dataVencimento) : '—',
    Pagamento: l.dataPagamento ? formatDatePtBr(l.dataPagamento) : '—',
    Status: STATUS_FINANCEIRO_LABELS[l.status] || l.status,
    Proprietário: l.proprietarioId ? propMap.get(l.proprietarioId)?.nomeCompleto || '—' : '—',
    Motorista: l.motoristaId ? motMap.get(l.motoristaId)?.nomeCompleto || '—' : '—',
    Veículo: l.veiculoId ? veiMap.get(l.veiculoId)?.placa || '—' : '—',
    Observações: l.observacoes || '',
  }));

  const fretesRows = fretes.map((f) => ({
    Cliente: f.cliente,
    Origem: f.origem || '—',
    Destino: f.destino || '—',
    'Data Saída': f.dataSaida ? formatDatePtBr(f.dataSaida) : '—',
    'Valor Frete': f.valorFrete,
    'Valor Repasse': f.valorRepasse,
    Status: STATUS_FRETE_LABELS[f.status] || f.status,
    Proprietário: f.proprietarioId ? propMap.get(f.proprietarioId)?.nomeCompleto || '—' : '—',
    Motorista: f.motoristaId ? motMap.get(f.motoristaId)?.nomeCompleto || '—' : '—',
    Veículo: f.veiculoId ? veiMap.get(f.veiculoId)?.placa || '—' : '—',
    Observações: f.observacoes || '',
  }));

  const diasRows = diasTrabalhados.map((d) => ({
    Data: formatDatePtBr(d.data),
    Motorista: motMap.get(d.motoristaId)?.nomeCompleto || '—',
    Placa: d.placa || veiMap.get(d.veiculoId)?.placa || '—',
    Proprietário: d.proprietarioId ? propMap.get(d.proprietarioId)?.nomeCompleto || '—' : '—',
    'Rota / Operação': d.rota || '—',
    Modalidade: TURNO_TRABALHO_LABELS[d.turno] || d.turno,
    'Valor Diária': d.valorDiaria,
    Status: STATUS_DIA_LABELS[d.status] || d.status,
    Observações: d.observacoes || '',
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(motoristasRows), 'Motoristas');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(veiculosRows), 'Veículos');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(proprietariosRows), 'Proprietários');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(documentosRows), 'Documentação');
  if (vencimentosRows.length > 0) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(vencimentosRows), 'Vencimentos');
  }
  if (diasRows.length > 0) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(diasRows), 'Dias Trabalhados');
  }
  if (financeiroRows.length > 0) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(financeiroRows), 'Financeiro');
  }
  if (fretesRows.length > 0) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(fretesRows), 'Fretes');
  }

  XLSX.writeFile(wb, `El_Nathan_Transportes_Cadastros_${getTodayIso()}.xlsx`);
}

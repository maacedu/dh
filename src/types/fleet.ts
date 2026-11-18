export type SituacaoCadastral =
  | 'aprovado'
  | 'pendente'
  | 'documentacao_vencida'
  | 'em_analise';

export type TipoVeiculo = '' | 'Van' | 'HR' | 'VUC' | 'Médio';

export type TipoDocumento =
  | 'CNH'
  | 'CRLV'
  | 'Comprovante de Endereço'
  | 'ANTT / RNTRC'
  | 'Contrato / Procuração'
  | 'Outro';

export type EntidadeTipo = 'motorista' | 'veiculo' | 'proprietario';

export type StatusDocumento =
  | 'valido'
  | 'vencido'
  | 'a_vencer'
  | 'pendente'
  | 'em_analise';

export interface Proprietario {
  id: string;
  ownerUid: string;
  nomeCompleto: string;
  cpfCnpj: string;
  contato: string;
  situacaoCadastral: SituacaoCadastral;
  observacoes?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Motorista {
  id: string;
  ownerUid: string;
  nomeCompleto: string;
  cpf: string;
  cnh: string;
  categoriaCnh: string;
  validadeCnh: string;
  telefone: string;
  placa?: string;
  proprietarioId: string;
  situacaoCadastral: SituacaoCadastral;
  camposPendentes: string[];
  observacoes?: string;
  rotaPadrao?: string;
  valorDiariaPadrao?: number;
  statusAtualizadoEm?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Veiculo {
  id: string;
  ownerUid: string;
  placa: string;
  modelo: string;
  marca: string;
  ano: string;
  renavam: string;
  tipoVeiculo: TipoVeiculo;
  proprietarioId: string;
  motoristaId: string;
  validadeCrlv: string;
  situacaoCadastral: SituacaoCadastral;
  camposPendentes: string[];
  observacoes?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Documento {
  id: string;
  ownerUid: string;
  tipoDocumento: TipoDocumento;
  nomeArquivo: string;
  mimeType: string;
  entidadeTipo: EntidadeTipo;
  entidadeId: string;
  entidadeNome: string;
  dataValidade: string;
  statusDocumento: StatusDocumento;
  camposPendentes: string[];
  resumoExtracao?: string;
  observacoes?: string;
  arquivoUrl?: string;
  storagePath?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ExtractionResponse {
  tipoDocumentoDetectado: TipoDocumento;
  entidadePrincipal: EntidadeTipo;
  dataValidadeDocumento: string;
  resumoExtracao: string;
  motorista: {
    presenteNoDocumento: boolean;
    nomeCompleto: string;
    cpf: string;
    cnh: string;
    categoriaCnh: string;
    validadeCnh: string;
    telefone: string;
  };
  proprietario: {
    presenteNoDocumento: boolean;
    nomeCompleto: string;
    cpfCnpj: string;
    contato: string;
  };
  veiculo: {
    presenteNoDocumento: boolean;
    placa: string;
    modelo: string;
    marca: string;
    ano: string;
    renavam: string;
    tipoVeiculo: TipoVeiculo;
    validadeCrlv: string;
  };
  camposNaoIdentificados: string[];
}

export interface PendenciaItem {
  id: string;
  entidadeTipo: EntidadeTipo;
  entidadeId: string;
  entidadeTitulo: string;
  categoria: 'vencido' | 'a_vencer' | 'faltante' | 'campo_pendente';
  descricao: string;
  dataReferencia?: string;
  diasRestantes?: number;
}

export type TipoLancamento = 'receita' | 'despesa' | 'repasse';

export type StatusFinanceiro = 'pago' | 'pendente' | 'atrasado' | 'cancelado';

export interface LancamentoFinanceiro {
  id: string;
  ownerUid: string;
  descricao: string;
  tipo: TipoLancamento;
  categoria: string;
  valor: number;
  dataVencimento: string;
  dataPagamento: string;
  status: StatusFinanceiro;
  proprietarioId: string;
  motoristaId: string;
  veiculoId: string;
  observacoes?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CategoriaFinanceira {
  id: string;
  ownerUid: string;
  nome: string;
  tipoPadrao: TipoLancamento;
  descricao: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type StatusFrete =
  | 'agendado'
  | 'em_transito'
  | 'entregue'
  | 'faturado'
  | 'cancelado';

export interface Frete {
  id: string;
  ownerUid: string;
  cliente: string;
  origem: string;
  destino: string;
  dataSaida: string;
  valorFrete: number;
  valorRepasse: number;
  proprietarioId: string;
  motoristaId: string;
  veiculoId: string;
  status: StatusFrete;
  observacoes?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type TurnoTrabalho = 'dia_completo' | 'meia_diaria' | 'extra';

export type StatusDiaTrabalhado = 'trabalhado' | 'folga' | 'falta' | 'feriado';

export interface DiaTrabalhado {
  id: string;
  ownerUid: string;
  motoristaId: string;
  proprietarioId: string;
  veiculoId: string;
  placa: string;
  data: string;
  rota: string;
  turno: TurnoTrabalho;
  valorDiaria: number;
  status: StatusDiaTrabalhado;
  observacoes?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

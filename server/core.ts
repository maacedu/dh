import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

function resolveFirebaseApiKey(): string {
  if (process.env.FIREBASE_API_KEY) {
    return process.env.FIREBASE_API_KEY;
  }
  const baseDir =
    typeof __dirname !== 'undefined'
      ? __dirname
      : import.meta.dirname || process.cwd();
  const candidates = [
    path.resolve(process.cwd(), 'firebase-applet-config.json'),
    path.resolve(baseDir, '..', 'firebase-applet-config.json'),
    path.resolve(baseDir, 'firebase-applet-config.json'),
  ];
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        const rawConfig = JSON.parse(fs.readFileSync(candidate, 'utf-8')) as {
          apiKey?: string;
        };
        if (rawConfig.apiKey) return rawConfig.apiKey;
      }
    } catch {
      // try next path
    }
  }
  return '';
}

const firebaseApiKey = resolveFirebaseApiKey();

const ACCESS_PASSWORD = process.env.APP_ACCESS_PASSWORD || '4907';
const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  crypto
    .createHash('sha256')
    .update(`el-nathan-session-${firebaseApiKey || 'default'}`)
    .digest('hex');

export const OPERATOR_EMAIL = 'operador@elnathantransportes.com.br';
export const OPERATOR_FIREBASE_SECRET = crypto
  .createHmac('sha256', SESSION_SECRET)
  .update('el-nathan-operator-firebase-key-v1')
  .digest('hex')
  .slice(0, 32);

export function createSessionToken(): string {
  const payload = Buffer.from(
    JSON.stringify({
      role: 'operador',
      exp: Date.now() + 1000 * 60 * 60 * 24 * 7,
    })
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifySessionToken(token: string | undefined | null): boolean {
  if (!token || !token.includes('.')) return false;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return false;
  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payload)
    .digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return false;
  }
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8')) as {
      exp?: number;
    };
    return typeof decoded.exp === 'number' && decoded.exp > Date.now();
  } catch {
    return false;
  }
}

export function verifyAccessPassword(candidate: string): boolean {
  const a = Buffer.from(candidate);
  const b = Buffer.from(ACCESS_PASSWORD);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
]);

export async function verifyFirebaseUser(
  authHeader: string | undefined | null
): Promise<{ uid: string; email: string } | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const idToken = authHeader.slice('Bearer '.length).trim();
  if (!idToken || !firebaseApiKey) {
    return null;
  }

  try {
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(firebaseApiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    );
    if (!response.ok) {
      return null;
    }
    const payload = (await response.json()) as {
      users?: Array<{ localId?: string; email?: string; emailVerified?: boolean }>;
    };
    const user = payload.users?.[0];
    if (!user?.localId) {
      return null;
    }
    return { uid: user.localId, email: user.email || '' };
  } catch {
    return null;
  }
}

export function handleLoginRequest(password: unknown): {
  status: number;
  body: Record<string, unknown>;
} {
  if (typeof password !== 'string' || !verifyAccessPassword(password.trim())) {
    return {
      status: 401,
      body: { error: 'Senha incorreta. Verifique e tente novamente.' },
    };
  }

  const sessionToken = createSessionToken();
  return {
    status: 200,
    body: {
      ok: true,
      sessionToken,
      operatorEmail: OPERATOR_EMAIL,
      operatorPassword: OPERATOR_FIREBASE_SECRET,
    },
  };
}

export async function handleExtractDocumentRequest(params: {
  sessionToken?: string | null;
  authHeader?: string | null;
  body: {
    fileBase64?: string;
    mimeType?: string;
    fileName?: string;
    hintTipoDocumento?: string;
  };
}): Promise<{ status: number; body: Record<string, unknown> }> {
  const hasValidSession = verifySessionToken(params.sessionToken);
  const verifiedUser = hasValidSession
    ? { uid: 'session-operator', email: OPERATOR_EMAIL }
    : await verifyFirebaseUser(params.authHeader);

  if (!verifiedUser) {
    return {
      status: 401,
      body: {
        error: 'Acesso não autorizado. Faça login para enviar documentos.',
      },
    };
  }

  if (!process.env.GEMINI_API_KEY) {
    return {
      status: 500,
      body: {
        error: 'Chave GEMINI_API_KEY não configurada nas variáveis de ambiente do servidor.',
      },
    };
  }

  const { fileBase64, mimeType, fileName, hintTipoDocumento } = params.body;

  if (!fileBase64 || !mimeType) {
    return {
      status: 400,
      body: { error: 'Arquivo ou tipo MIME ausente na requisição.' },
    };
  }

  const normalizedMime = mimeType === 'image/jpg' ? 'image/jpeg' : mimeType;
  if (!ALLOWED_MIME_TYPES.has(normalizedMime)) {
    return {
      status: 400,
      body: {
        error: 'Formato não suportado. Envie arquivos PDF, PNG, JPG ou WEBP.',
      },
    };
  }

  const cleanBase64 = fileBase64.includes(',') ? fileBase64.split(',')[1] : fileBase64;
  if (!cleanBase64 || cleanBase64.length > 20 * 1024 * 1024) {
    return {
      status: 400,
      body: {
        error: 'O arquivo excede o tamanho máximo permitido.',
      },
    };
  }

  const { GoogleGenAI, Type, ThinkingLevel } = await import('@google/genai');

  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const systemInstruction = [
    'Você é um especialista em leitura e extração documental da transportadora El Nathan Transportes.',
    'Sua tarefa é analisar o documento enviado (PDF ou imagem: CNH, CRLV, Comprovante de Endereço, ANTT/RNTRC, Contrato ou outro) e extrair EXCLUSIVAMENTE os dados explicitamente presentes e legíveis no documento.',
    'REGRAS ABSOLUTAS ANTI-INVENÇÃO:',
    '1. NUNCA invente, suponha, estime ou complete dados ausentes ou ilegíveis.',
    '2. Qualquer campo que não conste no documento deve ser retornado como string vazia "".',
    '3. Datas devem usar o formato YYYY-MM-DD somente quando dia, mês e ano estiverem explicitamente legíveis. Se houver apenas ano (como "Exercício 2025" no CRLV sem data de validade explícita), deixe o campo de validade como "" e mencione o exercício em resumoExtracao.',
    '4. Para tipoVeiculo, retorne apenas um dos valores exatos: "Van", "HR", "VUC", "Médio" ou "" caso não seja possível confirmar pelo documento (por exemplo, se não ficar claro ou se for melhor o operador classificar manualmente).',
    '5. Identifique corretamente se o documento traz dados de Motorista, Veículo, Proprietário ou ambos (por exemplo, o CRLV normalmente traz dados do Veículo e do Proprietário).',
    '6. Em camposNaoIdentificados, liste em português os rótulos dos campos importantes daquele tipo de documento que não estavam visíveis e precisarão de preenchimento manual.',
  ].join('\n');

  const userPrompt = `Analise o arquivo "${fileName || 'documento'}"${
    hintTipoDocumento ? ` (sugestão do operador: ${hintTipoDocumento})` : ''
  } e extraia somente as informações visíveis, deixando "" nos campos ausentes.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: normalizedMime,
              data: cleanBase64,
            },
          },
          { text: userPrompt },
        ],
      },
      config: {
        systemInstruction,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            tipoDocumentoDetectado: {
              type: Type.STRING,
              description:
                'Um dos valores exatos: CNH, CRLV, Comprovante de Endereço, ANTT / RNTRC, Contrato / Procuração, Outro',
            },
            entidadePrincipal: {
              type: Type.STRING,
              description: 'Um dos valores exatos: motorista, veiculo, proprietario',
            },
            dataValidadeDocumento: {
              type: Type.STRING,
              description: 'Data de validade do documento no formato YYYY-MM-DD ou string vazia ""',
            },
            resumoExtracao: {
              type: Type.STRING,
              description: 'Resumo curto e fiel dos dados encontrados no documento (máx. 400 caracteres).',
            },
            motorista: {
              type: Type.OBJECT,
              properties: {
                presenteNoDocumento: { type: Type.BOOLEAN },
                nomeCompleto: { type: Type.STRING },
                cpf: { type: Type.STRING },
                cnh: { type: Type.STRING },
                categoriaCnh: { type: Type.STRING },
                validadeCnh: { type: Type.STRING },
                telefone: { type: Type.STRING },
              },
              required: [
                'presenteNoDocumento',
                'nomeCompleto',
                'cpf',
                'cnh',
                'categoriaCnh',
                'validadeCnh',
                'telefone',
              ],
            },
            proprietario: {
              type: Type.OBJECT,
              properties: {
                presenteNoDocumento: { type: Type.BOOLEAN },
                nomeCompleto: { type: Type.STRING },
                cpfCnpj: { type: Type.STRING },
                contato: { type: Type.STRING },
              },
              required: ['presenteNoDocumento', 'nomeCompleto', 'cpfCnpj', 'contato'],
            },
            veiculo: {
              type: Type.OBJECT,
              properties: {
                presenteNoDocumento: { type: Type.BOOLEAN },
                placa: { type: Type.STRING },
                modelo: { type: Type.STRING },
                marca: { type: Type.STRING },
                ano: { type: Type.STRING },
                renavam: { type: Type.STRING },
                tipoVeiculo: {
                  type: Type.STRING,
                  description: 'Apenas Van, HR, VUC, Médio ou "" se não identificado',
                },
                validadeCrlv: { type: Type.STRING },
              },
              required: [
                'presenteNoDocumento',
                'placa',
                'modelo',
                'marca',
                'ano',
                'renavam',
                'tipoVeiculo',
                'validadeCrlv',
              ],
            },
            camposNaoIdentificados: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Lista de campos não encontrados no documento para preenchimento manual.',
            },
          },
          required: [
            'tipoDocumentoDetectado',
            'entidadePrincipal',
            'dataValidadeDocumento',
            'resumoExtracao',
            'motorista',
            'proprietario',
            'veiculo',
            'camposNaoIdentificados',
          ],
        },
      },
    });

    const rawText = (response.text ?? '{}').trim();
    const parsed = JSON.parse(rawText) as Record<string, unknown>;
    return {
      status: 200,
      body: { extracted: parsed },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido ao processar documento.';
    console.error('Erro na extração Gemini:', message);
    return {
      status: 502,
      body: {
        error: `Falha ao analisar o documento: ${message}`,
      },
    };
  }
}

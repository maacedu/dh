import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  CheckCircle2,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileCheck2,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Pencil,
  Plus,
  Route,
  Search,
  ShieldCheck,
  Sun,
  Trash2,
  Truck,
  Upload,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';
import {
  auth,
  deleteFleetDocumentFile,
  firebaseProjectId,
  testFirestoreConnection,
} from './lib/firebase';
import {
  evaluateDateStatus,
  exportFleetToExcel,
  formatBrl,
  formatDatePtBr,
  formatIsoDateTimePtBr,
  generatePendencias,
  getTodayIso,
  SITUACAO_LABELS,
  STATUS_DIA_LABELS,
  suggestSituacaoMotorista,
  suggestSituacaoVeiculo,
  TURNO_TRABALHO_LABELS,
} from './lib/compliance';
import {
  deleteDocumento,
  deleteMotorista,
  deleteProprietario,
  deleteVeiculo,
  subscribeFleetData,
  updateDocumento,
  updateMotorista,
  updateProprietario,
  updateVeiculo,
} from './lib/fleetService';
import type {
  CategoriaFinanceira,
  DiaTrabalhado,
  Documento,
  Frete,
  LancamentoFinanceiro,
  Motorista,
  Proprietario,
  SituacaoCadastral,
  StatusDocumento,
  TipoVeiculo,
  Veiculo,
} from './types/fleet';
import { DocStatusIndicator, SituacaoIndicator } from './components/StatusTag';
import { EditableCell } from './components/EditableCell';
import { DocumentUploadModal } from './components/DocumentUploadModal';
import { ManualEntryModal, type ManualModalMode } from './components/ManualEntryModal';
import { EditEntityModal, type EditableEntity } from './components/EditEntityModal';
import { ConfirmDeleteModal } from './components/ConfirmDeleteModal';
import { OwnerDetailDrawer } from './components/OwnerDetailDrawer';
import { FinanceiroSection } from './components/FinanceiroSection';
import { FretesSection } from './components/FretesSection';
import { ScrollableTableCard } from './components/ScrollableTableCard';

type NavSection =
  | 'painel'
  | 'motoristas'
  | 'veiculos'
  | 'proprietarios'
  | 'documentos'
  | 'financeiro'
  | 'fretes';

type ThemeMode = 'dark' | 'light';

const ADMIN_EMAIL = 'joaomacedogondim22@gmail.com';

const SITUACAO_OPTIONS: Array<{ value: 'todos' | SituacaoCadastral; label: string }> = [
  { value: 'todos', label: 'Todos' },
  { value: 'aprovado', label: 'Aprovado' },
  { value: 'em_analise', label: 'Em Análise' },
  { value: 'pendente', label: 'Em Revisão' },
  { value: 'documentacao_vencida', label: 'Documentação Vencida' },
];

const TIPO_VEICULO_OPTIONS: Array<{ value: 'todos' | TipoVeiculo; label: string }> = [
  { value: 'todos', label: 'Todos os Tipos' },
  { value: 'Van', label: 'Van' },
  { value: 'HR', label: 'HR' },
  { value: 'VUC', label: 'VUC' },
  { value: 'Médio', label: 'Médio' },
];

function BrandEmblem() {
  return (
    <svg
      viewBox="0 0 36 36"
      className="h-9 w-9 shrink-0"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="elnathanBrandGrad" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#2563EB" />
          <stop offset="100%" stopColor="#1D4ED8" />
        </linearGradient>
      </defs>
      <rect width="36" height="36" rx="9" fill="url(#elnathanBrandGrad)" />
      <rect x="0.5" y="0.5" width="35" height="35" rx="8.5" stroke="white" strokeOpacity="0.16" />
      <path
        d="M8 12h12.5v10H8V12Zm12.5 3.5h4.7L28 19v3h-7.5v-6.5Z"
        stroke="#FFFFFF"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="12.5" cy="24.2" r="2.1" fill="#FFFFFF" />
      <circle cx="24.5" cy="24.2" r="2.1" fill="#FFFFFF" />
    </svg>
  );
}

export default function App() {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    try {
      return localStorage.getItem('elnathan_theme') === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem('elnathan_theme', theme);
    } catch {
      // ignore storage errors
    }
  }, [theme]);

  function toggleTheme() {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }

  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [sessionUnlocked, setSessionUnlocked] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [needsProviderSetup, setNeedsProviderSetup] = useState(false);
  const [authError, setAuthError] = useState('');
  const [signingIn, setSigningIn] = useState(false);

  const [loadingData, setLoadingData] = useState(true);
  const [dataError, setDataError] = useState('');
  const [proprietarios, setProprietarios] = useState<Proprietario[]>([]);
  const [motoristas, setMotoristas] = useState<Motorista[]>([]);
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [lancamentos, setLancamentos] = useState<LancamentoFinanceiro[]>([]);
  const [categoriasFinanceiras, setCategoriasFinanceiras] = useState<CategoriaFinanceira[]>([]);
  const [fretes, setFretes] = useState<Frete[]>([]);
  const [diasTrabalhados, setDiasTrabalhados] = useState<DiaTrabalhado[]>([]);

  const [activeSection, setActiveSection] = useState<NavSection>('painel');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [situacaoFilter, setSituacaoFilter] = useState<'todos' | SituacaoCadastral>('todos');
  const [tipoVeiculoFilter, setTipoVeiculoFilter] = useState<'todos' | TipoVeiculo>('todos');
  const [proprietarioFilter, setProprietarioFilter] = useState<string>('todos');
  const [pendenciaTab, setPendenciaTab] = useState<'documentos' | 'vencimentos'>('documentos');
  const [vencimentoWindowFilter, setVencimentoWindowFilter] = useState<
    'todos' | 'vencidos' | '7d' | '15d' | '30d'
  >('todos');

  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [manualModalMode, setManualModalMode] = useState<ManualModalMode | null>(null);
  const [editingEntity, setEditingEntity] = useState<EditableEntity | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'motorista' | 'veiculo' | 'proprietario' | 'documento';
    id: string;
    title: string;
    warning?: string;
  } | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);
  const [selectedOwnerId, setSelectedOwnerId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    void testFirestoreConnection();

    let active = true;
    const storedToken = localStorage.getItem('elnathan_session_token') || '';
    const verifyPromise = storedToken
      ? fetch('/api/auth/verify', { headers: { 'X-Session-Token': storedToken } })
          .then((r) => r.ok)
          .catch(() => false)
      : Promise.resolve(false);

    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      const validSession = await verifyPromise;
      if (!active) return;
      setSessionUnlocked(validSession);
      setUser(nextUser);
      setAuthReady(true);
    });

    return () => {
      active = false;
      unsub();
    };
  }, []);

  useEffect(() => {
    if (!user || !sessionUnlocked) {
      setProprietarios([]);
      setMotoristas([]);
      setVeiculos([]);
      setDocumentos([]);
      setLancamentos([]);
      setCategoriasFinanceiras([]);
      setFretes([]);
      setDiasTrabalhados([]);
      setLoadingData(false);
      return;
    }

    setLoadingData(true);
    setDataError('');
    const isAdminUser =
      Boolean(user.emailVerified) && user.email?.toLowerCase() === ADMIN_EMAIL;

    const unsub = subscribeFleetData(user.uid, isAdminUser, {
      onProprietarios: (items) => {
        setProprietarios(items);
        setLoadingData(false);
      },
      onMotoristas: (items) => {
        setMotoristas(items);
        setLoadingData(false);
      },
      onVeiculos: (items) => {
        setVeiculos(items);
        setLoadingData(false);
      },
      onDocumentos: (items) => {
        setDocumentos(items);
        setLoadingData(false);
      },
      onFinanceiro: (items) => {
        setLancamentos(items);
      },
      onCategoriasFinanceiras: (items) => {
        setCategoriasFinanceiras(items);
      },
      onFretes: (items) => {
        setFretes(items);
      },
      onDiasTrabalhados: (items) => {
        setDiasTrabalhados(items);
      },
      onError: (err) => {
        setDataError(err.message);
        setLoadingData(false);
      },
    });

    return unsub;
  }, [user, sessionUnlocked]);

  function showToast(type: 'success' | 'error', text: string) {
    setToast({ type, text });
    window.setTimeout(() => {
      setToast((prev) => (prev?.text === text ? null : prev));
    }, 5000);
  }

  async function handlePasswordLogin(e: FormEvent) {
    e.preventDefault();
    setAuthError('');
    setNeedsProviderSetup(false);
    setSigningIn(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwordInput }),
      });

      const rawText = await res.text();
      let data: {
        ok?: boolean;
        sessionToken?: string;
        operatorEmail?: string;
        operatorPassword?: string;
        error?: string;
      } = {};
      try {
        data = rawText ? (JSON.parse(rawText) as typeof data) : {};
      } catch {
        data = {};
      }

      if (!res.ok || !data.sessionToken || !data.operatorEmail || !data.operatorPassword) {
        setAuthError(
          data.error ||
            (res.status === 404
              ? 'Serviço de autenticação (/api/auth/login) não encontrado no servidor.'
              : 'Senha incorreta ou falha ao validar acesso.')
        );
        setSigningIn(false);
        return;
      }

      localStorage.setItem('elnathan_session_token', data.sessionToken);

      try {
        await signInWithEmailAndPassword(auth, data.operatorEmail, data.operatorPassword);
      } catch (signInErr) {
        const code = (signInErr as { code?: string })?.code || '';
        if (code === 'auth/user-not-found' || code === 'auth/invalid-credential') {
          try {
            await createUserWithEmailAndPassword(auth, data.operatorEmail, data.operatorPassword);
          } catch (createErr) {
            const createCode = (createErr as { code?: string })?.code || '';
            if (
              createCode === 'auth/operation-not-allowed' ||
              createCode === 'auth/admin-restricted-operation'
            ) {
              await signInAnonymously(auth);
            } else {
              throw createErr;
            }
          }
        } else if (
          code === 'auth/operation-not-allowed' ||
          code === 'auth/admin-restricted-operation'
        ) {
          await signInAnonymously(auth);
        } else {
          throw signInErr;
        }
      }

      setSessionUnlocked(true);
      setPasswordInput('');
    } catch (err) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/operation-not-allowed' || code === 'auth/admin-restricted-operation') {
        setNeedsProviderSetup(true);
        setAuthError(
          'Senha validada, mas o provedor E-mail/senha ainda precisa ser ativado no Firebase Console para liberar o banco de dados.'
        );
      } else {
        setAuthError(
          err instanceof Error ? err.message : 'Não foi possível iniciar a sessão no sistema.'
        );
      }
    } finally {
      setSigningIn(false);
    }
  }

  async function handleLogout() {
    localStorage.removeItem('elnathan_session_token');
    setSessionUnlocked(false);
    await signOut(auth);
  }

  const propMap = useMemo(
    () => new Map(proprietarios.map((p) => [p.id, p])),
    [proprietarios]
  );

  const motMap = useMemo(() => new Map(motoristas.map((m) => [m.id, m])), [motoristas]);

  const motPlateByVehicleMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const v of veiculos) {
      if (v.motoristaId && v.placa && !map.has(v.motoristaId)) {
        map.set(v.motoristaId, v.placa);
      }
    }
    return map;
  }, [veiculos]);

  const pendencias = useMemo(
    () => generatePendencias(motoristas, veiculos, proprietarios, documentos),
    [motoristas, veiculos, proprietarios, documentos]
  );

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const normalizedSearchDigits = searchQuery.replace(/\D/g, '');

  const filteredMotoristas = useMemo(() => {
    return motoristas.filter((m) => {
      if (situacaoFilter !== 'todos' && m.situacaoCadastral !== situacaoFilter) return false;
      if (proprietarioFilter !== 'todos' && m.proprietarioId !== proprietarioFilter) return false;
      if (!normalizedSearch) return true;
      const propName = propMap.get(m.proprietarioId)?.nomeCompleto.toLowerCase() || '';
      const cpfDigits = m.cpf.replace(/\D/g, '');
      const plateText = (m.placa || motPlateByVehicleMap.get(m.id) || '').toLowerCase();
      return (
        m.nomeCompleto.toLowerCase().includes(normalizedSearch) ||
        m.cpf.toLowerCase().includes(normalizedSearch) ||
        (normalizedSearchDigits.length >= 3 && cpfDigits.includes(normalizedSearchDigits)) ||
        m.cnh.toLowerCase().includes(normalizedSearch) ||
        plateText.includes(normalizedSearch) ||
        propName.includes(normalizedSearch)
      );
    });
  }, [
    motoristas,
    situacaoFilter,
    proprietarioFilter,
    normalizedSearch,
    normalizedSearchDigits,
    propMap,
    motPlateByVehicleMap,
  ]);

  const filteredVeiculos = useMemo(() => {
    return veiculos.filter((v) => {
      if (situacaoFilter !== 'todos' && v.situacaoCadastral !== situacaoFilter) return false;
      if (tipoVeiculoFilter !== 'todos' && v.tipoVeiculo !== tipoVeiculoFilter) return false;
      if (proprietarioFilter !== 'todos' && v.proprietarioId !== proprietarioFilter) return false;
      if (!normalizedSearch) return true;
      const prop = propMap.get(v.proprietarioId);
      const mot = motMap.get(v.motoristaId);
      const propDigits = prop?.cpfCnpj.replace(/\D/g, '') || '';
      return (
        v.placa.toLowerCase().includes(normalizedSearch) ||
        v.modelo.toLowerCase().includes(normalizedSearch) ||
        v.marca.toLowerCase().includes(normalizedSearch) ||
        v.renavam.toLowerCase().includes(normalizedSearch) ||
        (prop?.nomeCompleto.toLowerCase().includes(normalizedSearch) ?? false) ||
        (normalizedSearchDigits.length >= 3 && propDigits.includes(normalizedSearchDigits)) ||
        (mot?.nomeCompleto.toLowerCase().includes(normalizedSearch) ?? false)
      );
    });
  }, [
    veiculos,
    situacaoFilter,
    tipoVeiculoFilter,
    proprietarioFilter,
    normalizedSearch,
    normalizedSearchDigits,
    propMap,
    motMap,
  ]);

  const filteredProprietarios = useMemo(() => {
    return proprietarios.filter((p) => {
      if (situacaoFilter !== 'todos' && p.situacaoCadastral !== situacaoFilter) return false;
      if (!normalizedSearch) return true;
      const docDigits = p.cpfCnpj.replace(/\D/g, '');
      const hasMatchingVehicle = veiculos.some(
        (v) => v.proprietarioId === p.id && v.placa.toLowerCase().includes(normalizedSearch)
      );
      return (
        p.nomeCompleto.toLowerCase().includes(normalizedSearch) ||
        p.cpfCnpj.toLowerCase().includes(normalizedSearch) ||
        (normalizedSearchDigits.length >= 3 && docDigits.includes(normalizedSearchDigits)) ||
        hasMatchingVehicle
      );
    });
  }, [proprietarios, veiculos, situacaoFilter, normalizedSearch, normalizedSearchDigits]);

  const filteredDocumentos = useMemo(() => {
    return documentos.filter((d) => {
      if (!normalizedSearch) return true;
      return (
        d.nomeArquivo.toLowerCase().includes(normalizedSearch) ||
        d.entidadeNome.toLowerCase().includes(normalizedSearch) ||
        d.tipoDocumento.toLowerCase().includes(normalizedSearch)
      );
    });
  }, [documentos, normalizedSearch]);

  const filteredPendencias = useMemo(() => {
    return pendencias.filter((p) => {
      if (vencimentoWindowFilter === 'vencidos' && p.categoria !== 'vencido') return false;
      if (vencimentoWindowFilter === '7d') {
        if (p.categoria === 'vencido') return false;
        if (p.diasRestantes === undefined || p.diasRestantes < 0 || p.diasRestantes > 7) {
          return false;
        }
      }
      if (vencimentoWindowFilter === '15d') {
        if (p.categoria === 'vencido') return false;
        if (p.diasRestantes === undefined || p.diasRestantes < 0 || p.diasRestantes > 15) {
          return false;
        }
      }
      if (vencimentoWindowFilter === '30d') {
        if (p.categoria === 'vencido') return false;
        if (p.diasRestantes === undefined || p.diasRestantes < 0 || p.diasRestantes > 30) {
          return false;
        }
      }
      if (!normalizedSearch) return true;
      return (
        p.entidadeTitulo.toLowerCase().includes(normalizedSearch) ||
        p.descricao.toLowerCase().includes(normalizedSearch)
      );
    });
  }, [pendencias, vencimentoWindowFilter, normalizedSearch]);

  // Dashboard Metrics
  const kpis = useMemo(() => {
    const motAprovados = motoristas.filter((m) => m.situacaoCadastral === 'aprovado').length;
    const motEmAnalise = motoristas.filter(
      (m) => m.situacaoCadastral === 'em_analise' || m.situacaoCadastral === 'pendente'
    ).length;
    const veiDisponiveis = veiculos.filter(
      (v) =>
        v.situacaoCadastral === 'aprovado' &&
        evaluateDateStatus(v.validadeCrlv) !== 'vencido'
    ).length;
    const currentMonth = getTodayIso().slice(0, 7);
    const diasMes = diasTrabalhados.filter((d) => d.data.startsWith(currentMonth));
    const diasTrabalhadosMes = diasMes.filter((d) => d.status === 'trabalhado').length;
    const motoristasAtivosMes = new Set(
      diasMes.filter((d) => d.status === 'trabalhado').map((d) => d.motoristaId)
    ).size;
    const totalDiariasMes = diasMes.reduce((acc, d) => acc + (d.valorDiaria || 0), 0);
    const vencidosCount = pendencias.filter((p) => p.categoria === 'vencido').length;

    return {
      totalMotoristas: motoristas.length,
      motAprovados,
      motEmAnalise,
      totalVeiculos: veiculos.length,
      veiDisponiveis,
      diasTrabalhadosMes,
      motoristasAtivosMes,
      totalDiariasMes,
      vencidosCount,
      totalVencimentos: pendencias.length,
      totalProprietarios: proprietarios.length,
    };
  }, [motoristas, veiculos, proprietarios, pendencias, diasTrabalhados]);

  const selectedOwner = useMemo(
    () => proprietarios.find((p) => p.id === selectedOwnerId) || null,
    [proprietarios, selectedOwnerId]
  );

  if (!authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F4F6FA] dark:bg-[#07090E]">
        <div className="text-sm font-medium text-slate-600 dark:text-slate-400">
          Inicializando El Nathan Transportes...
        </div>
      </div>
    );
  }

  if (!user || !sessionUnlocked) {
    return (
      <div className="relative flex min-h-screen flex-col justify-center overflow-hidden bg-[#F4F6FA] dark:bg-[#07090E] px-4 py-12">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(37,99,235,0.08),transparent_58%)] dark:bg-[radial-gradient(ellipse_at_top,rgba(37,99,235,0.18),transparent_58%)]"
        />

        <div className="absolute right-4 top-4 z-10 sm:right-6 sm:top-6">
          <button
            type="button"
            onClick={toggleTheme}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300/90 dark:border-white/[0.1] bg-white/90 dark:bg-[#0F1520]/90 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 shadow-xs backdrop-blur-xs transition-colors hover:bg-white dark:hover:bg-[#161E2E] whitespace-nowrap"
          >
            {theme === 'dark' ? (
              <>
                <Sun className="h-3.5 w-3.5 text-slate-700 dark:text-white" />
                <span>Tema Claro</span>
              </>
            ) : (
              <>
                <Moon className="h-3.5 w-3.5 text-slate-700" />
                <span>Tema Escuro</span>
              </>
            )}
          </button>
        </div>

        <div className="relative z-10 mx-auto w-full max-w-md rounded-2xl border border-slate-200/90 dark:border-white/[0.09] bg-white dark:bg-[#0F1520] p-8 shadow-2xl dark:shadow-black/70">
          <div className="flex items-center gap-3.5">
            <BrandEmblem />
            <div>
              <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                El Nathan Transportes
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Gestão Documental de Frota e Motoristas
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-2 border-t border-slate-200/80 dark:border-white/[0.07] pt-6">
            <div className="flex items-start gap-2.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
              <p>
                Área restrita da transportadora. Informe a senha de acesso para consultar e
                gerenciar cadastros e documentos.
              </p>
            </div>
          </div>

          {authError && (
            <div className="mt-4 space-y-2 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/50 px-3.5 py-2.5 text-xs text-red-700 dark:text-red-300">
              <p>{authError}</p>
              {needsProviderSetup && (
                <p className="text-[11px] leading-relaxed text-red-800 dark:text-red-200">
                  Acesse{' '}
                  <a
                    href={`https://console.firebase.google.com/project/${firebaseProjectId}/authentication/providers`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold underline"
                  >
                    Firebase Authentication &gt; Sign-in method
                  </a>
                  , ative <strong>E-mail/senha</strong> e tente entrar novamente com a senha.
                </p>
              )}
            </div>
          )}

          <form onSubmit={handlePasswordLogin} className="mt-5 space-y-4">
            <div>
              <label
                htmlFor="access-password"
                className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Senha de acesso
              </label>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                <input
                  id="access-password"
                  type={showPassword ? 'text' : 'password'}
                  inputMode="numeric"
                  autoComplete="current-password"
                  autoFocus
                  required
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Digite a senha"
                  className="w-full rounded-lg border border-slate-300 dark:border-white/[0.1] bg-white dark:bg-[#0B0F17] py-2.5 pl-9 pr-10 font-mono text-sm text-slate-900 dark:text-white placeholder:font-sans placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-blue-600 dark:focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-white"
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={signingIn || !passwordInput.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm shadow-blue-600/25 transition-colors hover:bg-blue-500 disabled:opacity-50"
            >
              {signingIn ? 'Verificando...' : 'Entrar no Sistema'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const navItems: Array<{
    id: NavSection;
    label: string;
    icon: typeof LayoutDashboard;
    count?: number;
  }> = [
    { id: 'painel', label: 'Painel Geral', icon: LayoutDashboard },
    { id: 'motoristas', label: 'Motoristas', icon: Users, count: motoristas.length },
    { id: 'veiculos', label: 'Veículos', icon: Truck, count: veiculos.length },
    { id: 'proprietarios', label: 'Proprietários', icon: Building2, count: proprietarios.length },
    {
      id: 'documentos',
      label: 'Documentação',
      icon: FileCheck2,
      count: documentos.length > 0 ? documentos.length : undefined,
    },
    {
      id: 'financeiro',
      label: 'Financeiro',
      icon: Wallet,
      count: lancamentos.length > 0 ? lancamentos.length : undefined,
    },
    {
      id: 'fretes',
      label: 'Rotas & Diárias',
      icon: Route,
      count:
        diasTrabalhados.length > 0
          ? diasTrabalhados.length
          : fretes.length > 0
            ? fretes.length
            : undefined,
    },
  ];

  const sectionTitles: Record<NavSection, string> = {
    painel: 'Painel Geral da Frota',
    motoristas: 'Cadastro de Motoristas',
    veiculos: 'Cadastro de Veículos',
    proprietarios: 'Proprietários e Vínculos',
    documentos: 'Documentação e Vencimentos',
    financeiro: 'Financeiro e Categorias',
    fretes: 'Rotas e Dias Trabalhados',
  };

  function handleExportExcel() {
    exportFleetToExcel(
      motoristas,
      veiculos,
      proprietarios,
      documentos,
      pendencias,
      lancamentos,
      fretes,
      diasTrabalhados
    );
    showToast('success', 'Planilha Excel exportada com os cadastros atualizados.');
  }

  async function safeAction(fn: () => Promise<void>, successMessage?: string) {
    try {
      await fn();
      if (successMessage) {
        showToast('success', successMessage);
      }
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Erro ao atualizar registro.');
    }
  }

  function requestDeleteMotorista(m: Motorista) {
    const linkedVeiCount = veiculos.filter((v) => v.motoristaId === m.id).length;
    setDeleteTarget({
      type: 'motorista',
      id: m.id,
      title: `o motorista "${m.nomeCompleto}"`,
      warning:
        linkedVeiCount > 0
          ? `Este motorista está vinculado como principal em ${linkedVeiCount} veículo(s). Eles serão desvinculados automaticamente.`
          : undefined,
    });
  }

  function requestDeleteVeiculo(v: Veiculo) {
    setDeleteTarget({
      type: 'veiculo',
      id: v.id,
      title: `o veículo "${v.placa}"`,
    });
  }

  function requestDeleteProprietario(p: Proprietario) {
    const linkedMotCount = motoristas.filter((m) => m.proprietarioId === p.id).length;
    const linkedVeiCount = veiculos.filter((v) => v.proprietarioId === p.id).length;
    const warningParts: string[] = [];
    if (linkedMotCount > 0) warningParts.push(`${linkedMotCount} motorista(s)`);
    if (linkedVeiCount > 0) warningParts.push(`${linkedVeiCount} veículo(s)`);
    setDeleteTarget({
      type: 'proprietario',
      id: p.id,
      title: `o proprietário "${p.nomeCompleto}"`,
      warning:
        warningParts.length > 0
          ? `Este proprietário possui ${warningParts.join(' e ')} vinculados. Os vínculos serão removidos automaticamente.`
          : undefined,
    });
  }

  async function confirmDeleteAction() {
    if (!deleteTarget) return;
    setDeletingBusy(true);
    try {
      if (deleteTarget.type === 'motorista') {
        const linkedVeiculos = veiculos.filter((v) => v.motoristaId === deleteTarget.id);
        for (const v of linkedVeiculos) {
          await updateVeiculo(v.id, v, {
            motoristaId: '',
            proprietarioId: v.proprietarioId && propMap.has(v.proprietarioId) ? v.proprietarioId : '',
          });
        }
        await deleteMotorista(deleteTarget.id);
        if (editingEntity?.type === 'motorista' && editingEntity.data.id === deleteTarget.id) {
          setEditingEntity(null);
        }
        showToast('success', 'Cadastro de motorista excluído.');
      } else if (deleteTarget.type === 'veiculo') {
        await deleteVeiculo(deleteTarget.id);
        if (editingEntity?.type === 'veiculo' && editingEntity.data.id === deleteTarget.id) {
          setEditingEntity(null);
        }
        showToast('success', 'Cadastro de veículo excluído.');
      } else if (deleteTarget.type === 'proprietario') {
        const linkedMotoristas = motoristas.filter((m) => m.proprietarioId === deleteTarget.id);
        for (const m of linkedMotoristas) {
          await updateMotorista(m.id, m, { proprietarioId: '' });
        }
        const linkedVeiculos = veiculos.filter((v) => v.proprietarioId === deleteTarget.id);
        for (const v of linkedVeiculos) {
          await updateVeiculo(v.id, v, { proprietarioId: '' });
        }
        await deleteProprietario(deleteTarget.id);
        if (selectedOwnerId === deleteTarget.id) {
          setSelectedOwnerId(null);
        }
        if (editingEntity?.type === 'proprietario' && editingEntity.data.id === deleteTarget.id) {
          setEditingEntity(null);
        }
        showToast('success', 'Cadastro de proprietário excluído.');
      } else {
        const docToDelete = documentos.find((d) => d.id === deleteTarget.id);
        await deleteFleetDocumentFile(docToDelete?.storagePath);
        await deleteDocumento(deleteTarget.id);
        showToast('success', 'Registro de documento excluído.');
      }
      setDeleteTarget(null);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Erro ao excluir registro.');
    } finally {
      setDeletingBusy(false);
    }
  }

  const selectFilterCls =
    'rounded-lg border border-slate-300 dark:border-white/[0.1] bg-white dark:bg-[#0F1520] px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 focus:border-blue-500 focus:outline-none';

  const inlineSelectCls =
    'w-full rounded-md border border-transparent bg-transparent px-2 py-1 text-xs text-slate-800 dark:text-slate-200 hover:border-slate-300 dark:hover:border-white/[0.12] hover:bg-white dark:hover:bg-[#0B0F17] focus:border-blue-500 focus:bg-white dark:focus:bg-[#0B0F17] focus:outline-none';

  const statusSelectCls =
    'rounded-md border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-[#0B0F17] px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:text-slate-200 focus:border-blue-500 focus:outline-none';

  const primaryNav = navItems.slice(0, 5);
  const secondaryNav = navItems.slice(5);

  const renderNavButton = (item: (typeof navItems)[number]) => {
    const Icon = item.icon;
    const active = activeSection === item.id;
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => {
          setActiveSection(item.id);
          setMobileNavOpen(false);
        }}
        className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-xs font-medium transition-colors duration-150 whitespace-nowrap ${
          active
            ? 'bg-blue-600 text-white shadow-xs shadow-blue-600/20'
            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/90 dark:hover:bg-white/[0.05] hover:text-slate-900 dark:hover:text-white'
        }`}
      >
        <span className="flex items-center gap-2.5">
          <Icon className="h-4 w-4 shrink-0" />
          <span>{item.label}</span>
        </span>
        {item.count !== undefined && (
          <span
            className={`font-mono text-[11px] tabular-nums ${
              active ? 'text-blue-100' : 'text-slate-400 dark:text-slate-500'
            }`}
          >
            {item.count}
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="flex min-h-screen bg-[#F4F6FA] dark:bg-[#07090E] text-slate-900 dark:text-slate-100">
      {/* Mobile Sidebar Backdrop */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-xs lg:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col border-r border-slate-200/80 dark:border-white/[0.07] bg-white dark:bg-[#0B0F17] text-slate-800 dark:text-slate-100 transition-transform lg:static lg:translate-x-0 ${
          mobileNavOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-white/[0.07] px-5 py-4">
          <div className="flex items-center gap-3">
            <BrandEmblem />
            <div className="min-w-0">
              <span className="block truncate text-sm font-bold tracking-tight text-slate-900 dark:text-white">
                El Nathan Transportes
              </span>
              <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                Gestão de Frota
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMobileNavOpen(false)}
            className="rounded-lg p-1.5 text-slate-400 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] hover:text-slate-900 dark:hover:text-white lg:hidden"
            aria-label="Fechar menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-5">
          <div className="space-y-1">
            <p className="px-3 pb-1 text-[11px] font-medium text-slate-400 dark:text-slate-500">
              Operação Documental
            </p>
            {primaryNav.map(renderNavButton)}
          </div>

          <div className="space-y-1 border-t border-slate-200/70 dark:border-white/[0.06] pt-4">
            <p className="px-3 pb-1 text-[11px] font-medium text-slate-400 dark:text-slate-500">
              Financeiro e Rotas
            </p>
            {secondaryNav.map(renderNavButton)}
          </div>
        </nav>

        {/* Theme Switcher & Operator Footer */}
        <div className="space-y-3 border-t border-slate-200/80 dark:border-white/[0.07] p-4">
          <div className="grid grid-cols-2 gap-1 rounded-lg border border-slate-200/90 dark:border-white/[0.08] bg-slate-100/90 dark:bg-[#07090E] p-1">
            <button
              type="button"
              onClick={() => setTheme('dark')}
              className={`inline-flex items-center justify-center gap-1.5 rounded-md py-1.5 text-[11px] font-medium transition-colors whitespace-nowrap ${
                theme === 'dark'
                  ? 'bg-[#161E2E] text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Moon className="h-3 w-3" />
              <span>Escuro</span>
            </button>
            <button
              type="button"
              onClick={() => setTheme('light')}
              className={`inline-flex items-center justify-center gap-1.5 rounded-md py-1.5 text-[11px] font-medium transition-colors whitespace-nowrap ${
                theme === 'light'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Sun className="h-3 w-3" />
              <span>Claro</span>
            </button>
          </div>

          <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200/75 dark:border-white/[0.06] bg-slate-50/70 dark:bg-white/[0.02] px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-slate-900 dark:text-white">
                {user.displayName || 'Operador Autorizado'}
              </p>
              <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                {user.email || 'Sessão ativa'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              title="Sair do sistema"
              className="rounded-md p-1.5 text-slate-400 dark:text-slate-400 transition-colors hover:bg-slate-200/70 dark:hover:bg-white/[0.08] hover:text-slate-900 dark:hover:text-white"
              aria-label="Sair"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/80 dark:border-white/[0.07] bg-white/90 dark:bg-[#07090E]/90 px-4 py-3 backdrop-blur-md sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="rounded-lg border border-slate-200 dark:border-white/[0.1] p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] lg:hidden"
              aria-label="Abrir menu"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="hidden sm:inline">El Nathan Transportes</span>
              <span aria-hidden="true" className="hidden sm:inline text-slate-300 dark:text-slate-600">
                /
              </span>
              <span className="text-sm font-semibold text-slate-900 dark:text-white">
                {sectionTitles[activeSection]}
              </span>
            </div>
          </div>

          <div className="flex flex-1 items-center justify-end gap-2.5 sm:gap-3">
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por nome, CPF/CNPJ ou placa..."
                className="w-full rounded-lg border border-slate-300/90 dark:border-white/[0.1] bg-slate-50 dark:bg-[#0F1520] py-1.5 pl-8.5 pr-3 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-blue-600 dark:focus:border-blue-500 focus:bg-white dark:focus:bg-[#0B0F17] focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <button
              type="button"
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300/90 dark:border-white/[0.1] bg-white dark:bg-[#0F1520] px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors hover:bg-slate-50 dark:hover:bg-white/[0.06] whitespace-nowrap shrink-0"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Exportar Excel</span>
            </button>

            <button
              type="button"
              onClick={() => setUploadModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white shadow-xs shadow-blue-600/20 transition-colors hover:bg-blue-500 whitespace-nowrap shrink-0"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Enviar Documento</span>
            </button>
          </div>
        </header>

        <main className="flex-1 space-y-6 p-4 sm:p-6">
          {toast && (
            <div
              className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-xs ${
                toast.type === 'success'
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
                  : 'border-red-500/30 bg-red-500/10 text-red-800 dark:text-red-300'
              }`}
            >
              <span className="flex items-center gap-2 font-medium">
                {toast.type === 'success' ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                ) : (
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                )}
                {toast.text}
              </span>
              <button
                type="button"
                onClick={() => setToast(null)}
                className="rounded p-0.5 text-current opacity-70 hover:opacity-100"
                aria-label="Fechar aviso"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {dataError && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-700 dark:text-red-300">
              Erro ao carregar dados: {dataError}
            </div>
          )}

          {/* PAINEL GERAL */}
          {activeSection === 'painel' && (
            <div className="space-y-6">
              {/* KPI Strip */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <button
                  type="button"
                  onClick={() => setActiveSection('motoristas')}
                  className="group rounded-xl border border-slate-200/90 dark:border-white/[0.08] bg-white dark:bg-[#0F1520] p-5 text-left transition-colors hover:border-blue-500/40 dark:hover:border-blue-400/35"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      Motoristas Cadastrados
                    </p>
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                      <Users className="h-4 w-4" />
                    </span>
                  </div>
                  <p className="mt-2 font-mono text-2xl font-semibold text-slate-900 dark:text-white tabular-nums">
                    {loadingData ? '—' : kpis.totalMotoristas}
                  </p>
                  <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400 tabular-nums">
                    {kpis.motAprovados} aprovados · {kpis.motEmAnalise} em análise
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSection('veiculos')}
                  className="group rounded-xl border border-slate-200/90 dark:border-white/[0.08] bg-white dark:bg-[#0F1520] p-5 text-left transition-colors hover:border-emerald-500/40 dark:hover:border-emerald-400/35"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      Veículos Disponíveis
                    </p>
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      <Truck className="h-4 w-4" />
                    </span>
                  </div>
                  <p className="mt-2 font-mono text-2xl font-semibold text-slate-900 dark:text-white tabular-nums">
                    {loadingData ? '—' : kpis.veiDisponiveis}
                    <span className="text-sm font-normal text-slate-400 dark:text-slate-500">
                      {' '}
                      / {kpis.totalVeiculos}
                    </span>
                  </p>
                  <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400">
                    Frota regularizada e com CRLV em dia
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSection('fretes')}
                  className="group rounded-xl border border-slate-200/90 dark:border-white/[0.08] bg-white dark:bg-[#0F1520] p-5 text-left transition-colors hover:border-emerald-500/40 dark:hover:border-emerald-400/35"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      Dias Trabalhados (Mês)
                    </p>
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      <CalendarDays className="h-4 w-4" />
                    </span>
                  </div>
                  <p className="mt-2 font-mono text-2xl font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">
                    {loadingData ? '—' : kpis.diasTrabalhadosMes}
                  </p>
                  <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400 tabular-nums">
                    {kpis.motoristasAtivosMes} motorista(s) · {formatBrl(kpis.totalDiariasMes)}
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSection('proprietarios')}
                  className="group rounded-xl border border-slate-200/90 dark:border-white/[0.08] bg-white dark:bg-[#0F1520] p-5 text-left transition-colors hover:border-blue-500/40 dark:hover:border-blue-400/35"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      Proprietários e Arquivos
                    </p>
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-500/10 text-slate-600 dark:text-slate-300">
                      <Building2 className="h-4 w-4" />
                    </span>
                  </div>
                  <p className="mt-2 font-mono text-2xl font-semibold text-slate-900 dark:text-white tabular-nums">
                    {loadingData ? '—' : kpis.totalProprietarios}
                  </p>
                  <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400 tabular-nums">
                    {documentos.length} documento(s) · {kpis.totalVencimentos} vencimento(s)
                  </p>
                </button>
              </div>

              {/* Operational Split */}
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                {/* Left Column: Recent Worked Days + Expiration Monitor */}
                <div className="space-y-6 xl:col-span-2">
                  <div className="rounded-xl border border-slate-200/90 dark:border-white/[0.08] bg-white dark:bg-[#0F1520]">
                    <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-white/[0.07] px-5 py-4">
                      <div>
                        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                          Rotas e Dias Trabalhados Recentes
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Acompanhamento direto da escala diária dos motoristas da frota
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveSection('fretes')}
                        className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow-xs hover:bg-blue-500 whitespace-nowrap"
                      >
                        Abrir Rotas
                      </button>
                    </div>

                    {loadingData ? (
                      <div className="p-6 text-xs text-slate-500 dark:text-slate-400">
                        Carregando registros...
                      </div>
                    ) : diasTrabalhados.length === 0 ? (
                      <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
                        <CalendarDays className="mb-2.5 h-7 w-7 text-blue-600 dark:text-blue-400" />
                        <p className="text-sm font-medium text-slate-800 dark:text-white">
                          Nenhum dia trabalhado lançado ainda
                        </p>
                        <p className="mt-1 max-w-md text-xs text-slate-500 dark:text-slate-400">
                          Acesse a aba Rotas & Diárias para registrar todos os dias trabalhados de cada motorista na folha mensal.
                        </p>
                        <button
                          type="button"
                          onClick={() => setActiveSection('fretes')}
                          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-500"
                        >
                          <CalendarDays className="h-3.5 w-3.5" />
                          Lançar Dias Trabalhados
                        </button>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-200/75 dark:divide-white/[0.06]">
                        {diasTrabalhados.slice(0, 6).map((d) => {
                          const driver = motMap.get(d.motoristaId);
                          return (
                            <div
                              key={d.id}
                              className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-xs transition-colors hover:bg-slate-50/90 dark:hover:bg-white/[0.025]"
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                                    {formatDatePtBr(d.data)}
                                  </span>
                                  <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                                    ·
                                  </span>
                                  <span className="truncate font-medium text-slate-900 dark:text-white">
                                    {driver?.nomeCompleto || 'Motorista'}
                                  </span>
                                  {d.placa && (
                                    <span className="rounded bg-slate-100 dark:bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-slate-700 dark:text-slate-300">
                                      {d.placa}
                                    </span>
                                  )}
                                </div>
                                <p className="mt-0.5 truncate text-slate-500 dark:text-slate-400">
                                  {d.rota || 'Rota padrão'} · {TURNO_TRABALHO_LABELS[d.turno]}
                                </p>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="font-mono font-medium text-slate-800 dark:text-slate-200 tabular-nums">
                                  {d.valorDiaria ? formatBrl(d.valorDiaria) : '—'}
                                </span>
                                <span
                                  className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${
                                    d.status === 'trabalhado'
                                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                      : d.status === 'falta'
                                        ? 'bg-red-500/15 text-red-700 dark:text-red-300'
                                        : 'bg-slate-200/80 dark:bg-white/[0.08] text-slate-700 dark:text-slate-300'
                                  }`}
                                >
                                  {STATUS_DIA_LABELS[d.status]}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {filteredPendencias.length > 0 && (
                    <div className="rounded-xl border border-slate-200/90 dark:border-white/[0.08] bg-white dark:bg-[#0F1520]">
                      <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-white/[0.07] px-5 py-3.5">
                        <div>
                          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                            Controle de Vencimentos (CNH / CRLV)
                          </h2>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Apenas documentos com data vencida ou vencimento nos próximos 30 dias
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveSection('documentos');
                            setPendenciaTab('vencimentos');
                          }}
                          className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
                        >
                          Ver todos
                        </button>
                      </div>
                      <div className="divide-y divide-slate-200/75 dark:divide-white/[0.06]">
                        {filteredPendencias.slice(0, 5).map((pen) => (
                          <div
                            key={pen.id}
                            className="flex items-center justify-between gap-4 px-5 py-3 text-xs"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`font-semibold ${
                                    pen.categoria === 'vencido'
                                      ? 'text-red-700 dark:text-red-400'
                                      : 'text-slate-800 dark:text-white'
                                  }`}
                                >
                                  {pen.categoria === 'vencido' ? 'Vencido' : 'A Vencer'}
                                </span>
                                <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                                  ·
                                </span>
                                <span className="truncate font-medium text-slate-900 dark:text-white">
                                  {pen.entidadeTitulo}
                                </span>
                              </div>
                              <p className="mt-0.5 truncate text-slate-500 dark:text-slate-400">
                                {pen.descricao}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Fleet Breakdown & Quick Actions */}
                <div className="space-y-6">
                  <div className="rounded-xl border border-slate-200/90 dark:border-white/[0.08] bg-white dark:bg-[#0F1520] p-5">
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                      Frota por Tipo de Veículo
                    </h2>
                    <div className="mt-4 space-y-3.5 text-xs">
                      {(['Van', 'HR', 'VUC', 'Médio'] as const).map((tipo) => {
                        const count = veiculos.filter((v) => v.tipoVeiculo === tipo).length;
                        const aprov = veiculos.filter(
                          (v) => v.tipoVeiculo === tipo && v.situacaoCadastral === 'aprovado'
                        ).length;
                        const pct =
                          veiculos.length > 0 ? Math.round((count / veiculos.length) * 100) : 0;
                        return (
                          <div key={tipo} className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-slate-700 dark:text-slate-200">
                                {tipo}
                              </span>
                              <span className="font-mono tabular-nums text-slate-900 dark:text-white">
                                {count}{' '}
                                <span className="text-slate-400 dark:text-slate-500">
                                  ({aprov} aprov.)
                                </span>
                              </span>
                            </div>
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-white/[0.06]">
                              <div
                                className="h-full rounded-full bg-blue-600 dark:bg-blue-500 transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                      <div className="flex items-center justify-between border-t border-slate-100 dark:border-white/[0.06] pt-3">
                        <span className="font-medium text-slate-600 dark:text-slate-300">
                          Sem categoria
                        </span>
                        <span className="font-mono tabular-nums text-slate-800 dark:text-white">
                          {veiculos.filter((v) => !v.tipoVeiculo).length}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200/90 dark:border-white/[0.08] bg-white dark:bg-[#0F1520] p-5">
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                      Ações Rápidas
                    </h2>
                    <div className="mt-3 grid grid-cols-1 gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveSection('fretes')}
                        className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-xs font-medium text-emerald-700 dark:text-emerald-300 transition-colors hover:bg-emerald-500/15"
                      >
                        <span>Lançar Dias Trabalhados (Rotas)</span>
                        <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setUploadModalOpen(true)}
                        className="flex items-center justify-between rounded-lg border border-blue-500/30 bg-blue-500/10 px-3.5 py-2.5 text-xs font-medium text-blue-700 dark:text-blue-300 transition-colors hover:bg-blue-500/15"
                      >
                        <span>Enviar PDF ou Imagem (Extração)</span>
                        <Upload className="h-3.5 w-3.5 shrink-0" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setManualModalMode('motorista')}
                        className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-white/[0.08] bg-slate-50/70 dark:bg-[#0B0F17] px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors hover:bg-slate-100 dark:hover:bg-white/[0.05]"
                      >
                        <span>Novo Motorista</span>
                        <Plus className="h-3.5 w-3.5 shrink-0" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setManualModalMode('veiculo')}
                        className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-white/[0.08] bg-slate-50/70 dark:bg-[#0B0F17] px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors hover:bg-slate-100 dark:hover:bg-white/[0.05]"
                      >
                        <span>Novo Veículo</span>
                        <Plus className="h-3.5 w-3.5 shrink-0" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setManualModalMode('proprietario')}
                        className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-white/[0.08] bg-slate-50/70 dark:bg-[#0B0F17] px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors hover:bg-slate-100 dark:hover:bg-white/[0.05]"
                      >
                        <span>Novo Proprietário</span>
                        <Plus className="h-3.5 w-3.5 shrink-0" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* MOTORISTAS TABLE */}
          {activeSection === 'motoristas' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-1 rounded-xl border border-slate-200/90 dark:border-white/[0.08] bg-slate-100/90 dark:bg-white/[0.03] p-1">
                  {SITUACAO_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setSituacaoFilter(opt.value)}
                      className={`rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                        situacaoFilter === opt.value
                          ? opt.value === 'aprovado'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-white dark:bg-[#182234] text-slate-900 dark:text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={proprietarioFilter}
                    onChange={(e) => setProprietarioFilter(e.target.value)}
                    className={selectFilterCls}
                  >
                    <option value="todos">Todos os Proprietários</option>
                    {proprietarios.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nomeCompleto}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setManualModalMode('motorista')}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-medium text-white shadow-xs hover:bg-blue-500 whitespace-nowrap"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Novo Motorista
                  </button>
                </div>
              </div>

              <ScrollableTableCard header="Planilha editável: clique em qualquer campo para editar diretamente. Motoristas aprovados ficam destacados em verde.">
                <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200/80 dark:border-white/[0.07] bg-slate-50/90 dark:bg-white/[0.025] text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                        <th className="sticky left-0 z-10 min-w-[185px] border-r border-slate-200/80 dark:border-white/[0.07] bg-slate-50 dark:bg-[#111827] px-3.5 py-3">
                          Nome Completo
                        </th>
                        <th className="px-3.5 py-3">CPF</th>
                        <th className="px-3.5 py-3">CNH</th>
                        <th className="px-3.5 py-3">Cat.</th>
                        <th className="px-3.5 py-3">Validade CNH</th>
                        <th className="px-3.5 py-3">Telefone</th>
                        <th className="px-3.5 py-3">Placa</th>
                        <th className="px-3.5 py-3">Rota Padrão</th>
                        <th className="px-3.5 py-3">Diária Padrão</th>
                        <th className="px-3.5 py-3">Proprietário</th>
                        <th className="px-3.5 py-3">Situação</th>
                        <th className="px-3.5 py-3 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/75 dark:divide-white/[0.06]">
                      {filteredMotoristas.length === 0 ? (
                        <tr>
                          <td
                            colSpan={12}
                            className="px-4 py-12 text-center text-xs text-slate-500 dark:text-slate-400"
                          >
                            Nenhum motorista encontrado para os filtros aplicados.
                          </td>
                        </tr>
                      ) : (
                        filteredMotoristas.map((m) => {
                          const cnhExpiryStatus = evaluateDateStatus(m.validadeCnh);
                          const isApproved = m.situacaoCadastral === 'aprovado';
                          const cellTone = isApproved ? 'emerald' : 'default';
                          const linkedVehiclePlate = motPlateByVehicleMap.get(m.id) || '';
                          const safeOwnerId =
                            m.proprietarioId && propMap.has(m.proprietarioId) ? m.proprietarioId : '';
                          const saveMotPatch = (
                            patch: Parameters<typeof updateMotorista>[2],
                            msg: string
                          ) =>
                            safeAction(
                              () =>
                                updateMotorista(m.id, m, {
                                  ...(patch.proprietarioId === undefined &&
                                  m.proprietarioId !== safeOwnerId
                                    ? { proprietarioId: '' }
                                    : {}),
                                  ...patch,
                                }),
                              msg
                            );
                          return (
                            <tr
                              key={m.id}
                              className={`transition-colors ${
                                isApproved
                                  ? 'bg-emerald-50/85 dark:bg-emerald-950/35 hover:bg-emerald-100/70 dark:hover:bg-emerald-950/55'
                                  : 'hover:bg-slate-50/90 dark:hover:bg-white/[0.025]'
                              }`}
                            >
                              <td
                                className={`sticky left-0 z-10 min-w-[185px] border-r border-slate-200/80 dark:border-white/[0.07] px-2.5 py-2 ${
                                  isApproved
                                    ? 'bg-emerald-50 dark:bg-[#0D211B]'
                                    : 'bg-white dark:bg-[#0F1520]'
                                }`}
                              >
                                <EditableCell
                                  value={m.nomeCompleto}
                                  tone={cellTone}
                                  onError={(err) =>
                                    showToast(
                                      'error',
                                      err instanceof Error ? err.message : 'Erro ao salvar nome.'
                                    )
                                  }
                                  onSave={async (val) => {
                                    await saveMotPatch(
                                      { nomeCompleto: val },
                                      'Nome do motorista atualizado.'
                                    );
                                  }}
                                />
                                {m.observacoes && (
                                  <span
                                    className={`block max-w-[220px] truncate px-2 text-[10px] ${
                                      isApproved
                                        ? 'text-emerald-700/80 dark:text-emerald-400/80'
                                        : 'text-slate-400 dark:text-slate-500'
                                    }`}
                                  >
                                    Obs.: {m.observacoes}
                                  </span>
                                )}
                              </td>
                              <td className="px-2.5 py-2 min-w-[130px]">
                                <EditableCell
                                  value={m.cpf}
                                  mono
                                  tone={cellTone}
                                  onSave={async (val) => {
                                    await saveMotPatch({ cpf: val }, 'CPF atualizado.');
                                  }}
                                />
                              </td>
                              <td className="px-2.5 py-2 min-w-[120px]">
                                <EditableCell
                                  value={m.cnh}
                                  mono
                                  tone={cellTone}
                                  onSave={async (val) => {
                                    await saveMotPatch({ cnh: val }, 'CNH atualizada.');
                                  }}
                                />
                              </td>
                              <td className="px-2.5 py-2 w-[75px]">
                                <EditableCell
                                  value={m.categoriaCnh}
                                  mono
                                  tone={cellTone}
                                  onSave={async (val) => {
                                    await saveMotPatch(
                                      { categoriaCnh: val },
                                      'Categoria da CNH atualizada.'
                                    );
                                  }}
                                />
                              </td>
                              <td className="px-2.5 py-2 min-w-[130px]">
                                <EditableCell
                                  value={m.validadeCnh}
                                  type="date"
                                  mono
                                  tone={cellTone}
                                  displayValue={formatDatePtBr(m.validadeCnh)}
                                  onSave={async (val) => {
                                    const nextSit = suggestSituacaoMotorista({
                                      ...m,
                                      validadeCnh: val,
                                    });
                                    await saveMotPatch(
                                      {
                                        validadeCnh: val,
                                        situacaoCadastral: nextSit,
                                      },
                                      'Validade da CNH atualizada.'
                                    );
                                  }}
                                />
                                {cnhExpiryStatus === 'vencido' ? (
                                  <span className="block px-2 text-[10px] font-medium text-red-700 dark:text-red-400">
                                    CNH vencida
                                  </span>
                                ) : cnhExpiryStatus === 'a_vencer' ? (
                                  <span className="block px-2 text-[10px] font-medium text-slate-700 dark:text-white">
                                    Vence em breve
                                  </span>
                                ) : isApproved && cnhExpiryStatus === 'valido' ? (
                                  <span className="block px-2 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                                    CNH em dia
                                  </span>
                                ) : null}
                              </td>
                              <td className="px-2.5 py-2 min-w-[130px]">
                                <EditableCell
                                  value={m.telefone}
                                  tone={cellTone}
                                  onSave={async (val) => {
                                    await saveMotPatch({ telefone: val }, 'Telefone atualizado.');
                                  }}
                                />
                              </td>
                              <td className="px-2.5 py-2 min-w-[115px]">
                                <EditableCell
                                  value={m.placa || linkedVehiclePlate}
                                  mono
                                  tone={cellTone}
                                  placeholder="Placa"
                                  onSave={async (val) => {
                                    await saveMotPatch(
                                      { placa: val.toUpperCase() },
                                      'Placa do motorista atualizada.'
                                    );
                                  }}
                                />
                              </td>
                              <td className="px-2.5 py-2 min-w-[155px]">
                                <EditableCell
                                  value={m.rotaPadrao || ''}
                                  tone={cellTone}
                                  placeholder="Definir rota"
                                  onSave={async (val) => {
                                    await saveMotPatch(
                                      { rotaPadrao: val },
                                      'Rota padrão atualizada.'
                                    );
                                  }}
                                />
                              </td>
                              <td className="px-2.5 py-2 min-w-[115px]">
                                <EditableCell
                                  value={String(m.valorDiariaPadrao || 0)}
                                  mono
                                  tone={cellTone}
                                  displayValue={
                                    m.valorDiariaPadrao ? formatBrl(m.valorDiariaPadrao) : '—'
                                  }
                                  onSave={async (val) => {
                                    const parsed = Number(val.replace(',', '.'));
                                    if (Number.isFinite(parsed) && parsed >= 0) {
                                      await saveMotPatch(
                                        { valorDiariaPadrao: parsed },
                                        'Diária padrão atualizada.'
                                      );
                                    }
                                  }}
                                />
                              </td>
                              <td className="px-2.5 py-2 min-w-[160px]">
                                <select
                                  value={safeOwnerId}
                                  onChange={async (e) => {
                                    await saveMotPatch(
                                      { proprietarioId: e.target.value },
                                      'Vínculo com proprietário atualizado.'
                                    );
                                  }}
                                  className={
                                    isApproved
                                      ? 'w-full rounded-md border border-transparent bg-transparent px-2 py-1 text-xs font-medium text-emerald-800 dark:text-emerald-300 hover:border-emerald-300 dark:hover:border-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/70 focus:border-emerald-500 focus:bg-white dark:focus:bg-[#0B0F17] focus:outline-none'
                                      : inlineSelectCls
                                  }
                                >
                                  <option value="">Sem vínculo</option>
                                  {proprietarios.map((p) => (
                                    <option key={p.id} value={p.id}>
                                      {p.nomeCompleto}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="px-2.5 py-2 min-w-[165px]">
                                <div className="flex flex-col gap-1">
                                  <SituacaoIndicator situacao={m.situacaoCadastral} />
                                  <select
                                    value={m.situacaoCadastral}
                                    aria-label={`Situação cadastral de ${m.nomeCompleto}`}
                                    onChange={async (e) => {
                                      const nextSit = e.target.value as SituacaoCadastral;
                                      await saveMotPatch(
                                        { situacaoCadastral: nextSit },
                                        `Status de ${m.nomeCompleto} atualizado para ${SITUACAO_LABELS[nextSit]}.`
                                      );
                                    }}
                                    className={
                                      isApproved
                                        ? 'rounded-md border border-emerald-400/70 dark:border-emerald-700/70 bg-emerald-100/80 dark:bg-emerald-950/70 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:text-emerald-300 focus:border-emerald-500 focus:outline-none'
                                        : statusSelectCls
                                    }
                                  >
                                    {(Object.keys(SITUACAO_LABELS) as SituacaoCadastral[]).map(
                                      (st) => (
                                        <option key={st} value={st}>
                                          {SITUACAO_LABELS[st]}
                                        </option>
                                      )
                                    )}
                                  </select>
                                  {m.statusAtualizadoEm && (
                                    <span
                                      className={`font-mono text-[10px] ${
                                        isApproved
                                          ? 'text-emerald-700/75 dark:text-emerald-400/75'
                                          : 'text-slate-400 dark:text-slate-500'
                                      }`}
                                    >
                                      Alt.: {formatIsoDateTimePtBr(m.statusAtualizadoEm)}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-3.5 py-2 text-right">
                                <div className="inline-flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setEditingEntity({ type: 'motorista', data: m })}
                                    className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium whitespace-nowrap ${
                                      isApproved
                                        ? 'border-emerald-300 dark:border-emerald-700/70 bg-emerald-100/70 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-200/70 dark:hover:bg-emerald-900/60'
                                        : 'border-slate-300 dark:border-white/[0.1] bg-white dark:bg-[#0B0F17] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.06]'
                                    }`}
                                    title="Editar motorista e status"
                                  >
                                    <Pencil className="h-3 w-3" />
                                    Editar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => requestDeleteMotorista(m)}
                                    className="inline-flex items-center gap-1 rounded-md border border-transparent p-1.5 text-slate-400 dark:text-slate-500 hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400"
                                    title="Excluir motorista"
                                    aria-label={`Excluir motorista ${m.nomeCompleto}`}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
              </ScrollableTableCard>
            </div>
          )}

          {/* VEICULOS TABLE */}
          {activeSection === 'veiculos' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-1 rounded-xl border border-slate-200/90 dark:border-white/[0.08] bg-slate-100/90 dark:bg-white/[0.03] p-1">
                  {SITUACAO_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setSituacaoFilter(opt.value)}
                      className={`rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                        situacaoFilter === opt.value
                          ? 'bg-white dark:bg-[#182234] text-slate-900 dark:text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={tipoVeiculoFilter}
                    onChange={(e) =>
                      setTipoVeiculoFilter(e.target.value as 'todos' | TipoVeiculo)
                    }
                    className={selectFilterCls}
                  >
                    {TIPO_VEICULO_OPTIONS.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={proprietarioFilter}
                    onChange={(e) => setProprietarioFilter(e.target.value)}
                    className={selectFilterCls}
                  >
                    <option value="todos">Todos os Proprietários</option>
                    {proprietarios.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nomeCompleto}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setManualModalMode('veiculo')}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-medium text-white shadow-xs hover:bg-blue-500 whitespace-nowrap"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Novo Veículo
                  </button>
                </div>
              </div>

              <ScrollableTableCard header="Planilha editável da frota: clique em qualquer célula para atualizar placa, modelo, marca, ano, RENAVAM, tipo (Van, HR, VUC, Médio) ou proprietário.">
                <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200/80 dark:border-white/[0.07] bg-slate-50/90 dark:bg-white/[0.025] text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                        <th className="sticky left-0 z-10 min-w-[105px] border-r border-slate-200/80 dark:border-white/[0.07] bg-slate-50 dark:bg-[#111827] px-3.5 py-3">
                          Placa
                        </th>
                        <th className="px-3.5 py-3">Marca</th>
                        <th className="px-3.5 py-3">Modelo</th>
                        <th className="px-3.5 py-3">Ano</th>
                        <th className="px-3.5 py-3">RENAVAM</th>
                        <th className="px-3.5 py-3">Tipo</th>
                        <th className="px-3.5 py-3">Proprietário</th>
                        <th className="px-3.5 py-3">Motorista</th>
                        <th className="px-3.5 py-3">Validade CRLV</th>
                        <th className="px-3.5 py-3">Situação</th>
                        <th className="px-3.5 py-3 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/75 dark:divide-white/[0.06]">
                      {filteredVeiculos.length === 0 ? (
                        <tr>
                          <td
                            colSpan={11}
                            className="px-4 py-12 text-center text-xs text-slate-500 dark:text-slate-400"
                          >
                            Nenhum veículo encontrado para os filtros aplicados.
                          </td>
                        </tr>
                      ) : (
                        filteredVeiculos.map((v) => {
                          const crlvStatus = evaluateDateStatus(v.validadeCrlv);
                          const safePropId =
                            v.proprietarioId && propMap.has(v.proprietarioId)
                              ? v.proprietarioId
                              : '';
                          const safeMotId =
                            v.motoristaId && motMap.has(v.motoristaId) ? v.motoristaId : '';
                          const saveVeiPatch = (
                            patch: Parameters<typeof updateVeiculo>[2],
                            msg?: string
                          ) =>
                            safeAction(
                              () =>
                                updateVeiculo(v.id, v, {
                                  ...(patch.proprietarioId === undefined &&
                                  v.proprietarioId !== safePropId
                                    ? { proprietarioId: '' }
                                    : {}),
                                  ...(patch.motoristaId === undefined &&
                                  v.motoristaId !== safeMotId
                                    ? { motoristaId: '' }
                                    : {}),
                                  ...patch,
                                }),
                              msg
                            );
                          return (
                            <tr
                              key={v.id}
                              className="transition-colors hover:bg-slate-50/90 dark:hover:bg-white/[0.025]"
                            >
                              <td className="sticky left-0 z-10 min-w-[105px] border-r border-slate-200/80 dark:border-white/[0.07] bg-white dark:bg-[#0F1520] px-2.5 py-2">
                                <EditableCell
                                  value={v.placa}
                                  mono
                                  onSave={async (val) => {
                                    await saveVeiPatch({ placa: val }, 'Placa atualizada.');
                                  }}
                                />
                              </td>
                              <td className="px-2.5 py-2 min-w-[110px]">
                                <EditableCell
                                  value={v.marca}
                                  onSave={async (val) => {
                                    await saveVeiPatch({ marca: val }, 'Marca atualizada.');
                                  }}
                                />
                              </td>
                              <td className="px-2.5 py-2 min-w-[140px]">
                                <EditableCell
                                  value={v.modelo}
                                  onSave={async (val) => {
                                    await saveVeiPatch({ modelo: val }, 'Modelo atualizado.');
                                  }}
                                />
                              </td>
                              <td className="px-2.5 py-2 w-[90px]">
                                <EditableCell
                                  value={v.ano}
                                  mono
                                  onSave={async (val) => {
                                    await saveVeiPatch({ ano: val }, 'Ano atualizado.');
                                  }}
                                />
                              </td>
                              <td className="px-2.5 py-2 min-w-[125px]">
                                <EditableCell
                                  value={v.renavam}
                                  mono
                                  onSave={async (val) => {
                                    await saveVeiPatch({ renavam: val }, 'RENAVAM atualizado.');
                                  }}
                                />
                              </td>
                              <td className="px-2.5 py-2 min-w-[105px]">
                                <select
                                  value={v.tipoVeiculo}
                                  onChange={async (e) => {
                                    await saveVeiPatch(
                                      { tipoVeiculo: e.target.value as TipoVeiculo },
                                      'Tipo de veículo atualizado.'
                                    );
                                  }}
                                  className={inlineSelectCls}
                                >
                                  <option value="">Sem categoria</option>
                                  <option value="Van">Van</option>
                                  <option value="HR">HR</option>
                                  <option value="VUC">VUC</option>
                                  <option value="Médio">Médio</option>
                                </select>
                              </td>
                              <td className="px-2.5 py-2 min-w-[155px]">
                                <select
                                  value={safePropId}
                                  onChange={async (e) => {
                                    await saveVeiPatch(
                                      { proprietarioId: e.target.value },
                                      'Proprietário do veículo atualizado.'
                                    );
                                  }}
                                  className={inlineSelectCls}
                                >
                                  <option value="">Sem vínculo</option>
                                  {proprietarios.map((p) => (
                                    <option key={p.id} value={p.id}>
                                      {p.nomeCompleto}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="px-2.5 py-2 min-w-[145px]">
                                <select
                                  value={safeMotId}
                                  onChange={async (e) => {
                                    await saveVeiPatch(
                                      { motoristaId: e.target.value },
                                      'Motorista do veículo atualizado.'
                                    );
                                  }}
                                  className={inlineSelectCls}
                                >
                                  <option value="">Não vinculado</option>
                                  {motoristas.map((m) => (
                                    <option key={m.id} value={m.id}>
                                      {m.nomeCompleto}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="px-2.5 py-2 min-w-[125px]">
                                <EditableCell
                                  value={v.validadeCrlv}
                                  type="date"
                                  mono
                                  displayValue={formatDatePtBr(v.validadeCrlv)}
                                  onSave={async (val) => {
                                    const nextSit = suggestSituacaoVeiculo({
                                      ...v,
                                      validadeCrlv: val,
                                    });
                                    await saveVeiPatch(
                                      {
                                        validadeCrlv: val,
                                        situacaoCadastral: nextSit,
                                      },
                                      'Validade do CRLV atualizada.'
                                    );
                                  }}
                                />
                                {crlvStatus === 'vencido' && (
                                  <span className="block px-2 text-[10px] font-medium text-red-700 dark:text-red-400">
                                    CRLV vencido
                                  </span>
                                )}
                              </td>
                              <td className="px-2.5 py-2 min-w-[155px]">
                                <div className="flex flex-col gap-1">
                                  <SituacaoIndicator situacao={v.situacaoCadastral} />
                                  <select
                                    value={v.situacaoCadastral}
                                    onChange={async (e) => {
                                      const nextSit = e.target.value as SituacaoCadastral;
                                      await saveVeiPatch(
                                        { situacaoCadastral: nextSit },
                                        `Status do veículo ${v.placa} atualizado.`
                                      );
                                    }}
                                    className={statusSelectCls}
                                  >
                                    {(Object.keys(SITUACAO_LABELS) as SituacaoCadastral[]).map(
                                      (st) => (
                                        <option key={st} value={st}>
                                          {SITUACAO_LABELS[st]}
                                        </option>
                                      )
                                    )}
                                  </select>
                                </div>
                              </td>
                              <td className="px-3.5 py-2 text-right">
                                <div className="inline-flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setEditingEntity({ type: 'veiculo', data: v })}
                                    className="inline-flex items-center gap-1 rounded-md border border-slate-300 dark:border-white/[0.1] bg-white dark:bg-[#0B0F17] px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.06] whitespace-nowrap"
                                    title="Editar veículo"
                                  >
                                    <Pencil className="h-3 w-3" />
                                    Editar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => requestDeleteVeiculo(v)}
                                    className="rounded-md p-1.5 text-slate-400 dark:text-slate-500 hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400"
                                    title="Excluir veículo"
                                    aria-label={`Excluir veículo ${v.placa}`}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
              </ScrollableTableCard>
            </div>
          )}

          {/* PROPRIETARIOS TABLE */}
          {activeSection === 'proprietarios' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-1 rounded-xl border border-slate-200/90 dark:border-white/[0.08] bg-slate-100/90 dark:bg-white/[0.03] p-1">
                  {SITUACAO_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setSituacaoFilter(opt.value)}
                      className={`rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                        situacaoFilter === opt.value
                          ? 'bg-white dark:bg-[#182234] text-slate-900 dark:text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setManualModalMode('proprietario')}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-medium text-white shadow-xs hover:bg-blue-500 whitespace-nowrap"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Novo Proprietário
                </button>
              </div>

              <ScrollableTableCard header="Selecione um motorista cadastrado diretamente na linha do proprietário ou clique em Vínculos para administrar motoristas e veículos.">
                <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200/80 dark:border-white/[0.07] bg-slate-50/90 dark:bg-white/[0.025] text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                        <th className="sticky left-0 z-10 min-w-[195px] border-r border-slate-200/80 dark:border-white/[0.07] bg-slate-50 dark:bg-[#111827] px-3.5 py-3">
                          Nome Completo / Razão Social
                        </th>
                        <th className="px-3.5 py-3">CPF / CNPJ</th>
                        <th className="px-3.5 py-3">Contato</th>
                        <th className="px-3.5 py-3">Motoristas (Cadastrados)</th>
                        <th className="px-3.5 py-3">Veículos</th>
                        <th className="px-3.5 py-3">Situação</th>
                        <th className="px-3.5 py-3 text-right">Vínculos / Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/75 dark:divide-white/[0.06]">
                      {filteredProprietarios.length === 0 ? (
                        <tr>
                          <td
                            colSpan={7}
                            className="px-4 py-12 text-center text-xs text-slate-500 dark:text-slate-400"
                          >
                            Nenhum proprietário cadastrado ainda.
                          </td>
                        </tr>
                      ) : (
                        filteredProprietarios.map((p) => {
                          const linkedVei = veiculos.filter((v) => v.proprietarioId === p.id);
                          const linkedMot = motoristas.filter((m) => m.proprietarioId === p.id);
                          const selectableMotoristas = motoristas.filter(
                            (m) => m.proprietarioId !== p.id
                          );
                          return (
                            <tr
                              key={p.id}
                              className="transition-colors hover:bg-slate-50/90 dark:hover:bg-white/[0.025]"
                            >
                              <td className="sticky left-0 z-10 min-w-[195px] border-r border-slate-200/80 dark:border-white/[0.07] bg-white dark:bg-[#0F1520] px-2.5 py-2">
                                <EditableCell
                                  value={p.nomeCompleto}
                                  onSave={async (val) => {
                                    await safeAction(
                                      () => updateProprietario(p.id, { nomeCompleto: val }),
                                      'Nome do proprietário atualizado.'
                                    );
                                  }}
                                />
                              </td>
                              <td className="px-2.5 py-2 min-w-[140px]">
                                <EditableCell
                                  value={p.cpfCnpj}
                                  mono
                                  onSave={async (val) => {
                                    await safeAction(
                                      () => updateProprietario(p.id, { cpfCnpj: val }),
                                      'CPF/CNPJ atualizado.'
                                    );
                                  }}
                                />
                              </td>
                              <td className="px-2.5 py-2 min-w-[150px]">
                                <EditableCell
                                  value={p.contato}
                                  onSave={async (val) => {
                                    await safeAction(
                                      () => updateProprietario(p.id, { contato: val }),
                                      'Contato atualizado.'
                                    );
                                  }}
                                />
                              </td>
                              <td className="px-2.5 py-2 min-w-[230px]">
                                <div className="space-y-1.5">
                                  {linkedMot.length > 0 && (
                                    <div className="flex flex-wrap gap-1">
                                      {linkedMot.map((m) => (
                                        <span
                                          key={m.id}
                                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#0B0F17] px-2 py-0.5 text-[11px] font-medium text-slate-800 dark:text-slate-200"
                                        >
                                          <span className="max-w-[140px] truncate">
                                            {m.nomeCompleto}
                                          </span>
                                          <button
                                            type="button"
                                            onClick={async () => {
                                              await safeAction(
                                                () =>
                                                  updateMotorista(m.id, m, { proprietarioId: '' }),
                                                `Motorista "${m.nomeCompleto}" desvinculado.`
                                              );
                                            }}
                                            className="rounded p-0.5 text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400"
                                            title="Desvincular motorista"
                                            aria-label={`Desvincular motorista ${m.nomeCompleto}`}
                                          >
                                            <X className="h-3 w-3" />
                                          </button>
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                  <select
                                    value=""
                                    onChange={async (e) => {
                                      const motId = e.target.value;
                                      if (!motId) return;
                                      const target = motoristas.find((m) => m.id === motId);
                                      if (!target) return;
                                      await safeAction(
                                        () =>
                                          updateMotorista(target.id, target, {
                                            proprietarioId: p.id,
                                          }),
                                        `Motorista "${target.nomeCompleto}" vinculado a ${p.nomeCompleto}.`
                                      );
                                    }}
                                    className={`w-full rounded-md border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-[#0B0F17] px-2 py-1 text-[11px] focus:border-blue-500 focus:outline-none ${
                                      linkedMot.length === 0
                                        ? 'font-medium text-slate-800 dark:text-white'
                                        : 'text-slate-600 dark:text-slate-300'
                                    }`}
                                  >
                                    <option value="">
                                      {motoristas.length === 0
                                        ? 'Nenhum motorista cadastrado'
                                        : linkedMot.length === 0
                                          ? 'Selecionar motorista cadastrado...'
                                          : '+ Vincular outro motorista...'}
                                    </option>
                                    {selectableMotoristas.map((m) => {
                                      const currentOwner = m.proprietarioId
                                        ? propMap.get(m.proprietarioId)?.nomeCompleto
                                        : '';
                                      return (
                                        <option key={m.id} value={m.id}>
                                          {m.nomeCompleto}
                                          {m.cpf ? ` (${m.cpf})` : ''}
                                          {currentOwner ? ` · Atual: ${currentOwner}` : ''}
                                        </option>
                                      );
                                    })}
                                  </select>
                                </div>
                              </td>
                              <td className="px-3.5 py-2 text-xs text-slate-700 dark:text-slate-300 tabular-nums">
                                <span className="font-mono font-medium">{linkedVei.length}</span>{' '}
                                {linkedVei.length === 1 ? 'veículo' : 'veículos'}
                                {linkedVei.length > 0 && (
                                  <span className="mt-0.5 block font-mono text-[10px] text-slate-500 dark:text-slate-400">
                                    {linkedVei.map((v) => v.placa).join(', ')}
                                  </span>
                                )}
                              </td>
                              <td className="px-2.5 py-2 min-w-[155px]">
                                <div className="flex flex-col gap-1">
                                  <SituacaoIndicator situacao={p.situacaoCadastral} />
                                  <select
                                    value={p.situacaoCadastral}
                                    onChange={async (e) => {
                                      const nextSit = e.target.value as SituacaoCadastral;
                                      await safeAction(
                                        () =>
                                          updateProprietario(p.id, {
                                            situacaoCadastral: nextSit,
                                          }),
                                        `Status de ${p.nomeCompleto} atualizado.`
                                      );
                                    }}
                                    className={statusSelectCls}
                                  >
                                    {(Object.keys(SITUACAO_LABELS) as SituacaoCadastral[]).map(
                                      (st) => (
                                        <option key={st} value={st}>
                                          {SITUACAO_LABELS[st]}
                                        </option>
                                      )
                                    )}
                                  </select>
                                </div>
                              </td>
                              <td className="px-3.5 py-2 text-right">
                                <div className="inline-flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setEditingEntity({ type: 'proprietario', data: p })
                                    }
                                    className="inline-flex items-center gap-1 rounded-md border border-slate-300 dark:border-white/[0.1] bg-white dark:bg-[#0B0F17] px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.06] whitespace-nowrap"
                                    title="Editar proprietário"
                                  >
                                    <Pencil className="h-3 w-3" />
                                    Editar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setSelectedOwnerId(p.id)}
                                    className="rounded-md border border-slate-300 dark:border-white/[0.1] bg-white dark:bg-[#0B0F17] px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.06] whitespace-nowrap"
                                  >
                                    Vínculos
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => requestDeleteProprietario(p)}
                                    className="rounded-md p-1.5 text-slate-400 dark:text-slate-500 hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400"
                                    title="Excluir proprietário"
                                    aria-label={`Excluir proprietário ${p.nomeCompleto}`}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
              </ScrollableTableCard>
            </div>
          )}

          {/* DOCUMENTACAO & VENCIMENTOS */}
          {activeSection === 'documentos' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-1 rounded-xl border border-slate-200/90 dark:border-white/[0.08] bg-slate-100/90 dark:bg-white/[0.03] p-1">
                  <button
                    type="button"
                    onClick={() => setPendenciaTab('documentos')}
                    className={`rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                      pendenciaTab === 'documentos'
                        ? 'bg-white dark:bg-[#182234] text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Arquivos Enviados ({filteredDocumentos.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendenciaTab('vencimentos')}
                    className={`rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                      pendenciaTab === 'vencimentos'
                        ? 'bg-white dark:bg-[#182234] text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Controle de Vencimentos ({filteredPendencias.length})
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setUploadModalOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-medium text-white shadow-xs hover:bg-blue-500 whitespace-nowrap"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Enviar Novo Documento
                </button>
              </div>

              {pendenciaTab === 'vencimentos' ? (
                <ScrollableTableCard
                  header="Documentos com validade vencida ou próxima do vencimento."
                  headerRight={
                    <div className="flex flex-wrap items-center gap-1">
                      {(
                        [
                          { id: 'todos', label: 'Todos' },
                          { id: 'vencidos', label: 'Vencidos' },
                          { id: '7d', label: 'Até 7d' },
                          { id: '15d', label: 'Até 15d' },
                          { id: '30d', label: 'Até 30d' },
                        ] as const
                      ).map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setVencimentoWindowFilter(opt.id)}
                          className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors whitespace-nowrap ${
                            vencimentoWindowFilter === opt.id
                              ? opt.id === 'vencidos'
                                ? 'bg-red-600 text-white'
                                : 'bg-blue-600 text-white'
                              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-white/[0.06]'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  }
                >
                  <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200/80 dark:border-white/[0.07] bg-slate-50/90 dark:bg-white/[0.025] text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                          <th className="px-4 py-3">Situação da Validade</th>
                          <th className="px-4 py-3">Prazo</th>
                          <th className="px-4 py-3">Cadastro</th>
                          <th className="px-4 py-3">Identificação</th>
                          <th className="px-4 py-3">Detalhe do Vencimento</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/75 dark:divide-white/[0.06]">
                        {filteredPendencias.length === 0 ? (
                          <tr>
                            <td
                              colSpan={5}
                              className="px-4 py-12 text-center text-xs text-slate-500 dark:text-slate-400"
                            >
                              Nenhum documento encontrado para este filtro de vencimento.
                            </td>
                          </tr>
                        ) : (
                          filteredPendencias.map((pen) => (
                            <tr
                              key={pen.id}
                              className="transition-colors hover:bg-slate-50/90 dark:hover:bg-white/[0.025]"
                            >
                              <td className="px-4 py-3 font-medium whitespace-nowrap">
                                {pen.categoria === 'vencido' ? (
                                  <span className="inline-flex items-center gap-1.5 text-red-700 dark:text-red-400">
                                    Vencido
                                  </span>
                                ) : (
                                  <span className="text-slate-800 dark:text-white">
                                    A Vencer
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 font-mono text-[11px] whitespace-nowrap">
                                {pen.diasRestantes !== undefined ? (
                                  <span
                                    className={
                                      pen.diasRestantes < 0
                                        ? 'font-semibold text-red-700 dark:text-red-400'
                                        : 'text-slate-700 dark:text-slate-200'
                                    }
                                  >
                                    {pen.diasRestantes < 0
                                      ? `${Math.abs(pen.diasRestantes)}d em atraso`
                                      : pen.diasRestantes === 0
                                        ? 'Vence hoje'
                                        : `Em ${pen.diasRestantes}d`}
                                  </span>
                                ) : (
                                  '—'
                                )}
                              </td>
                              <td className="px-4 py-3 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                                {pen.entidadeTipo}
                              </td>
                              <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                                {pen.entidadeTitulo}
                              </td>
                              <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                                {pen.descricao}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                </ScrollableTableCard>
              ) : (
                <ScrollableTableCard header="Arquivos enviados e datas de validade extraídas ou editáveis.">
                  <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200/80 dark:border-white/[0.07] bg-slate-50/90 dark:bg-white/[0.025] text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                          <th className="px-3.5 py-3">Tipo</th>
                          <th className="px-3.5 py-3">Arquivo Enviado</th>
                          <th className="px-3.5 py-3">Vínculo</th>
                          <th className="px-3.5 py-3">Validade</th>
                          <th className="px-3.5 py-3">Status</th>
                          <th className="px-3.5 py-3">Resumo da Extração</th>
                          <th className="px-3.5 py-3 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/75 dark:divide-white/[0.06]">
                        {filteredDocumentos.length === 0 ? (
                          <tr>
                            <td
                              colSpan={7}
                              className="px-4 py-12 text-center text-xs text-slate-500 dark:text-slate-400"
                            >
                              Nenhum documento enviado ainda.
                            </td>
                          </tr>
                        ) : (
                          filteredDocumentos.map((d) => (
                            <tr
                              key={d.id}
                              className="transition-colors hover:bg-slate-50/90 dark:hover:bg-white/[0.025]"
                            >
                              <td className="px-3.5 py-2.5 font-medium text-slate-900 dark:text-white whitespace-nowrap">
                                {d.tipoDocumento}
                              </td>
                              <td className="px-3.5 py-2.5 max-w-[200px] truncate text-slate-700 dark:text-slate-300">
                                {d.nomeArquivo}
                              </td>
                              <td className="px-3.5 py-2.5 text-slate-700 dark:text-slate-300">
                                <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500">
                                  {d.entidadeTipo}
                                </span>{' '}
                                · {d.entidadeNome}
                              </td>
                              <td className="px-2.5 py-2 min-w-[125px]">
                                <EditableCell
                                  value={d.dataValidade}
                                  type="date"
                                  mono
                                  requiredPending={false}
                                  displayValue={
                                    d.dataValidade ? formatDatePtBr(d.dataValidade) : 'Sem validade'
                                  }
                                  onSave={async (val) => {
                                    const nextStatus: StatusDocumento = val
                                      ? evaluateDateStatus(val)
                                      : d.statusDocumento;
                                    await safeAction(
                                      () =>
                                        updateDocumento(d.id, {
                                          dataValidade: val,
                                          statusDocumento: nextStatus,
                                        }),
                                      'Validade do documento atualizada.'
                                    );
                                  }}
                                />
                              </td>
                              <td className="px-3.5 py-2.5">
                                <DocStatusIndicator status={d.statusDocumento} />
                              </td>
                              <td className="px-3.5 py-2.5 max-w-[260px] truncate text-slate-600 dark:text-slate-400">
                                {d.resumoExtracao || '—'}
                              </td>
                              <td className="px-3.5 py-2.5 text-right whitespace-nowrap">
                                <div className="inline-flex items-center justify-end gap-1.5">
                                  {d.arquivoUrl && (
                                    <a
                                      href={d.arquivoUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-[#0B0F17] px-2.5 py-1 text-[11px] font-medium text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                                      title="Abrir arquivo original"
                                    >
                                      <ExternalLink className="h-3 w-3" />
                                      Ver Arquivo
                                    </a>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setDeleteTarget({
                                        type: 'documento',
                                        id: d.id,
                                        title: `o documento "${d.nomeArquivo}"`,
                                      })
                                    }
                                    className="rounded-md p-1.5 text-slate-400 dark:text-slate-500 hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400"
                                    title="Excluir documento"
                                    aria-label={`Excluir documento ${d.nomeArquivo}`}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                </ScrollableTableCard>
              )}
            </div>
          )}

          {/* FINANCEIRO */}
          {activeSection === 'financeiro' && (
            <FinanceiroSection
              uid={user.uid}
              lancamentos={lancamentos}
              categoriasFinanceiras={categoriasFinanceiras}
              proprietarios={proprietarios}
              motoristas={motoristas}
              veiculos={veiculos}
              searchQuery={searchQuery}
              onNewLancamento={() => setManualModalMode('financeiro')}
              onToast={showToast}
            />
          )}

          {/* ROTAS & DIARIAS (AO LADO DE FINANCEIRO) */}
          {activeSection === 'fretes' && (
            <FretesSection
              uid={user.uid}
              diasTrabalhados={diasTrabalhados}
              fretes={fretes}
              proprietarios={proprietarios}
              motoristas={motoristas}
              veiculos={veiculos}
              categoriasFinanceiras={categoriasFinanceiras}
              searchQuery={searchQuery}
              onNewFrete={() => setManualModalMode('frete')}
              onToast={showToast}
            />
          )}
        </main>
      </div>

      {/* Modals & Drawers */}
      {uploadModalOpen && (
        <DocumentUploadModal
          user={user}
          proprietarios={proprietarios}
          motoristas={motoristas}
          veiculos={veiculos}
          onClose={() => setUploadModalOpen(false)}
          onSaved={(msg) => showToast('success', msg)}
        />
      )}

      {manualModalMode && (
        <ManualEntryModal
          mode={manualModalMode}
          uid={user.uid}
          proprietarios={proprietarios}
          motoristas={motoristas}
          veiculos={veiculos}
          categoriasFinanceiras={categoriasFinanceiras}
          onClose={() => setManualModalMode(null)}
          onCreated={(msg) => showToast('success', msg)}
        />
      )}

      {selectedOwner && (
        <OwnerDetailDrawer
          proprietario={selectedOwner}
          proprietarios={proprietarios}
          motoristas={motoristas}
          veiculos={veiculos}
          documentos={documentos}
          onClose={() => setSelectedOwnerId(null)}
        />
      )}

      {editingEntity && (
        <EditEntityModal
          entity={editingEntity}
          proprietarios={proprietarios}
          motoristas={motoristas}
          veiculos={veiculos}
          onClose={() => setEditingEntity(null)}
          onSaved={(msg) => showToast('success', msg)}
          onRequestDelete={(target) => {
            if (target.type === 'motorista') requestDeleteMotorista(target.data);
            else if (target.type === 'veiculo') requestDeleteVeiculo(target.data);
            else requestDeleteProprietario(target.data);
          }}
        />
      )}

      {deleteTarget && (
        <ConfirmDeleteModal
          title="Confirmar Exclusão"
          targetName={deleteTarget.title}
          warning={deleteTarget.warning}
          busy={deletingBusy}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDeleteAction}
        />
      )}
    </div>
  );
}

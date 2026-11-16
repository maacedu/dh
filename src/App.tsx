import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Download,
  Eye,
  EyeOff,
  FileCheck2,
  FileWarning,
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
import { auth, firebaseProjectId, testFirestoreConnection } from './lib/firebase';
import {
  computeMotoristaPendingFields,
  computeProprietarioPendingFields,
  computeVeiculoPendingFields,
  evaluateDateStatus,
  exportFleetToExcel,
  formatDatePtBr,
  generatePendencias,
  SITUACAO_LABELS,
  suggestSituacaoMotorista,
  suggestSituacaoVeiculo,
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
  { value: 'pendente', label: 'Pendente' },
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
      viewBox="0 0 32 32"
      className="h-8 w-8 shrink-0"
      fill="none"
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="7" fill="#1D4ED8" />
      <path
        d="M7 10.5h11.5v9H7v-9Zm11.5 3h4.2l2.3 2.8v3.2h-6.5v-6Z"
        stroke="#FFFFFF"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <circle cx="11" cy="21.5" r="2" fill="#FFFFFF" />
      <circle cx="22" cy="21.5" r="2" fill="#FFFFFF" />
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

  const [activeSection, setActiveSection] = useState<NavSection>('painel');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [situacaoFilter, setSituacaoFilter] = useState<'todos' | SituacaoCadastral>('todos');
  const [tipoVeiculoFilter, setTipoVeiculoFilter] = useState<'todos' | TipoVeiculo>('todos');
  const [proprietarioFilter, setProprietarioFilter] = useState<string>('todos');
  const [pendenciaTab, setPendenciaTab] = useState<'pendencias' | 'documentos'>('pendencias');

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
      return (
        m.nomeCompleto.toLowerCase().includes(normalizedSearch) ||
        m.cpf.toLowerCase().includes(normalizedSearch) ||
        (normalizedSearchDigits.length >= 3 && cpfDigits.includes(normalizedSearchDigits)) ||
        m.cnh.toLowerCase().includes(normalizedSearch) ||
        propName.includes(normalizedSearch)
      );
    });
  }, [motoristas, situacaoFilter, proprietarioFilter, normalizedSearch, normalizedSearchDigits, propMap]);

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
      if (!normalizedSearch) return true;
      return (
        p.entidadeTitulo.toLowerCase().includes(normalizedSearch) ||
        p.descricao.toLowerCase().includes(normalizedSearch)
      );
    });
  }, [pendencias, normalizedSearch]);

  // Dashboard Metrics
  const kpis = useMemo(() => {
    const motAprovados = motoristas.filter((m) => m.situacaoCadastral === 'aprovado').length;
    const veiDisponiveis = veiculos.filter(
      (v) =>
        v.situacaoCadastral === 'aprovado' &&
        evaluateDateStatus(v.validadeCrlv) !== 'vencido'
    ).length;
    const vencidosCount = pendencias.filter((p) => p.categoria === 'vencido').length;
    const faltantesCount = pendencias.filter((p) => p.categoria === 'faltante').length;

    return {
      totalMotoristas: motoristas.length,
      motAprovados,
      totalVeiculos: veiculos.length,
      veiDisponiveis,
      totalPendencias: pendencias.length,
      vencidosCount,
      faltantesCount,
      totalProprietarios: proprietarios.length,
    };
  }, [motoristas, veiculos, proprietarios, pendencias]);

  const selectedOwner = useMemo(
    () => proprietarios.find((p) => p.id === selectedOwnerId) || null,
    [proprietarios, selectedOwnerId]
  );

  if (!authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-zinc-950">
        <div className="text-sm font-medium text-slate-600 dark:text-zinc-400">
          Inicializando El Nathan Transportes...
        </div>
      </div>
    );
  }

  if (!user || !sessionUnlocked) {
    return (
      <div className="relative flex min-h-screen flex-col justify-center bg-slate-100 dark:bg-zinc-950 px-4 py-12">
        <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
          <button
            type="button"
            onClick={toggleTheme}
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-zinc-200 transition-colors hover:bg-slate-50 dark:hover:bg-zinc-800 whitespace-nowrap"
          >
            {theme === 'dark' ? (
              <>
                <Sun className="h-3.5 w-3.5 text-amber-400" />
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

        <div className="mx-auto w-full max-w-md rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 shadow-xl dark:shadow-black/50">
          <div className="flex items-center gap-3.5">
            <BrandEmblem />
            <div>
              <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-zinc-50">
                El Nathan Transportes
              </h1>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Gestão Documental de Frota e Motoristas
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-2 border-t border-slate-200 dark:border-zinc-800 pt-6">
            <div className="flex items-start gap-2.5 text-xs leading-relaxed text-slate-600 dark:text-zinc-400">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-700 dark:text-blue-400" />
              <p>
                Área restrita da transportadora. Informe a senha de acesso para consultar e
                gerenciar cadastros e documentos.
              </p>
            </div>
          </div>

          {authError && (
            <div className="mt-4 space-y-2 rounded-md border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/50 px-3.5 py-2.5 text-xs text-red-700 dark:text-red-300">
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
                className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-zinc-300"
              >
                Senha de acesso
              </label>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-zinc-500" />
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
                  className="w-full rounded-md border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 py-2.5 pl-9 pr-10 font-mono text-sm text-slate-900 dark:text-zinc-100 placeholder:font-sans placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:border-blue-600 dark:focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-200"
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={signingIn || !passwordInput.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-blue-700 dark:bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-800 dark:hover:bg-blue-500 disabled:opacity-50"
            >
              {signingIn ? 'Verificando...' : 'Entrar'}
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
      count: pendencias.length > 0 ? pendencias.length : undefined,
    },
    {
      id: 'financeiro',
      label: 'Financeiro',
      icon: Wallet,
      count: lancamentos.length > 0 ? lancamentos.length : undefined,
    },
    {
      id: 'fretes',
      label: 'Fretes & Rotas',
      icon: Route,
      count: fretes.length > 0 ? fretes.length : undefined,
    },
  ];

  const sectionTitles: Record<NavSection, string> = {
    painel: 'Painel Geral da Frota',
    motoristas: 'Cadastro de Motoristas',
    veiculos: 'Cadastro de Veículos',
    proprietarios: 'Proprietários e Vínculos',
    documentos: 'Documentação e Pendências',
    financeiro: 'Financeiro e Categorias',
    fretes: 'Fretes e Rotas Operacionais',
  };

  function handleExportExcel() {
    exportFleetToExcel(
      motoristas,
      veiculos,
      proprietarios,
      documentos,
      pendencias,
      lancamentos,
      fretes
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
    'rounded-md border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-xs text-slate-700 dark:text-zinc-200 focus:border-blue-500 focus:outline-none';

  const inlineSelectCls =
    'w-full rounded border border-transparent bg-transparent px-1.5 py-1 text-xs text-slate-800 dark:text-zinc-200 hover:border-slate-300 dark:hover:border-zinc-700 hover:bg-white dark:hover:bg-zinc-950 focus:border-blue-500 focus:bg-white dark:focus:bg-zinc-950 focus:outline-none';

  const statusSelectCls =
    'rounded border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-1.5 py-0.5 text-[11px] text-slate-700 dark:text-zinc-200 focus:border-blue-500 focus:outline-none';

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100">
      {/* Mobile Sidebar Backdrop */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 lg:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200 dark:border-zinc-800/90 bg-white dark:bg-[#0C0C0F] text-slate-800 dark:text-zinc-100 transition-transform lg:static lg:translate-x-0 ${
          mobileNavOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800/90 px-5 py-4">
          <div className="flex items-center gap-3">
            <BrandEmblem />
            <span className="text-sm font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap">
              El Nathan Transportes
            </span>
          </div>
          <button
            type="button"
            onClick={() => setMobileNavOpen(false)}
            className="rounded p-1 text-slate-400 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white lg:hidden"
            aria-label="Fechar menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => {
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
                className={`flex w-full items-center justify-between rounded-md px-3 py-2.5 text-left text-xs font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-blue-700 dark:bg-blue-600 text-white'
                    : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-900 hover:text-slate-900 dark:hover:text-zinc-100'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </span>
                {item.count !== undefined && (
                  <span
                    className={`font-mono text-[11px] tabular-nums ${
                      active
                        ? 'text-blue-100'
                        : item.id === 'documentos' && pendencias.length > 0
                          ? 'font-semibold text-amber-600 dark:text-amber-400'
                          : 'text-slate-400 dark:text-zinc-500'
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Theme Switcher & Operator Footer */}
        <div className="space-y-3 border-t border-slate-200 dark:border-zinc-800/90 p-4">
          <div className="grid grid-cols-2 gap-1 rounded-md border border-slate-200 dark:border-zinc-800 bg-slate-100 dark:bg-zinc-950 p-1">
            <button
              type="button"
              onClick={() => setTheme('dark')}
              className={`inline-flex items-center justify-center gap-1.5 rounded py-1.5 text-[11px] font-medium transition-colors whitespace-nowrap ${
                theme === 'dark'
                  ? 'bg-zinc-800 text-white shadow-xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
              }`}
            >
              <Moon className="h-3 w-3" />
              <span>Escuro</span>
            </button>
            <button
              type="button"
              onClick={() => setTheme('light')}
              className={`inline-flex items-center justify-center gap-1.5 rounded py-1.5 text-[11px] font-medium transition-colors whitespace-nowrap ${
                theme === 'light'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
              }`}
            >
              <Sun className="h-3 w-3" />
              <span>Claro</span>
            </button>
          </div>

          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-slate-900 dark:text-zinc-100">
                {user.displayName || 'Operador Autorizado'}
              </p>
              <p className="truncate text-[11px] text-slate-500 dark:text-zinc-400">
                {user.email || 'Sessão por senha ativa'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              title="Sair do sistema"
              className="rounded p-1.5 text-slate-400 dark:text-zinc-400 transition-colors hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-slate-900 dark:hover:text-white"
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
        <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-zinc-800/90 bg-white/95 dark:bg-zinc-950/90 px-4 py-3 backdrop-blur-xs sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="rounded border border-slate-200 dark:border-zinc-800 p-1.5 text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-900 lg:hidden"
              aria-label="Abrir menu"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-zinc-400">
              <span className="hidden sm:inline">El Nathan Transportes</span>
              <span aria-hidden="true" className="hidden sm:inline">
                /
              </span>
              <span className="font-semibold text-slate-900 dark:text-zinc-100">
                {sectionTitles[activeSection]}
              </span>
            </div>
          </div>

          <div className="flex flex-1 items-center justify-end gap-2.5 sm:gap-3">
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 dark:text-zinc-500" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por nome, CPF/CNPJ ou placa..."
                className="w-full rounded-md border border-slate-300 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 py-1.5 pl-8 pr-3 text-xs text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:border-blue-600 dark:focus:border-blue-500 focus:bg-white dark:focus:bg-zinc-950 focus:outline-none"
              />
            </div>

            <button
              type="button"
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-zinc-200 transition-colors hover:bg-slate-50 dark:hover:bg-zinc-800 whitespace-nowrap shrink-0"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Exportar Excel</span>
            </button>

            <button
              type="button"
              onClick={() => setUploadModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-700 dark:bg-blue-600 px-3.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-800 dark:hover:bg-blue-500 whitespace-nowrap shrink-0"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Enviar Documento</span>
            </button>
          </div>
        </header>

        <main className="flex-1 space-y-6 p-4 sm:p-6">
          {toast && (
            <div
              className={`flex items-center justify-between gap-3 rounded-md border px-4 py-2.5 text-xs ${
                toast.type === 'success'
                  ? 'border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300'
                  : 'border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/50 text-red-800 dark:text-red-300'
              }`}
            >
              <span className="flex items-center gap-2">
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
                className="text-current opacity-70 hover:opacity-100"
                aria-label="Fechar aviso"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {dataError && (
            <div className="rounded-md border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/50 px-4 py-3 text-xs text-red-700 dark:text-red-300">
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
                  className="rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 p-5 text-left transition-colors hover:border-slate-300 dark:hover:border-zinc-700"
                >
                  <p className="text-xs font-medium text-slate-500 dark:text-zinc-400">
                    Motoristas Cadastrados
                  </p>
                  <p className="mt-2 font-mono text-2xl font-semibold text-slate-900 dark:text-white tabular-nums">
                    {loadingData ? '—' : kpis.totalMotoristas}
                  </p>
                  <p className="mt-1.5 text-xs text-slate-600 dark:text-zinc-400 tabular-nums">
                    {kpis.motAprovados} aprovados · {kpis.totalMotoristas - kpis.motAprovados} em revisão/pendentes
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSection('veiculos')}
                  className="rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 p-5 text-left transition-colors hover:border-slate-300 dark:hover:border-zinc-700"
                >
                  <p className="text-xs font-medium text-slate-500 dark:text-zinc-400">
                    Veículos Disponíveis
                  </p>
                  <p className="mt-2 font-mono text-2xl font-semibold text-slate-900 dark:text-white tabular-nums">
                    {loadingData ? '—' : kpis.veiDisponiveis}
                    <span className="text-sm font-normal text-slate-400 dark:text-zinc-500">
                      {' '}
                      / {kpis.totalVeiculos}
                    </span>
                  </p>
                  <p className="mt-1.5 text-xs text-slate-600 dark:text-zinc-400">
                    Frota regularizada e com CRLV em dia
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveSection('documentos');
                    setPendenciaTab('pendencias');
                  }}
                  className="rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 p-5 text-left transition-colors hover:border-slate-300 dark:hover:border-zinc-700"
                >
                  <p className="text-xs font-medium text-slate-500 dark:text-zinc-400">
                    Pendências Documentais
                  </p>
                  <p
                    className={`mt-2 font-mono text-2xl font-semibold tabular-nums ${
                      kpis.totalPendencias > 0
                        ? 'text-red-700 dark:text-red-400'
                        : 'text-emerald-700 dark:text-emerald-400'
                    }`}
                  >
                    {loadingData ? '—' : kpis.totalPendencias}
                  </p>
                  <p className="mt-1.5 text-xs text-slate-600 dark:text-zinc-400 tabular-nums">
                    {kpis.vencidosCount} vencidos · {kpis.faltantesCount} documentos faltantes
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSection('proprietarios')}
                  className="rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 p-5 text-left transition-colors hover:border-slate-300 dark:hover:border-zinc-700"
                >
                  <p className="text-xs font-medium text-slate-500 dark:text-zinc-400">
                    Proprietários Vinculados
                  </p>
                  <p className="mt-2 font-mono text-2xl font-semibold text-slate-900 dark:text-white tabular-nums">
                    {loadingData ? '—' : kpis.totalProprietarios}
                  </p>
                  <p className="mt-1.5 text-xs text-slate-600 dark:text-zinc-400">
                    {documentos.length} documentos arquivados no sistema
                  </p>
                </button>
              </div>

              {/* Operational Split */}
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                {/* Actionable Pendencies */}
                <div className="rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 xl:col-span-2">
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 px-5 py-3.5">
                    <div>
                      <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
                        Alertas de Documentação e Pendências
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-zinc-400">
                        Documentos vencidos, arquivos faltantes ou campos aguardando preenchimento manual
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveSection('documentos');
                        setPendenciaTab('pendencias');
                      }}
                      className="text-xs font-medium text-blue-700 dark:text-blue-400 hover:underline whitespace-nowrap"
                    >
                      Ver todas
                    </button>
                  </div>

                  {loadingData ? (
                    <div className="p-6 text-xs text-slate-500 dark:text-zinc-400">
                      Carregando registros...
                    </div>
                  ) : filteredPendencias.length === 0 ? (
                    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
                      <CheckCircle2 className="mb-2.5 h-7 w-7 text-emerald-600 dark:text-emerald-400" />
                      <p className="text-sm font-medium text-slate-800 dark:text-zinc-100">
                        {motoristas.length === 0 && veiculos.length === 0
                          ? 'Nenhum cadastro registrado ainda'
                          : 'Nenhuma pendência documental encontrada'}
                      </p>
                      <p className="mt-1 max-w-md text-xs text-slate-500 dark:text-zinc-400">
                        {motoristas.length === 0 && veiculos.length === 0
                          ? 'Envie uma CNH ou CRLV em PDF ou imagem para iniciar o cadastro automático da frota.'
                          : 'Todos os motoristas, veículos e documentos cadastrados estão em dia.'}
                      </p>
                      {motoristas.length === 0 && veiculos.length === 0 && (
                        <button
                          type="button"
                          onClick={() => setUploadModalOpen(true)}
                          className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-blue-700 dark:bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800 dark:hover:bg-blue-500"
                        >
                          <Upload className="h-3.5 w-3.5" />
                          Enviar Primeiro Documento
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-200 dark:divide-zinc-800">
                      {filteredPendencias.slice(0, 8).map((pen) => (
                        <div
                          key={pen.id}
                          className="flex items-center justify-between gap-4 px-5 py-3 text-xs transition-colors hover:bg-slate-50 dark:hover:bg-zinc-800/50"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span
                                className={`font-semibold ${
                                  pen.categoria === 'vencido'
                                    ? 'text-red-700 dark:text-red-400'
                                    : pen.categoria === 'faltante'
                                      ? 'text-orange-700 dark:text-orange-400'
                                      : pen.categoria === 'a_vencer'
                                        ? 'text-amber-700 dark:text-amber-400'
                                        : 'text-slate-700 dark:text-zinc-300'
                                }`}
                              >
                                {pen.categoria === 'vencido'
                                  ? 'Vencido'
                                  : pen.categoria === 'faltante'
                                    ? 'Doc. Faltante'
                                    : pen.categoria === 'a_vencer'
                                      ? 'A Vencer'
                                      : 'Campo Pendente'}
                              </span>
                              <span aria-hidden="true" className="text-slate-300 dark:text-zinc-700">
                                ·
                              </span>
                              <span className="truncate font-medium text-slate-900 dark:text-zinc-100">
                                {pen.entidadeTitulo}
                              </span>
                            </div>
                            <p className="mt-0.5 truncate text-slate-600 dark:text-zinc-400">
                              {pen.descricao}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveSection(
                                pen.entidadeTipo === 'motorista'
                                  ? 'motoristas'
                                  : pen.entidadeTipo === 'veiculo'
                                    ? 'veiculos'
                                    : 'proprietarios'
                              );
                            }}
                            className="shrink-0 rounded border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 whitespace-nowrap"
                          >
                            Corrigir
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Fleet Breakdown & Quick Actions */}
                <div className="space-y-6">
                  <div className="rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 p-5">
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
                      Frota por Tipo de Veículo
                    </h2>
                    <div className="mt-4 space-y-3 text-xs">
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
                              <span className="font-medium text-slate-700 dark:text-zinc-200">
                                {tipo}
                              </span>
                              <span className="font-mono tabular-nums text-slate-900 dark:text-zinc-100">
                                {count}{' '}
                                <span className="text-slate-400 dark:text-zinc-500">
                                  ({aprov} aprov.)
                                </span>
                              </span>
                            </div>
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800">
                              <div
                                className="h-full rounded-full bg-blue-600 dark:bg-blue-500 transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                      <div className="flex items-center justify-between border-t border-slate-100 dark:border-zinc-800 pt-2.5">
                        <span className="font-medium text-amber-700 dark:text-amber-400">
                          Tipo Pendente
                        </span>
                        <span className="font-mono tabular-nums text-amber-700 dark:text-amber-400">
                          {veiculos.filter((v) => !v.tipoVeiculo).length}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 p-5">
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
                      Ações Rápidas de Cadastro
                    </h2>
                    <div className="mt-3 grid grid-cols-1 gap-2">
                      <button
                        type="button"
                        onClick={() => setUploadModalOpen(true)}
                        className="flex items-center justify-between rounded-md border border-blue-200 dark:border-blue-800/70 bg-blue-50/70 dark:bg-blue-950/40 px-3.5 py-2.5 text-xs font-medium text-blue-800 dark:text-blue-300 hover:bg-blue-100/70 dark:hover:bg-blue-950/70"
                      >
                        <span>Enviar PDF ou Imagem (Extração Automática)</span>
                        <Upload className="h-3.5 w-3.5 shrink-0" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setManualModalMode('motorista')}
                        className="flex items-center justify-between rounded-md border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/60 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800"
                      >
                        <span>Cadastrar Motorista Manualmente</span>
                        <Plus className="h-3.5 w-3.5 shrink-0" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setManualModalMode('veiculo')}
                        className="flex items-center justify-between rounded-md border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/60 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800"
                      >
                        <span>Cadastrar Veículo Manualmente</span>
                        <Plus className="h-3.5 w-3.5 shrink-0" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setManualModalMode('proprietario')}
                        className="flex items-center justify-between rounded-md border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/60 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800"
                      >
                        <span>Cadastrar Proprietário Manualmente</span>
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
                <div className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-100 dark:bg-zinc-900 p-1">
                  {SITUACAO_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setSituacaoFilter(opt.value)}
                      className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                        situacaoFilter === opt.value
                          ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-xs'
                          : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
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
                    className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs font-medium text-slate-800 dark:text-zinc-100 hover:bg-slate-50 dark:hover:bg-zinc-800 whitespace-nowrap"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Novo Motorista
                  </button>
                </div>
              </div>

              <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90">
                <div className="border-b border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-950/60 px-4 py-2 text-[11px] text-slate-500 dark:text-zinc-400">
                  Planilha editável: clique em qualquer campo para editar diretamente. Campos em âmbar estão pendentes de preenchimento manual.
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950/80 text-[11px] font-semibold text-slate-600 dark:text-zinc-400">
                        <th className="px-3 py-2.5">Nome Completo</th>
                        <th className="px-3 py-2.5">CPF</th>
                        <th className="px-3 py-2.5">CNH</th>
                        <th className="px-3 py-2.5">Cat.</th>
                        <th className="px-3 py-2.5">Validade CNH</th>
                        <th className="px-3 py-2.5">Telefone</th>
                        <th className="px-3 py-2.5">Proprietário</th>
                        <th className="px-3 py-2.5">Situação</th>
                        <th className="px-3 py-2.5 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-zinc-800">
                      {filteredMotoristas.length === 0 ? (
                        <tr>
                          <td
                            colSpan={9}
                            className="px-4 py-10 text-center text-xs text-slate-500 dark:text-zinc-400"
                          >
                            Nenhum motorista encontrado para os filtros aplicados.
                          </td>
                        </tr>
                      ) : (
                        filteredMotoristas.map((m) => {
                          const cnhExpiryStatus = evaluateDateStatus(m.validadeCnh);
                          const missing = computeMotoristaPendingFields(m);
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
                              className="transition-colors hover:bg-slate-50/80 dark:hover:bg-zinc-800/40"
                            >
                              <td className="px-2 py-1.5 min-w-[180px]">
                                <EditableCell
                                  value={m.nomeCompleto}
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
                                {missing.length > 0 && (
                                  <span className="block px-1.5 text-[10px] text-amber-700 dark:text-amber-400">
                                    Falta: {missing.join(', ')}
                                  </span>
                                )}
                                {m.observacoes && (
                                  <span className="block max-w-[220px] truncate px-1.5 text-[10px] text-slate-400 dark:text-zinc-500">
                                    Obs.: {m.observacoes}
                                  </span>
                                )}
                              </td>
                              <td className="px-2 py-1.5 min-w-[130px]">
                                <EditableCell
                                  value={m.cpf}
                                  mono
                                  onSave={async (val) => {
                                    await saveMotPatch({ cpf: val }, 'CPF atualizado.');
                                  }}
                                />
                              </td>
                              <td className="px-2 py-1.5 min-w-[120px]">
                                <EditableCell
                                  value={m.cnh}
                                  mono
                                  onSave={async (val) => {
                                    await saveMotPatch({ cnh: val }, 'CNH atualizada.');
                                  }}
                                />
                              </td>
                              <td className="px-2 py-1.5 w-[75px]">
                                <EditableCell
                                  value={m.categoriaCnh}
                                  mono
                                  onSave={async (val) => {
                                    await saveMotPatch(
                                      { categoriaCnh: val },
                                      'Categoria da CNH atualizada.'
                                    );
                                  }}
                                />
                              </td>
                              <td className="px-2 py-1.5 min-w-[130px]">
                                <EditableCell
                                  value={m.validadeCnh}
                                  type="date"
                                  mono
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
                                {cnhExpiryStatus === 'vencido' && (
                                  <span className="block px-1.5 text-[10px] font-medium text-red-700 dark:text-red-400">
                                    CNH vencida
                                  </span>
                                )}
                                {cnhExpiryStatus === 'a_vencer' && (
                                  <span className="block px-1.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
                                    Vence em breve
                                  </span>
                                )}
                              </td>
                              <td className="px-2 py-1.5 min-w-[130px]">
                                <EditableCell
                                  value={m.telefone}
                                  onSave={async (val) => {
                                    await saveMotPatch({ telefone: val }, 'Telefone atualizado.');
                                  }}
                                />
                              </td>
                              <td className="px-2 py-1.5 min-w-[160px]">
                                <select
                                  value={safeOwnerId}
                                  onChange={async (e) => {
                                    await saveMotPatch(
                                      { proprietarioId: e.target.value },
                                      'Vínculo com proprietário atualizado.'
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
                              <td className="px-2 py-1.5 min-w-[160px]">
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
                              <td className="px-3 py-1.5 text-right">
                                <div className="inline-flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setEditingEntity({ type: 'motorista', data: m })}
                                    className="inline-flex items-center gap-1 rounded border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800 whitespace-nowrap"
                                    title="Editar motorista e status"
                                  >
                                    <Pencil className="h-3 w-3" />
                                    Editar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => requestDeleteMotorista(m)}
                                    className="inline-flex items-center gap-1 rounded border border-transparent p-1.5 text-slate-400 dark:text-zinc-500 hover:border-red-200 dark:hover:border-red-900/60 hover:bg-red-50 dark:hover:bg-red-950/60 hover:text-red-700 dark:hover:text-red-400"
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
                </div>
              </div>
            </div>
          )}

          {/* VEICULOS TABLE */}
          {activeSection === 'veiculos' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-100 dark:bg-zinc-900 p-1">
                  {SITUACAO_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setSituacaoFilter(opt.value)}
                      className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                        situacaoFilter === opt.value
                          ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-xs'
                          : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
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
                    className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs font-medium text-slate-800 dark:text-zinc-100 hover:bg-slate-50 dark:hover:bg-zinc-800 whitespace-nowrap"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Novo Veículo
                  </button>
                </div>
              </div>

              <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90">
                <div className="border-b border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-950/60 px-4 py-2 text-[11px] text-slate-500 dark:text-zinc-400">
                  Planilha editável da frota: clique em qualquer célula para atualizar placa, modelo, marca, ano, RENAVAM, tipo (Van, HR, VUC, Médio) ou proprietário.
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950/80 text-[11px] font-semibold text-slate-600 dark:text-zinc-400">
                        <th className="px-3 py-2.5">Placa</th>
                        <th className="px-3 py-2.5">Marca</th>
                        <th className="px-3 py-2.5">Modelo</th>
                        <th className="px-3 py-2.5">Ano</th>
                        <th className="px-3 py-2.5">RENAVAM</th>
                        <th className="px-3 py-2.5">Tipo</th>
                        <th className="px-3 py-2.5">Proprietário</th>
                        <th className="px-3 py-2.5">Motorista</th>
                        <th className="px-3 py-2.5">Validade CRLV</th>
                        <th className="px-3 py-2.5">Situação</th>
                        <th className="px-3 py-2.5 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-zinc-800">
                      {filteredVeiculos.length === 0 ? (
                        <tr>
                          <td
                            colSpan={11}
                            className="px-4 py-10 text-center text-xs text-slate-500 dark:text-zinc-400"
                          >
                            Nenhum veículo encontrado para os filtros aplicados.
                          </td>
                        </tr>
                      ) : (
                        filteredVeiculos.map((v) => {
                          const crlvStatus = evaluateDateStatus(v.validadeCrlv);
                          const missing = computeVeiculoPendingFields(v);
                          return (
                            <tr
                              key={v.id}
                              className="transition-colors hover:bg-slate-50/80 dark:hover:bg-zinc-800/40"
                            >
                              <td className="px-2 py-1.5 min-w-[100px]">
                                <EditableCell
                                  value={v.placa}
                                  mono
                                  onSave={async (val) => {
                                    await updateVeiculo(v.id, v, { placa: val });
                                  }}
                                />
                                {missing.length > 0 && (
                                  <span className="block px-1.5 text-[10px] text-amber-700 dark:text-amber-400">
                                    {missing.length} pend.
                                  </span>
                                )}
                              </td>
                              <td className="px-2 py-1.5 min-w-[110px]">
                                <EditableCell
                                  value={v.marca}
                                  onSave={async (val) => {
                                    await updateVeiculo(v.id, v, { marca: val });
                                  }}
                                />
                              </td>
                              <td className="px-2 py-1.5 min-w-[140px]">
                                <EditableCell
                                  value={v.modelo}
                                  onSave={async (val) => {
                                    await updateVeiculo(v.id, v, { modelo: val });
                                  }}
                                />
                              </td>
                              <td className="px-2 py-1.5 w-[90px]">
                                <EditableCell
                                  value={v.ano}
                                  mono
                                  onSave={async (val) => {
                                    await updateVeiculo(v.id, v, { ano: val });
                                  }}
                                />
                              </td>
                              <td className="px-2 py-1.5 min-w-[125px]">
                                <EditableCell
                                  value={v.renavam}
                                  mono
                                  onSave={async (val) => {
                                    await updateVeiculo(v.id, v, { renavam: val });
                                  }}
                                />
                              </td>
                              <td className="px-2 py-1.5 min-w-[105px]">
                                <select
                                  value={v.tipoVeiculo}
                                  onChange={async (e) => {
                                    await updateVeiculo(v.id, v, {
                                      tipoVeiculo: e.target.value as TipoVeiculo,
                                    });
                                  }}
                                  className={`w-full rounded border border-transparent bg-transparent px-1.5 py-1 text-xs hover:border-slate-300 dark:hover:border-zinc-700 hover:bg-white dark:hover:bg-zinc-950 focus:border-blue-500 focus:bg-white dark:focus:bg-zinc-950 focus:outline-none ${
                                    !v.tipoVeiculo
                                      ? 'font-medium text-amber-700 dark:text-amber-400'
                                      : 'text-slate-800 dark:text-zinc-200'
                                  }`}
                                >
                                  <option value="">Pendente</option>
                                  <option value="Van">Van</option>
                                  <option value="HR">HR</option>
                                  <option value="VUC">VUC</option>
                                  <option value="Médio">Médio</option>
                                </select>
                              </td>
                              <td className="px-2 py-1.5 min-w-[155px]">
                                <select
                                  value={v.proprietarioId}
                                  onChange={async (e) => {
                                    await updateVeiculo(v.id, v, {
                                      proprietarioId: e.target.value,
                                    });
                                  }}
                                  className={`w-full rounded border border-transparent bg-transparent px-1.5 py-1 text-xs hover:border-slate-300 dark:hover:border-zinc-700 hover:bg-white dark:hover:bg-zinc-950 focus:border-blue-500 focus:bg-white dark:focus:bg-zinc-950 focus:outline-none ${
                                    !v.proprietarioId
                                      ? 'font-medium text-amber-700 dark:text-amber-400'
                                      : 'text-slate-800 dark:text-zinc-200'
                                  }`}
                                >
                                  <option value="">Pendente</option>
                                  {proprietarios.map((p) => (
                                    <option key={p.id} value={p.id}>
                                      {p.nomeCompleto}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="px-2 py-1.5 min-w-[145px]">
                                <select
                                  value={v.motoristaId}
                                  onChange={async (e) => {
                                    await updateVeiculo(v.id, v, {
                                      motoristaId: e.target.value,
                                    });
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
                              <td className="px-2 py-1.5 min-w-[125px]">
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
                                    await updateVeiculo(v.id, v, {
                                      validadeCrlv: val,
                                      situacaoCadastral: nextSit,
                                    });
                                  }}
                                />
                                {crlvStatus === 'vencido' && (
                                  <span className="block px-1.5 text-[10px] font-medium text-red-700 dark:text-red-400">
                                    CRLV vencido
                                  </span>
                                )}
                              </td>
                              <td className="px-2 py-1.5 min-w-[155px]">
                                <div className="flex flex-col gap-1">
                                  <SituacaoIndicator situacao={v.situacaoCadastral} />
                                  <select
                                    value={v.situacaoCadastral}
                                    onChange={async (e) => {
                                      const nextSit = e.target.value as SituacaoCadastral;
                                      await safeAction(
                                        () =>
                                          updateVeiculo(v.id, v, {
                                            situacaoCadastral: nextSit,
                                            ...(v.proprietarioId && !propMap.has(v.proprietarioId)
                                              ? { proprietarioId: '' }
                                              : {}),
                                            ...(v.motoristaId && !motMap.has(v.motoristaId)
                                              ? { motoristaId: '' }
                                              : {}),
                                          }),
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
                              <td className="px-3 py-1.5 text-right">
                                <div className="inline-flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setEditingEntity({ type: 'veiculo', data: v })}
                                    className="inline-flex items-center gap-1 rounded border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800 whitespace-nowrap"
                                    title="Editar veículo"
                                  >
                                    <Pencil className="h-3 w-3" />
                                    Editar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => requestDeleteVeiculo(v)}
                                    className="rounded p-1.5 text-slate-400 dark:text-zinc-500 hover:bg-red-50 dark:hover:bg-red-950/60 hover:text-red-700 dark:hover:text-red-400"
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
                </div>
              </div>
            </div>
          )}

          {/* PROPRIETARIOS TABLE */}
          {activeSection === 'proprietarios' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-100 dark:bg-zinc-900 p-1">
                  {SITUACAO_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setSituacaoFilter(opt.value)}
                      className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                        situacaoFilter === opt.value
                          ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-xs'
                          : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setManualModalMode('proprietario')}
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs font-medium text-slate-800 dark:text-zinc-100 hover:bg-slate-50 dark:hover:bg-zinc-800 whitespace-nowrap"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Novo Proprietário
                </button>
              </div>

              <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90">
                <div className="border-b border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-950/60 px-4 py-2 text-[11px] text-slate-500 dark:text-zinc-400">
                  Selecione um motorista cadastrado diretamente na linha do proprietário ou clique em Gerenciar Vínculos para administrar motoristas e veículos.
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950/80 text-[11px] font-semibold text-slate-600 dark:text-zinc-400">
                        <th className="px-3 py-2.5">Nome Completo / Razão Social</th>
                        <th className="px-3 py-2.5">CPF / CNPJ</th>
                        <th className="px-3 py-2.5">Contato</th>
                        <th className="px-3 py-2.5">Motoristas (Cadastrados)</th>
                        <th className="px-3 py-2.5">Veículos</th>
                        <th className="px-3 py-2.5">Situação</th>
                        <th className="px-3 py-2.5 text-right">Vínculos / Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-zinc-800">
                      {filteredProprietarios.length === 0 ? (
                        <tr>
                          <td
                            colSpan={7}
                            className="px-4 py-10 text-center text-xs text-slate-500 dark:text-zinc-400"
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
                          const missing = computeProprietarioPendingFields(p);
                          return (
                            <tr
                              key={p.id}
                              className="transition-colors hover:bg-slate-50/80 dark:hover:bg-zinc-800/40"
                            >
                              <td className="px-2 py-1.5 min-w-[190px]">
                                <EditableCell
                                  value={p.nomeCompleto}
                                  onSave={async (val) => {
                                    await updateProprietario(p.id, { nomeCompleto: val });
                                  }}
                                />
                                {missing.length > 0 && (
                                  <span className="block px-1.5 text-[10px] text-amber-700 dark:text-amber-400">
                                    Falta: {missing.join(', ')}
                                  </span>
                                )}
                              </td>
                              <td className="px-2 py-1.5 min-w-[140px]">
                                <EditableCell
                                  value={p.cpfCnpj}
                                  mono
                                  onSave={async (val) => {
                                    await updateProprietario(p.id, { cpfCnpj: val });
                                  }}
                                />
                              </td>
                              <td className="px-2 py-1.5 min-w-[150px]">
                                <EditableCell
                                  value={p.contato}
                                  onSave={async (val) => {
                                    await updateProprietario(p.id, { contato: val });
                                  }}
                                />
                              </td>
                              <td className="px-2 py-1.5 min-w-[230px]">
                                <div className="space-y-1.5">
                                  {linkedMot.length > 0 && (
                                    <div className="flex flex-wrap gap-1">
                                      {linkedMot.map((m) => (
                                        <span
                                          key={m.id}
                                          className="inline-flex items-center gap-1 rounded border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-950 px-2 py-0.5 text-[11px] font-medium text-slate-800 dark:text-zinc-200"
                                        >
                                          <span className="max-w-[140px] truncate">
                                            {m.nomeCompleto}
                                          </span>
                                          <button
                                            type="button"
                                            onClick={async () => {
                                              await updateMotorista(m.id, m, { proprietarioId: '' });
                                              showToast(
                                                'success',
                                                `Motorista "${m.nomeCompleto}" desvinculado.`
                                              );
                                            }}
                                            className="rounded p-0.5 text-slate-400 dark:text-zinc-500 hover:text-red-600 dark:hover:text-red-400"
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
                                      await updateMotorista(target.id, target, {
                                        proprietarioId: p.id,
                                      });
                                      showToast(
                                        'success',
                                        `Motorista "${target.nomeCompleto}" vinculado a ${p.nomeCompleto}.`
                                      );
                                    }}
                                    className={`w-full rounded border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-2 py-1 text-[11px] focus:border-blue-500 focus:outline-none ${
                                      linkedMot.length === 0
                                        ? 'font-medium text-amber-700 dark:text-amber-400'
                                        : 'text-slate-600 dark:text-zinc-300'
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
                              <td className="px-3 py-2 text-xs text-slate-700 dark:text-zinc-300 tabular-nums">
                                <span className="font-mono font-medium">{linkedVei.length}</span>{' '}
                                {linkedVei.length === 1 ? 'veículo' : 'veículos'}
                                {linkedVei.length > 0 && (
                                  <span className="mt-0.5 block font-mono text-[10px] text-slate-500 dark:text-zinc-400">
                                    {linkedVei.map((v) => v.placa).join(', ')}
                                  </span>
                                )}
                              </td>
                              <td className="px-2 py-1.5 min-w-[155px]">
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
                              <td className="px-3 py-1.5 text-right">
                                <div className="inline-flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setEditingEntity({ type: 'proprietario', data: p })
                                    }
                                    className="inline-flex items-center gap-1 rounded border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800 whitespace-nowrap"
                                    title="Editar proprietário"
                                  >
                                    <Pencil className="h-3 w-3" />
                                    Editar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setSelectedOwnerId(p.id)}
                                    className="rounded border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800 whitespace-nowrap"
                                  >
                                    Vínculos
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => requestDeleteProprietario(p)}
                                    className="rounded p-1.5 text-slate-400 dark:text-zinc-500 hover:bg-red-50 dark:hover:bg-red-950/60 hover:text-red-700 dark:hover:text-red-400"
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
                </div>
              </div>
            </div>
          )}

          {/* DOCUMENTACAO & PENDENCIAS */}
          {activeSection === 'documentos' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-1 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-100 dark:bg-zinc-900 p-1">
                  <button
                    type="button"
                    onClick={() => setPendenciaTab('pendencias')}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                      pendenciaTab === 'pendencias'
                        ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
                    }`}
                  >
                    Pendências e Vencimentos ({filteredPendencias.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendenciaTab('documentos')}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                      pendenciaTab === 'documentos'
                        ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
                    }`}
                  >
                    Arquivos Enviados ({filteredDocumentos.length})
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setUploadModalOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-md bg-blue-700 dark:bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-800 dark:hover:bg-blue-500 whitespace-nowrap"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Enviar Novo Documento
                </button>
              </div>

              {pendenciaTab === 'pendencias' ? (
                <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950/80 text-[11px] font-semibold text-slate-600 dark:text-zinc-400">
                          <th className="px-4 py-2.5">Tipo de Alerta</th>
                          <th className="px-4 py-2.5">Cadastro</th>
                          <th className="px-4 py-2.5">Identificação</th>
                          <th className="px-4 py-2.5">Detalhe da Pendência</th>
                          <th className="px-4 py-2.5 text-right">Ação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-zinc-800">
                        {filteredPendencias.length === 0 ? (
                          <tr>
                            <td
                              colSpan={5}
                              className="px-4 py-10 text-center text-xs text-slate-500 dark:text-zinc-400"
                            >
                              Nenhuma pendência documental ativa.
                            </td>
                          </tr>
                        ) : (
                          filteredPendencias.map((pen) => (
                            <tr
                              key={pen.id}
                              className="transition-colors hover:bg-slate-50/80 dark:hover:bg-zinc-800/40"
                            >
                              <td className="px-4 py-2.5 font-medium whitespace-nowrap">
                                {pen.categoria === 'vencido' ? (
                                  <span className="inline-flex items-center gap-1.5 text-red-700 dark:text-red-400">
                                    <FileWarning className="h-3.5 w-3.5" />
                                    Vencido
                                  </span>
                                ) : pen.categoria === 'faltante' ? (
                                  <span className="inline-flex items-center gap-1.5 text-orange-700 dark:text-orange-400">
                                    <AlertTriangle className="h-3.5 w-3.5" />
                                    Doc. Faltante
                                  </span>
                                ) : pen.categoria === 'a_vencer' ? (
                                  <span className="text-amber-700 dark:text-amber-400">
                                    A Vencer (30d)
                                  </span>
                                ) : (
                                  <span className="text-slate-700 dark:text-zinc-300">
                                    Campo Pendente
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-2.5 font-mono text-[11px] uppercase text-slate-500 dark:text-zinc-400">
                                {pen.entidadeTipo}
                              </td>
                              <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-zinc-100">
                                {pen.entidadeTitulo}
                              </td>
                              <td className="px-4 py-2.5 text-slate-600 dark:text-zinc-400">
                                {pen.descricao}
                              </td>
                              <td className="px-4 py-2.5 text-right">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setActiveSection(
                                      pen.entidadeTipo === 'motorista'
                                        ? 'motoristas'
                                        : pen.entidadeTipo === 'veiculo'
                                          ? 'veiculos'
                                          : 'proprietarios'
                                    )
                                  }
                                  className="rounded border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800 whitespace-nowrap"
                                >
                                  Abrir Cadastro
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950/80 text-[11px] font-semibold text-slate-600 dark:text-zinc-400">
                          <th className="px-3 py-2.5">Tipo</th>
                          <th className="px-3 py-2.5">Arquivo Enviado</th>
                          <th className="px-3 py-2.5">Vínculo</th>
                          <th className="px-3 py-2.5">Validade</th>
                          <th className="px-3 py-2.5">Status</th>
                          <th className="px-3 py-2.5">Resumo da Extração</th>
                          <th className="px-3 py-2.5 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-zinc-800">
                        {filteredDocumentos.length === 0 ? (
                          <tr>
                            <td
                              colSpan={7}
                              className="px-4 py-10 text-center text-xs text-slate-500 dark:text-zinc-400"
                            >
                              Nenhum documento enviado ainda.
                            </td>
                          </tr>
                        ) : (
                          filteredDocumentos.map((d) => (
                            <tr
                              key={d.id}
                              className="transition-colors hover:bg-slate-50/80 dark:hover:bg-zinc-800/40"
                            >
                              <td className="px-3 py-2 font-medium text-slate-900 dark:text-zinc-100 whitespace-nowrap">
                                {d.tipoDocumento}
                              </td>
                              <td className="px-3 py-2 max-w-[200px] truncate text-slate-700 dark:text-zinc-300">
                                {d.nomeArquivo}
                              </td>
                              <td className="px-3 py-2 text-slate-700 dark:text-zinc-300">
                                <span className="font-mono text-[10px] uppercase text-slate-400 dark:text-zinc-500">
                                  {d.entidadeTipo}
                                </span>{' '}
                                · {d.entidadeNome}
                              </td>
                              <td className="px-2 py-1.5 min-w-[125px]">
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
                                    await updateDocumento(d.id, {
                                      dataValidade: val,
                                      statusDocumento: nextStatus,
                                    });
                                  }}
                                />
                              </td>
                              <td className="px-3 py-2">
                                <DocStatusIndicator status={d.statusDocumento} />
                              </td>
                              <td className="px-3 py-2 max-w-[260px] truncate text-slate-600 dark:text-zinc-400">
                                {d.resumoExtracao || '—'}
                              </td>
                              <td className="px-3 py-2 text-right">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setDeleteTarget({
                                      type: 'documento',
                                      id: d.id,
                                      title: `o documento "${d.nomeArquivo}"`,
                                    })
                                  }
                                  className="rounded p-1.5 text-slate-400 dark:text-zinc-500 hover:bg-red-50 dark:hover:bg-red-950/60 hover:text-red-700 dark:hover:text-red-400"
                                  title="Excluir documento"
                                  aria-label={`Excluir documento ${d.nomeArquivo}`}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
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

          {/* FRETES & ROTAS (AO LADO DE FINANCEIRO) */}
          {activeSection === 'fretes' && (
            <FretesSection
              fretes={fretes}
              proprietarios={proprietarios}
              motoristas={motoristas}
              veiculos={veiculos}
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

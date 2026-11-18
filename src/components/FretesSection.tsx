import { useMemo, useState, type FormEvent } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  Route,
  Trash2,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import type {
  DiaTrabalhado,
  Frete,
  Motorista,
  Proprietario,
  StatusDiaTrabalhado,
  StatusFrete,
  TurnoTrabalho,
  Veiculo,
} from '../types/fleet';
import {
  formatBrl,
  formatDatePtBr,
  getTodayIso,
  STATUS_DIA_LABELS,
  STATUS_FRETE_LABELS,
  TURNO_TRABALHO_LABELS,
} from '../lib/compliance';
import {
  createDiaTrabalhado,
  deleteDiaTrabalhado,
  deleteFrete,
  updateDiaTrabalhado,
  updateFrete,
} from '../lib/fleetService';
import { EditableCell } from './EditableCell';
import { ScrollableTableCard } from './ScrollableTableCard';

interface FretesSectionProps {
  uid: string;
  diasTrabalhados: DiaTrabalhado[];
  fretes: Frete[];
  proprietarios: Proprietario[];
  motoristas: Motorista[];
  veiculos: Veiculo[];
  searchQuery: string;
  onNewFrete: () => void;
  onToast: (type: 'success' | 'error', text: string) => void;
}

const statusFreteColorMap: Record<StatusFrete, string> = {
  agendado: 'text-slate-700 dark:text-slate-200',
  em_transito: 'text-blue-700 dark:text-blue-400',
  entregue: 'text-emerald-700 dark:text-emerald-400',
  faturado: 'text-emerald-800 dark:text-emerald-300',
  cancelado: 'text-red-700 dark:text-red-400',
};

const statusDiaColorMap: Record<StatusDiaTrabalhado, string> = {
  trabalhado: 'text-emerald-700 dark:text-emerald-400',
  folga: 'text-slate-600 dark:text-slate-300',
  falta: 'text-red-700 dark:text-red-400',
  feriado: 'text-blue-700 dark:text-blue-400',
};

const inlineSelectCls =
  'w-full rounded-md border border-transparent bg-transparent px-2 py-1 text-xs text-slate-800 dark:text-slate-200 hover:border-slate-300 dark:hover:border-white/[0.12] hover:bg-white dark:hover:bg-[#0B0F17] focus:border-blue-500 focus:bg-white dark:focus:bg-[#0B0F17] focus:outline-none';

const statusSelectCls =
  'rounded-md border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-[#0B0F17] px-2 py-1 text-[11px] font-medium focus:border-blue-500 focus:outline-none';

const modalInputCls =
  'w-full rounded-lg border border-slate-300 dark:border-white/[0.1] bg-white dark:bg-[#0B0F17] px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-blue-600 dark:focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20';

const modalLabelCls = 'mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300';

const MONTH_NAMES_PT = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

const WEEKDAY_SHORT = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

function getDaysInMonth(yearMonth: string): number {
  const [y, m] = yearMonth.split('-').map(Number);
  if (!y || !m) return 30;
  return new Date(y, m, 0).getDate();
}

function getMonthLabel(yearMonth: string): string {
  const [y, m] = yearMonth.split('-').map(Number);
  if (!y || !m || m < 1 || m > 12) return yearMonth;
  return `${MONTH_NAMES_PT[m - 1]} ${y}`;
}

function shiftYearMonth(yearMonth: string, delta: number): string {
  const [y, m] = yearMonth.split('-').map(Number);
  const d = new Date(y, (m || 1) - 1 + delta, 1);
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${yy}-${mm}`;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function getDayCellBadge(reg: DiaTrabalhado): {
  code: string;
  classes: string;
  title: string;
} {
  if (reg.status === 'falta') {
    return {
      code: 'X',
      classes:
        'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30',
      title: `Falta${reg.rota ? ` · ${reg.rota}` : ''}`,
    };
  }
  if (reg.status === 'folga') {
    return {
      code: 'F',
      classes:
        'bg-slate-200/80 dark:bg-white/[0.08] text-slate-700 dark:text-slate-300 border-slate-300 dark:border-white/[0.12]',
      title: `Folga${reg.rota ? ` · ${reg.rota}` : ''}`,
    };
  }
  if (reg.status === 'feriado') {
    return {
      code: 'H',
      classes:
        'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30',
      title: `Feriado${reg.rota ? ` · ${reg.rota}` : ''}`,
    };
  }
  if (reg.turno === 'extra') {
    return {
      code: 'E',
      classes:
        'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30',
      title: `Diária Extra${reg.rota ? ` · ${reg.rota}` : ''}`,
    };
  }
  if (reg.turno === 'meia_diaria') {
    return {
      code: '½',
      classes:
        'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30',
      title: `Meia Diária${reg.rota ? ` · ${reg.rota}` : ''}`,
    };
  }
  return {
    code: 'T',
    classes:
      'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    title: `Trabalhado${reg.rota ? ` · ${reg.rota}` : ''}`,
  };
}

export function FretesSection({
  uid,
  diasTrabalhados,
  fretes,
  proprietarios,
  motoristas,
  veiculos,
  searchQuery,
  onNewFrete,
  onToast,
}: FretesSectionProps) {
  const [subTab, setSubTab] = useState<'dias' | 'fretes'>('dias');
  const [selectedMonth, setSelectedMonth] = useState(() => getTodayIso().slice(0, 7));
  const [motoristaFilter, setMotoristaFilter] = useState<string>('todos');
  const [diaStatusFilter, setDiaStatusFilter] = useState<'todos' | StatusDiaTrabalhado>('todos');
  const [freteStatusFilter, setFreteStatusFilter] = useState<'todos' | StatusFrete>('todos');

  // Workday Registration / Edit Modal state
  const [workdayModalOpen, setWorkdayModalOpen] = useState(false);
  const [editingDia, setEditingDia] = useState<DiaTrabalhado | null>(null);
  const [formMotId, setFormMotId] = useState('');
  const [formDates, setFormDates] = useState<string[]>([]);
  const [formSingleDate, setFormSingleDate] = useState(getTodayIso());
  const [formRota, setFormRota] = useState('');
  const [formPlaca, setFormPlaca] = useState('');
  const [formPropId, setFormPropId] = useState('');
  const [formVeiId, setFormVeiId] = useState('');
  const [formTurno, setFormTurno] = useState<TurnoTrabalho>('dia_completo');
  const [formValorDiaria, setFormValorDiaria] = useState('');
  const [formStatus, setFormStatus] = useState<StatusDiaTrabalhado>('trabalhado');
  const [formObs, setFormObs] = useState('');
  const [savingDia, setSavingDia] = useState(false);
  const [diaFormError, setDiaFormError] = useState('');

  const propMap = useMemo(() => new Map(proprietarios.map((p) => [p.id, p])), [proprietarios]);
  const motMap = useMemo(() => new Map(motoristas.map((m) => [m.id, m])), [motoristas]);
  const veiMap = useMemo(() => new Map(veiculos.map((v) => [v.id, v])), [veiculos]);

  const motLinkedVehicleMap = useMemo(() => {
    const map = new Map<string, Veiculo>();
    for (const v of veiculos) {
      if (v.motoristaId && !map.has(v.motoristaId)) {
        map.set(v.motoristaId, v);
      }
    }
    return map;
  }, [veiculos]);

  const daysInMonth = useMemo(() => getDaysInMonth(selectedMonth), [selectedMonth]);

  const dayColumns = useMemo(() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    return Array.from({ length: daysInMonth }, (_, idx) => {
      const day = idx + 1;
      const dateStr = `${selectedMonth}-${pad2(day)}`;
      const dow = y && m ? new Date(y, m - 1, day).getDay() : 1;
      return {
        day,
        dateStr,
        weekdayShort: WEEKDAY_SHORT[dow],
        isWeekend: dow === 0 || dow === 6,
      };
    });
  }, [selectedMonth, daysInMonth]);

  const diasNoMes = useMemo(
    () => diasTrabalhados.filter((d) => d.data.startsWith(selectedMonth)),
    [diasTrabalhados, selectedMonth]
  );

  const filteredDias = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return diasNoMes.filter((d) => {
      if (motoristaFilter !== 'todos' && d.motoristaId !== motoristaFilter) return false;
      if (diaStatusFilter !== 'todos' && d.status !== diaStatusFilter) return false;
      if (!q) return true;
      const motName = motMap.get(d.motoristaId)?.nomeCompleto.toLowerCase() || '';
      const propName = propMap.get(d.proprietarioId)?.nomeCompleto.toLowerCase() || '';
      const veiPlaca = (d.placa || veiMap.get(d.veiculoId)?.placa || '').toLowerCase();
      return (
        motName.includes(q) ||
        propName.includes(q) ||
        veiPlaca.includes(q) ||
        d.rota.toLowerCase().includes(q) ||
        d.data.includes(q)
      );
    });
  }, [diasNoMes, motoristaFilter, diaStatusFilter, searchQuery, motMap, propMap, veiMap]);

  const matrixMotoristas = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return motoristas.filter((m) => {
      if (motoristaFilter !== 'todos' && m.id !== motoristaFilter) return false;
      if (!q) return true;
      const propName = propMap.get(m.proprietarioId)?.nomeCompleto.toLowerCase() || '';
      const plate = (m.placa || motLinkedVehicleMap.get(m.id)?.placa || '').toLowerCase();
      return (
        m.nomeCompleto.toLowerCase().includes(q) ||
        m.cpf.toLowerCase().includes(q) ||
        plate.includes(q) ||
        propName.includes(q)
      );
    });
  }, [motoristas, motoristaFilter, searchQuery, propMap, motLinkedVehicleMap]);

  // Index by `${motoristaId}|${dateStr}`
  const diaMatrixIndex = useMemo(() => {
    const map = new Map<string, DiaTrabalhado[]>();
    for (const d of diasNoMes) {
      const key = `${d.motoristaId}|${d.data}`;
      const list = map.get(key) || [];
      list.push(d);
      map.set(key, list);
    }
    return map;
  }, [diasNoMes]);

  const monthSummary = useMemo(() => {
    let trabalhados = 0;
    let extras = 0;
    let folgasFaltas = 0;
    let totalDiarias = 0;
    const activeDrivers = new Set<string>();

    for (const d of diasNoMes) {
      totalDiarias += d.valorDiaria || 0;
      if (d.status === 'trabalhado') {
        trabalhados += 1;
        activeDrivers.add(d.motoristaId);
        if (d.turno === 'extra') extras += 1;
      } else {
        folgasFaltas += 1;
      }
    }

    let fretesAtivos = 0;
    let fretesBruto = 0;
    for (const f of fretes) {
      if (f.status === 'cancelado') continue;
      if (f.status === 'agendado' || f.status === 'em_transito') fretesAtivos += 1;
      fretesBruto += f.valorFrete;
    }

    return {
      trabalhados,
      extras,
      folgasFaltas,
      activeDriversCount: activeDrivers.size,
      totalDiarias,
      fretesTotal: fretes.length,
      fretesAtivos,
      fretesBruto,
    };
  }, [diasNoMes, fretes]);

  const filteredFretes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return fretes.filter((f) => {
      if (freteStatusFilter !== 'todos' && f.status !== freteStatusFilter) return false;
      if (!q) return true;
      const propName = propMap.get(f.proprietarioId)?.nomeCompleto.toLowerCase() || '';
      const motName = motMap.get(f.motoristaId)?.nomeCompleto.toLowerCase() || '';
      const veiPlaca = veiMap.get(f.veiculoId)?.placa.toLowerCase() || '';
      return (
        f.cliente.toLowerCase().includes(q) ||
        f.origem.toLowerCase().includes(q) ||
        f.destino.toLowerCase().includes(q) ||
        propName.includes(q) ||
        motName.includes(q) ||
        veiPlaca.includes(q)
      );
    });
  }, [fretes, freteStatusFilter, searchQuery, propMap, motMap, veiMap]);

  function applyDriverDefaults(motId: string) {
    setFormMotId(motId);
    const mot = motMap.get(motId);
    if (!mot) return;
    const linkedVei = motLinkedVehicleMap.get(motId);
    const safeProp = mot.proprietarioId && propMap.has(mot.proprietarioId) ? mot.proprietarioId : '';
    setFormPropId(safeProp);
    setFormVeiId(linkedVei ? linkedVei.id : '');
    setFormPlaca((mot.placa || linkedVei?.placa || '').toUpperCase());
  }

  function openNewWorkdayModal(prefillMotId?: string, prefillDate?: string) {
    setEditingDia(null);
    setDiaFormError('');
    const defaultMotId =
      prefillMotId ||
      (motoristaFilter !== 'todos' ? motoristaFilter : motoristas[0]?.id || '');
    if (defaultMotId) {
      applyDriverDefaults(defaultMotId);
    } else {
      setFormMotId('');
      setFormPropId('');
      setFormVeiId('');
      setFormPlaca('');
    }
    const today = getTodayIso();
    const initialDate =
      prefillDate || (today.startsWith(selectedMonth) ? today : `${selectedMonth}-01`);
    setFormDates([initialDate]);
    setFormSingleDate(initialDate);
    setFormRota('');
    setFormTurno('dia_completo');
    setFormValorDiaria('');
    setFormStatus('trabalhado');
    setFormObs('');
    setWorkdayModalOpen(true);
  }

  function openEditWorkdayModal(reg: DiaTrabalhado) {
    setEditingDia(reg);
    setDiaFormError('');
    setFormMotId(motMap.has(reg.motoristaId) ? reg.motoristaId : motoristas[0]?.id || '');
    setFormSingleDate(reg.data);
    setFormDates([reg.data]);
    setFormRota(reg.rota);
    setFormPlaca(reg.placa);
    setFormPropId(reg.proprietarioId && propMap.has(reg.proprietarioId) ? reg.proprietarioId : '');
    setFormVeiId(reg.veiculoId && veiMap.has(reg.veiculoId) ? reg.veiculoId : '');
    setFormTurno(reg.turno);
    setFormValorDiaria(reg.valorDiaria ? String(reg.valorDiaria) : '');
    setFormStatus(reg.status);
    setFormObs(reg.observacoes ?? '');
    setWorkdayModalOpen(true);
  }

  function toggleDateSelection(dateStr: string) {
    setFormDates((prev) =>
      prev.includes(dateStr) ? prev.filter((d) => d !== dateStr) : [...prev, dateStr].sort()
    );
  }

  function selectWeekdayRange(includeSaturday: boolean) {
    const picked: string[] = [];
    const [y, m] = selectedMonth.split('-').map(Number);
    for (let day = 1; day <= daysInMonth; day++) {
      const dow = new Date(y, m - 1, day).getDay();
      if (dow >= 1 && (dow <= 5 || (includeSaturday && dow === 6))) {
        picked.push(`${selectedMonth}-${pad2(day)}`);
      }
    }
    setFormDates(picked);
  }

  async function handleSaveWorkday(e: FormEvent) {
    e.preventDefault();
    setDiaFormError('');

    if (!formMotId || !motMap.has(formMotId)) {
      setDiaFormError('Selecione um motorista cadastrado para registrar os dias.');
      return;
    }

    const numericValor = Number(formValorDiaria.replace(',', '.')) || 0;
    const safePropId = formPropId && propMap.has(formPropId) ? formPropId : '';
    const safeVeiId = formVeiId && veiMap.has(formVeiId) ? formVeiId : '';
    const resolvedPlaca =
      formPlaca.trim().toUpperCase() ||
      (safeVeiId ? veiMap.get(safeVeiId)?.placa || '' : '') ||
      motMap.get(formMotId)?.placa ||
      '';

    setSavingDia(true);
    try {
      if (editingDia) {
        if (!formSingleDate) {
          setDiaFormError('Informe a data do registro.');
          setSavingDia(false);
          return;
        }
        await updateDiaTrabalhado(editingDia.id, {
          motoristaId: formMotId,
          proprietarioId: safePropId,
          veiculoId: safeVeiId,
          placa: resolvedPlaca,
          data: formSingleDate,
          rota: formRota,
          turno: formTurno,
          valorDiaria: numericValor,
          status: formStatus,
          observacoes: formObs,
        });
        onToast('success', 'Dia trabalhado atualizado com sucesso.');
      } else {
        if (formDates.length === 0) {
          setDiaFormError('Selecione ao menos um dia no calendário.');
          setSavingDia(false);
          return;
        }
        for (const dateStr of formDates) {
          await createDiaTrabalhado(uid, {
            motoristaId: formMotId,
            proprietarioId: safePropId,
            veiculoId: safeVeiId,
            placa: resolvedPlaca,
            data: dateStr,
            rota: formRota,
            turno: formTurno,
            valorDiaria: numericValor,
            status: formStatus,
            observacoes: formObs,
          });
        }
        const motName = motMap.get(formMotId)?.nomeCompleto || 'Motorista';
        onToast(
          'success',
          `${formDates.length} ${
            formDates.length === 1 ? 'dia registrado' : 'dias registrados'
          } para ${motName}.`
        );
      }
      setWorkdayModalOpen(false);
    } catch (err) {
      setDiaFormError(err instanceof Error ? err.message : 'Erro ao salvar dias trabalhados.');
    } finally {
      setSavingDia(false);
    }
  }

  // Modal calendar layout helpers
  const modalCalendarData = useMemo(() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const firstDow = y && m ? new Date(y, m - 1, 1).getDay() : 0;
    const blanks = Array.from({ length: firstDow }, (_, i) => i);
    return { blanks };
  }, [selectedMonth]);

  return (
    <div className="space-y-6">
      {/* KPI Strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200/90 dark:border-white/[0.08] bg-white dark:bg-[#0F1520] p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Dias Trabalhados ({getMonthLabel(selectedMonth)})
            </p>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CalendarDays className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 font-mono text-2xl font-semibold text-slate-900 dark:text-white tabular-nums">
            {monthSummary.trabalhados}
          </p>
          <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400 tabular-nums">
            {monthSummary.extras} extra(s) · {monthSummary.folgasFaltas} folga/falta
          </p>
        </div>

        <div className="rounded-xl border border-slate-200/90 dark:border-white/[0.08] bg-white dark:bg-[#0F1520] p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Motoristas na Escala
            </p>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Users className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 font-mono text-2xl font-semibold text-slate-900 dark:text-white tabular-nums">
            {monthSummary.activeDriversCount}
            <span className="text-sm font-normal text-slate-400 dark:text-slate-500">
              {' '}
              / {motoristas.length}
            </span>
          </p>
          <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400">
            Com dias lançados no mês
          </p>
        </div>

        <div className="rounded-xl border border-slate-200/90 dark:border-white/[0.08] bg-white dark:bg-[#0F1520] p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Total em Diárias (Mês)
            </p>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Wallet className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 font-mono text-2xl font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">
            {formatBrl(monthSummary.totalDiarias)}
          </p>
          <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400">
            Somatório das diárias registradas
          </p>
        </div>

        <div className="rounded-xl border border-slate-200/90 dark:border-white/[0.08] bg-white dark:bg-[#0F1520] p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Fretes e Viagens
            </p>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-500/10 text-slate-600 dark:text-slate-300">
              <Route className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 font-mono text-2xl font-semibold text-slate-900 dark:text-white tabular-nums">
            {monthSummary.fretesTotal}
          </p>
          <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400 tabular-nums">
            {formatBrl(monthSummary.fretesBruto)} em fretes
          </p>
        </div>
      </div>

      {/* Sub-tabs + Primary Action */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-xl border border-slate-200/90 dark:border-white/[0.08] bg-slate-100/90 dark:bg-white/[0.03] p-1">
          <button
            type="button"
            onClick={() => setSubTab('dias')}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              subTab === 'dias'
                ? 'bg-white dark:bg-[#182234] text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Dias Trabalhados ({diasNoMes.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('fretes')}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              subTab === 'fretes'
                ? 'bg-white dark:bg-[#182234] text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Fretes e Viagens ({fretes.length})
          </button>
        </div>

        {subTab === 'dias' ? (
          <div className="flex flex-wrap items-center gap-2">
            {/* Month Switcher */}
            <div className="inline-flex items-center rounded-lg border border-slate-300/90 dark:border-white/[0.1] bg-white dark:bg-[#0F1520] p-0.5">
              <button
                type="button"
                onClick={() => setSelectedMonth((prev) => shiftYearMonth(prev, -1))}
                className="rounded-md p-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] hover:text-slate-900 dark:hover:text-white"
                aria-label="Mês anterior"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => {
                  if (e.target.value) setSelectedMonth(e.target.value);
                }}
                aria-label="Selecionar mês de referência"
                className="bg-transparent px-2 py-1 text-xs font-semibold text-slate-800 dark:text-white focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setSelectedMonth((prev) => shiftYearMonth(prev, 1))}
                className="rounded-md p-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] hover:text-slate-900 dark:hover:text-white"
                aria-label="Próximo mês"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <select
              value={motoristaFilter}
              onChange={(e) => setMotoristaFilter(e.target.value)}
              className="rounded-lg border border-slate-300/90 dark:border-white/[0.1] bg-white dark:bg-[#0F1520] px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 focus:border-blue-500 focus:outline-none"
            >
              <option value="todos">Todos os Motoristas</option>
              {motoristas.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nomeCompleto}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => openNewWorkdayModal()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-medium text-white shadow-xs hover:bg-blue-500 whitespace-nowrap"
            >
              <Plus className="h-3.5 w-3.5" />
              Registrar Dias Trabalhados
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={freteStatusFilter}
              onChange={(e) => setFreteStatusFilter(e.target.value as 'todos' | StatusFrete)}
              className="rounded-lg border border-slate-300/90 dark:border-white/[0.1] bg-white dark:bg-[#0F1520] px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 focus:border-blue-500 focus:outline-none"
            >
              <option value="todos">Todos os Status</option>
              {(Object.keys(STATUS_FRETE_LABELS) as StatusFrete[]).map((st) => (
                <option key={st} value={st}>
                  {STATUS_FRETE_LABELS[st]}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={onNewFrete}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-medium text-white shadow-xs hover:bg-blue-500 whitespace-nowrap"
            >
              <Plus className="h-3.5 w-3.5" />
              Novo Frete
            </button>
          </div>
        )}
      </div>

      {subTab === 'dias' ? (
        <div className="space-y-6">
          {/* Monthly Workday Matrix (1..31) */}
          <ScrollableTableCard
            header={
              <div>
                <h3 className="text-xs font-semibold text-slate-900 dark:text-white">
                  Folha Mensal de Motoristas — {getMonthLabel(selectedMonth)}
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Clique em qualquer dia da grade para lançar ou editar o dia trabalhado do motorista.
                </p>
              </div>
            }
            headerRight={
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded border border-emerald-500/30 bg-emerald-500/15 font-mono text-[10px] font-bold">
                    T
                  </span>
                  Trabalhado
                </span>
                <span className="inline-flex items-center gap-1 text-blue-700 dark:text-blue-300">
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded border border-blue-500/30 bg-blue-500/15 font-mono text-[10px] font-bold">
                    E
                  </span>
                  Extra
                </span>
                <span className="inline-flex items-center gap-1 text-sky-700 dark:text-sky-300">
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded border border-sky-500/30 bg-sky-500/15 font-mono text-[10px] font-bold">
                    ½
                  </span>
                  Meia
                </span>
                <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300">
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded border border-slate-300 dark:border-white/[0.15] bg-slate-200/70 dark:bg-white/[0.07] font-mono text-[10px] font-bold">
                    F
                  </span>
                  Folga
                </span>
                <span className="inline-flex items-center gap-1 text-red-700 dark:text-red-300">
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded border border-red-500/30 bg-red-500/15 font-mono text-[10px] font-bold">
                    X
                  </span>
                  Falta
                </span>
              </div>
            }
          >
            {matrixMotoristas.length === 0 ? (
              <div className="px-4 py-10 text-center text-xs text-slate-500 dark:text-slate-400">
                {motoristas.length === 0
                  ? 'Cadastre motoristas primeiro para montar a escala mensal de dias trabalhados.'
                  : 'Nenhum motorista encontrado para o filtro atual.'}
              </div>
            ) : (
              <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200/80 dark:border-white/[0.07] bg-slate-50/90 dark:bg-white/[0.025] text-[10px] font-semibold text-slate-600 dark:text-slate-400">
                      <th className="sticky left-0 z-10 min-w-[180px] border-r border-slate-200/80 dark:border-white/[0.07] bg-slate-50 dark:bg-[#111827] px-3.5 py-2.5">
                        Motorista
                      </th>
                      {dayColumns.map((col) => (
                        <th
                          key={col.dateStr}
                          className={`min-w-[32px] px-1 py-2 text-center font-mono ${
                            col.isWeekend
                              ? 'bg-slate-100/80 dark:bg-white/[0.03] text-slate-500 dark:text-slate-400'
                              : ''
                          }`}
                        >
                          <span className="block leading-none">{col.day}</span>
                          <span className="mt-0.5 block text-[9px] font-normal opacity-75">
                            {col.weekdayShort}
                          </span>
                        </th>
                      ))}
                      <th className="border-l border-slate-200/80 dark:border-white/[0.07] px-3 py-2 text-center whitespace-nowrap">
                        Dias
                      </th>
                      <th className="px-3 py-2 text-right whitespace-nowrap">Total (R$)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/75 dark:divide-white/[0.06]">
                    {matrixMotoristas.map((m) => {
                      const isApproved = m.situacaoCadastral === 'aprovado';
                      const driverMonthLogs = diasNoMes.filter((d) => d.motoristaId === m.id);
                      const workedCount = driverMonthLogs.filter(
                        (d) => d.status === 'trabalhado'
                      ).length;
                      const driverTotal = driverMonthLogs.reduce(
                        (acc, d) => acc + (d.valorDiaria || 0),
                        0
                      );
                      const plate = m.placa || motLinkedVehicleMap.get(m.id)?.placa || '';
                      return (
                        <tr
                          key={m.id}
                          className={
                            isApproved
                              ? 'bg-emerald-50/55 dark:bg-emerald-950/20 hover:bg-emerald-50 dark:hover:bg-emerald-950/35'
                              : 'hover:bg-slate-50/80 dark:hover:bg-white/[0.02]'
                          }
                        >
                          <td
                            className={`sticky left-0 z-10 border-r border-slate-200/80 dark:border-white/[0.07] px-3.5 py-2 ${
                              isApproved
                                ? 'bg-emerald-50/95 dark:bg-[#0D1E1B]'
                                : 'bg-white dark:bg-[#0F1520]'
                            }`}
                          >
                            <p
                              className={`truncate max-w-[165px] font-medium ${
                                isApproved
                                  ? 'text-emerald-900 dark:text-emerald-300'
                                  : 'text-slate-900 dark:text-white'
                              }`}
                            >
                              {m.nomeCompleto}
                            </p>
                            {plate && (
                              <p className="font-mono text-[10px] text-slate-500 dark:text-slate-400">
                                {plate}
                              </p>
                            )}
                          </td>
                          {dayColumns.map((col) => {
                            const entries = diaMatrixIndex.get(`${m.id}|${col.dateStr}`) || [];
                            const first = entries[0];
                            const badge = first ? getDayCellBadge(first) : null;
                            return (
                              <td
                                key={col.dateStr}
                                className={`px-0.5 py-1.5 text-center ${
                                  col.isWeekend ? 'bg-slate-50/80 dark:bg-white/[0.015]' : ''
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() =>
                                    first
                                      ? openEditWorkdayModal(first)
                                      : openNewWorkdayModal(m.id, col.dateStr)
                                  }
                                  title={
                                    badge
                                      ? `${m.nomeCompleto} (${formatDatePtBr(col.dateStr)}): ${badge.title}`
                                      : `Registrar dia ${formatDatePtBr(col.dateStr)} para ${m.nomeCompleto}`
                                  }
                                  className={`inline-flex h-6 w-6 items-center justify-center rounded border font-mono text-[10px] font-semibold transition-colors ${
                                    badge
                                      ? badge.classes
                                      : 'border-transparent text-slate-300 dark:text-slate-600 hover:border-blue-500/40 hover:bg-blue-500/10 hover:text-blue-600 dark:hover:text-blue-400'
                                  }`}
                                >
                                  {badge ? badge.code : '·'}
                                </button>
                              </td>
                            );
                          })}
                          <td className="border-l border-slate-200/80 dark:border-white/[0.07] px-3 py-2 text-center font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                            {workedCount}
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-medium text-emerald-700 dark:text-emerald-400 tabular-nums whitespace-nowrap">
                            {formatBrl(driverTotal)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
            )}
          </ScrollableTableCard>

          {/* Detailed Daily Records Table */}
          <ScrollableTableCard
            header={
              <span className="text-xs font-semibold text-slate-800 dark:text-white">
                Registros Detalhados — {getMonthLabel(selectedMonth)} ({filteredDias.length})
              </span>
            }
            headerRight={
              <div className="flex flex-wrap items-center gap-1.5">
                {(['todos', 'trabalhado', 'folga', 'falta', 'feriado'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setDiaStatusFilter(st)}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                      diaStatusFilter === st
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-white/[0.06]'
                    }`}
                  >
                    {st === 'todos' ? 'Todos' : STATUS_DIA_LABELS[st]}
                  </button>
                ))}
              </div>
            }
          >
            <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200/80 dark:border-white/[0.07] bg-slate-50/90 dark:bg-white/[0.025] text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                    <th className="px-3.5 py-3">Data</th>
                    <th className="px-3.5 py-3">Motorista</th>
                    <th className="px-3.5 py-3">Rota / Operação</th>
                    <th className="px-3.5 py-3">Placa</th>
                    <th className="px-3.5 py-3">Proprietário</th>
                    <th className="px-3.5 py-3">Turno</th>
                    <th className="px-3.5 py-3">Diária (R$)</th>
                    <th className="px-3.5 py-3">Status</th>
                    <th className="px-3.5 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/75 dark:divide-white/[0.06]">
                  {filteredDias.length === 0 ? (
                    <tr>
                      <td
                        colSpan={9}
                        className="px-4 py-10 text-center text-xs text-slate-500 dark:text-slate-400"
                      >
                        Nenhum dia registrado para {getMonthLabel(selectedMonth)}. Clique em
                        &ldquo;Registrar Dias Trabalhados&rdquo; ou em qualquer célula da grade acima.
                      </td>
                    </tr>
                  ) : (
                    filteredDias.map((d) => {
                      const safeMotId = motMap.has(d.motoristaId) ? d.motoristaId : '';
                      const safePropId =
                        d.proprietarioId && propMap.has(d.proprietarioId) ? d.proprietarioId : '';
                      const safeVeiId =
                        d.veiculoId && veiMap.has(d.veiculoId) ? d.veiculoId : '';
                      const saveDia = (patch: Partial<DiaTrabalhado>) =>
                        updateDiaTrabalhado(d.id, {
                          ...(d.proprietarioId && !propMap.has(d.proprietarioId)
                            ? { proprietarioId: '' }
                            : {}),
                          ...(d.veiculoId && !veiMap.has(d.veiculoId) ? { veiculoId: '' } : {}),
                          ...patch,
                        });
                      return (
                        <tr
                          key={d.id}
                          className="transition-colors hover:bg-slate-50/90 dark:hover:bg-white/[0.025]"
                        >
                          <td className="px-2.5 py-2 min-w-[115px]">
                            <EditableCell
                              value={d.data}
                              type="date"
                              mono
                              displayValue={formatDatePtBr(d.data)}
                              onSave={async (val) => {
                                if (val) await saveDia({ data: val });
                              }}
                            />
                          </td>
                          <td className="px-2.5 py-2 min-w-[160px]">
                            <select
                              value={safeMotId}
                              onChange={async (e) => {
                                if (e.target.value) {
                                  await saveDia({ motoristaId: e.target.value });
                                }
                              }}
                              className={inlineSelectCls}
                            >
                              {motoristas.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.nomeCompleto}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-2.5 py-2 min-w-[165px]">
                            <EditableCell
                              value={d.rota}
                              placeholder="Definir rota"
                              onSave={async (val) => {
                                await saveDia({ rota: val });
                              }}
                            />
                          </td>
                          <td className="px-2.5 py-2 min-w-[100px]">
                            <EditableCell
                              value={d.placa || (safeVeiId ? veiMap.get(safeVeiId)?.placa || '' : '')}
                              mono
                              placeholder="Placa"
                              onSave={async (val) => {
                                await saveDia({ placa: val.toUpperCase() });
                              }}
                            />
                          </td>
                          <td className="px-2.5 py-2 min-w-[145px]">
                            <select
                              value={safePropId}
                              onChange={async (e) => {
                                await saveDia({ proprietarioId: e.target.value });
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
                          <td className="px-2.5 py-2 min-w-[125px]">
                            <select
                              value={d.turno}
                              onChange={async (e) => {
                                await saveDia({ turno: e.target.value as TurnoTrabalho });
                              }}
                              className={inlineSelectCls}
                            >
                              {(Object.keys(TURNO_TRABALHO_LABELS) as TurnoTrabalho[]).map((t) => (
                                <option key={t} value={t}>
                                  {TURNO_TRABALHO_LABELS[t]}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-2.5 py-2 min-w-[105px]">
                            <EditableCell
                              value={String(d.valorDiaria || 0)}
                              mono
                              displayValue={formatBrl(d.valorDiaria || 0)}
                              onSave={async (val) => {
                                const parsed = Number(val.replace(',', '.'));
                                if (Number.isFinite(parsed) && parsed >= 0) {
                                  await saveDia({ valorDiaria: parsed });
                                }
                              }}
                            />
                          </td>
                          <td className="px-2.5 py-2 min-w-[120px]">
                            <select
                              value={d.status}
                              onChange={async (e) => {
                                await saveDia({ status: e.target.value as StatusDiaTrabalhado });
                              }}
                              className={`${statusSelectCls} ${statusDiaColorMap[d.status]}`}
                            >
                              {(Object.keys(STATUS_DIA_LABELS) as StatusDiaTrabalhado[]).map(
                                (st) => (
                                  <option key={st} value={st}>
                                    {STATUS_DIA_LABELS[st]}
                                  </option>
                                )
                              )}
                            </select>
                          </td>
                          <td className="px-3.5 py-2 text-right">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => openEditWorkdayModal(d)}
                                className="rounded-md p-1.5 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-white/[0.06] hover:text-slate-700 dark:hover:text-white"
                                title="Editar registro"
                                aria-label="Editar dia trabalhado"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  await deleteDiaTrabalhado(d.id);
                                  onToast('success', 'Registro de dia trabalhado removido.');
                                }}
                                className="rounded-md p-1.5 text-slate-400 dark:text-slate-500 hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400"
                                title="Excluir registro"
                                aria-label="Excluir dia trabalhado"
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
      ) : (
        /* FRETES E VIAGENS SUB-TAB */
        <ScrollableTableCard header="Controle operacional de fretes e viagens integrado aos cadastros de proprietários, motoristas e veículos.">
          <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200/80 dark:border-white/[0.07] bg-slate-50/90 dark:bg-white/[0.025] text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  <th className="px-3.5 py-3">Cliente</th>
                  <th className="px-3.5 py-3">Origem</th>
                  <th className="px-3.5 py-3">Destino</th>
                  <th className="px-3.5 py-3">Saída</th>
                  <th className="px-3.5 py-3">Proprietário</th>
                  <th className="px-3.5 py-3">Motorista</th>
                  <th className="px-3.5 py-3">Veículo</th>
                  <th className="px-3.5 py-3">Frete (R$)</th>
                  <th className="px-3.5 py-3">Repasse (R$)</th>
                  <th className="px-3.5 py-3">Status</th>
                  <th className="px-3.5 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/75 dark:divide-white/[0.06]">
                {filteredFretes.length === 0 ? (
                  <tr>
                    <td
                      colSpan={11}
                      className="px-4 py-12 text-center text-xs text-slate-500 dark:text-slate-400"
                    >
                      Nenhum frete registrado ainda.
                    </td>
                  </tr>
                ) : (
                  filteredFretes.map((f) => (
                    <tr
                      key={f.id}
                      className="transition-colors hover:bg-slate-50/90 dark:hover:bg-white/[0.025]"
                    >
                      <td className="px-2.5 py-2 min-w-[155px]">
                        <EditableCell
                          value={f.cliente}
                          onSave={async (val) => {
                            await updateFrete(f.id, { cliente: val });
                          }}
                        />
                      </td>
                      <td className="px-2.5 py-2 min-w-[115px]">
                        <EditableCell
                          value={f.origem}
                          onSave={async (val) => {
                            await updateFrete(f.id, { origem: val });
                          }}
                        />
                      </td>
                      <td className="px-2.5 py-2 min-w-[115px]">
                        <EditableCell
                          value={f.destino}
                          onSave={async (val) => {
                            await updateFrete(f.id, { destino: val });
                          }}
                        />
                      </td>
                      <td className="px-2.5 py-2 min-w-[115px]">
                        <EditableCell
                          value={f.dataSaida}
                          type="date"
                          mono
                          displayValue={f.dataSaida ? formatDatePtBr(f.dataSaida) : '—'}
                          onSave={async (val) => {
                            await updateFrete(f.id, { dataSaida: val });
                          }}
                        />
                      </td>
                      <td className="px-2.5 py-2 min-w-[140px]">
                        <select
                          value={f.proprietarioId}
                          onChange={async (e) => {
                            await updateFrete(f.id, { proprietarioId: e.target.value });
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
                      <td className="px-2.5 py-2 min-w-[140px]">
                        <select
                          value={f.motoristaId}
                          onChange={async (e) => {
                            await updateFrete(f.id, { motoristaId: e.target.value });
                          }}
                          className={inlineSelectCls}
                        >
                          <option value="">Sem vínculo</option>
                          {motoristas.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.nomeCompleto}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2.5 py-2 min-w-[110px]">
                        <select
                          value={f.veiculoId}
                          onChange={async (e) => {
                            await updateFrete(f.id, { veiculoId: e.target.value });
                          }}
                          className={inlineSelectCls}
                        >
                          <option value="">Sem vínculo</option>
                          {veiculos.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.placa}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2.5 py-2 min-w-[110px]">
                        <EditableCell
                          value={String(f.valorFrete)}
                          mono
                          displayValue={formatBrl(f.valorFrete)}
                          onSave={async (val) => {
                            const parsed = Number(val.replace(',', '.'));
                            if (Number.isFinite(parsed) && parsed >= 0) {
                              await updateFrete(f.id, { valorFrete: parsed });
                            }
                          }}
                        />
                      </td>
                      <td className="px-2.5 py-2 min-w-[110px]">
                        <EditableCell
                          value={String(f.valorRepasse)}
                          mono
                          displayValue={formatBrl(f.valorRepasse)}
                          onSave={async (val) => {
                            const parsed = Number(val.replace(',', '.'));
                            if (Number.isFinite(parsed) && parsed >= 0) {
                              await updateFrete(f.id, { valorRepasse: parsed });
                            }
                          }}
                        />
                      </td>
                      <td className="px-2.5 py-2 min-w-[120px]">
                        <select
                          value={f.status}
                          onChange={async (e) => {
                            await updateFrete(f.id, { status: e.target.value as StatusFrete });
                          }}
                          className={`${statusSelectCls} ${statusFreteColorMap[f.status]}`}
                        >
                          {(Object.keys(STATUS_FRETE_LABELS) as StatusFrete[]).map((st) => (
                            <option key={st} value={st}>
                              {STATUS_FRETE_LABELS[st]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3.5 py-2 text-right">
                        <button
                          type="button"
                          onClick={async () => {
                            await deleteFrete(f.id);
                            onToast('success', 'Frete removido.');
                          }}
                          className="rounded-md p-1.5 text-slate-400 dark:text-slate-500 hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400"
                          title="Excluir frete"
                          aria-label={`Excluir frete ${f.cliente}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
        </ScrollableTableCard>
      )}

      {/* Modal de Registro / Edição de Dias Trabalhados */}
      {workdayModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
          <div className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-xl border border-slate-200/90 dark:border-white/[0.09] bg-white dark:bg-[#0F1520] shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-white/[0.07] px-6 py-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                  {editingDia
                    ? 'Editar Dia Trabalhado'
                    : `Registrar Dias Trabalhados — ${getMonthLabel(selectedMonth)}`}
                </h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Selecione o motorista e marque um ou vários dias trabalhados na rota.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setWorkdayModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] hover:text-slate-700 dark:hover:text-white"
                aria-label="Fechar janela"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveWorkday} className="flex-1 space-y-4 overflow-y-auto p-6">
              {diaFormError && (
                <div className="rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/50 px-3.5 py-2.5 text-xs text-red-700 dark:text-red-300">
                  {diaFormError}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className={modalLabelCls}>Motorista *</label>
                  {motoristas.length === 0 ? (
                    <div className="rounded-lg border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-[#0B0F17] px-3.5 py-2.5 text-xs text-slate-600 dark:text-slate-400">
                      Nenhum motorista cadastrado ainda. Cadastre um motorista na aba Motoristas para lançar os dias trabalhados.
                    </div>
                  ) : (
                    <select
                      value={formMotId}
                      onChange={(e) => applyDriverDefaults(e.target.value)}
                      className={modalInputCls}
                      required
                    >
                      <option value="">Selecionar motorista...</option>
                      {motoristas.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.nomeCompleto} {m.placa ? `(${m.placa})` : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {editingDia ? (
                  <div>
                    <label className={modalLabelCls}>Data *</label>
                    <input
                      type="date"
                      value={formSingleDate}
                      onChange={(e) => setFormSingleDate(e.target.value)}
                      className={`${modalInputCls} font-mono`}
                      required
                    />
                  </div>
                ) : (
                  <div className="sm:col-span-2 rounded-xl border border-slate-200/90 dark:border-white/[0.08] bg-slate-50/70 dark:bg-[#0B0F17] p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-800 dark:text-white">
                        Selecione os dias ({formDates.length} selecionado{formDates.length === 1 ? '' : 's'})
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => selectWeekdayRange(false)}
                          className="rounded-md border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-[#0F1520] px-2.5 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06]"
                        >
                          Seg a Sex
                        </button>
                        <button
                          type="button"
                          onClick={() => selectWeekdayRange(true)}
                          className="rounded-md border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-[#0F1520] px-2.5 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06]"
                        >
                          Seg a Sáb
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormDates([getTodayIso()])}
                          className="rounded-md border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-[#0F1520] px-2.5 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06]"
                        >
                          Hoje
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormDates([])}
                          className="rounded-md border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-[#0F1520] px-2.5 py-1 text-[11px] font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                        >
                          Limpar
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-slate-400 dark:text-slate-500 mb-1.5">
                      <span>Dom</span>
                      <span>Seg</span>
                      <span>Ter</span>
                      <span>Qua</span>
                      <span>Qui</span>
                      <span>Sex</span>
                      <span>Sáb</span>
                    </div>
                    <div className="grid grid-cols-7 gap-1.5">
                      {modalCalendarData.blanks.map((b) => (
                        <div key={`blank-${b}`} />
                      ))}
                      {dayColumns.map((col) => {
                        const selected = formDates.includes(col.dateStr);
                        const hasExisting =
                          formMotId &&
                          (diaMatrixIndex.get(`${formMotId}|${col.dateStr}`)?.length || 0) > 0;
                        return (
                          <button
                            key={col.dateStr}
                            type="button"
                            onClick={() => toggleDateSelection(col.dateStr)}
                            className={`relative flex h-9 flex-col items-center justify-center rounded-lg border font-mono text-xs font-medium transition-colors ${
                              selected
                                ? 'border-blue-600 bg-blue-600 text-white shadow-xs'
                                : col.isWeekend
                                  ? 'border-slate-200/80 dark:border-white/[0.06] bg-slate-100/70 dark:bg-white/[0.02] text-slate-500 dark:text-slate-400 hover:border-blue-400'
                                  : 'border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#0F1520] text-slate-700 dark:text-slate-200 hover:border-blue-400'
                            }`}
                          >
                            <span>{col.day}</span>
                            {hasExisting && (
                              <span
                                className={`h-1 w-1 rounded-full ${
                                  selected ? 'bg-white' : 'bg-emerald-500'
                                }`}
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div>
                  <label className={modalLabelCls}>Rota / Operação</label>
                  <input
                    type="text"
                    value={formRota}
                    onChange={(e) => setFormRota(e.target.value)}
                    placeholder="Ex.: DHL Cajamar · Rota Grande SP"
                    className={modalInputCls}
                  />
                </div>

                <div>
                  <label className={modalLabelCls}>Placa</label>
                  <input
                    type="text"
                    list="workday-placas"
                    value={formPlaca}
                    onChange={(e) => setFormPlaca(e.target.value.toUpperCase())}
                    placeholder="ABC1D23"
                    className={`${modalInputCls} font-mono uppercase`}
                  />
                  <datalist id="workday-placas">
                    {veiculos.map((v) => (
                      <option key={v.id} value={v.placa}>
                        {v.modelo ? `${v.placa} · ${v.modelo}` : v.placa}
                      </option>
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className={modalLabelCls}>Turno</label>
                  <select
                    value={formTurno}
                    onChange={(e) => setFormTurno(e.target.value as TurnoTrabalho)}
                    className={modalInputCls}
                  >
                    {(Object.keys(TURNO_TRABALHO_LABELS) as TurnoTrabalho[]).map((t) => (
                      <option key={t} value={t}>
                        {TURNO_TRABALHO_LABELS[t]}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={modalLabelCls}>Valor da Diária (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formValorDiaria}
                    onChange={(e) => setFormValorDiaria(e.target.value)}
                    placeholder="0,00"
                    className={`${modalInputCls} font-mono`}
                  />
                </div>

                <div>
                  <label className={modalLabelCls}>Status</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as StatusDiaTrabalhado)}
                    className={modalInputCls}
                  >
                    {(Object.keys(STATUS_DIA_LABELS) as StatusDiaTrabalhado[]).map((st) => (
                      <option key={st} value={st}>
                        {STATUS_DIA_LABELS[st]}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={modalLabelCls}>Proprietário (Opcional)</label>
                  <select
                    value={formPropId}
                    onChange={(e) => setFormPropId(e.target.value)}
                    className={modalInputCls}
                  >
                    <option value="">Sem vínculo</option>
                    {proprietarios.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nomeCompleto}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className={modalLabelCls}>Observações</label>
                  <input
                    type="text"
                    value={formObs}
                    onChange={(e) => setFormObs(e.target.value)}
                    placeholder="Anotações da diária ou rota (opcional)"
                    className={modalInputCls}
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/80 dark:border-white/[0.07] pt-4">
                <div>
                  {editingDia && (
                    <button
                      type="button"
                      disabled={savingDia}
                      onClick={async () => {
                        setSavingDia(true);
                        try {
                          await deleteDiaTrabalhado(editingDia.id);
                          onToast('success', 'Registro de dia trabalhado removido.');
                          setWorkdayModalOpen(false);
                        } finally {
                          setSavingDia(false);
                        }
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 px-3.5 py-2 text-xs font-medium text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-950/70 whitespace-nowrap"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Excluir Dia
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setWorkdayModalOpen(false)}
                    className="rounded-lg border border-slate-300 dark:border-white/[0.1] bg-white dark:bg-white/[0.04] px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.08] whitespace-nowrap"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={savingDia || motoristas.length === 0}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white shadow-xs hover:bg-blue-500 disabled:opacity-50 whitespace-nowrap"
                  >
                    {savingDia
                      ? 'Salvando...'
                      : editingDia
                        ? 'Salvar Alterações'
                        : `Registrar ${formDates.length || 0} Dia(s)`}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

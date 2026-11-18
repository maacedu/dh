import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface ScrollableTableCardProps {
  header?: ReactNode;
  headerRight?: ReactNode;
  children: ReactNode;
}

export function ScrollableTableCard({
  header,
  headerRight,
  children,
}: ScrollableTableCardProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(maxScroll > 2 && el.scrollLeft < maxScroll - 2);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollState();

    const ro = new ResizeObserver(() => {
      updateScrollState();
    });
    ro.observe(el);
    if (el.firstElementChild) {
      ro.observe(el.firstElementChild);
    }

    window.addEventListener('resize', updateScrollState);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', updateScrollState);
    };
  }, [updateScrollState, children]);

  function scrollByDirection(direction: -1 | 1) {
    const el = scrollRef.current;
    if (!el) return;
    const step = Math.max(260, Math.round(el.clientWidth * 0.65));
    el.scrollBy({ left: step * direction, behavior: 'smooth' });
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/90 dark:border-white/[0.08] bg-white dark:bg-[#0F1520]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 dark:border-white/[0.07] bg-slate-50/80 dark:bg-white/[0.02] px-4 py-2.5">
        <div className="min-w-0 flex-1 text-[11px] text-slate-500 dark:text-slate-400">
          {header}
        </div>

        <div className="flex items-center gap-2.5">
          {headerRight}
          <div
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200/90 dark:border-white/[0.1] bg-white dark:bg-[#0B0F17] p-0.5 shadow-2xs"
            role="group"
            aria-label="Rolar colunas da tabela"
          >
            <button
              type="button"
              onClick={() => scrollByDirection(-1)}
              disabled={!canScrollLeft}
              title="Ver colunas anteriores"
              aria-label="Rolar tabela para a esquerda"
              className="inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-600 dark:text-slate-300 transition-colors hover:bg-slate-100 dark:hover:bg-white/[0.08] hover:text-slate-900 dark:hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="hidden sm:inline px-1 text-[10px] font-medium text-slate-500 dark:text-slate-400 select-none">
              Colunas
            </span>
            <button
              type="button"
              onClick={() => scrollByDirection(1)}
              disabled={!canScrollRight}
              title="Ver próximas colunas"
              aria-label="Rolar tabela para a direita"
              className="inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-600 dark:text-slate-300 transition-colors hover:bg-slate-100 dark:hover:bg-white/[0.08] hover:text-slate-900 dark:hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      <div ref={scrollRef} onScroll={updateScrollState} className="overflow-x-auto">
        {children}
      </div>
    </div>
  );
}

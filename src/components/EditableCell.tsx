import { useEffect, useRef, useState } from 'react';
import { Pencil } from 'lucide-react';

interface EditableCellProps {
  value: string;
  placeholder?: string;
  type?: 'text' | 'date';
  mono?: boolean;
  displayValue?: string;
  requiredPending?: boolean;
  tone?: 'default' | 'emerald';
  onSave: (nextValue: string) => Promise<void> | void;
  onError?: (err: unknown) => void;
}

export function EditableCell({
  value,
  placeholder = '—',
  type = 'text',
  mono = false,
  displayValue,
  requiredPending = false,
  tone = 'default',
  onSave,
  onError,
}: EditableCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      if (type === 'text') {
        inputRef.current.select();
      }
    }
  }, [editing, type]);

  async function commit() {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed === value) return;
    setSaving(true);
    try {
      await onSave(trimmed);
    } catch (err) {
      setDraft(value);
      if (onError) {
        onError(err);
      }
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type={type}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            commit();
          } else if (e.key === 'Escape') {
            setDraft(value);
            setEditing(false);
          }
        }}
        className={`w-full min-w-[110px] rounded-md border border-blue-500 bg-white dark:bg-[#0B0F17] px-2.5 py-1 text-xs text-slate-900 dark:text-slate-100 outline-none ring-2 ring-blue-500/20 ${
          mono ? 'font-mono tabular-nums' : ''
        }`}
      />
    );
  }

  const isEmpty = !value.trim();
  const shown = displayValue ?? (isEmpty ? placeholder : value);
  const isEmerald = tone === 'emerald';

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      title="Clique para editar"
      className={`group flex w-full items-center justify-between gap-1.5 rounded-md px-2 py-1 text-left text-xs transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
        isEmerald
          ? 'hover:bg-emerald-500/15'
          : 'hover:bg-slate-100/90 dark:hover:bg-white/[0.06]'
      } ${saving ? 'opacity-60' : ''}`}
    >
      <span
        className={`truncate ${mono ? 'font-mono tabular-nums' : ''} ${
          isEmpty && requiredPending
            ? 'text-slate-500 dark:text-slate-400'
            : isEmpty
              ? 'text-slate-400 dark:text-slate-500'
              : isEmerald
                ? 'font-medium text-emerald-800 dark:text-emerald-300'
                : 'text-slate-800 dark:text-slate-200'
        }`}
      >
        {shown}
      </span>
      <Pencil
        className={`h-3 w-3 shrink-0 opacity-0 transition-opacity duration-150 group-hover:opacity-80 group-focus-visible:opacity-80 ${
          isEmerald
            ? 'text-emerald-600 dark:text-emerald-400'
            : 'text-slate-400 dark:text-slate-400'
        }`}
      />
    </button>
  );
}

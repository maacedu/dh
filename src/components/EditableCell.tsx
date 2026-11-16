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
  placeholder = 'Pendente',
  type = 'text',
  mono = false,
  displayValue,
  requiredPending = true,
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
        className={`w-full min-w-[110px] rounded border border-blue-500 bg-white dark:bg-zinc-950 px-2 py-1 text-xs text-slate-900 dark:text-zinc-100 outline-none ring-2 ring-blue-500/20 ${
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
      title="Clique para editar manualmente"
      className={`group flex w-full items-center justify-between gap-1.5 rounded px-1.5 py-1 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
        isEmerald
          ? 'hover:bg-emerald-100/70 dark:hover:bg-emerald-900/40'
          : 'hover:bg-slate-100 dark:hover:bg-zinc-800/80'
      } ${saving ? 'opacity-60' : ''}`}
    >
      <span
        className={`truncate ${mono ? 'font-mono tabular-nums' : ''} ${
          isEmpty && requiredPending
            ? 'font-medium text-amber-700 dark:text-amber-400'
            : isEmpty
              ? 'text-slate-400 dark:text-zinc-500'
              : isEmerald
                ? 'font-medium text-emerald-800 dark:text-emerald-300'
                : 'text-slate-800 dark:text-zinc-200'
        }`}
      >
        {shown}
      </span>
      <Pencil
        className={`h-3 w-3 shrink-0 opacity-45 transition-opacity group-hover:opacity-100 ${
          isEmerald
            ? 'text-emerald-600 dark:text-emerald-400'
            : 'text-slate-400 dark:text-zinc-500'
        }`}
      />
    </button>
  );
}

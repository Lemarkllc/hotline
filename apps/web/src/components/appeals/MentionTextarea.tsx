import { useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";

const MRU_KEY = "hotline-mention-mru";

function readMru(): string[] {
  try {
    const raw = localStorage.getItem(MRU_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function bumpMru(id: string): void {
  const mru = readMru().filter((x) => x !== id);
  mru.unshift(id);
  localStorage.setItem(MRU_KEY, JSON.stringify(mru.slice(0, 50)));
}

/** Находит незакрытый "@фрагмент" сразу перед курсором — например, для
 * "привет @ива|" (курсор на |) вернёт { start: 7, query: "ива" }. null, если курсор
 * не внутри такого фрагмента (нет "@" перед ним без пробела между ними). */
function findActiveMention(text: string, caret: number): { start: number; query: string } | null {
  const uptoCaret = text.slice(0, caret);
  const at = uptoCaret.lastIndexOf("@");
  if (at === -1) return null;
  const between = uptoCaret.slice(at + 1);
  if (/\s/.test(between)) return null; // пробел — @фрагмент уже закрыт
  if (at > 0 && !/\s/.test(text[at - 1]!)) return null; // "@" не в начале слова (e.g. "email@x")
  return { start: at, query: between };
}

interface MentionableUser {
  id: string;
  fullName: string;
}

export function MentionTextarea({
  value,
  onChange,
  users,
  mentionedUserIds,
  onMentionedUserIdsChange,
  onSubmit,
  placeholder,
  rows = 2,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  users: MentionableUser[];
  mentionedUserIds: string[];
  onMentionedUserIdsChange: (ids: string[]) => void;
  onSubmit: () => void;
  placeholder?: string;
  rows?: number;
  /** Переопределяет визуал внутреннего Textarea (мобильная input-bar, design_handoff_mobile_pwa) —
   * логика упоминаний/MRU/клавиатурной навигации при этом не дублируется. */
  className?: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [mention, setMention] = useState<{ start: number; query: string } | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const candidates = mention
    ? users
        .filter((u) => u.fullName.toLowerCase().includes(mention.query.toLowerCase()))
        .sort((a, b) => {
          const mru = readMru();
          const ia = mru.indexOf(a.id);
          const ib = mru.indexOf(b.id);
          if (ia === -1 && ib === -1) return a.fullName.localeCompare(b.fullName);
          if (ia === -1) return 1;
          if (ib === -1) return -1;
          return ia - ib;
        })
        .slice(0, 8)
    : [];

  function selectMention(user: MentionableUser) {
    if (!mention || !textareaRef.current) return;
    const caret = textareaRef.current.selectionStart ?? value.length;
    const before = value.slice(0, mention.start);
    const after = value.slice(caret);
    const inserted = `@${user.fullName} `;
    onChange(before + inserted + after);
    if (!mentionedUserIds.includes(user.id)) {
      onMentionedUserIdsChange([...mentionedUserIds, user.id]);
    }
    bumpMru(user.id);
    setMention(null);
    // Курсор — сразу после вставленного упоминания, не в конец текста.
    requestAnimationFrame(() => {
      const pos = before.length + inserted.length;
      textareaRef.current?.setSelectionRange(pos, pos);
      textareaRef.current?.focus();
    });
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const text = e.target.value;
    onChange(text);
    const caret = e.target.selectionStart ?? text.length;
    const active = findActiveMention(text, caret);
    setMention(active);
    setActiveIndex(0);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (mention && candidates.length) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % candidates.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + candidates.length) % candidates.length);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        selectMention(candidates[activeIndex]!);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setMention(null);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  }

  return (
    <div className="relative flex-1">
      <Textarea
        ref={textareaRef}
        rows={rows}
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          // Небольшая задержка — иначе onBlur съедает клик по пункту списка раньше onClick.
          setTimeout(() => setMention(null), 150);
        }}
        className={className}
      />
      {mention && candidates.length > 0 && (
        <div className="absolute bottom-full left-0 z-20 mb-1 w-64 rounded-md border border-border bg-surface p-1 shadow-lg">
          {candidates.map((u, i) => (
            <button
              key={u.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => selectMention(u)}
              className={
                "block w-full rounded-sm px-2 py-1.5 text-left text-sm " +
                (i === activeIndex ? "bg-primary/10 text-primary" : "hover:bg-background")
              }
            >
              {u.fullName}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

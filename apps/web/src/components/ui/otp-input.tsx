import { useRef } from "react";
import { cn } from "@/lib/utils";

interface OtpInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  error?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
}

/** Шесть отдельных полей кода (Auth.dc.html "2b") — вставка шестизначного кода
 * распределяется по всем полям сразу, не только в то, что в фокусе. */
export function OtpInput({ length = 6, value, onChange, onComplete, error, disabled, autoFocus }: OtpInputProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? "");

  function setDigit(index: number, digit: string) {
    const next = digits.slice();
    next[index] = digit;
    const joined = next.join("");
    onChange(joined);
    if (joined.length === length) onComplete?.(joined);
  }

  function handleChange(index: number, raw: string) {
    const digit = raw.replace(/\D/g, "").slice(-1);
    setDigit(index, digit);
    if (digit && index < length - 1) refs.current[index + 1]?.focus();
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      refs.current[index - 1]?.focus();
    } else if (e.key === "ArrowLeft" && index > 0) {
      refs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < length - 1) {
      refs.current[index + 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (!pasted) return;
    e.preventDefault();
    onChange(pasted);
    if (pasted.length === length) onComplete?.(pasted);
    refs.current[Math.min(pasted.length, length - 1)]?.focus();
  }

  return (
    <div className="flex gap-2" onPaste={handlePaste}>
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          autoFocus={autoFocus && i === 0}
          disabled={disabled}
          aria-invalid={error}
          value={digit}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          className={cn(
            "h-[52px] w-[44px] rounded-md border border-rule-strong bg-surface text-center font-mono text-[22px] font-medium text-text-1",
            "focus-visible:outline-none focus-visible:border-2 focus-visible:border-text-1",
            error && "border-status-overdue text-status-overdue",
            disabled && "cursor-not-allowed opacity-50",
          )}
        />
      ))}
    </div>
  );
}

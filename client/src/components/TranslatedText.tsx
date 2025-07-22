import { TranslationTooltip } from "./TranslationTooltip";

interface TranslatedTextProps {
  text: string;
  className?: string;
}

export function TranslatedText({ text, className = "" }: TranslatedTextProps) {
  // Split text into words, preserving spaces and punctuation
  const words = text.split(/(\s+|[،؛؟!.\n])/);

  return (
    <span className={className}>
      {words.map((part, index) => {
        // If it's whitespace or punctuation, render as-is
        if (/^\s+$/.test(part) || /^[،؛؟!.\n]+$/.test(part)) {
          return <span key={index}>{part}</span>;
        }

        // If it's a word (contains Arabic characters), wrap with translation tooltip
        if (/[\u0600-\u06FF]/.test(part)) {
          return (
            <TranslationTooltip key={index} word={part}>
              {part}
            </TranslationTooltip>
          );
        }

        // For any other content, render as-is
        return <span key={index}>{part}</span>;
      })}
    </span>
  );
}
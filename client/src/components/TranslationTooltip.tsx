import { useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getTranslation } from "@/data/arabicDictionary";

interface TranslationTooltipProps {
  word: string;
  children: React.ReactNode;
}

export function TranslationTooltip({ word, children }: TranslationTooltipProps) {
  const [translation] = useState(() => getTranslation(word));

  if (!translation) {
    return <>{children}</>;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-help hover:bg-blue-100 hover:bg-opacity-30 rounded px-0.5 transition-colors">
            {children}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <p className="text-sm font-medium">{translation}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
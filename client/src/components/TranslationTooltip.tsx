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
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-help hover:bg-blue-100 dark:hover:bg-blue-900 hover:bg-opacity-40 dark:hover:bg-opacity-40 rounded px-0.5 transition-all duration-150 ease-in-out">
            {children}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{translation}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
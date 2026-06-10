'use client';

import { useCallback } from 'react';
import { FileText, List, Brain, HelpCircle, Lightbulb, ArrowRight, BookOpen, Search } from 'lucide-react';

interface QuickResponseBarProps {
  hasDocuments: boolean;
  onSelect: (text: string) => void;
  disabled?: boolean;
}

const noDocChips = [
  { icon: FileText, label: 'What can you do?', query: 'What can you do? How does document Q&A work?' },
  { icon: HelpCircle, label: 'How to upload?', query: 'How do I upload and query my documents?' },
  { icon: Lightbulb, label: 'Supported formats?', query: 'What file formats are supported for upload?' },
];

const withDocChips = [
  { icon: List, label: 'Summarize', query: 'Provide a comprehensive summary of the uploaded documents' },
  { icon: Brain, label: 'Key insights', query: 'What are the key insights and main takeaways from the documents?' },
  { icon: BookOpen, label: 'Key terms', query: 'What are the most important terms and concepts defined in the documents?' },
  { icon: Search, label: 'Find details', query: 'What specific details and data points are mentioned in the documents?' },
  { icon: ArrowRight, label: 'Compare', query: 'Compare and contrast the different topics covered in the documents' },
  { icon: Lightbulb, label: 'Gaps & questions', query: 'What questions remain unanswered or what gaps exist in the documents?' },
];

export function QuickResponseBar({ hasDocuments, onSelect, disabled }: QuickResponseBarProps) {
  const chips = hasDocuments ? withDocChips : noDocChips;

  const handleClick = useCallback((query: string) => {
    if (!disabled) {
      onSelect(query);
    }
  }, [onSelect, disabled]);

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
      {chips.map((chip) => {
        const Icon = chip.icon;
        return (
          <button
            key={chip.label}
            onClick={() => handleClick(chip.query)}
            disabled={disabled}
            className={`
              shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium
              transition-all duration-200 active:scale-95
              dark:bg-white/[0.04] dark:text-white/50 dark:border-white/[0.06]
              dark:hover:bg-white/[0.07] dark:hover:text-white/70 dark:hover:border-purple-500/20
              bg-black/[0.03] text-gray-600 border border-black/[0.06]
              hover:bg-purple-50 hover:text-purple-700 hover:border-purple-200
              disabled:opacity-40 disabled:cursor-not-allowed
            `}
          >
            <Icon size={11} className="shrink-0" />
            <span>{chip.label}</span>
          </button>
        );
      })}
    </div>
  );
}

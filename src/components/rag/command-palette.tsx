'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from '@/components/ui/command';
import {
  Plus,
  PanelLeft,
  Upload,
  Download,
  MessageSquare,
  Sparkles,
} from 'lucide-react';

export interface CommandAction {
  id: string;
  label: string;
  group: string;
  icon: React.ReactNode;
  shortcut?: string;
  action: () => void;
}

interface CommandPaletteProps {
  onNewConversation: () => void;
  onToggleSidebar: () => void;
  onUploadDocument: () => void;
  onExportChat: () => void;
  onPrefillQuestion: (question: string) => void;
}

// ─── Keyboard Shortcut Badge ──────────────────────────────────────────
function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[20px] h-[18px] px-1.5 rounded-[4px] bg-white/[0.06] border border-white/[0.1] text-[9px] text-white/60 font-mono shadow-[0_1px_0_rgba(255,255,255,0.05)]">
      {children}
    </kbd>
  );
}

export function CommandPalette({
  onNewConversation,
  onToggleSidebar,
  onUploadDocument,
  onExportChat,
  onPrefillQuestion,
}: CommandPaletteProps) {
  const [open, setOpen] = useState(false);

  // Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const runAction = useCallback(
    (action: () => void) => {
      setOpen(false);
      action();
    },
    []
  );

  const commands: CommandAction[] = [
    {
      id: 'new-conversation',
      label: 'New conversation',
      group: 'Actions',
      icon: <Plus size={16} className="text-purple-400/70" />,
      shortcut: '⌘N',
      action: () => onNewConversation(),
    },
    {
      id: 'toggle-sidebar',
      label: 'Toggle sidebar',
      group: 'Actions',
      icon: <PanelLeft size={16} className="text-purple-400/70" />,
      action: () => onToggleSidebar(),
    },
    {
      id: 'upload-document',
      label: 'Upload document',
      group: 'Actions',
      icon: <Upload size={16} className="text-purple-400/70" />,
      action: () => onUploadDocument(),
    },
    {
      id: 'export-chat',
      label: 'Export chat',
      group: 'Actions',
      icon: <Download size={16} className="text-purple-400/70" />,
      action: () => onExportChat(),
    },
    {
      id: 'ask-topics',
      label: 'Ask: What are the main topics?',
      group: 'Quick Questions',
      icon: <MessageSquare size={16} className="text-emerald-400/70" />,
      action: () => onPrefillQuestion('What are the main topics?'),
    },
    {
      id: 'ask-summarize',
      label: 'Ask: Summarize key points',
      group: 'Quick Questions',
      icon: <MessageSquare size={16} className="text-emerald-400/70" />,
      action: () => onPrefillQuestion('Summarize key points'),
    },
    {
      id: 'ask-conclusions',
      label: 'Ask: What conclusions are drawn?',
      group: 'Quick Questions',
      icon: <Sparkles size={16} className="text-emerald-400/70" />,
      action: () => onPrefillQuestion('What conclusions are drawn?'),
    },
  ];

  const actionCommands = commands.filter((c) => c.group === 'Actions');
  const questionCommands = commands.filter((c) => c.group === 'Quick Questions');

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Command Palette"
      description="Search for a command to run..."
      className="bg-[#161923]/95 border-white/[0.1] backdrop-blur-2xl shadow-2xl shadow-purple-500/5 sm:max-w-md"
    >
      <CommandInput
        placeholder="Type a command or question..."
        className="text-white/80 placeholder:text-white/55"
      />
      <CommandList className="max-h-[280px]">
        <CommandEmpty className="text-white/60 text-xs py-4">
          No commands found.
        </CommandEmpty>
        <CommandGroup heading="Actions" className="[&_[cmdk-group-heading]]:text-white/55 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider">
          {actionCommands.map((cmd) => (
            <CommandItem
              key={cmd.id}
              onSelect={() => runAction(cmd.action)}
              className="text-white/60 data-[selected=true]:text-white/90 data-[selected=true]:bg-purple-500/10 data-[selected=true]:border-l-2 data-[selected=true]:border-l-purple-400/40 rounded-lg cursor-pointer py-2.5 px-3 transition-all"
            >
              <span className="mr-2.5 flex items-center justify-center w-5 h-5 rounded-md bg-white/[0.06] border border-white/[0.08]">
                {cmd.icon}
              </span>
              <span className="flex-1 text-xs font-medium">{cmd.label}</span>
              {cmd.shortcut && (
                <span className="ml-auto flex items-center gap-0.5">
                  <Kbd>{cmd.shortcut}</Kbd>
                </span>
              )}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator className="bg-white/[0.06]" />
        <CommandGroup heading="Quick Questions" className="[&_[cmdk-group-heading]]:text-white/55 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider">
          {questionCommands.map((cmd) => (
            <CommandItem
              key={cmd.id}
              onSelect={() => runAction(cmd.action)}
              className="text-white/60 data-[selected=true]:text-white/90 data-[selected=true]:bg-purple-500/10 data-[selected=true]:border-l-2 data-[selected=true]:border-l-purple-400/40 rounded-lg cursor-pointer py-2.5 px-3 transition-all"
            >
              <span className="mr-2.5 flex items-center justify-center w-5 h-5 rounded-md bg-white/[0.06] border border-white/[0.08]">
                {cmd.icon}
              </span>
              <span className="flex-1 text-xs font-medium">{cmd.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
      {/* Footer with polished shortcut badges */}
      <div className="border-t border-white/[0.06] px-3 py-2.5 flex items-center justify-between">
        <span className="text-[10px] text-white/50 flex items-center gap-1">
          <Kbd>{typeof navigator !== 'undefined' && /Mac|iPhone/.test(navigator.userAgent) ? '⌘' : 'Ctrl'}</Kbd>
          <span className="text-white/30">+</span>
          <Kbd>K</Kbd>
          <span className="ml-1">to toggle</span>
        </span>
        <span className="text-[10px] text-white/50 flex items-center gap-1">
          <Kbd>↑↓</Kbd>
          <span className="text-white/30">navigate</span>
          <span className="text-white/30">•</span>
          <Kbd>↵</Kbd>
          <span className="text-white/30">select</span>
        </span>
      </div>
    </CommandDialog>
  );
}

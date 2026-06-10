'use client';

import { useTheme } from 'next-themes';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional mount detection for SSR hydration
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/[0.06] transition-colors" aria-label="Toggle theme">
        <div className="w-3.5 h-3.5" />
      </button>
    );
  }

  const cycleTheme = () => {
    if (theme === 'dark') setTheme('light');
    else if (theme === 'light') setTheme('system');
    else setTheme('dark');
  };

  const icon = theme === 'light' ? <Sun size={14} /> : theme === 'dark' ? <Moon size={14} /> : <Monitor size={14} />;
  const label = theme === 'light' ? 'Light mode' : theme === 'dark' ? 'Dark mode' : 'System theme';

  return (
    <button
      onClick={cycleTheme}
      className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/[0.06] dark:hover:bg-white/[0.06] hover:bg-black/[0.06] transition-all text-white/55 dark:text-white/55 text-gray-600 active:scale-95"
      aria-label={label}
      title={label}
    >
      {icon}
    </button>
  );
}

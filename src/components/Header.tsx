import { Sun, Moon } from "lucide-react";

interface HeaderProps {
  darkMode: boolean;
  setDarkMode: (dark: boolean) => void;
  navigate: (path: string) => void;
}

export default function Header({ darkMode, setDarkMode, navigate }: HeaderProps) {
  return (
    <header className={`sticky top-0 z-50 w-full border-b backdrop-blur-md transition-colors duration-300 ${
      darkMode 
        ? "bg-zinc-950/80 border-zinc-900 text-zinc-100" 
        : "bg-white/80 border-zinc-200 text-zinc-900"
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Left Side: Site Name without logo */}
        <div 
          onClick={() => navigate("/")}
          className="cursor-pointer group flex items-center gap-1.5"
        >
          <span className="font-display text-2xl font-black tracking-tight bg-gradient-to-r from-violet-600 to-fuchsia-500 bg-clip-text text-transparent group-hover:opacity-90 transition-opacity">
            StreamVault
          </span>
          <span className={`text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded font-bold font-mono transition-colors ${
            darkMode ? "bg-zinc-900 text-zinc-400" : "bg-zinc-100 text-zinc-500"
          }`}>
            Hub
          </span>
        </div>

        {/* Right Side: Day / Night toggle button */}
        <button
          onClick={() => setDarkMode(!darkMode)}
          className={`p-2.5 rounded-xl border transition-all duration-300 ${
            darkMode 
              ? "bg-zinc-900 border-zinc-800 hover:bg-zinc-800 text-amber-400 hover:text-amber-300 shadow-[0_0_15px_rgba(251,191,36,0.1)]" 
              : "bg-zinc-50 border-zinc-200 hover:bg-zinc-100 text-indigo-600 hover:text-indigo-700 shadow-sm"
          }`}
          aria-label="Toggle Night Mode"
          id="night-mode-toggle"
        >
          {darkMode ? (
            <Sun className="w-5 h-5 animate-pulse" />
          ) : (
            <Moon className="w-5 h-5" />
          )}
        </button>
      </div>
    </header>
  );
}

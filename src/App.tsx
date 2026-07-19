import { useState, useEffect } from "react";
import Header from "./components/Header";
import PlayerView from "./components/PlayerView";
import DownloadView from "./components/DownloadView";
import AdminDashboardView from "./components/AdminDashboardView";
import HomeView from "./components/HomeView";

export default function App() {
  const [path, setPath] = useState(window.location.pathname);
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem("theme");
    return saved ? saved === "dark" : true; // Default to dark/theater mode
  });

  // Client-side routing hook
  useEffect(() => {
    const handlePopState = () => {
      setPath(window.location.pathname);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Theme Sync hook
  useEffect(() => {
    localStorage.setItem("theme", darkMode ? "dark" : "light");
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode]);

  const navigate = (newPath: string) => {
    window.history.pushState(null, "", newPath);
    setPath(newPath);
  };

  // Route Resolver
  const renderRoute = () => {
    // 1. Secret system control portal
    if (path.startsWith("/system-gateway")) {
      return <AdminDashboardView darkMode={darkMode} navigate={navigate} />;
    }

    // 2. Home dashboard view
    if (path.startsWith("/home")) {
      return <HomeView darkMode={darkMode} navigate={navigate} />;
    }

    // 3. Secure Downloader view (format: /download/:slug)
    if (path.startsWith("/download/")) {
      const slug = path.split("/")[2] || "";
      return <DownloadView slug={slug} darkMode={darkMode} navigate={navigate} />;
    }

    // 4. Immersive Streaming view (format: /:slug)
    // Strip leading slash
    const slug = path.substring(1);
    if (slug && slug !== "home" && slug !== "index.html" && slug !== "player" && slug !== "player/") {
      return <PlayerView slug={slug} darkMode={darkMode} navigate={navigate} />;
    }

    // Fallback: If root or empty, we load PlayerView with an empty slug (triggering missing parameter message)
    return <PlayerView slug="" darkMode={darkMode} navigate={navigate} />;
  };

  return (
    <div className={`min-h-screen font-sans antialiased transition-colors duration-300 ${
      darkMode ? "bg-zinc-950 text-zinc-100" : "bg-zinc-50 text-zinc-900"
    }`}>
      {/* Header bar on top of all pages */}
      <Header darkMode={darkMode} setDarkMode={setDarkMode} navigate={navigate} />
      
      {/* Dynamic page content depending on active route */}
      <main className="w-full">
        {renderRoute()}
      </main>
    </div>
  );
}

import React, { useState, useEffect } from "react";
import { Video } from "../types";
import { 
  LayoutDashboard, FileVideo, Eye, HardDrive, Shield, Activity, 
  Plus, Trash2, Edit2, Search, ArrowLeft, Laptop, Tablet, 
  Smartphone, Globe, RefreshCw, X, AlertCircle, CheckCircle2,
  Calendar, Clock, Film, Sparkles, ExternalLink, Lock
} from "lucide-react";
import { getApiUrl } from "../utils/api";
import { generateRandomSlug } from "./HomeView";

interface AdminDashboardViewProps {
  darkMode: boolean;
  navigate: (path: string) => void;
}

interface AnalyticsData {
  totalFiles: number;
  totalViews: number;
  totalStorage: string;
  dailyViews: { date: string; views: number }[];
  deviceStats: { name: string; value: number }[];
  browserStats: { name: string; value: number }[];
  osStats: { name: string; value: number }[];
  topVideos: { title: string; slug: string; views: number; fileSize: number }[];
  recentLogs: {
    title: string;
    slug: string;
    ip: string;
    browser: string;
    device: string;
    os: string;
    timestamp: string;
  }[];
  mongoStorageSize?: string;
  mongoCollections?: number;
  mongoDocuments?: number;
  isMongoActive?: boolean;
}

export default function AdminDashboardView({ darkMode, navigate }: AdminDashboardViewProps) {
  // Authentication states
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem("sys_auth") === "true";
  });
  const [authPassword, setAuthPassword] = useState<string>(() => {
    return sessionStorage.getItem("sys_key") || "";
  });
  const [typedPassword, setTypedPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  const [activeTab, setActiveTab] = useState<"overview" | "files">("overview");
  const [videos, setVideos] = useState<Video[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  
  // File Search
  const [searchQuery, setSearchQuery] = useState("");

  // Video Form states (Add/Edit)
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingVideo, setEditingVideo] = useState<Video | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    slug: "",
    description: "",
    videoUrl: "",
    downloadUrl: "",
    thumbnailUrl: "",
    duration: "05:00",
    fileSize: "124.5",
  });
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete confirmation
  const [deleteConfirmSlug, setDeleteConfirmSlug] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated]);

  const handleVerifyPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setIsVerifying(true);

    // Give a short natural delay for verification feedback
    await new Promise((resolve) => setTimeout(resolve, 600));

    try {
      // @ts-ignore
      const correctPassword = import.meta.env.VITE_ADMIN_PASSWORD || "MySecureAdminPassword123";
      
      if (typedPassword === correctPassword) {
        sessionStorage.setItem("sys_auth", "true");
        sessionStorage.setItem("sys_key", typedPassword);
        setAuthPassword(typedPassword);
        setIsAuthenticated(true);
      } else {
        throw new Error("Incorrect security password entered.");
      }
    } catch (err: any) {
      setAuthError(err.message || "Failed to authenticate.");
    } finally {
      setIsVerifying(false);
    }
  };

  const fetchData = async () => {
    try {
      setIsLoading(true);
      setError("");
      
      // Fetch both videos list and analytics summary
      const [videosRes, analyticsRes] = await Promise.all([
        fetch(getApiUrl("/api/videos")),
        fetch(getApiUrl("/api/analytics"))
      ]);

      if (!videosRes.ok || !analyticsRes.ok) {
        if (videosRes.status === 401 || analyticsRes.status === 401) {
          sessionStorage.removeItem("sys_auth");
          sessionStorage.removeItem("sys_key");
          setIsAuthenticated(false);
          throw new Error("Session expired. Please re-enter password.");
        }
        throw new Error("Failed to load dashboard data from backend server.");
      }

      const videosData = await videosRes.json();
      const analyticsData = await analyticsRes.json();

      setVideos(videosData);
      setAnalytics(analyticsData);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred while loading server analytics.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenAddModal = () => {
    setEditingVideo(null);
    setFormData({
      title: "",
      slug: generateRandomSlug(10),
      description: "",
      videoUrl: "",
      downloadUrl: "",
      thumbnailUrl: "",
      duration: "05:00",
      fileSize: "124.5",
    });
    setFormError("");
    setFormSuccess("");
    setShowFormModal(true);
  };

  const handleOpenEditModal = (video: Video) => {
    setEditingVideo(video);
    setFormData({
      title: video.title,
      slug: video.slug,
      description: video.description || "",
      videoUrl: video.videoUrl,
      downloadUrl: video.downloadUrl || "",
      thumbnailUrl: video.thumbnailUrl || "",
      duration: video.duration || "05:00",
      fileSize: video.fileSize ? video.fileSize.toString() : "124.5",
    });
    setFormError("");
    setFormSuccess("");
    setShowFormModal(true);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");
    setIsSubmitting(true);

    const endpoint = editingVideo 
      ? `/api/videos/${editingVideo.slug}`
      : "/api/videos";
    
    const method = editingVideo ? "PUT" : "POST";

    try {
      const res = await fetch(getApiUrl(endpoint), {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to save video details.");
      }

      setFormSuccess(editingVideo ? "Video updated successfully!" : "Video registered successfully!");
      
      // Refresh list and analytics
      await fetchData();

      setTimeout(() => {
        setShowFormModal(false);
      }, 1500);

    } catch (err: any) {
      setFormError(err.message || "A network error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteVideo = async (slug: string) => {
    try {
      setIsLoading(true);

      const res = await fetch(getApiUrl(`/api/videos/${slug}`), {
        method: "DELETE"
      });

      if (!res.ok) {
        throw new Error("Failed to delete video file entry.");
      }

      setDeleteConfirmSlug(null);
      await fetchData();
    } catch (err: any) {
      setError(err.message || "Failed to remove directory video.");
    } finally {
      setIsLoading(false);
    }
  };

  // Filter videos based on search
  const filteredVideos = videos.filter(v => 
    v.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (v.description && v.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Pagination for Files
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;

  const totalItems = filteredVideos.length;
  const isLimitReached = totalItems <= itemsPerPage;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const activePage = Math.min(currentPage, totalPages);
  const indexOfLastItem = activePage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentFilteredVideos = filteredVideos.slice(indexOfFirstItem, indexOfLastItem);

  // SVG Area Chart calculations
  const renderSvgChart = () => {
    if (!analytics || !analytics.dailyViews || analytics.dailyViews.length === 0) return null;

    const data = analytics.dailyViews;
    const width = 800;
    const height = 240;
    const padding = 40;

    const maxVal = Math.max(...data.map(d => d.views), 10);
    const scaleX = (width - padding * 2) / (data.length - 1);
    const scaleY = (height - padding * 2) / maxVal;

    // Create points
    const points = data.map((d, i) => {
      const x = padding + i * scaleX;
      const y = height - padding - d.views * scaleY;
      return { x, y, val: d.views, date: d.date };
    });

    // Create path string
    const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
    
    // Create area path string (extends to bottom)
    const areaPath = `
      ${linePath}
      L ${points[points.length - 1].x} ${height - padding}
      L ${points[0].x} ${height - padding}
      Z
    `;

    return (
      <div className="relative w-full overflow-x-auto pb-4">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[600px] h-[240px] select-none">
          {/* Gradients */}
          <defs>
            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#8b5cf6" />
              <stop offset="50%" stopColor="#d946ef" />
              <stop offset="100%" stopColor="#6366f1" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
            const y = padding + (height - padding * 2) * ratio;
            const val = Math.round(maxVal * (1 - ratio));
            return (
              <g key={idx}>
                <line 
                  x1={padding} 
                  y1={y} 
                  x2={width - padding} 
                  y2={y} 
                  className={darkMode ? "stroke-zinc-800" : "stroke-zinc-200"} 
                  strokeDasharray="4 4"
                />
                <text 
                  x={padding - 10} 
                  y={y + 4} 
                  textAnchor="end" 
                  className={`text-[10px] font-mono fill-current opacity-50 ${darkMode ? "text-zinc-400" : "text-zinc-600"}`}
                >
                  {val}
                </text>
              </g>
            );
          })}

          {/* Area under curve */}
          <path d={areaPath} fill="url(#areaGrad)" />

          {/* Core Curve Line */}
          <path 
            d={linePath} 
            fill="none" 
            stroke="url(#lineGrad)" 
            strokeWidth="3.5" 
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Interactive dots & hover triggers */}
          {points.map((p, idx) => (
            <g key={idx} className="group cursor-pointer">
              {/* Outer hover ring */}
              <circle 
                cx={p.x} 
                cy={p.y} 
                r="10" 
                className="fill-violet-500/0 hover:fill-violet-500/10 transition-colors duration-200"
              />
              {/* Core Dot */}
              <circle 
                cx={p.x} 
                cy={p.y} 
                r="4.5" 
                className={`fill-zinc-950 stroke-violet-500 stroke-2 ${darkMode ? "fill-zinc-950" : "fill-white"}`}
              />
              
              {/* Simple inline tooltip on hover */}
              <g className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                <rect 
                  x={p.x - 35} 
                  y={p.y - 35} 
                  width="70" 
                  height="22" 
                  rx="4" 
                  className={darkMode ? "fill-zinc-900 stroke-zinc-700" : "fill-white stroke-zinc-200"}
                  strokeWidth="1"
                />
                <text 
                  x={p.x} 
                  y={p.y - 21} 
                  textAnchor="middle" 
                  className={`text-[10px] font-bold font-mono fill-current ${darkMode ? "text-zinc-200" : "text-zinc-800"}`}
                >
                  {p.val} views
                </text>
              </g>
            </g>
          ))}

          {/* X Axis Labels */}
          {points.filter((_, idx) => idx % 2 === 0 || idx === points.length - 1).map((p, idx) => {
            // Format date to MM-DD
            let displayDate = p.date;
            try {
              const parts = p.date.split("-");
              if (parts.length >= 3) {
                displayDate = `${parts[1]}/${parts[2]}`;
              }
            } catch (e) {}

            return (
              <text 
                key={idx} 
                x={p.x} 
                y={height - 15} 
                textAnchor="middle" 
                className={`text-[10px] font-mono fill-current opacity-50 ${darkMode ? "text-zinc-400" : "text-zinc-600"}`}
              >
                {displayDate}
              </text>
            );
          })}
        </svg>
      </div>
    );
  };

  // Helper to calculate total logged devices
  const renderDeviceStats = () => {
    if (!analytics || !analytics.deviceStats) return null;
    const stats = analytics.deviceStats;
    const total = stats.reduce((acc, curr) => acc + curr.value, 0) || 1;

    return (
      <div className="space-y-4">
        {stats.map((item, idx) => {
          const pct = Math.round((item.value / total) * 100);
          const Icon = item.name === "Desktop" ? Laptop : item.name === "Tablet" ? Tablet : Smartphone;
          return (
            <div key={idx} className="space-y-1.5">
              <div className="flex justify-between text-xs font-medium">
                <div className="flex items-center gap-1.5 opacity-80">
                  <Icon className="w-3.5 h-3.5 text-violet-500" />
                  <span>{item.name}</span>
                </div>
                <span className="font-mono">{item.value} ({pct}%)</span>
              </div>
              <div className={`h-2 w-full rounded-full ${darkMode ? "bg-zinc-800" : "bg-zinc-100"}`}>
                <div 
                  className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all duration-500"
                  style={{ width: `${pct}%` }}
                ></div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  if (!isAuthenticated) {
    return (
      <div className={`min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center px-4 py-16 transition-colors duration-300 ${
        darkMode ? "bg-zinc-950 text-zinc-100" : "bg-zinc-50 text-zinc-900"
      }`}>
        <div className={`w-full max-w-md p-8 rounded-2xl border transition-all duration-300 shadow-xl ${
          darkMode 
            ? "bg-zinc-900/60 border-zinc-800 shadow-[0_0_30px_rgba(139,92,246,0.05)]" 
            : "bg-white border-zinc-200"
        }`}>
          <div className="flex flex-col items-center text-center space-y-4">
            <div className={`p-4 rounded-full border transition-all duration-300 ${
              darkMode 
                ? "bg-violet-950/30 border-violet-900/50 text-violet-400" 
                : "bg-violet-50 border-violet-100 text-violet-600"
            }`}>
              <Lock className="w-8 h-8 animate-pulse" />
            </div>
            
            <div className="space-y-1.5">
              <h2 className="font-display text-2xl font-extrabold tracking-tight">
                Secure System Gate
              </h2>
              <p className="text-xs opacity-60 max-w-[280px] mx-auto">
                Please enter the authorized access key to unlock console utilities and system configurations.
              </p>
            </div>
          </div>

          <form onSubmit={handleVerifyPassword} className="mt-8 space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="admin-password" className="text-[10px] uppercase tracking-wider font-bold opacity-75">
                Access Key
              </label>
              <input
                id="admin-password"
                type="password"
                required
                value={typedPassword}
                onChange={(e) => setTypedPassword(e.target.value)}
                placeholder="••••••••"
                className={`w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all focus:ring-2 focus:ring-violet-500/30 ${
                  darkMode 
                    ? "bg-zinc-950 border-zinc-800 focus:border-violet-500 text-white placeholder-zinc-700" 
                    : "bg-zinc-50 border-zinc-200 focus:border-violet-500 text-zinc-900 placeholder-zinc-300"
                }`}
                autoFocus
              />
            </div>

            {authError && (
              <div className="flex items-start gap-2 p-3 text-xs rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{authError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isVerifying}
              className="w-full py-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 active:scale-[0.98] text-white font-semibold text-xs rounded-xl cursor-pointer shadow-lg shadow-violet-600/15 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isVerifying ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Unlock Console"
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-zinc-500/5 flex justify-center">
            <button
              onClick={() => navigate("/")}
              className={`flex items-center gap-1.5 text-xs font-semibold cursor-pointer transition-colors ${
                darkMode ? "text-zinc-500 hover:text-zinc-300" : "text-zinc-400 hover:text-zinc-700"
              }`}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Return to Hub
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-[calc(100vh-4rem)] pb-12 transition-colors duration-300 ${
      darkMode ? "bg-zinc-950 text-zinc-100" : "bg-zinc-50 text-zinc-900"
    }`}>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">

        {error && (
          <div className="mb-6 p-4 rounded-xl border border-red-500/20 bg-red-500/5 text-red-500 flex items-center gap-3 animate-in fade-in duration-300">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <div className="text-sm font-medium">{error}</div>
          </div>
        )}

        {/* Core Layout Grid (Sidebar + Main Content Panel) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT COLUMN: Sidebar Menu */}
          <aside className="lg:col-span-3 space-y-2">
            <div className={`p-1.5 rounded-2xl border ${darkMode ? "bg-zinc-900/40 border-zinc-900" : "bg-white border-zinc-100 shadow-sm"} space-y-1`}>
              <button
                onClick={() => setActiveTab("overview")}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                  activeTab === "overview"
                    ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/10"
                    : darkMode
                      ? "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50"
                      : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50"
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Overview</span>
              </button>

              <button
                onClick={() => setActiveTab("files")}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                  activeTab === "files"
                    ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/10"
                    : darkMode
                      ? "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50"
                      : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50"
                }`}
              >
                <FileVideo className="w-4 h-4" />
                <span>All Files</span>
              </button>
            </div>

          </aside>

          {/* RIGHT COLUMN: Tab Panel */}
          <main className="lg:col-span-9 space-y-8">
            
            {/* TAB 1: OVERVIEW */}
            {activeTab === "overview" && (
              <div className="space-y-8 animate-in fade-in duration-300">
                
                {/* 4 Cards Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {/* Card 1: Total Views */}
                  <div className={`p-6 rounded-2xl border ${darkMode ? "bg-zinc-900/30 border-zinc-900" : "bg-white border-zinc-200/80 shadow-sm"} relative overflow-hidden group`}>
                    <div className="absolute top-0 right-0 w-24 h-24 bg-violet-500/5 rounded-full blur-2xl"></div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] uppercase tracking-wider font-bold opacity-60">Total Streams Viewed</span>
                      <span className="p-2 rounded-xl bg-violet-500/10 text-violet-400">
                        <Eye className="w-4 h-4" />
                      </span>
                    </div>
                    <div className="text-3xl font-display font-black tracking-tight">{analytics?.totalViews ?? 0}</div>
                    <p className={`text-[10px] mt-1 font-mono ${darkMode ? "text-zinc-500" : "text-zinc-500"}`}>Cumulative active counts</p>
                  </div>

                  {/* Card 2: Registered Files */}
                  <div className={`p-6 rounded-2xl border ${darkMode ? "bg-zinc-900/30 border-zinc-900" : "bg-white border-zinc-200/80 shadow-sm"} relative overflow-hidden group`}>
                    <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl"></div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] uppercase tracking-wider font-bold opacity-60">Total Video Files</span>
                      <span className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
                        <FileVideo className="w-4 h-4" />
                      </span>
                    </div>
                    <div className="text-3xl font-display font-black tracking-tight">{analytics?.totalFiles ?? 0}</div>
                    <p className={`text-[10px] mt-1 font-mono ${darkMode ? "text-zinc-500" : "text-zinc-500"}`}>Indexed stream channels</p>
                  </div>

                  {/* Card 3: Cloud Storage used */}
                  <div className={`p-6 rounded-2xl border ${darkMode ? "bg-zinc-900/30 border-zinc-900" : "bg-white border-zinc-200/80 shadow-sm"} relative overflow-hidden group`}>
                    <div className="absolute top-0 right-0 w-24 h-24 bg-fuchsia-500/5 rounded-full blur-2xl"></div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] uppercase tracking-wider font-bold opacity-60">R2 Storage Volume</span>
                      <span className="p-2 rounded-xl bg-fuchsia-500/10 text-fuchsia-400">
                        <HardDrive className="w-4 h-4" />
                      </span>
                    </div>
                    <div className="text-3xl font-display font-black tracking-tight">{analytics?.totalStorage ?? "0 MB"}</div>
                    <p className={`text-[10px] mt-1 font-mono ${darkMode ? "text-zinc-500" : "text-zinc-500"}`}>Compiled sizes estimate</p>
                  </div>

                  {/* Card 4: Database Status */}
                  <div className={`p-6 rounded-2xl border ${darkMode ? "bg-zinc-900/30 border-zinc-900" : "bg-white border-zinc-200/80 shadow-sm"} relative overflow-hidden group`}>
                    <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl"></div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] uppercase tracking-wider font-bold opacity-60">Database Cluster</span>
                      <span className={`p-2 rounded-xl ${analytics?.isMongoActive ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"}`}>
                        <Activity className="w-4 h-4" />
                      </span>
                    </div>
                    {analytics?.isMongoActive ? (
                      <div className="space-y-1">
                        <div className="text-xl font-display font-black tracking-tight text-emerald-500">
                          {analytics.mongoStorageSize || "0.00 KB"}
                        </div>
                        <div className={`text-[10px] font-mono ${darkMode ? "text-zinc-400" : "text-zinc-500"}`}>
                          {analytics.mongoCollections ?? 0} collections ({analytics.mongoDocuments ?? 0} docs)
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <div className="text-lg font-display font-bold tracking-tight text-amber-500">
                          JSON Database
                        </div>
                        <div className={`text-[10px] font-mono ${darkMode ? "text-zinc-400" : "text-zinc-500"}`}>
                          MongoDB is Offline (Local file)
                        </div>
                      </div>
                    )}
                    <p className={`text-[10px] mt-2 font-mono ${darkMode ? "text-zinc-500" : "text-zinc-500"}`}>
                      {analytics?.isMongoActive ? "MongoDB Telemetry Active" : "Using local JSON fallback"}
                    </p>
                  </div>
                </div>

                {/* Daily Views Line/Area Chart */}
                <div className={`p-6 rounded-2xl border ${darkMode ? "bg-zinc-900/40 border-zinc-900" : "bg-white border-zinc-200 shadow-sm"} space-y-4`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-display font-bold">Daily Stream Traffic</h3>
                      <p className={`text-xs ${darkMode ? "text-zinc-400" : "text-zinc-500"}`}>
                        Views over the last 15 days across all active channels.
                      </p>
                    </div>
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold font-mono tracking-wider px-2 py-0.5 rounded ${
                      darkMode ? "bg-violet-500/10 text-violet-400" : "bg-violet-100 text-violet-700"
                    }`}>
                      <Activity className="w-3 h-3 animate-pulse" /> LIVE TELEMETRY
                    </span>
                  </div>

                  {isLoading ? (
                    <div className="h-48 flex items-center justify-center">
                      <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  ) : (
                    renderSvgChart()
                  )}
                </div>

                {/* Lower Grid: Device Stats & Browser/OS Statistics */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Device breakdown */}
                  <div className={`p-6 rounded-2xl border ${darkMode ? "bg-zinc-900/40 border-zinc-900" : "bg-white border-zinc-200 shadow-sm"} space-y-6`}>
                    <div>
                      <h3 className="text-base font-display font-bold">Viewer Form Factor</h3>
                      <p className={`text-xs ${darkMode ? "text-zinc-400" : "text-zinc-500"}`}>
                        Device classification extracted from telemetry logs.
                      </p>
                    </div>
                    {isLoading ? (
                      <div className="h-32 flex items-center justify-center">
                        <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    ) : (
                      renderDeviceStats()
                    )}
                  </div>

                  {/* Top performing videos */}
                  <div className={`p-6 rounded-2xl border ${darkMode ? "bg-zinc-900/40 border-zinc-900" : "bg-white border-zinc-200 shadow-sm"} space-y-4`}>
                    <div>
                      <h3 className="text-base font-display font-bold">Top Trending Streams</h3>
                      <p className={`text-xs ${darkMode ? "text-zinc-400" : "text-zinc-500"}`}>
                        Most viewed index paths over active storage cycles.
                      </p>
                    </div>
                    
                    <div className="divide-y divide-zinc-500/5">
                      {isLoading ? (
                        <div className="h-32 flex items-center justify-center">
                          <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                      ) : analytics?.topVideos && analytics.topVideos.length > 0 ? (
                        analytics.topVideos.map((video, idx) => (
                          <div key={idx} className="py-2.5 flex items-center justify-between first:pt-0 last:pb-0">
                            <div className="min-w-0 pr-4">
                              <div className="font-medium text-xs truncate opacity-90">{video.title}</div>
                              <div className="font-mono text-[9px] opacity-40 mt-0.5">/{video.slug} • {video.fileSize} MB</div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="font-mono text-xs font-bold text-violet-500">{video.views}</span>
                              <span className="text-[10px] opacity-50">views</span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-8 text-xs opacity-50">No views logs recorded yet.</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Large Real-Time View Logs (Deep Analytics Table) */}
                <div className={`p-6 rounded-2xl border ${darkMode ? "bg-zinc-900/40 border-zinc-900" : "bg-white border-zinc-200 shadow-sm"} space-y-4`}>
                  <div>
                    <h3 className="text-base font-display font-bold">Detailed Telemetry View Logs</h3>
                    <p className={`text-xs ${darkMode ? "text-zinc-400" : "text-zinc-500"}`}>
                      Full breakdown of the last 50 unique stream requests (24-hour deduplicated).
                    </p>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className={`border-b ${darkMode ? "border-zinc-900 text-zinc-400" : "border-zinc-200 text-zinc-600"} font-semibold`}>
                          <th className="pb-3 pr-4">Stream Channel</th>
                          <th className="pb-3 px-4">Viewer IP</th>
                          <th className="pb-3 px-4">Browser / Client</th>
                          <th className="pb-3 px-4">Platform OS</th>
                          <th className="pb-3 px-4">Form Factor</th>
                          <th className="pb-3 pl-4">Timestamp</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-500/5">
                        {isLoading ? (
                          <tr>
                            <td colSpan={6} className="py-8 text-center">
                              <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                            </td>
                          </tr>
                        ) : analytics?.recentLogs && analytics.recentLogs.length > 0 ? (
                          analytics.recentLogs.map((log, idx) => (
                            <tr key={idx} className={`hover:bg-zinc-500/5 transition-colors`}>
                              <td className="py-3 pr-4 font-medium truncate max-w-[160px]" title={log.title}>
                                {log.title}
                              </td>
                              <td className="py-3 px-4 font-mono text-zinc-400">
                                {log.ip}
                              </td>
                              <td className="py-3 px-4 opacity-80">
                                {log.browser}
                              </td>
                              <td className="py-3 px-4 opacity-80">
                                {log.os}
                              </td>
                              <td className="py-3 px-4">
                                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  log.device === "Mobile" 
                                    ? "bg-amber-500/10 text-amber-500" 
                                    : log.device === "Tablet" 
                                      ? "bg-blue-500/10 text-blue-500" 
                                      : "bg-violet-500/10 text-violet-500"
                                }`}>
                                  {log.device === "Mobile" ? <Smartphone className="w-3 h-3" /> : log.device === "Tablet" ? <Tablet className="w-3 h-3" /> : <Laptop className="w-3 h-3" />}
                                  {log.device}
                                </span>
                              </td>
                              <td className="py-3 pl-4 font-mono text-[10px] text-zinc-400 shrink-0">
                                {new Date(log.timestamp).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={6} className="py-8 text-center opacity-50">No logs captured. Play some video streams to generate activity logs.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            )}

            {/* TAB 2: ALL FILES */}
            {activeTab === "files" && (
              <div className={`p-6 rounded-2xl border ${darkMode ? "bg-zinc-900/40 border-zinc-900" : "bg-white border-zinc-200 shadow-sm"} space-y-6 animate-in fade-in duration-300`}>
                
                {/* Search Bar & Stats Header */}
                <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                  <div>
                    <h3 className="text-base font-display font-bold">R2 Storage Stream Files</h3>
                    <p className={`text-xs ${darkMode ? "text-zinc-400" : "text-zinc-500"}`}>
                      Search, register, modify or strip active media pathways.
                    </p>
                  </div>
                  
                  {/* Search Control */}
                  <div className="flex items-center gap-3 w-full md:w-auto shrink-0">
                    {/* Search Input Box */}
                    <div className="relative w-full sm:w-60 shrink-0">
                      <Search className="w-4 h-4 absolute left-3 top-2.5 opacity-40" />
                      <input
                        type="text"
                        placeholder="Search index by slug, title..."
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          setCurrentPage(1);
                        }}
                        className={`w-full pl-9 pr-4 py-2 text-xs rounded-xl border outline-none transition-all focus:ring-2 focus:ring-violet-500 ${
                          darkMode 
                            ? "bg-zinc-950 border-zinc-800 focus:border-violet-500 text-zinc-100" 
                            : "bg-zinc-50 border-zinc-200 focus:border-violet-500 text-zinc-800"
                        }`}
                      />
                    </div>
                  </div>
                </div>

                {/* Video pathways table list */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className={`border-b ${darkMode ? "border-zinc-900 text-zinc-400" : "border-zinc-200 text-zinc-600"} font-semibold`}>
                        <th className="pb-3 pr-4">Thumbnail</th>
                        <th className="pb-3 px-4">Title</th>
                        <th className="pb-3 px-4">Custom Slug</th>
                        <th className="pb-3 px-4">Duration</th>
                        <th className="pb-3 px-4 text-center">Views</th>
                        <th className="pb-3 px-4 text-center">Size (MB)</th>
                        <th className="pb-3 pl-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-500/5">
                      {currentFilteredVideos.length > 0 ? (
                        currentFilteredVideos.map((video) => (
                          <tr key={video.slug} className="hover:bg-zinc-500/5 transition-colors">
                            {/* Thumbnail */}
                            <td className="py-3.5 pr-4 shrink-0">
                              <div className="relative w-16 h-10 rounded-lg overflow-hidden bg-zinc-900 border border-zinc-800 shrink-0">
                                <img 
                                  src={video.thumbnailUrl} 
                                  alt={video.title}
                                  className="w-full h-full object-cover"
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                            </td>
                            {/* Title */}
                            <td className="py-3.5 px-4 max-w-[200px]">
                              <div className="font-bold opacity-90 truncate">{video.title}</div>
                            </td>
                            {/* Slug path */}
                            <td className="py-3.5 px-4 font-mono text-[10px] text-violet-400">
                              /{video.slug}
                            </td>
                            {/* Duration */}
                            <td className="py-3.5 px-4 font-mono opacity-80">
                              {video.duration || "00:00"}
                            </td>
                            {/* Total views */}
                            <td className="py-3.5 px-4 font-mono text-center font-bold">
                              {video.views ?? 0}
                            </td>
                            {/* Storage size */}
                            <td className="py-3.5 px-4 font-mono text-center opacity-80">
                              {video.fileSize || 124.5}
                            </td>
                            {/* Actions buttons */}
                            <td className="py-3.5 pl-4 text-right">
                              {deleteConfirmSlug === video.slug ? (
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => handleDeleteVideo(video.slug)}
                                    className="px-2 py-1 bg-red-600 text-white rounded font-semibold text-[10px] cursor-pointer"
                                  >
                                    Confirm
                                  </button>
                                  <button
                                    onClick={() => setDeleteConfirmSlug(null)}
                                    className={`px-2 py-1 border rounded text-[10px] cursor-pointer ${
                                      darkMode ? "border-zinc-800 text-zinc-300" : "border-zinc-200 text-zinc-600"
                                    }`}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => handleOpenEditModal(video)}
                                    className={`p-1.5 rounded-lg border cursor-pointer transition-colors ${
                                      darkMode ? "border-zinc-800 hover:bg-zinc-800 text-zinc-300" : "border-zinc-200 hover:bg-zinc-100 text-zinc-700"
                                    }`}
                                    title="Edit properties"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <a
                                    href={`/${video.slug}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`p-1.5 rounded-lg border cursor-pointer transition-colors flex items-center justify-center ${
                                      darkMode ? "border-zinc-800 hover:bg-zinc-800 text-zinc-300" : "border-zinc-200 hover:bg-zinc-100 text-zinc-700"
                                    }`}
                                    title="Play stream (New tab)"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </a>
                                  <button
                                    onClick={() => setDeleteConfirmSlug(video.slug)}
                                    className={`p-1.5 rounded-lg border cursor-pointer transition-colors ${
                                      darkMode ? "border-red-900/50 hover:bg-red-950/20 text-red-400" : "border-red-200 hover:bg-red-50 text-red-600"
                                    }`}
                                    title="Delete entry"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="py-8 text-center opacity-50">
                            {searchQuery ? "No indexing matches found." : "No registered streams present."}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                {filteredVideos.length > 0 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-zinc-500/5">
                    <div className="text-xs opacity-60 font-medium">
                      {isLimitReached ? (
                        <span>Showing all {totalItems} items</span>
                      ) : (
                        <span>
                          Showing {indexOfFirstItem + 1}-{Math.min(indexOfLastItem, totalItems)} of {totalItems} items
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-1.5">
                      {/* Prev Button */}
                      <button
                        type="button"
                        onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                        disabled={currentPage === 1 || isLimitReached}
                        className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all flex items-center gap-1 select-none ${
                          currentPage === 1 || isLimitReached
                            ? "opacity-40 cursor-not-allowed border-zinc-500/10 text-zinc-500"
                            : darkMode
                              ? "bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:text-white cursor-pointer"
                              : "bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 shadow-sm cursor-pointer"
                        }`}
                      >
                        Previous
                      </button>

                      {/* Page numbers */}
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                        <button
                          key={pageNum}
                          type="button"
                          onClick={() => setCurrentPage(pageNum)}
                          disabled={isLimitReached}
                          className={`w-8 h-8 rounded-lg border text-xs font-mono font-bold transition-all select-none ${
                            isLimitReached
                              ? "opacity-40 cursor-not-allowed border-zinc-500/10 text-zinc-500"
                              : activePage === pageNum
                                ? "bg-violet-600 border-violet-600 text-white shadow-sm"
                                : darkMode
                                  ? "bg-zinc-900/50 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer"
                                  : "bg-white border-zinc-200 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 cursor-pointer"
                          }`}
                        >
                          {pageNum}
                        </button>
                      ))}

                      {/* Next Button */}
                      <button
                        type="button"
                        onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages || isLimitReached}
                        className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all flex items-center gap-1 select-none ${
                          currentPage === totalPages || isLimitReached
                            ? "opacity-40 cursor-not-allowed border-zinc-500/10 text-zinc-500"
                            : darkMode
                              ? "bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:text-white cursor-pointer"
                              : "bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 shadow-sm cursor-pointer"
                        }`}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}

              </div>
            )}

          </main>

        </div>
      </div>

      {/* DYNAMIC FORM MODAL: REGISTER / MODIFY VIDEO PATHWAYS */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop screen */}
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowFormModal(false)}
          ></div>
          
          {/* Modal Container */}
          <div className={`relative w-full max-w-2xl p-6 sm:p-8 rounded-2xl border animate-in zoom-in-95 duration-200 ${
            darkMode ? "bg-zinc-900 border-zinc-800 text-zinc-100" : "bg-white border-zinc-200 text-zinc-900 shadow-2xl"
          }`}>
            <button
              onClick={() => setShowFormModal(false)}
              className={`absolute top-4 right-4 p-1.5 rounded-lg border cursor-pointer transition-colors ${
                darkMode ? "border-zinc-800 hover:bg-zinc-800" : "border-zinc-200 hover:bg-zinc-50"
              }`}
            >
              <X className="w-4 h-4" />
            </button>

            <div className="mb-6">
              <h3 className="text-xl font-display font-bold">
                {editingVideo ? `Edit Video: ${editingVideo.title}` : "Register a New R2 Stream"}
              </h3>
              <p className={`text-xs mt-1 ${darkMode ? "text-zinc-400" : "text-zinc-500"}`}>
                Configure storage pathways, thumbnails and secure download gateways.
              </p>
            </div>

            {formError && (
              <div className="mb-4 p-3 rounded-lg border border-red-500/20 bg-red-500/5 text-red-500 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {formSuccess && (
              <div className="mb-4 p-3 rounded-lg border border-green-500/20 bg-green-500/5 text-green-500 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{formSuccess}</span>
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wide font-bold opacity-70">Video Title *</label>
                  <input
                    type="text"
                    name="title"
                    required
                    value={formData.title}
                    onChange={handleInputChange}
                    placeholder="e.g. Neon City Drift"
                    className={`w-full px-3.5 py-2 rounded-xl border text-xs outline-none transition-all focus:ring-2 focus:ring-violet-500 ${
                      darkMode ? "bg-zinc-950 border-zinc-800 focus:border-violet-500" : "bg-zinc-50 border-zinc-200 focus:border-violet-500"
                    }`}
                  />
                </div>
                
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wide font-bold opacity-70">Custom Slug (Optional)</label>
                  <input
                    type="text"
                    name="slug"
                    value={formData.slug}
                    onChange={handleInputChange}
                    disabled={!!editingVideo}
                    placeholder="e.g. neon-city-drift"
                    className={`w-full px-3.5 py-2 rounded-xl border text-xs outline-none transition-all focus:ring-2 focus:ring-violet-500 ${
                      darkMode ? "bg-zinc-950 border-zinc-800 focus:border-violet-500 disabled:opacity-40" : "bg-zinc-50 border-zinc-200 focus:border-violet-500 disabled:opacity-40"
                    }`}
                  />
                </div>
              </div>



              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wide font-bold opacity-70">Streaming Video Direct URL (.mp4) *</label>
                  <input
                    type="url"
                    name="videoUrl"
                    required
                    value={formData.videoUrl}
                    onChange={handleInputChange}
                    placeholder="e.g. https://pub-id.r2.dev/video.mp4"
                    className={`w-full px-3.5 py-2 rounded-xl border text-xs outline-none transition-all focus:ring-2 focus:ring-violet-500 ${
                      darkMode ? "bg-zinc-950 border-zinc-800 focus:border-violet-500" : "bg-zinc-50 border-zinc-200 focus:border-violet-500"
                    }`}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wide font-bold opacity-70">Direct Download File URL *</label>
                  <input
                    type="url"
                    name="downloadUrl"
                    required
                    value={formData.downloadUrl}
                    onChange={handleInputChange}
                    placeholder="e.g. https://pub-id.r2.dev/video-hd.mp4"
                    className={`w-full px-3.5 py-2 rounded-xl border text-xs outline-none transition-all focus:ring-2 focus:ring-violet-500 ${
                      darkMode ? "bg-zinc-950 border-zinc-800 focus:border-violet-500" : "bg-zinc-50 border-zinc-200 focus:border-violet-500"
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1 md:col-span-2">
                  <label className="text-[10px] uppercase tracking-wide font-bold opacity-70">Thumbnail Cover Image URL</label>
                  <input
                    type="url"
                    name="thumbnailUrl"
                    value={formData.thumbnailUrl}
                    onChange={handleInputChange}
                    placeholder="e.g. https://images.unsplash.com/photo-..."
                    className={`w-full px-3.5 py-2 rounded-xl border text-xs outline-none transition-all focus:ring-2 focus:ring-violet-500 ${
                      darkMode ? "bg-zinc-950 border-zinc-800 focus:border-violet-500" : "bg-zinc-50 border-zinc-200 focus:border-violet-500"
                    }`}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wide font-bold opacity-70">Duration (00:00)</label>
                  <input
                    type="text"
                    name="duration"
                    value={formData.duration}
                    onChange={handleInputChange}
                    placeholder="e.g. 10:15"
                    className={`w-full px-3.5 py-2 rounded-xl border text-xs outline-none transition-all focus:ring-2 focus:ring-violet-500 ${
                      darkMode ? "bg-zinc-950 border-zinc-800 focus:border-violet-500" : "bg-zinc-50 border-zinc-200 focus:border-violet-500"
                    }`}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wide font-bold opacity-70">Estimated File Size (MB)</label>
                <input
                  type="number"
                  step="0.1"
                  name="fileSize"
                  value={formData.fileSize}
                  onChange={handleInputChange}
                  placeholder="e.g. 248.5"
                  className={`w-full px-3.5 py-2 rounded-xl border text-xs outline-none transition-all focus:ring-2 focus:ring-violet-500 ${
                    darkMode ? "bg-zinc-950 border-zinc-800 focus:border-violet-500" : "bg-zinc-50 border-zinc-200 focus:border-violet-500"
                  }`}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-zinc-500/5">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className={`px-4 py-2.5 rounded-xl border font-semibold text-xs cursor-pointer ${
                    darkMode ? "border-zinc-800 hover:bg-zinc-800" : "border-zinc-200 hover:bg-zinc-50"
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold text-xs rounded-xl cursor-pointer disabled:opacity-55"
                >
                  {isSubmitting ? "Saving Stream..." : editingVideo ? "Apply Changes" : "Register Pathway"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

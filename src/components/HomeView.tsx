import React, { useState, useEffect } from "react";
import { Video } from "../types";
import { Play, Flame, Film, PlusCircle, ArrowRight, Eye, Calendar, Clock, AlertCircle, CheckCircle2 } from "lucide-react";
import { getApiUrl } from "../utils/api";

// Generate mixed random letters, numbers, and characters slug (e.g. Fsj_te39c7)
export function generateRandomSlug(length = 10): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

interface HomeViewProps {
  darkMode: boolean;
  navigate: (path: string) => void;
}

export default function HomeView({ darkMode, navigate }: HomeViewProps) {
  const [videos, setVideos] = useState<Video[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Video creation form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    slug: "",
    description: "",
    videoUrl: "",
    downloadUrl: "",
    thumbnailUrl: "",
    duration: "05:00",
  });
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;

  const totalItems = videos.length;
  const isLimitReached = totalItems <= itemsPerPage;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const activePage = Math.min(currentPage, totalPages);
  const indexOfLastItem = activePage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentVideos = videos.slice(indexOfFirstItem, indexOfLastItem);

  useEffect(() => {
    fetchVideos();
  }, []);

  const fetchVideos = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(getApiUrl("/api/videos"));
      if (res.ok) {
        const data = await res.json();
        setVideos(data);
      }
    } catch (err) {
      console.error("Error loading videos:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");

    if (!formData.title || !formData.videoUrl || !formData.downloadUrl) {
      setFormError("Title, Stream Video URL, and Download Link are strictly required.");
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch(getApiUrl("/api/videos"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || "Failed to register video.");
      } else {
        setFormSuccess(`Successfully registered stream: "${data.title}"!`);
        setFormData({
          title: "",
          slug: "",
          description: "",
          videoUrl: "",
          downloadUrl: "",
          thumbnailUrl: "",
          duration: "05:00",
        });
        setShowAddForm(false);
        fetchVideos(); // Refresh list
      }
    } catch (err) {
      setFormError("Network error occurred. Please verify backend state.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`min-h-[calc(100vh-4rem)] bg-grid-pattern py-8 px-4 sm:px-6 lg:px-8 transition-colors duration-300 ${
      darkMode ? "bg-zinc-950 text-zinc-100" : "bg-zinc-50 text-zinc-900 bg-grid-pattern-light"
    }`}>
      <div className="max-w-7xl mx-auto space-y-12">
        
        {/* Hero Section */}
        <div className={`relative overflow-hidden rounded-3xl p-8 md:p-12 border transition-all duration-300 ${
          darkMode 
            ? "bg-gradient-to-br from-zinc-900 to-zinc-950 border-zinc-900 shadow-2xl shadow-violet-950/20" 
            : "bg-gradient-to-br from-white to-zinc-100 border-zinc-200 shadow-xl"
        }`}>
          {/* Ambient background glows */}
          <div className="absolute -top-12 -right-12 w-64 h-64 bg-violet-600/10 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-12 -left-12 w-64 h-64 bg-fuchsia-600/10 rounded-full blur-3xl"></div>

          <div className="relative z-10 max-w-3xl space-y-6">
            <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-mono tracking-wider ${
              darkMode ? "bg-violet-500/10 text-violet-400 border border-violet-500/20" : "bg-violet-100 text-violet-700"
            }`}>
              <Flame className="w-3.5 h-3.5 animate-bounce" /> ULTRA MODERN STREAMING
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-extrabold tracking-tight leading-none">
              The Safe & Immersive <br/>
              <span className="bg-gradient-to-r from-violet-500 via-fuchsia-500 to-indigo-500 bg-clip-text text-transparent">
                Video Gateway
              </span>
            </h1>
            
            <p className={`text-base md:text-lg max-w-2xl leading-relaxed ${
              darkMode ? "text-zinc-400" : "text-zinc-600"
            }`}>
              Experience zero-latency custom player streaming powered by Plyr.io controls. Unlock secure, verified link downloads protected by a highly resilient 3-stage validation engine.
            </p>

            <div className="flex flex-wrap gap-4 pt-2">
              {videos.length > 0 && (
                <button
                  onClick={() => navigate(`/${videos[0].slug}`)}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-medium rounded-xl shadow-lg shadow-violet-500/20 transition-all hover:scale-[1.02] cursor-pointer"
                  id="play-featured-btn"
                >
                  <Play className="w-4 h-4 fill-current" /> Watch Featured
                </button>
              )}
              
              <button
                onClick={() => {
                  const randomSlug = generateRandomSlug(10);
                  setFormData(prev => ({
                    ...prev,
                    title: "",
                    slug: randomSlug,
                    description: "",
                    videoUrl: "",
                    downloadUrl: "",
                    thumbnailUrl: "",
                    duration: "05:00"
                  }));
                  setShowAddForm(!showAddForm);
                }}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl border font-medium transition-all hover:scale-[1.02] cursor-pointer ${
                  darkMode 
                    ? "bg-zinc-900 border-zinc-800 hover:bg-zinc-800 text-zinc-100" 
                    : "bg-white border-zinc-200 hover:bg-zinc-50 text-zinc-800"
                }`}
                id="toggle-add-video-btn"
              >
                <PlusCircle className="w-4 h-4 text-violet-500" /> Share Custom Stream
              </button>

              <button
                onClick={() => navigate("/player")}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl border font-medium transition-all hover:scale-[1.02] cursor-pointer ${
                  darkMode 
                    ? "bg-red-950/20 border-red-900/50 hover:bg-red-900/20 text-red-400" 
                    : "bg-red-50 border-red-200 hover:bg-red-100 text-red-700"
                }`}
                id="test-missing-slug-btn"
              >
                <AlertCircle className="w-4 h-4 animate-pulse" /> Test Missing Slug
              </button>
            </div>
          </div>
        </div>

        {/* Custom video upload/creation Form */}
        {showAddForm && (
          <div className={`p-6 sm:p-8 rounded-2xl border animate-in fade-in slide-in-from-top-4 duration-300 ${
            darkMode ? "bg-zinc-900/50 border-zinc-800" : "bg-white border-zinc-200 shadow-md"
          }`}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-display font-bold">Register a New Stream</h3>
                <p className={`text-xs mt-1 ${darkMode ? "text-zinc-400" : "text-zinc-500"}`}>
                  Enter details to register a stream and dynamic page.
                </p>
              </div>
              <button 
                onClick={() => setShowAddForm(false)}
                className={`text-xs px-3 py-1.5 rounded-lg border cursor-pointer ${
                  darkMode ? "border-zinc-800 hover:bg-zinc-800" : "border-zinc-200 hover:bg-zinc-100"
                }`}
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold tracking-wide uppercase opacity-75">Video Title *</label>
                  <input
                    type="text"
                    name="title"
                    required
                    value={formData.title}
                    onChange={handleInputChange}
                    placeholder="e.g. Neon City Drift"
                    className={`w-full px-4 py-2.5 rounded-xl border text-sm transition-all focus:ring-2 focus:ring-violet-500 outline-none ${
                      darkMode ? "bg-zinc-950 border-zinc-800 focus:border-violet-500" : "bg-zinc-50 border-zinc-200 focus:border-violet-500"
                    }`}
                  />
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold tracking-wide uppercase opacity-75">Custom Slug (Optional)</label>
                  <input
                    type="text"
                    name="slug"
                    value={formData.slug}
                    onChange={handleInputChange}
                    placeholder="e.g. neon-city-drift"
                    className={`w-full px-4 py-2.5 rounded-xl border text-sm transition-all focus:ring-2 focus:ring-violet-500 outline-none ${
                      darkMode ? "bg-zinc-950 border-zinc-800 focus:border-violet-500" : "bg-zinc-50 border-zinc-200 focus:border-violet-500"
                    }`}
                  />
                </div>
              </div>



              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold tracking-wide uppercase opacity-75">Streaming Video Direct URL (.mp4)*</label>
                  <input
                    type="url"
                    name="videoUrl"
                    required
                    value={formData.videoUrl}
                    onChange={handleInputChange}
                    placeholder="https://example.com/stream.mp4"
                    className={`w-full px-4 py-2.5 rounded-xl border text-sm transition-all focus:ring-2 focus:ring-violet-500 outline-none ${
                      darkMode ? "bg-zinc-950 border-zinc-800 focus:border-violet-500" : "bg-zinc-50 border-zinc-200 focus:border-violet-500"
                    }`}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold tracking-wide uppercase opacity-75">Hidden Download Link *</label>
                  <input
                    type="url"
                    name="downloadUrl"
                    required
                    value={formData.downloadUrl}
                    onChange={handleInputChange}
                    placeholder="https://example.com/source-highres-download.zip"
                    className={`w-full px-4 py-2.5 rounded-xl border text-sm transition-all focus:ring-2 focus:ring-violet-500 outline-none ${
                      darkMode ? "bg-zinc-950 border-zinc-800 focus:border-violet-500" : "bg-zinc-50 border-zinc-200 focus:border-violet-500"
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold tracking-wide uppercase opacity-75">Thumbnail Image URL (Optional)</label>
                  <input
                    type="url"
                    name="thumbnailUrl"
                    value={formData.thumbnailUrl}
                    onChange={handleInputChange}
                    placeholder="https://images.unsplash.com/photo-..."
                    className={`w-full px-4 py-2.5 rounded-xl border text-sm transition-all focus:ring-2 focus:ring-violet-500 outline-none ${
                      darkMode ? "bg-zinc-950 border-zinc-800 focus:border-violet-500" : "bg-zinc-50 border-zinc-200 focus:border-violet-500"
                    }`}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold tracking-wide uppercase opacity-75">Duration (Optional)</label>
                  <input
                    type="text"
                    name="duration"
                    value={formData.duration}
                    onChange={handleInputChange}
                    placeholder="e.g. 05:40"
                    className={`w-full px-4 py-2.5 rounded-xl border text-sm transition-all focus:ring-2 focus:ring-violet-500 outline-none ${
                      darkMode ? "bg-zinc-950 border-zinc-800 focus:border-violet-500" : "bg-zinc-50 border-zinc-200 focus:border-violet-500"
                    }`}
                  />
                </div>
              </div>

              {formError && (
                <div className="flex items-center gap-2 p-3.5 text-sm rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {formSuccess && (
                <div className="flex items-center gap-2 p-3.5 text-sm rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{formSuccess}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 text-white font-semibold rounded-xl transition-all cursor-pointer"
              >
                {isSubmitting ? "Registering Stream..." : "Register Stream"} <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}

        {/* Video Grid Section */}
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-zinc-500/10">
            <div className="flex items-center gap-2">
              <Film className="w-5 h-5 text-violet-500" />
              <h2 className="text-2xl font-display font-extrabold tracking-tight">Active Stream Channels</h2>
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-64 rounded-2xl bg-zinc-800/40"></div>
              ))}
            </div>
          ) : videos.length === 0 ? (
            <div className={`p-12 text-center rounded-2xl border ${
              darkMode ? "bg-zinc-900/20 border-zinc-900" : "bg-white border-zinc-200"
            }`}>
              <p className="text-lg font-medium">No videos active.</p>
              <p className={`text-sm mt-1 mb-4 ${darkMode ? "text-zinc-400" : "text-zinc-500"}`}>
                Register a stream using the share custom button.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {currentVideos.map((video) => (
                <div
                  key={video.slug}
                  onClick={() => navigate(`/${video.slug}`)}
                  className={`group cursor-pointer overflow-hidden rounded-2xl border transition-all duration-300 hover:-translate-y-1 ${
                    darkMode 
                      ? "bg-zinc-900/30 hover:bg-zinc-900/60 border-zinc-900 hover:border-violet-500/30 hover:shadow-xl hover:shadow-violet-950/15" 
                      : "bg-white border-zinc-200 hover:border-violet-500/30 hover:shadow-lg"
                  }`}
                  id={`video-card-${video.slug}`}
                >
                  {/* Thumbnail Cover */}
                  <div className="relative aspect-video w-full overflow-hidden bg-zinc-950">
                    <img
                      src={video.thumbnailUrl}
                      alt={video.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      referrerPolicy="no-referrer"
                    />
                    
                    {/* Dark gradient shadow */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
                    
                    {/* Hover play overlay */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                      <div className="p-3.5 rounded-full bg-violet-600 text-white shadow-lg animate-scale-up">
                        <Play className="w-5 h-5 fill-current" />
                      </div>
                    </div>

                    {/* Duration Label */}
                    <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1 px-2 py-1 rounded bg-black/85 text-white text-[10px] font-mono font-bold tracking-wider uppercase">
                      <Clock className="w-3 h-3" /> {video.duration}
                    </div>
                  </div>

                  {/* Details Body */}
                  <div className="p-5 space-y-3.5">
                    <h3 className="font-display font-bold text-base line-clamp-1 group-hover:text-violet-500 transition-colors">
                      {video.title}
                    </h3>

                    {/* Meta stats */}
                    <div className="flex items-center justify-between text-[11px] font-medium font-mono pt-3 border-t border-zinc-500/5">
                      <div className="flex items-center gap-1.5 opacity-75">
                        <Eye className="w-3.5 h-3.5 text-violet-500" />
                        <span>{video.views.toLocaleString()} views</span>
                      </div>
                      <div className="flex items-center gap-1.5 opacity-75">
                        <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                        <span>{video.createdAt}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination Controls */}
          {videos.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 mt-4 border-t border-zinc-500/10">
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
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1 || isLimitReached}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all flex items-center gap-1 select-none ${
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
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages || isLimitReached}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all flex items-center gap-1 select-none ${
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

      </div>
    </div>
  );
}

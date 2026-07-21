import { useState, useEffect, useRef } from "react";
import { Video } from "../types";
import Plyr from "plyr";
import Hls from "hls.js";
import "plyr/dist/plyr.css";
import { 
  ArrowLeft, Download, Share2, Eye, Calendar, Clock, 
  Copy, Check, Facebook, Twitter, Mail, HelpCircle, Film, Sparkles, ExternalLink, Database, Loader2
} from "lucide-react";
import { getApiUrl } from "../utils/api";

interface PlayerViewProps {
  mapping: string;
  darkMode: boolean;
  navigate: (path: string) => void;
}

export default function PlayerView({ mapping, darkMode, navigate }: PlayerViewProps) {
  const [video, setVideo] = useState<Video | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [showShareModal, setShowShareModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [channelLink, setChannelLink] = useState("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const plyrInstance = useRef<Plyr | null>(null);
  const hlsInstance = useRef<Hls | null>(null);

  // Compute active video source URL (prioritize HLS m3u8, fallback to high-quality MP4)
  let activeSource = "";
  if (video) {
    activeSource = video.hls_playlist_url || video.videoUrl || "";
    if (!activeSource && video.mp4_urls && Object.keys(video.mp4_urls).length > 0) {
      const qualities = Object.keys(video.mp4_urls);
      activeSource = video.mp4_urls["1080p"] || video.mp4_urls["720p"] || video.mp4_urls[qualities[0]];
    }
  }

  // Fetch application configuration (including channelLink) on mount
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await fetch(getApiUrl("/api/config"));
        if (res.ok) {
          const data = await res.json();
          if (data.channelLink) {
            setChannelLink(data.channelLink);
          }
        }
      } catch (err) {
        console.error("Failed to load channel config:", err);
      }
    };
    fetchConfig();
  }, []);

  useEffect(() => {
    const fetchVideoDetails = async () => {
      if (!mapping || mapping.trim() === "") {
        setError("Missing URL Parameter: No video mapping detected. Please specify a valid video mapping at the end of the URL.");
        setIsLoading(false);
        return;
      }
      try {
        setIsLoading(true);
        setError("");
        const res = await fetch(getApiUrl(`/api/videos/${mapping}`));
        if (!res.ok) {
          throw new Error("This streaming channel is inactive or could not be found.");
        }
        const data = await res.json();
        setVideo(data);
      } catch (err: any) {
        setError(err.message || "Failed to load video details.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchVideoDetails();
  }, [mapping]);

  // Initialize Plyr and HLS
  useEffect(() => {
    if (!video || !videoRef.current || !activeSource) return;

    const videoElement = videoRef.current;
    const isHls = activeSource.toLowerCase().includes(".m3u8");

    // Clean up previous instances completely
    if (plyrInstance.current) {
      plyrInstance.current.destroy();
      plyrInstance.current = null;
    }
    if (hlsInstance.current) {
      hlsInstance.current.destroy();
      hlsInstance.current = null;
    }

    const plyrOptions = {
      controls: [
        "play-large",
        "play",
        "progress",
        "current-time",
        "duration",
        "mute",
        "volume",
        "captions",
        "settings",
        "pip",
        "airplay",
        "fullscreen",
      ],
      tooltips: { controls: true, seek: true },
      keyboard: { global: true },
      ratio: "16:9",
      autoplay: false,
    };

    let hls: Hls | null = null;
    let plyr: Plyr | null = null;

    if (isHls) {
      if (Hls.isSupported()) {
        hls = new Hls({
          maxMaxBufferLength: 10, // Optimize buffering for smooth playback
          enableWorker: true,
          lowLatencyMode: true,
        });
        hls.loadSource(activeSource);
        hls.attachMedia(videoElement);
        hlsInstance.current = hls;

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          plyr = new Plyr(videoElement, plyrOptions);
          plyrInstance.current = plyr;
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                console.log("fatal network error encountered, try to recover");
                hls?.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.log("fatal media error encountered, try to recover");
                hls?.recoverMediaError();
                break;
              default:
                console.error("Unrecoverable error encountered");
                break;
            }
          }
        });
      } else if (videoElement.canPlayType("application/vnd.apple.mpegurl")) {
        // Native HLS support (Safari)
        videoElement.src = activeSource;
        plyr = new Plyr(videoElement, plyrOptions);
        plyrInstance.current = plyr;
      } else {
        setError("Your browser does not support HLS streaming. Please switch to 'MP4 Direct Play' below.");
      }
    } else {
      // Regular MP4
      videoElement.src = activeSource;
      plyr = new Plyr(videoElement, plyrOptions);
      plyrInstance.current = plyr;
    }

    return () => {
      if (plyrInstance.current) {
        plyrInstance.current.destroy();
        plyrInstance.current = null;
      }
      if (hlsInstance.current) {
        hlsInstance.current.destroy();
        hlsInstance.current = null;
      }
    };
  }, [activeSource]);

  const handleCopyLink = () => {
    const streamLink = `${window.location.origin}/${mapping}`;
    navigator.clipboard.writeText(streamLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareText = `Check out this amazing stream: ${video?.title || "Video"}`;
  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/${mapping}` : "";

  if (isLoading) {
    return (
      <div className={`min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center p-8 ${
        darkMode ? "bg-zinc-950 text-zinc-100" : "bg-zinc-50 text-zinc-900"
      }`}>
        <div className="space-y-4 text-center">
          <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="font-display font-medium text-sm tracking-wide animate-pulse">Loading secure stream connection...</p>
        </div>
      </div>
    );
  }

  if (error || !video) {
    return (
      <div className={`min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center p-6 text-center ${
        darkMode ? "bg-zinc-950 text-zinc-100" : "bg-zinc-50 text-zinc-900"
      }`}>
        <div className={`max-w-md p-8 rounded-2xl border ${
          darkMode ? "bg-zinc-900/40 border-zinc-900" : "bg-white border-zinc-200 shadow-lg"
        }`}>
          <HelpCircle className="w-16 h-16 text-red-500 mx-auto mb-4 animate-bounce" />
          <h2 className="text-2xl font-display font-bold mb-2">Video Unreachable</h2>
          <p className={`text-sm ${darkMode ? "text-zinc-400" : "text-zinc-600"}`}>
            {error || "The requested video slug is not found in our database index."}
          </p>
          {channelLink && (
            <a
              href={channelLink}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-medium rounded-xl transition-all hover:scale-[1.02] cursor-pointer"
              id="visit-channel-btn"
            >
              <ExternalLink className="w-4 h-4" /> Visit Channel
            </a>
          )}
        </div>
      </div>
    );
  }

  if (video.uploadStatus !== "completed") {
    return (
      <div className={`min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center p-6 text-center ${
        darkMode ? "bg-zinc-950 text-zinc-100" : "bg-zinc-50 text-zinc-900"
      }`}>
        <div className={`max-w-md p-8 rounded-2xl border ${
          darkMode ? "bg-zinc-900/40 border-zinc-900" : "bg-white border-zinc-200 shadow-lg"
        }`}
        id="transcoding-notice"
        >
          <Loader2 className="w-12 h-12 text-violet-500 mx-auto mb-4 animate-spin" />
          <h2 className="text-2xl font-display font-bold mb-2">Transcoding in Progress</h2>
          <p className={`text-sm mb-6 leading-relaxed ${darkMode ? "text-zinc-400" : "text-zinc-600"}`}>
            "{video.title}" is currently being processed by Bunny Stream to prepare adaptive bitrate streaming directories.
          </p>
          <div className="space-y-1.5 mb-6">
            <div className="h-1.5 w-full bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-violet-500 transition-all duration-500"
                style={{ width: `${video.transcodingProgress || 0}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-[10px] font-mono opacity-50">
              <span className="font-bold">STATUS: WAITING</span>
              <span>{video.transcodingProgress || 0}%</span>
            </div>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="px-5 py-2.5 bg-zinc-900 dark:bg-zinc-800 hover:bg-zinc-800 dark:hover:bg-zinc-700 text-white text-xs font-bold rounded-xl transition-all hover:scale-[1.02] cursor-pointer"
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-[calc(100vh-4rem)] py-8 px-4 sm:px-6 lg:px-8 bg-grid-pattern transition-colors duration-300 ${
      darkMode ? "bg-zinc-950 text-zinc-100" : "bg-zinc-50 text-zinc-900 bg-grid-pattern-light"
    }`}>
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Video Player Card */}
        <div className={`overflow-hidden rounded-2xl border transition-all duration-300 ${
          darkMode 
            ? "bg-zinc-900/40 border-zinc-900 shadow-2xl shadow-violet-950/10" 
            : "bg-white border-zinc-200 shadow-xl"
        }`}
        id="video-player-card"
        >
          {/* Custom video element container styled with Plyr overrides */}
          <div key={video.mapping} className="w-full bg-black overflow-hidden rounded-xl">
            <video
              ref={videoRef}
              playsInline
              className="w-full h-full"
              poster={video.thumbnailUrl}
              crossOrigin="anonymous"
            >
              Your browser does not support the video tag.
            </video>
          </div>

          {/* Controls underneath Player inside card */}
          <div className="p-6 space-y-6 border-t border-zinc-500/5">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded font-mono ${
                    darkMode ? "bg-violet-500/10 text-violet-400" : "bg-violet-100 text-violet-700"
                  }`}>
                    <Sparkles className="w-3 h-3 animate-pulse" /> LIVE STREAM
                  </span>
                  <span className="text-xs opacity-50 font-mono">{video.duration}</span>
                </div>
                <h1 className="text-xl md:text-2xl lg:text-3xl font-display font-extrabold tracking-tight">
                  {video.title}
                </h1>
              </div>

              {/* Action Buttons Below Player */}
              <div className="flex items-center gap-3 shrink-0">
                <button
                  onClick={() => setShowShareModal(true)}
                  className={`flex items-center gap-2 px-5 py-3 rounded-xl border font-semibold text-sm transition-all hover:scale-102 cursor-pointer ${
                    darkMode 
                      ? "bg-zinc-900 border-zinc-800 hover:bg-zinc-800 hover:text-white" 
                      : "bg-white border-zinc-200 hover:bg-zinc-50 hover:text-zinc-950"
                  }`}
                  id="share-video-btn"
                >
                  <Share2 className="w-4 h-4 text-violet-500" /> Share
                </button>

                <button
                  onClick={() => navigate(`/download/${video.mapping}`)}
                  className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold text-sm rounded-xl shadow-lg shadow-violet-500/15 transition-all hover:scale-102 cursor-pointer"
                  id="download-video-btn"
                >
                  <Download className="w-4 h-4" /> Download Video
                </button>
              </div>
            </div>

            {/* Meta stats and line */}
            <div className="flex flex-wrap gap-4 items-center text-xs font-mono font-medium opacity-85 pt-1.5 border-b border-zinc-500/5 pb-4">
              <div className="flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-violet-500" />
                <span>{video.views.toLocaleString()} Stream views</span>
              </div>
              <span className="opacity-25">•</span>
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-indigo-500" />
                <span>Uploaded {video.createdAt}</span>
              </div>
              <span className="opacity-25">•</span>
              <div className="flex items-center gap-1.5">
                <Film className="w-4 h-4 text-fuchsia-500" />
                <span>1080p Ultra HD</span>
              </div>
              {video.fileSize && (
                <>
                  <span className="opacity-25">•</span>
                  <div className="flex items-center gap-1.5">
                    <Database className="w-4 h-4 text-emerald-500" />
                    <span>{video.fileSize} MB</span>
                  </div>
                </>
              )}
            </div>


          </div>
        </div>

      </div>

      {/* Share Modal Dialog */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop overlay */}
          <div 
            onClick={() => setShowShareModal(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          ></div>

          {/* Modal box */}
          <div className={`relative w-full max-w-md p-6 rounded-2xl border animate-in fade-in zoom-in-95 duration-200 ${
            darkMode ? "bg-zinc-900 border-zinc-800 text-zinc-100" : "bg-white border-zinc-200 text-zinc-900 shadow-2xl"
          }`}>
            <h3 className="text-lg font-display font-bold mb-4">Share with Network</h3>

            {/* Quick social links */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <a
                href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
                target="_blank"
                rel="noreferrer"
                className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border text-xs font-semibold ${
                  darkMode ? "bg-zinc-950 border-zinc-800 hover:bg-zinc-800" : "bg-zinc-50 border-zinc-200 hover:bg-zinc-100"
                }`}
              >
                <Facebook className="w-5 h-5 text-blue-500" />
                <span>Facebook</span>
              </a>

              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`}
                target="_blank"
                rel="noreferrer"
                className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border text-xs font-semibold ${
                  darkMode ? "bg-zinc-950 border-zinc-800 hover:bg-zinc-800" : "bg-zinc-50 border-zinc-200 hover:bg-zinc-100"
                }`}
              >
                <Twitter className="w-5 h-5 text-sky-400" />
                <span>Twitter</span>
              </a>

              <a
                href={`mailto:?subject=${encodeURIComponent(video.title)}&body=${encodeURIComponent(shareUrl)}`}
                className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border text-xs font-semibold ${
                  darkMode ? "bg-zinc-950 border-zinc-800 hover:bg-zinc-800" : "bg-zinc-50 border-zinc-200 hover:bg-zinc-100"
                }`}
              >
                <Mail className="w-5 h-5 text-fuchsia-500" />
                <span>Email</span>
              </a>
            </div>

            {/* Copier Input Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold font-mono uppercase tracking-wider opacity-75">Stream Link</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={`${window.location.origin}/${mapping}`}
                  className={`flex-grow px-3 py-2 rounded-lg border text-xs font-mono select-all outline-none ${
                    darkMode ? "bg-zinc-950 border-zinc-800" : "bg-zinc-100 border-zinc-200"
                  }`}
                />
                <button
                  onClick={handleCopyLink}
                  className={`px-3 py-2 rounded-lg border text-xs font-semibold flex items-center gap-1 cursor-pointer shrink-0 transition-colors ${
                    copied 
                      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
                      : darkMode ? "bg-zinc-950 border-zinc-800 hover:bg-zinc-800" : "bg-zinc-50 border-zinc-200 hover:bg-zinc-100"
                  }`}
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" /> Copy
                    </>
                  )}
                </button>
              </div>
            </div>

            <button
              onClick={() => setShowShareModal(false)}
              className={`w-full mt-6 py-2.5 rounded-xl border text-sm font-semibold transition-colors cursor-pointer ${
                darkMode ? "border-zinc-800 hover:bg-zinc-800" : "border-zinc-200 hover:bg-zinc-50"
              }`}
            >
              Close
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

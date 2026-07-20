import { useState, useEffect } from "react";
import { Video, TaskConfig } from "../types";
import { 
  ArrowLeft, Lock, Unlock, CheckCircle2, ShieldCheck, 
  Clock, AlertTriangle, ExternalLink, RefreshCw, FileVideo, ShieldAlert 
} from "lucide-react";
import { getApiUrl } from "../utils/api";

interface DownloadViewProps {
  slug: string;
  darkMode: boolean;
  navigate: (path: string) => void;
}

export default function DownloadView({ slug, darkMode, navigate }: DownloadViewProps) {
  const [video, setVideo] = useState<Video | null>(null);
  const [taskConfig, setTaskConfig] = useState<TaskConfig | null>(null);
  const [sessionId, setSessionId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // Step states
  // 0: Init, 1: Task 1 Clickable, 2: Task 1 Verifying/Countdown, 3: Task 1 ready to verify, 4: Task 1 Completed (Task 2 clickable)
  // 5: Task 2 Verifying/Countdown, 6: Task 2 ready to verify, 7: Task 2 Completed (Task 3 clickable)
  // 8: Task 3 Verifying/Countdown, 9: Task 3 ready to verify, 10: Task 3 Completed (Download unlocked)
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [countdown, setCountdown] = useState<number>(0);
  const [countdownActive, setCountdownActive] = useState<boolean>(false);
  const [verificationError, setVerificationError] = useState<string>("");
  const [isVerifying, setIsVerifying] = useState<boolean>(false);

  // Download states
  const [downloadLink, setDownloadLink] = useState<string>("");
  const [downloadFileName, setDownloadFileName] = useState<string>("");

  useEffect(() => {
    const initializePage = async () => {
      try {
        setIsLoading(true);
        setError("");

        // 1. Fetch video metadata
        const videoRes = await fetch(getApiUrl(`/api/videos/${slug}`));
        if (!videoRes.ok) throw new Error("Video channel is offline or unavailable.");
        const videoData = await videoRes.json();
        setVideo(videoData);

        // 2. Fetch task config (ENV URLs)
        const configRes = await fetch(getApiUrl("/api/config"));
        if (!configRes.ok) throw new Error("Downloader service is temporarily offline.");
        const configData = await configRes.json();
        setTaskConfig(configData);

        // 3. Register secure session on backend
        const sessionRes = await fetch(getApiUrl("/api/session/start"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug }),
        });
        if (!sessionRes.ok) throw new Error("Failed to register dynamic download token.");
        const sessionData = await sessionRes.json();
        setSessionId(sessionData.sessionId);

      } catch (err: any) {
        setError(err.message || "Initialization failed.");
      } finally {
        setIsLoading(false);
      }
    };

    initializePage();
  }, [slug]);

  // Countdown timer effect
  useEffect(() => {
    let timer: any = null;
    if (countdownActive && countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    } else if (countdown === 0 && countdownActive) {
      setCountdownActive(false);
      // Advance step to "ready to verify"
      if (currentStep === 2) setCurrentStep(3); // Task 1 ready to verify
      if (currentStep === 5) setCurrentStep(6); // Task 2 ready to verify
      if (currentStep === 8) setCurrentStep(9); // Task 3 ready to verify
    }
    return () => clearInterval(timer);
  }, [countdown, countdownActive, currentStep]);

  const handleStartTask = async (taskNumber: 1 | 2 | 3) => {
    if (!sessionId || !taskConfig) return;
    setVerificationError("");

    const link = taskNumber === 1 
      ? taskConfig.task1Link 
      : taskNumber === 2 ? taskConfig.task2Link : taskConfig.task3Link;

    try {
      // 1. Inform server that task timer started
      const res = await fetch(getApiUrl("/api/session/task/start"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, task: taskNumber }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Server rejected task authorization.");
      }

      // 2. Open link in a new tab
      window.open(link, "_blank", "noopener,noreferrer");

      // 3. Start 10-second timer countdown in UI
      setCountdown(10);
      setCountdownActive(true);
      setCurrentStep(taskNumber === 1 ? 2 : taskNumber === 2 ? 5 : 8);

    } catch (err: any) {
      setVerificationError(err.message || "Could not begin task tracking.");
    }
  };

  const handleVerifyTask = async (taskNumber: 1 | 2 | 3) => {
    if (!sessionId) return;
    setVerificationError("");
    setIsVerifying(true);

    try {
      // Send verification request to server
      const res = await fetch(getApiUrl("/api/session/task/complete"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, task: taskNumber }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Verification failed. Please retry.");
      }

      // If successful, transition to next active step
      if (taskNumber === 1) {
        setCurrentStep(4); // Task 1 Complete. Task 2 now enabled.
      } else if (taskNumber === 2) {
        setCurrentStep(7); // Task 2 Complete. Task 3 now enabled.
      } else {
        setCurrentStep(10); // Task 3 Complete. Download unlocked!
      }

    } catch (err: any) {
      setVerificationError(err.message || "Failed to confirm task completion.");
      // Revert step back to ready to click so they can click to navigate again
      if (taskNumber === 1) setCurrentStep(1);
      if (taskNumber === 2) setCurrentStep(4);
      if (taskNumber === 3) setCurrentStep(7);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleDownload = async () => {
    if (!sessionId) return;
    setVerificationError("");
    setIsVerifying(true);

    try {
      const res = await fetch(getApiUrl("/api/session/download"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to retrieve secure payload.");
      }

      // We got the secure link safely!
      setDownloadLink(data.downloadUrl);
      setDownloadFileName(data.title || "video-source");

      // Trigger standard HTML5 file download instantly via ref anchor
      const anchor = document.createElement("a");
      anchor.href = data.downloadUrl;
      anchor.setAttribute("download", `${data.title || "video"}.mp4`);
      anchor.setAttribute("target", "_blank");
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);

    } catch (err: any) {
      setVerificationError(err.message || "Critical failure downloading video.");
    } finally {
      setIsVerifying(false);
    }
  };

  if (isLoading) {
    return (
      <div className={`min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center p-8 ${
        darkMode ? "bg-zinc-950 text-zinc-100" : "bg-zinc-50 text-zinc-900"
      }`}>
        <div className="space-y-4 text-center">
          <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="font-display font-medium text-sm tracking-wide animate-pulse">Establishing high-secure downloader session...</p>
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
          <ShieldAlert className="w-16 h-16 text-red-500 mx-auto mb-4 animate-bounce" />
          <h2 className="text-2xl font-display font-bold mb-2">Security Connection Expired</h2>
          <p className={`text-sm mb-6 ${darkMode ? "text-zinc-400" : "text-zinc-600"}`}>
            {error || "An unauthorized access or server error was encountered."}
          </p>
          <button
            onClick={() => navigate(`/${slug}`)}
            className="flex items-center justify-center gap-2 mx-auto px-6 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-medium rounded-xl transition-all hover:scale-105 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> Go Back to Player
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-[calc(100vh-4rem)] py-8 px-4 sm:px-6 lg:px-8 bg-grid-pattern transition-colors duration-300 ${
      darkMode ? "bg-zinc-950 text-zinc-100" : "bg-zinc-50 text-zinc-900 bg-grid-pattern-light"
    }`}>
      <div className="max-w-3xl mx-auto space-y-6">
        
        {/* Navigation & Header Info */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-500/10">
          <button
            onClick={() => navigate(`/${slug}`)}
            className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-wider px-4 py-2 rounded-xl border transition-all hover:scale-102 cursor-pointer ${
              darkMode 
                ? "bg-zinc-900/50 border-zinc-800 hover:bg-zinc-800 hover:text-white" 
                : "bg-white border-zinc-200 hover:bg-zinc-50 hover:text-black"
            }`}
            id="back-to-player-btn"
          >
            <ArrowLeft className="w-4 h-4" /> Streaming
          </button>

          <div className="flex items-center gap-2 text-xs font-mono font-medium opacity-80">
            <ShieldCheck className="w-4 h-4 text-emerald-500 animate-pulse" />
            <span>Secure Download Node Verified</span>
          </div>
        </div>

        {/* Video Card Brief */}
        <div className={`p-6 rounded-2xl border flex flex-col sm:flex-row gap-5 items-center ${
          darkMode ? "bg-zinc-900/30 border-zinc-900" : "bg-white border-zinc-200 shadow-sm"
        }`}>
          <div className="relative aspect-video w-full sm:w-44 rounded-xl overflow-hidden shrink-0 bg-zinc-950">
            <img
              src={video.thumbnailUrl}
              alt={video.title}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-black/20"></div>
          </div>
          <div className="space-y-1.5 w-full text-center sm:text-left">
            <div className="flex items-center gap-1.5 justify-center sm:justify-start">
              <FileVideo className="w-4 h-4 text-violet-500" />
              <span className="text-xs font-mono font-semibold opacity-75">Ready to Download</span>
            </div>
            <h1 className="text-lg font-display font-extrabold tracking-tight line-clamp-1">{video.title}</h1>
            {video.fileSize && (
              <p className="text-xs font-mono opacity-60 mt-0.5">
                Size: <span className="text-violet-500 font-semibold">{video.fileSize} MB</span>
              </p>
            )}
          </div>
        </div>

        {/* Security Warning box */}
        <div className={`p-4 rounded-xl border flex gap-3 ${
          darkMode ? "bg-violet-500/5 border-violet-500/10 text-violet-400" : "bg-violet-50/70 border-violet-100 text-violet-800"
        }`}>
          <ShieldCheck className="w-5 h-5 shrink-0 text-violet-500 mt-0.5" />
          <div className="text-xs leading-relaxed space-y-1">
            <p className="font-bold">Anti-Scrape Protection Active</p>
            <p className="opacity-90">
              The direct download link is encrypted server-side. Completion of each task requires a strict 10-second verification timer verified by server timestamps. Inspecting html, network, or modifying client code will not bypass these steps.
            </p>
          </div>
        </div>

        {/* Progress Tracker Card */}
        <div className={`p-6 sm:p-8 rounded-2xl border transition-all duration-300 ${
          darkMode ? "bg-zinc-900/40 border-zinc-900 shadow-2xl" : "bg-white border-zinc-200 shadow-xl"
        }`}>
          <h2 className="text-xl font-display font-bold mb-6 text-center sm:text-left">Verification Roadmap</h2>
          
          <div className="space-y-6 relative">
            {/* Connecting lines between nodes */}
            <div className="absolute left-[23px] top-4 bottom-12 w-[2px] bg-zinc-500/10 -z-10"></div>

            {/* TASK 1 STEP */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2">
              <div className="flex items-center gap-4">
                {/* Node Status Indicator */}
                <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 border transition-all duration-300 font-mono font-bold text-sm ${
                  currentStep > 3 
                    ? "bg-emerald-500/15 border-emerald-500 text-emerald-500" 
                    : currentStep === 1 || currentStep === 2 || currentStep === 3
                    ? "bg-violet-500/15 border-violet-500 text-violet-400 shadow-[0_0_15px_rgba(139,92,246,0.15)] animate-pulse" 
                    : "bg-zinc-950 border-zinc-800 text-zinc-500"
                }`}>
                  {currentStep > 3 ? <CheckCircle2 className="w-5 h-5" /> : "01"}
                </div>
                
                <div>
                  <h3 className="font-display font-bold text-sm">Task 1: Sponsor Discovery</h3>
                  <p className={`text-xs leading-relaxed ${darkMode ? "text-zinc-400" : "text-zinc-500"}`}>
                    Visit first security partner link and wait for 10 seconds.
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="w-full sm:w-auto shrink-0 pl-16 sm:pl-0">
                {currentStep === 1 ? (
                  <button
                    onClick={() => handleStartTask(1)}
                    className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold bg-violet-600 hover:bg-violet-500 text-white rounded-xl transition-all hover:scale-102 cursor-pointer"
                    id="task-1-start-btn"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Start Task 1
                  </button>
                ) : currentStep === 2 ? (
                  <div className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-semibold font-mono">
                    <Clock className="w-3.5 h-3.5 animate-spin" /> Verifying in {countdown}s
                  </div>
                ) : currentStep === 3 ? (
                  <button
                    onClick={() => handleVerifyTask(1)}
                    disabled={isVerifying}
                    className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-all cursor-pointer animate-pulse"
                    id="task-1-verify-btn"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isVerifying ? "animate-spin" : ""}`} /> Verify Task 1
                  </button>
                ) : (
                  <div className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold font-mono">
                    <CheckCircle2 className="w-3.5 h-3.5" /> TASK COMPLETED
                  </div>
                )}
              </div>
            </div>

            {/* TASK 2 STEP */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2">
              <div className="flex items-center gap-4">
                {/* Node Status Indicator */}
                <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 border transition-all duration-300 font-mono font-bold text-sm ${
                  currentStep > 6 
                    ? "bg-emerald-500/15 border-emerald-500 text-emerald-500" 
                    : currentStep === 4 || currentStep === 5 || currentStep === 6
                    ? "bg-violet-500/15 border-violet-500 text-violet-400 shadow-[0_0_15px_rgba(139,92,246,0.15)] animate-pulse" 
                    : "bg-zinc-950 border-zinc-850 text-zinc-600"
                }`}>
                  {currentStep > 6 ? <CheckCircle2 className="w-5 h-5" /> : currentStep > 3 ? "02" : <Lock className="w-4 h-4 opacity-75" />}
                </div>
                
                <div>
                  <h3 className={`font-display font-bold text-sm ${currentStep > 3 ? "" : "opacity-50"}`}>
                    Task 2: Content Verification
                  </h3>
                  <p className={`text-xs leading-relaxed ${currentStep > 3 ? (darkMode ? "text-zinc-400" : "text-zinc-500") : "opacity-35"}`}>
                    Review second partner platform guidelines for 10 seconds.
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="w-full sm:w-auto shrink-0 pl-16 sm:pl-0">
                {currentStep < 4 ? (
                  <button disabled className={`w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl border opacity-50 cursor-not-allowed ${
                    darkMode ? "border-zinc-800 bg-zinc-900/30 text-zinc-500" : "border-zinc-200 bg-zinc-100 text-zinc-400"
                  }`}>
                    <Lock className="w-3.5 h-3.5" /> Locked
                  </button>
                ) : currentStep === 4 ? (
                  <button
                    onClick={() => handleStartTask(2)}
                    className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold bg-violet-600 hover:bg-violet-500 text-white rounded-xl transition-all hover:scale-102 cursor-pointer"
                    id="task-2-start-btn"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Start Task 2
                  </button>
                ) : currentStep === 5 ? (
                  <div className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-semibold font-mono">
                    <Clock className="w-3.5 h-3.5 animate-spin" /> Verifying in {countdown}s
                  </div>
                ) : currentStep === 6 ? (
                  <button
                    onClick={() => handleVerifyTask(2)}
                    disabled={isVerifying}
                    className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-all cursor-pointer animate-pulse"
                    id="task-2-verify-btn"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isVerifying ? "animate-spin" : ""}`} /> Verify Task 2
                  </button>
                ) : (
                  <div className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold font-mono">
                    <CheckCircle2 className="w-3.5 h-3.5" /> TASK COMPLETED
                  </div>
                )}
              </div>
            </div>

            {/* TASK 3 STEP */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2">
              <div className="flex items-center gap-4">
                {/* Node Status Indicator */}
                <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 border transition-all duration-300 font-mono font-bold text-sm ${
                  currentStep > 9 
                    ? "bg-emerald-500/15 border-emerald-500 text-emerald-500" 
                    : currentStep === 7 || currentStep === 8 || currentStep === 9
                    ? "bg-violet-500/15 border-violet-500 text-violet-400 shadow-[0_0_15px_rgba(139,92,246,0.15)] animate-pulse" 
                    : "bg-zinc-950 border-zinc-850 text-zinc-600"
                }`}>
                  {currentStep > 9 ? <CheckCircle2 className="w-5 h-5" /> : currentStep > 6 ? "03" : <Lock className="w-4 h-4 opacity-75" />}
                </div>
                
                <div>
                  <h3 className={`font-display font-bold text-sm ${currentStep > 6 ? "" : "opacity-50"}`}>
                    Task 3: Security Integrity Check
                  </h3>
                  <p className={`text-xs leading-relaxed ${currentStep > 6 ? (darkMode ? "text-zinc-400" : "text-zinc-500") : "opacity-35"}`}>
                    Complete the secure cryptographic checks on partner network.
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="w-full sm:w-auto shrink-0 pl-16 sm:pl-0">
                {currentStep < 7 ? (
                  <button disabled className={`w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl border opacity-50 cursor-not-allowed ${
                    darkMode ? "border-zinc-800 bg-zinc-900/30 text-zinc-500" : "border-zinc-200 bg-zinc-100 text-zinc-400"
                  }`}>
                    <Lock className="w-3.5 h-3.5" /> Locked
                  </button>
                ) : currentStep === 7 ? (
                  <button
                    onClick={() => handleStartTask(3)}
                    className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold bg-violet-600 hover:bg-violet-500 text-white rounded-xl transition-all hover:scale-102 cursor-pointer"
                    id="task-3-start-btn"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Start Task 3
                  </button>
                ) : currentStep === 8 ? (
                  <div className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-semibold font-mono">
                    <Clock className="w-3.5 h-3.5 animate-spin" /> Verifying in {countdown}s
                  </div>
                ) : currentStep === 9 ? (
                  <button
                    onClick={() => handleVerifyTask(3)}
                    disabled={isVerifying}
                    className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-all cursor-pointer animate-pulse"
                    id="task-3-verify-btn"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isVerifying ? "animate-spin" : ""}`} /> Verify Task 3
                  </button>
                ) : (
                  <div className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold font-mono">
                    <CheckCircle2 className="w-3.5 h-3.5" /> TASK COMPLETED
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Verification Error Box */}
          {verificationError && (
            <div className="mt-8 flex items-center gap-2.5 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
              <AlertTriangle className="w-4.5 h-4.5 shrink-0" />
              <span>{verificationError}</span>
            </div>
          )}

          {/* Master Download Unlock Button */}
          <div className="mt-10 pt-6 border-t border-zinc-500/10 text-center">
            {currentStep < 10 ? (
              <div className="space-y-4">
                <button
                  disabled
                  className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold border opacity-60 cursor-not-allowed ${
                    darkMode ? "bg-zinc-950 border-zinc-800 text-zinc-500" : "bg-zinc-100 border-zinc-200 text-zinc-400"
                  }`}
                  id="final-download-locked-btn"
                >
                  <Lock className="w-4 h-4" /> Final Download Link Locked
                </button>
                <p className={`text-[11px] font-mono tracking-wide uppercase opacity-65`}>
                  Complete sponsor Task 1, 2, and 3 to authorize key release.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {downloadLink ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-bold animate-bounce">
                      <ShieldCheck className="w-5 h-5" /> Verification complete! Download starting automatically.
                    </div>
                    <a
                      href={downloadLink}
                      download={`${downloadFileName}.mp4`}
                      className="w-full flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold rounded-xl transition-all hover:scale-101 shadow-lg shadow-emerald-500/20"
                    >
                      <Unlock className="w-4 h-4" /> Download Did Not Start? Click Here
                    </a>
                  </div>
                ) : (
                  <button
                    onClick={handleDownload}
                    disabled={isVerifying}
                    className="w-full flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-violet-600 via-fuchsia-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-extrabold rounded-xl transition-all hover:scale-101 shadow-xl shadow-violet-500/20 cursor-pointer"
                    id="final-download-unlocked-btn"
                  >
                    <Unlock className="w-4 h-4" /> Authenticate & Access Download
                  </button>
                )}
                <p className={`text-[11px] font-mono tracking-wider uppercase font-bold text-emerald-500`}>
                  Vault Authorization Successful • Download ready
                </p>
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}

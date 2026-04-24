import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Camera,
  Video,
  VideoOff,
  ScanLine,
  Package,
  PackageX,
  PackageOpen,
  Activity,
  History,
  Settings2,
  X,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";

// ─── Types ─────────────────────────────────────────────────────────────────────

type PackageStatus = "good" | "damaged" | "empty";

interface AnalyzeResult {
  status:      PackageStatus;
  confidence:  number;   // 0–100
  reason:      string;
  issues:      string[];
  analysis_ms: number;
}

interface ScanResult {
  id:          string;
  status:      PackageStatus;
  confidence:  number;
  time:        string;
  reason:      string;
  scan_ms:     number;
}

interface ApiWrapper<T> { success: boolean; data: T }

// ─── Helpers ───────────────────────────────────────────────────────────────────

function StatusIcon({ status, className }: { status: PackageStatus; className?: string }) {
  if (status === "good")    return <Package     className={cn("text-success",     className)} />;
  if (status === "damaged") return <PackageX    className={cn("text-destructive", className)} />;
  return                           <PackageOpen className={cn("text-muted-foreground", className)} />;
}

function generatePackageId(): string {
  return `PKG-${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

// ─── Live Scanner Page ─────────────────────────────────────────────────────────

export function LiveScannerPage() {
  // ── Camera state ────────────────────────────────────────────────────────────
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isScanning,     setIsScanning]     = useState(false);
  const [isAnalyzing,    setIsAnalyzing]    = useState(false);
  const [cameraError,    setCameraError]    = useState<string | null>(null);
  const [rateLimitMsg,   setRateLimitMsg]   = useState<string | null>(null);

  // ── Scan data ────────────────────────────────────────────────────────────────
  const [recentScans,  setRecentScans]  = useState<ScanResult[]>([]);
  const [lastResult,   setLastResult]   = useState<AnalyzeResult | null>(null);

  // ── Config state ────────────────────────────────────────────────────────────
  const [isConfigOpen,          setIsConfigOpen]          = useState(false);
  const [confidenceThreshold,   setConfidenceThreshold]   = useState("85");
  const [scanIntervalS,         setScanIntervalS]         = useState("4");
  const [autoPauseOnDefect,     setAutoPauseOnDefect]     = useState(true);

  // ── Refs ─────────────────────────────────────────────────────────────────────
  const videoRef   = useRef<HTMLVideoElement>(null);
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const streamRef  = useRef<MediaStream | null>(null);
  const analyzingRef = useRef(false); // avoid closure-stale isAnalyzing in interval

  // ── Session stats (derived from recentScans) ──────────────────────────────
  const stats = useMemo(() => {
    if (recentScans.length === 0) return { scanned: 0, defectRate: 0, avgTime: 0, throughput: 0 };
    const damaged    = recentScans.filter(s => s.status === "damaged").length;
    const avgScan_ms = recentScans.reduce((a, s) => a + s.scan_ms, 0) / recentScans.length;
    const intervalMs = Math.max(4000, parseFloat(scanIntervalS) * 1000);
    return {
      scanned:    recentScans.length,
      defectRate: (damaged / recentScans.length) * 100,
      avgTime:    avgScan_ms / 1000,
      throughput: Math.round(3600_000 / intervalMs),
    };
  }, [recentScans, scanIntervalS]);

  // ── Camera lifecycle ────────────────────────────────────────────────────────

  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setIsCameraActive(true);
    } catch {
      setCameraError("Camera permission denied or no device available. Allow camera access and try again.");
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsCameraActive(false);
    setIsScanning(false);
    setLastResult(null);
  }, []);

  const toggleCamera = useCallback(() => {
    if (isCameraActive) stopCamera();
    else startCamera();
  }, [isCameraActive, startCamera, stopCamera]);

  // ── Frame capture + Gemini analysis ────────────────────────────────────────

  const captureAndAnalyze = useCallback(async () => {
    if (analyzingRef.current) return; // skip if previous call still in flight
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;

    analyzingRef.current = true;
    setIsAnalyzing(true);

    try {
      canvas.width  = video.videoWidth  || 640;
      canvas.height = video.videoHeight || 480;
      canvas.getContext("2d")?.drawImage(video, 0, 0);
      const frameDataUrl = canvas.toDataURL("image/jpeg", 0.75);

      const start   = Date.now();
      const wrapper = await api.post<ApiWrapper<AnalyzeResult>>(
        "/api/v1/scanner/analyze",
        { frame_data_url: frameDataUrl }
      );
      const result  = wrapper.data;
      const scan_ms = Date.now() - start;

      setLastResult(result);

      const newScan: ScanResult = {
        id:         generatePackageId(),
        status:     result.status,
        confidence: result.confidence,
        time:       new Date().toLocaleTimeString("en-PH", { hour12: false }),
        reason:     result.reason,
        scan_ms,
      };

      setRecentScans(prev => [newScan, ...prev].slice(0, 10));

      // Persist to backend — fire-and-forget (UI stays responsive).
      // frame_data_url is intentionally omitted: storing a raw base64 JPEG
      // (~100–200 KB) as an Appwrite document string attribute exceeds
      // per-attribute size limits and silently fails the entire document write.
      api.post<unknown>("/api/v1/scanner/scan", {
        status:        result.status,
        confidence:    result.confidence / 100,   // backend expects 0–1
        scan_time_ms:  scan_ms,
        frame_data_url: null,
        metadata: { reason: result.reason, issues: result.issues },
      }).catch(err => {
        console.error("Scan persist failed:", err);
        setRateLimitMsg("⚠ Scan recorded locally but failed to save to database. Check console for details.");
      });

      // Auto-pause if damaged and setting is enabled
      if (autoPauseOnDefect && result.status === "damaged") {
        setIsScanning(false);
      }

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("429") || msg.includes("rate") || msg.includes("quota") || msg.includes("RATE_LIMITED")) {
        // Parse retry delay from backend message if available
        const retryMatch = msg.match(/(\d+)\s*s/i);
        const seconds    = retryMatch ? parseInt(retryMatch[1], 10) : 60;
        setRateLimitMsg(`Gemini rate limit reached — scanning paused. Retry in ~${seconds}s.`);
        setIsScanning(false);
        // Auto-clear the notice after the suggested retry window
        setTimeout(() => setRateLimitMsg(null), seconds * 1000);
      } else {
        console.error("Analysis failed:", err);
      }
    } finally {
      analyzingRef.current = false;
      setIsAnalyzing(false);
    }
  }, [autoPauseOnDefect]);

  // ── Scanning interval ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isCameraActive || !isScanning) return;
    const intervalMs = Math.max(4000, parseFloat(scanIntervalS) * 1000);
    const id = setInterval(captureAndAnalyze, intervalMs);
    return () => clearInterval(id);
  }, [isCameraActive, isScanning, scanIntervalS, captureAndAnalyze]);

  // ── Attach stream to video element whenever isCameraActive becomes true ──────
  // This acts as a safety net: if the stream was acquired before the video
  // element was painted (React batching / Strict Mode double-invoke), the
  // effect runs after the DOM update and ensures srcObject is always set.
  useEffect(() => {
    if (isCameraActive && videoRef.current && streamRef.current) {
      if (videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
        videoRef.current.play().catch(() => {});
      }
    }
  }, [isCameraActive]);

  // ── Cleanup on unmount ───────────────────────────────────────────────────────
  useEffect(() => () => { streamRef.current?.getTracks().forEach(t => t.stop()) }, []);

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4 max-w-[1400px]">

      {/* ── Page Heading ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            Live Scanner
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time package inspection powered by Google Gemini Vision · {scanIntervalS}s interval
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setIsConfigOpen(true)}>
            <Settings2 className="w-3.5 h-3.5 mr-2" />
            Config
          </Button>
          <Button
            size="sm"
            variant={isCameraActive ? "destructive" : "default"}
            onClick={toggleCamera}
          >
            {isCameraActive
              ? <><VideoOff className="w-3.5 h-3.5 mr-2" />Stop Camera</>
              : <><Video    className="w-3.5 h-3.5 mr-2" />Start Camera</>
            }
          </Button>
        </div>
      </div>

      {/* ── Camera error banner ──────────────────────────────────────────────── */}
      {cameraError && (
        <div className="flex items-start gap-2 border border-destructive/40 bg-destructive/5 px-3 py-2.5">
          <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
          <p className="text-xs text-destructive">{cameraError}</p>
          <button onClick={() => setCameraError(null)} className="ml-auto shrink-0">
            <X className="w-3 h-3 text-muted-foreground hover:text-foreground" />
          </button>
        </div>
      )}

      {/* ── Gemini rate-limit notice ─────────────────────────────────────────── */}
      {rateLimitMsg && (
        <div className="flex items-start gap-2 border border-warning/40 bg-warning/5 px-3 py-2.5">
          <AlertTriangle className="w-3.5 h-3.5 text-warning shrink-0 mt-0.5" />
          <p className="text-xs text-warning">{rateLimitMsg}</p>
          <button onClick={() => setRateLimitMsg(null)} className="ml-auto shrink-0">
            <X className="w-3 h-3 text-muted-foreground hover:text-foreground" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">

        {/* ── Left Column: Camera Feed ─────────────────────────────────────── */}
        <div className="flex flex-col gap-4 lg:h-[540px]">
          <Card className="flex-1 flex flex-col min-h-0">
            <CardHeader className="border-b border-border bg-muted/30 pb-3">
              <div className="flex items-center gap-4">
                <CardTitle className="flex items-center gap-2 text-md shrink-0">
                  <Camera className="w-4 h-4 text-muted-foreground" />
                  Camera Feed
                </CardTitle>
                <div className="flex items-center gap-2 ml-auto">
                  {isAnalyzing && (
                    <Badge variant="warning" className="text-2xs gap-1">
                      <Loader2 className="w-2.5 h-2.5 animate-spin" />
                      Analyzing…
                    </Badge>
                  )}
                  <Badge variant={isCameraActive ? "stable" : "empty"} className="text-2xs">
                    {isCameraActive ? "Live" : "Offline"}
                  </Badge>
                </div>
              </div>
            </CardHeader>

            <CardContent className="flex-1 p-0 bg-black relative flex items-center justify-center overflow-hidden">
              {/* Hidden canvas for frame capture — always in DOM */}
              <canvas ref={canvasRef} className="hidden" />

              {/*
                ── Video element is ALWAYS in the DOM so videoRef.current is
                   never null when startCamera() runs and attaches srcObject.
                   We simply hide it with CSS until the stream is active.
              */}
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className={cn(
                  "w-full h-full object-cover [transform:scaleX(-1)]",
                  !isCameraActive && "hidden",
                )}
              />

              {/* ── Scanning corner brackets + sweep line (active only) ────── */}
              {isCameraActive && isScanning && (
                <div className="absolute inset-0 pointer-events-none border-[2px] border-success/30 m-8">
                  <div className="absolute top-0 left-0 w-4 h-4 border-t-[2px] border-l-[2px] border-success -ml-[2px] -mt-[2px]" />
                  <div className="absolute top-0 right-0 w-4 h-4 border-t-[2px] border-r-[2px] border-success -mr-[2px] -mt-[2px]" />
                  <div className="absolute bottom-0 left-0 w-4 h-4 border-b-[2px] border-l-[2px] border-success -ml-[2px] -mb-[2px]" />
                  <div className="absolute bottom-0 right-0 w-4 h-4 border-b-[2px] border-r-[2px] border-success -mr-[2px] -mb-[2px]" />
                  <div className="absolute left-0 right-0 h-[1px] bg-success/50 top-1/2 -translate-y-1/2 animate-[scan_2s_ease-in-out_infinite]" />
                </div>
              )}

              {/* ── Last result overlay — bottom strip on video ────────────── */}
              {isCameraActive && lastResult && isScanning && (
                <div className={cn(
                  "absolute bottom-0 left-0 right-0 px-3 py-2 flex items-center gap-2",
                  lastResult.status === "good"    && "bg-success/80",
                  lastResult.status === "damaged" && "bg-destructive/80",
                  lastResult.status === "empty"   && "bg-muted/80",
                )}>
                  <StatusIcon status={lastResult.status} className="w-3.5 h-3.5 text-white shrink-0" />
                  <span className="text-xs text-white font-medium capitalize">{lastResult.status}</span>
                  <span className="text-xs text-white/80 font-mono">{lastResult.confidence}%</span>
                  <span className="text-xs text-white/70 ml-2 truncate">{lastResult.reason}</span>
                </div>
              )}

              {/* ── Offline placeholder — absolute overlay when camera is off */}
              {!isCameraActive && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
                  <VideoOff className="w-10 h-10 mb-3 opacity-20" />
                  <p className="text-sm">Camera is inactive.</p>
                  <p className="text-xs mt-1 opacity-70">
                    Click "Start Camera" to begin classification.
                  </p>
                </div>
              )}
            </CardContent>

            {/* Last result reason callout */}
            {lastResult && (
              <div className="border-t border-border bg-muted/10 px-3 py-2 flex items-start gap-2">
                <Info className="w-3 h-3 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  <span className="font-medium text-foreground capitalize">{lastResult.status}</span>
                  {" — "}{lastResult.reason}
                  {lastResult.issues.length > 0 && (
                    <span className="text-destructive"> · {lastResult.issues.join(", ")}</span>
                  )}
                </p>
              </div>
            )}

            <CardFooter className="border-t border-border bg-muted/20 p-3 flex justify-between">
              <div className="text-xs text-muted-foreground font-mono">
                {isAnalyzing ? "ANALYZING_FRAME…" : isScanning ? "AWAITING_INTERVAL" : "STANDBY"}
              </div>
              <Button
                size="sm"
                disabled={!isCameraActive}
                onClick={() => setIsScanning(s => !s)}
                variant={isScanning ? "outline" : "default"}
              >
                {isScanning ? "Pause Inspection" : "Begin Inspection"}
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* ── Right Column: Recent Activity ────────────────────────────────── */}
        <div className="flex flex-col gap-4 min-h-0 lg:h-[540px]">

          {/* Recent Scans */}
          <Card className="flex-1 flex flex-col min-h-0">
            <CardHeader className="border-b border-border bg-muted/30 shrink-0">
              <CardTitle className="flex items-center gap-2 text-md">
                <History className="w-4 h-4 text-muted-foreground" />
                Recent Scans
              </CardTitle>
              <CardDescription>Latest Gemini classifications this session</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 p-0 overflow-y-auto">
              {recentScans.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground py-8">
                  <ScanLine className="w-8 h-8 opacity-20" strokeWidth={1.5} />
                  <p className="text-xs">No scans yet — begin inspection to start.</p>
                </div>
              ) : (
                <div className="flex flex-col divide-y divide-border">
                  {recentScans.map((scan, i) => (
                    <div
                      key={`${scan.id}-${i}`}
                      className="p-3 flex items-start gap-3 hover:bg-accent/30 transition-colors"
                    >
                      <div className="mt-0.5 shrink-0 border border-border bg-card p-1">
                        <StatusIcon status={scan.status} className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-xs font-mono text-foreground font-medium">{scan.id}</span>
                          <span className="text-2xs text-muted-foreground font-mono tabular-nums">{scan.time}</span>
                        </div>
                        <div className="flex items-center justify-between mb-0.5">
                          <Badge variant={scan.status} className="text-2xs uppercase">{scan.status}</Badge>
                          <span className="text-2xs text-muted-foreground tabular-nums">{scan.confidence.toFixed(1)}%</span>
                        </div>
                        <p className="text-2xs text-muted-foreground truncate leading-relaxed">{scan.reason}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Session Stats */}
          <Card>
            <CardHeader className="border-b border-border bg-muted/30 pb-3">
              <CardTitle className="flex items-center gap-2 text-md">
                <Activity className="w-4 h-4 text-muted-foreground" />
                Session Stats
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-2 gap-4">
                <StatCell label="Scanned"    value={stats.scanned.toString()} />
                <StatCell
                  label="Defect Rate"
                  value={`${stats.defectRate.toFixed(1)}%`}
                  color={stats.defectRate > 5 ? "warn" : undefined}
                />
                <StatCell label="Est. Throughput" value={`${stats.throughput}/hr`} />
                <StatCell
                  label="Avg Scan Time"
                  value={stats.avgTime > 0 ? `${stats.avgTime.toFixed(2)}s` : "—"}
                />
              </div>
              {recentScans.length > 0 && (
                <>
                  <Separator className="my-3" />
                  <div className="flex items-center gap-1.5 text-2xs text-success">
                    <CheckCircle2 className="w-3 h-3" />
                    {recentScans.filter(s => s.status === "good").length} good ·{" "}
                    {recentScans.filter(s => s.status === "damaged").length} damaged ·{" "}
                    {recentScans.filter(s => s.status === "empty").length} empty
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Config Modal ─────────────────────────────────────────────────────── */}
      {isConfigOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-card border border-border shadow-md flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
              <h3 className="text-md font-semibold text-foreground">Scanner Configuration</h3>
              <Button variant="ghost" size="icon" onClick={() => setIsConfigOpen(false)} className="h-6 w-6">
                <X className="w-4 h-4 text-muted-foreground" />
              </Button>
            </div>
            <div className="p-4 flex flex-col gap-4">

              <div className="flex flex-col gap-2">
                <Label htmlFor="interval" className="text-xs">Scan Interval (seconds)</Label>
                <Input
                  id="interval"
                  type="number"
                  value={scanIntervalS}
                  onChange={e => setScanIntervalS(e.target.value)}
                  min="4"
                  max="30"
                  step="1"
                />
                <p className="text-2xs text-muted-foreground">
                  Minimum 4s — Gemini free tier allows 15 requests/min.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="threshold" className="text-xs">Confidence Threshold (%)</Label>
                <Input
                  id="threshold"
                  type="number"
                  value={confidenceThreshold}
                  onChange={e => setConfidenceThreshold(e.target.value)}
                  min="50"
                  max="100"
                />
                <p className="text-2xs text-muted-foreground">
                  Scans below this confidence are flagged for manual review.
                </p>
              </div>

              <div className="flex items-center justify-between pt-1">
                <Label htmlFor="auto-pause" className="text-xs cursor-pointer select-none flex-1">
                  Auto-pause on defect detection
                </Label>
                <input
                  type="checkbox"
                  id="auto-pause"
                  checked={autoPauseOnDefect}
                  onChange={e => setAutoPauseOnDefect(e.target.checked)}
                  className="w-3.5 h-3.5 accent-primary cursor-pointer"
                />
              </div>
            </div>
            <div className="p-3 border-t border-border bg-muted/20 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setIsConfigOpen(false)}>Cancel</Button>
              <Button size="sm" onClick={() => setIsConfigOpen(false)}>Save Changes</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Stat Cell ────────────────────────────────────────────────────────────────

function StatCell({ label, value, color }: { label: string; value: string; color?: "warn" }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest">{label}</span>
      <span className={cn(
        "text-lg font-semibold tabular-nums text-foreground",
        color === "warn" && "text-warning",
      )}>
        {value}
      </span>
    </div>
  );
}

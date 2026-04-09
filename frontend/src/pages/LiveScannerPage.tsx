import { useState, useEffect, useRef } from "react";
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

// ─── Mock Data ─────────────────────────────────────────────────────────────────

type ScanResult = {
  id: string;
  status: "good" | "damaged" | "empty";
  confidence: number;
  time: string;
};

const MOCK_HISTORY: ScanResult[] = [
  { id: "PK-8829A", status: "good", confidence: 98.2, time: "14:32:15" },
  { id: "PK-8829B", status: "damaged", confidence: 91.5, time: "14:31:58" },
  { id: "PK-8829C", status: "good", confidence: 99.1, time: "14:31:42" },
  { id: "PK-8829D", status: "empty", confidence: 96.4, time: "14:31:30" },
  { id: "PK-8829E", status: "good", confidence: 97.8, time: "14:31:17" },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────

function StatusIcon({
  status,
  className,
}: {
  status: ScanResult["status"];
  className?: string;
}) {
  if (status === "good")
    return <Package className={cn("text-success", className)} />;
  if (status === "damaged")
    return <PackageX className={cn("text-destructive", className)} />;
  return <PackageOpen className={cn("text-muted-foreground", className)} />;
}

// ─── Live Scanner Page ─────────────────────────────────────────────────────────

export function LiveScannerPage() {
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [recentScans, setRecentScans] = useState<ScanResult[]>(MOCK_HISTORY);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [confidenceThreshold, setConfidenceThreshold] = useState("85");
  const videoRef = useRef<HTMLDivElement>(null);

  // Mock scanning effect
  useEffect(() => {
    if (!isCameraActive || !isScanning) return;

    const interval = setInterval(() => {
      const statuses: ("good" | "damaged" | "empty")[] = [
        "good",
        "good",
        "good",
        "damaged",
        "empty",
      ];
      const randomStatus =
        statuses[Math.floor(Math.random() * statuses.length)];

      const newScan: ScanResult = {
        id: `PK-${Math.floor(Math.random() * 90000 + 10000)}X`,
        status: randomStatus,
        confidence: 85 + Math.random() * 14,
        time: new Date().toLocaleTimeString("en-US", { hour12: false }),
      };

      setRecentScans((prev) => [newScan, ...prev].slice(0, 10));
    }, 3500);

    return () => clearInterval(interval);
  }, [isCameraActive, isScanning]);

  const toggleCamera = () => {
    setIsCameraActive(!isCameraActive);
    if (isCameraActive) setIsScanning(false);
  };

  return (
    <div className="flex flex-col gap-4 max-w-[1400px]">
      {/* ── Page Heading ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            Live Scanner
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time TensorFlow.js package classification
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsConfigOpen(true)}
          >
            <Settings2 className="w-3.5 h-3.5 mr-2" />
            Config
          </Button>
          <Button
            size="sm"
            variant={isCameraActive ? "destructive" : "default"}
            onClick={toggleCamera}
          >
            {isCameraActive ? (
              <>
                <VideoOff className="w-3.5 h-3.5 mr-2" /> Stop Camera
              </>
            ) : (
              <>
                <Video className="w-3.5 h-3.5 mr-2" /> Start Camera
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        {/* ── Left Column: Camera Feed ───────────────────────────────────────── */}
        <div className="flex flex-col gap-4">
          <Card className="flex-1 min-h-[500px] flex flex-col">
            <CardHeader className="border-b border-border bg-muted/30 pb-3">
              <CardTitle className="flex items-center gap-2 text-md">
                <Camera className="w-4 h-4 text-muted-foreground" />
                Camera Feed
              </CardTitle>
              <Badge
                variant={isCameraActive ? "stable" : "empty"}
                className="text-2xs"
              >
                {isCameraActive ? "Live" : "Offline"}
              </Badge>
            </CardHeader>
            <CardContent className="flex-1 p-0 bg-black relative flex items-center justify-center overflow-hidden">
              {isCameraActive ? (
                <>
                  {/* Mock Video Feed Placeholder */}
                  <div
                    ref={videoRef}
                    className="absolute inset-0 bg-sidebar-border/10 flex items-center justify-center bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-muted/20 via-background to-background"
                  >
                    <div className="text-center flex flex-col items-center">
                      <ScanLine
                        className={cn(
                          "w-12 h-12 text-muted-foreground/50 mb-4",
                          isScanning && "text-success animate-pulse",
                        )}
                      />
                      <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
                        TF.js Model Active
                      </p>
                    </div>
                  </div>

                  {/* Scanning Overlay Grid */}
                  {isScanning && (
                    <div className="absolute inset-0 pointer-events-none border-[2px] border-success/30 m-8">
                      <div className="absolute top-0 left-0 w-4 h-4 border-t-[2px] border-l-[2px] border-success -ml-[2px] -mt-[2px]" />
                      <div className="absolute top-0 right-0 w-4 h-4 border-t-[2px] border-r-[2px] border-success -mr-[2px] -mt-[2px]" />
                      <div className="absolute bottom-0 left-0 w-4 h-4 border-b-[2px] border-l-[2px] border-success -ml-[2px] -mb-[2px]" />
                      <div className="absolute bottom-0 right-0 w-4 h-4 border-b-[2px] border-r-[2px] border-success -mr-[2px] -mb-[2px]" />
                      <div className="absolute left-0 right-0 h-[1px] bg-success/40 top-1/2 -translate-y-1/2 shadow-[0_0_8px_2px_rgba(0,255,0,0.2)] animate-[scan_2s_ease-in-out_infinite]" />
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center text-muted-foreground flex flex-col items-center">
                  <VideoOff className="w-10 h-10 mb-3 opacity-20" />
                  <p className="text-sm">Camera is inactive.</p>
                  <p className="text-xs mt-1 opacity-70">
                    Click "Start Camera" to begin classification.
                  </p>
                </div>
              )}
            </CardContent>
            <CardFooter className="border-t border-border bg-muted/20 p-3 flex justify-between">
              <div className="text-xs text-muted-foreground font-mono">
                {isScanning ? "PROCESSING_FRAMES" : "AWAITING_INPUT"}
              </div>
              <Button
                size="sm"
                disabled={!isCameraActive}
                onClick={() => setIsScanning(!isScanning)}
                variant={isScanning ? "outline" : "default"}
              >
                {isScanning ? "Pause Inspection" : "Begin Inspection"}
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* ── Right Column: Recent Activity ──────────────────────────────────── */}
        <div className="flex flex-col gap-4 min-h-0">
          <Card className="flex-1 flex flex-col min-h-0">
            <CardHeader className="border-b border-border bg-muted/30 shrink-0">
              <div className="flex flex-col gap-1 w-full">
                <CardTitle className="flex items-center gap-2 text-md">
                  <History className="w-4 h-4 text-muted-foreground" />
                  Recent Scans
                </CardTitle>
                <CardDescription>
                  Latest classifications from the stream
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="flex-1 p-0 overflow-y-auto">
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
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-mono text-foreground font-medium">
                          {scan.id}
                        </span>
                        <span className="text-2xs text-muted-foreground font-mono tabular-nums">
                          {scan.time}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <Badge
                          variant={scan.status}
                          className="text-2xs uppercase"
                        >
                          {scan.status}
                        </Badge>
                        <span className="text-2xs text-muted-foreground tabular-nums">
                          {scan.confidence.toFixed(1)}% conf
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <Card>
            <CardHeader className="border-b border-border bg-muted/30 pb-3">
              <CardTitle className="flex items-center gap-2 text-md">
                <Activity className="w-4 h-4 text-muted-foreground" />
                Session Stats
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <span className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest">
                    Scanned
                  </span>
                  <span className="text-lg font-semibold tabular-nums text-foreground">
                    1,247
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest">
                    Defect Rate
                  </span>
                  <span className="text-lg font-semibold tabular-nums text-warning">
                    3.8%
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest">
                    Throughput
                  </span>
                  <span className="text-lg font-semibold tabular-nums text-foreground">
                    1,268/hr
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest">
                    Avg Time
                  </span>
                  <span className="text-lg font-semibold tabular-nums text-foreground">
                    2.84s
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Config Modal ──────────────────────────────────────────────────────── */}
      {isConfigOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-card border border-border shadow-md flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
              <h3 className="text-md font-semibold text-foreground">
                Scanner Configuration
              </h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsConfigOpen(false)}
                className="h-6 w-6"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </Button>
            </div>
            <div className="p-4 flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="threshold" className="text-xs">
                  Confidence Threshold (%)
                </Label>
                <Input
                  id="threshold"
                  type="number"
                  value={confidenceThreshold}
                  onChange={(e) => setConfidenceThreshold(e.target.value)}
                  min="50"
                  max="100"
                />
                <p className="text-2xs text-muted-foreground">
                  Scans below this confidence will be flagged for manual review.
                </p>
              </div>
              <div className="flex items-center justify-between pt-2">
                <Label
                  className="text-xs cursor-pointer select-none flex-1"
                  htmlFor="auto-pause"
                >
                  Auto-pause on defect
                </Label>
                <input
                  type="checkbox"
                  id="auto-pause"
                  defaultChecked
                  className="w-3.5 h-3.5 accent-primary cursor-pointer"
                />
              </div>
            </div>
            <div className="p-3 border-t border-border bg-muted/20 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsConfigOpen(false)}
              >
                Cancel
              </Button>
              <Button size="sm" onClick={() => setIsConfigOpen(false)}>
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

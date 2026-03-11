import { Sun, Moon, Monitor, RotateCcw, Cpu, Link, Database } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { useSettings, type Theme, type RefreshInterval } from "@/hooks/useSettings"

// ─── Settings Page ─────────────────────────────────────────────────────────────
export function SettingsPage() {
  const { settings, setSetting, resetSettings } = useSettings()

  return (
    <div className="w-full flex flex-col gap-5">

      {/* ── Appearance ───────────────────────────────────────────────────────── */}
      <Section title="Appearance" description="Control how LogiGuard looks on your device.">

        <SettingRow
          label="Theme"
          description="Choose between light, dark, or follow your system preference."
        >
          <ThemeToggle
            value={settings.theme}
            onChange={(v) => setSetting("theme", v)}
          />
        </SettingRow>

      </Section>

      {/* ── Scanner ──────────────────────────────────────────────────────────── */}
      <Section title="Scanner" description="Default behaviour for the Live Scanner module.">

        <SettingRow
          label="Confidence Threshold"
          description="Minimum confidence required before a scan result is accepted."
        >
          <div className="flex items-center gap-3 w-52">
            <input
              type="range"
              min={70}
              max={99}
              step={1}
              value={settings.confidenceThreshold}
              onChange={(e) => setSetting("confidenceThreshold", Number(e.target.value))}
              className="flex-1 h-1 appearance-none bg-border accent-foreground cursor-pointer"
            />
            <span className="text-xs font-semibold tabular-nums w-9 text-right">
              {settings.confidenceThreshold}%
            </span>
          </div>
        </SettingRow>

        <Separator />

        <SettingRow
          label="Blockchain Logging"
          description="Automatically log every accepted scan to the Ganache blockchain."
        >
          <Toggle
            checked={settings.blockchainLogging}
            onChange={(v) => setSetting("blockchainLogging", v)}
          />
        </SettingRow>

      </Section>

      {/* ── Dashboard ────────────────────────────────────────────────────────── */}
      <Section title="Dashboard" description="Configure live data refresh behaviour.">

        <SettingRow
          label="Auto-Refresh Interval"
          description="How often the dashboard polls for updated scan and queue data."
        >
          <SegmentedControl<RefreshInterval>
            options={[
              { label: "15 s", value: 15 },
              { label: "30 s", value: 30 },
              { label: "60 s", value: 60 },
            ]}
            value={settings.refreshInterval}
            onChange={(v) => setSetting("refreshInterval", v)}
          />
        </SettingRow>

      </Section>

      {/* ── Notifications ────────────────────────────────────────────────────── */}
      <Section title="Notifications" description="Control in-app alert behaviour.">

        <SettingRow
          label="Enable Notifications"
          description="Show alerts when packages are flagged as damaged or when queue overflow is predicted."
        >
          <Toggle
            checked={settings.notifications}
            onChange={(v) => setSetting("notifications", v)}
          />
        </SettingRow>

      </Section>

      {/* ── About ────────────────────────────────────────────────────────────── */}
      <Section title="About" description="System and version information.">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <AboutTile icon={Cpu}      label="AI Engine"  value="TensorFlow.js"  sub="MobileNet v2" />
          <AboutTile icon={Link}     label="Blockchain" value="Ganache"         sub="Chain ID 1337" />
          <AboutTile icon={Database} label="Database"   value="Appwrite"        sub="Collections ×3" />
        </div>
        <Separator />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>LogiGuard <span className="font-medium text-foreground">v2.0</span></span>
          <span>CSEL 303 · LSPU · 2026</span>
        </div>
      </Section>

      {/* ── Danger Zone ──────────────────────────────────────────────────────── */}
      <Section title="Reset" description="Restore all settings to their factory defaults.">
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            This resets theme, scanner defaults, and dashboard preferences. Your account data is not affected.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 gap-2 text-destructive border-destructive/30 hover:bg-destructive/8 hover:text-destructive"
            onClick={resetSettings}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset to Defaults
          </Button>
        </div>
      </Section>

    </div>
  )
}

// ─── Section ───────────────────────────────────────────────────────────────────
function Section({
  title, description, children,
}: {
  title:       string
  description: string
  children:    React.ReactNode
}) {
  return (
    <div className="bg-card border border-border">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-muted/30">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      {/* Content */}
      <div className="px-4 py-3 flex flex-col gap-3">
        {children}
      </div>
    </div>
  )
}

// ─── Setting Row ───────────────────────────────────────────────────────────────
function SettingRow({
  label, description, children,
}: {
  label:       string
  description: string
  children:    React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-6 min-h-[36px]">
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-xs font-medium text-foreground">{label}</span>
        <span className="text-xs text-muted-foreground leading-snug">{description}</span>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

// ─── Theme Toggle ──────────────────────────────────────────────────────────────
const THEME_OPTIONS: { value: Theme; icon: React.ElementType; label: string }[] = [
  { value: "light",  icon: Sun,     label: "Light"  },
  { value: "dark",   icon: Moon,    label: "Dark"   },
  { value: "system", icon: Monitor, label: "System" },
]

function ThemeToggle({ value, onChange }: { value: Theme; onChange: (v: Theme) => void }) {
  return (
    <div className="flex border border-border">
      {THEME_OPTIONS.map(({ value: v, icon: Icon, label }) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          title={label}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors duration-75 cursor-pointer",
            "border-r border-border last:border-r-0",
            value === v
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-foreground",
          )}
        >
          <Icon className="w-3 h-3" />
          {label}
        </button>
      ))}
    </div>
  )
}

// ─── Segmented Control ─────────────────────────────────────────────────────────
function SegmentedControl<T extends string | number>({
  options, value, onChange,
}: {
  options:  { label: string; value: T }[]
  value:    T
  onChange: (v: T) => void
}) {
  return (
    <div className="flex border border-border">
      {options.map((opt) => (
        <button
          key={String(opt.value)}
          onClick={() => onChange(opt.value)}
          className={cn(
            "px-3 py-1.5 text-xs font-medium transition-colors duration-75 cursor-pointer",
            "border-r border-border last:border-r-0",
            value === opt.value
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-foreground",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

// ─── Toggle Switch ─────────────────────────────────────────────────────────────
function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center",
        "border transition-colors duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        checked ? "bg-primary border-primary" : "bg-muted border-border",
      )}
    >
      <span
        className={cn(
          "pointer-events-none absolute h-3 w-3 bg-primary-foreground transition-transform duration-150",
          checked ? "translate-x-[18px]" : "translate-x-[3px]",
        )}
      />
    </button>
  )
}

// ─── About Tile ────────────────────────────────────────────────────────────────
function AboutTile({ icon: Icon, label, value, sub }: {
  icon: React.ElementType; label: string; value: string; sub: string
}) {
  return (
    <div className="flex items-start gap-2.5 border border-border p-3 bg-muted/20">
      <div className="w-6 h-6 border border-border flex items-center justify-center shrink-0 bg-muted">
        <Icon className="w-3 h-3 text-muted-foreground" strokeWidth={1.5} />
      </div>
      <div className="min-w-0">
        <p className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-xs font-semibold text-foreground mt-0.5">{value}</p>
        <p className="text-2xs text-muted-foreground mt-0.5">{sub}</p>
      </div>
    </div>
  )
}

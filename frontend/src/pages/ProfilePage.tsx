import { useState, useEffect } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Eye, EyeOff, Save, LogOut, User, Mail, Shield, Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { account } from "@/lib/appwrite"
import { useAuth } from "@/contexts/AuthContext"
import { cn } from "@/lib/utils"

interface UserPrefs {
  username?: string
  bio?:      string
}

type Tab = "profile" | "password"

// ─── Profile Page ──────────────────────────────────────────────────────────────
export function ProfilePage() {
  const { user, logout } = useAuth()
  const navigate         = useNavigate()

  const [activeTab, setActiveTab] = useState<Tab>("profile")

  // ── Profile details state ──────────────────────────────────────────────────
  const [joinedDate,     setJoinedDate]     = useState("")
  const [username,       setUsername]       = useState("")
  const [bio,            setBio]            = useState("")
  const [profileLoading, setProfileLoading] = useState(true)
  const [profileSaving,  setProfileSaving]  = useState(false)
  const [profileSuccess, setProfileSuccess] = useState(false)
  const [profileError,   setProfileError]   = useState("")

  // ── Password change state ──────────────────────────────────────────────────
  const [oldPassword,     setOldPassword]     = useState("")
  const [newPassword,     setNewPassword]     = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showOld,         setShowOld]         = useState(false)
  const [showNew,         setShowNew]         = useState(false)
  const [pwdSaving,       setPwdSaving]       = useState(false)
  const [pwdSuccess,      setPwdSuccess]      = useState(false)
  const [pwdError,        setPwdError]        = useState("")

  // ── Fetch prefs + registration date ───────────────────────────────────────
  useEffect(() => {
    account.get()
      .then((raw) => {
        const prefs = (raw.prefs as UserPrefs) ?? {}
        setUsername(prefs.username ?? "")
        setBio(prefs.bio ?? "")
        const date = new Date(raw.registration)
        setJoinedDate(
          date.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
        )
      })
      .finally(() => setProfileLoading(false))
  }, [])

  // ── Save profile ───────────────────────────────────────────────────────────
  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault()
    setProfileError("")
    setProfileSuccess(false)
    setProfileSaving(true)
    try {
      await account.updatePrefs({ username: username.trim(), bio: bio.trim() })
      setProfileSuccess(true)
    } catch (err: unknown) {
      setProfileError(err instanceof Error ? err.message : "Failed to save profile.")
    } finally {
      setProfileSaving(false)
    }
  }

  // ── Change password ────────────────────────────────────────────────────────
  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    setPwdError("")
    setPwdSuccess(false)
    if (newPassword.length < 8) { setPwdError("New password must be at least 8 characters."); return }
    if (newPassword !== confirmPassword) { setPwdError("Passwords do not match."); return }
    setPwdSaving(true)
    try {
      await account.updatePassword({ password: newPassword, oldPassword })
      setPwdSuccess(true)
      setOldPassword(""); setNewPassword(""); setConfirmPassword("")
    } catch (err: unknown) {
      setPwdError(err instanceof Error ? err.message : "Failed to update password.")
    } finally {
      setPwdSaving(false)
    }
  }

  async function handleLogout() {
    await logout()
    navigate("/auth/login", { replace: true })
  }

  const roleBadge = {
    admin:    "bg-primary text-primary-foreground",
    operator: "bg-warning/15 text-warning border border-warning/30",
    viewer:   "bg-muted text-muted-foreground border border-border",
  }[user?.role ?? "viewer"]

  return (
    // mx-auto centers the card block horizontally inside page-content
    <div className="mx-auto w-full max-w-3xl">
      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-5">

        {/* ── Identity Card ───────────────────────────────────────────────── */}
        <div className="flex flex-col bg-card border border-border">

          {/* Avatar + name */}
          <div className="flex flex-col items-center gap-3 p-6 border-b border-border">
            <div className="w-16 h-16 bg-primary flex items-center justify-center">
              <span className="text-xl font-bold text-primary-foreground tracking-tight">
                {user?.initials ?? "?"}
              </span>
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-foreground leading-snug">
                {user?.name ?? "—"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 break-all">
                {user?.email ?? "—"}
              </p>
            </div>
          </div>

          {/* Meta rows */}
          <div className="flex flex-col gap-3 p-5 flex-1">
            <MetaRow icon={Shield} label="Role">
              <span className={cn("text-2xs font-semibold px-1.5 py-0.5 capitalize", roleBadge)}>
                {user?.role ?? "—"}
              </span>
            </MetaRow>

            <MetaRow icon={Calendar} label="Joined">
              <span className="text-xs text-foreground">
                {profileLoading ? "—" : joinedDate}
              </span>
            </MetaRow>

            <MetaRow icon={Mail} label="Email">
              <span className="text-xs text-foreground truncate max-w-[120px]" title={user?.email}>
                {user?.email ?? "—"}
              </span>
            </MetaRow>

            <MetaRow icon={User} label="Username">
              {profileLoading ? (
                <span className="text-xs text-muted-foreground">—</span>
              ) : username ? (
                <span className="text-xs text-foreground">@{username}</span>
              ) : (
                <span className="text-xs text-muted-foreground italic">Not set</span>
              )}
            </MetaRow>
          </div>

          {/* Sign out */}
          <div className="p-5 border-t border-border">
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2 text-destructive border-destructive/30 hover:bg-destructive/8 hover:text-destructive"
              onClick={handleLogout}
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </Button>
          </div>
        </div>

        {/* ── Tabbed Edit Panel ────────────────────────────────────────────── */}
        <div className="flex flex-col bg-card border border-border">

          {/* Tab bar */}
          <div className="flex border-b border-border">
            {(["profile", "password"] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "px-5 py-3 text-xs font-medium transition-colors duration-75 cursor-pointer border-b-2 -mb-px",
                  activeTab === tab
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {tab === "profile" ? "Profile Details" : "Change Password"}
              </button>
            ))}
          </div>

          {/* ── Tab: Profile Details ─────────────────────────────────────── */}
          {activeTab === "profile" && (
            <form onSubmit={handleSaveProfile} className="p-5 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  placeholder="e.g. fnmistica"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={profileSaving}
                  maxLength={32}
                />
                <p className="text-2xs text-muted-foreground">
                  Alphanumeric and underscores only. Max 32 characters.
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="bio">Bio</Label>
                <textarea
                  id="bio"
                  placeholder="A short description about yourself…"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  disabled={profileSaving}
                  maxLength={200}
                  rows={3}
                  className="w-full resize-none border border-input bg-background px-3 py-2
                             text-xs text-foreground placeholder:text-muted-foreground
                             focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring
                             disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <p className="text-2xs text-muted-foreground text-right tabular-nums">
                  {bio.length} / 200
                </p>
              </div>

              {profileError && (
                <p className="text-xs text-destructive border border-destructive/30 bg-destructive/8 px-3 py-2">
                  {profileError}
                </p>
              )}
              {profileSuccess && (
                <p className="text-xs text-success border border-success/30 bg-success/8 px-3 py-2">
                  Profile saved successfully.
                </p>
              )}

              <div className="flex justify-end">
                <Button type="submit" size="sm" className="gap-2" disabled={profileSaving}>
                  {profileSaving ? (
                    <>
                      <span className="w-3 h-3 border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin inline-block" />
                      Saving…
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </form>
          )}

          {/* ── Tab: Change Password ─────────────────────────────────────── */}
          {activeTab === "password" && (
            <form onSubmit={handleChangePassword} className="p-5 flex flex-col gap-4">
              <PasswordField
                id="old-password"
                label="Current Password"
                value={oldPassword}
                onChange={setOldPassword}
                show={showOld}
                onToggle={() => setShowOld((v) => !v)}
                disabled={pwdSaving}
                placeholder="Your current password"
                autoComplete="current-password"
              />

              <PasswordField
                id="new-password"
                label="New Password"
                value={newPassword}
                onChange={setNewPassword}
                show={showNew}
                onToggle={() => setShowNew((v) => !v)}
                disabled={pwdSaving}
                placeholder="Min. 8 characters"
                autoComplete="new-password"
              />

              <PasswordField
                id="confirm-password"
                label="Confirm New Password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                show={showNew}
                onToggle={() => setShowNew((v) => !v)}
                disabled={pwdSaving}
                placeholder="Repeat new password"
                autoComplete="new-password"
              />

              {pwdError && (
                <p className="text-xs text-destructive border border-destructive/30 bg-destructive/8 px-3 py-2">
                  {pwdError}
                </p>
              )}
              {pwdSuccess && (
                <p className="text-xs text-success border border-success/30 bg-success/8 px-3 py-2">
                  Password updated successfully.
                </p>
              )}

              <div className="flex items-center justify-between gap-4 flex-wrap">
                <p className="text-xs text-muted-foreground">
                  Forgot your current password?{" "}
                  <Link
                    to="/auth/forgot-password"
                    className="underline underline-offset-2 hover:text-foreground transition-colors"
                  >
                    Reset it here
                  </Link>
                </p>
                <Button type="submit" size="sm" disabled={pwdSaving}>
                  {pwdSaving ? (
                    <>
                      <span className="w-3 h-3 border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin inline-block mr-2" />
                      Updating…
                    </>
                  ) : (
                    "Update Password"
                  )}
                </Button>
              </div>
            </form>
          )}
        </div>

      </div>
    </div>
  )
}

// ─── MetaRow ───────────────────────────────────────────────────────────────────
function MetaRow({
  icon: Icon, label, children,
}: {
  icon: React.ElementType; label: string; children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-2 min-w-0">
      <div className="flex items-center gap-1.5 shrink-0">
        <Icon className="w-3 h-3 text-muted-foreground" strokeWidth={1.75} />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      {children}
    </div>
  )
}

// ─── PasswordField ─────────────────────────────────────────────────────────────
function PasswordField({
  id, label, value, onChange, show, onToggle, disabled, placeholder, autoComplete,
}: {
  id: string; label: string; value: string; onChange: (v: string) => void
  show: boolean; onToggle: () => void; disabled: boolean
  placeholder: string; autoComplete: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={show ? "text" : "password"}
          placeholder={placeholder}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="pr-9"
        />
        <button
          type="button"
          onClick={onToggle}
          tabIndex={-1}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
        >
          {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  )
}

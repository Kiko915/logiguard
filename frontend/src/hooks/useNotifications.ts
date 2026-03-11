import { useCallback, useEffect, useState } from "react"
import { Query } from "appwrite"
import { databases, DATABASE_ID } from "@/lib/appwrite"

// ─── Types ─────────────────────────────────────────────────────────────────────

export type NotificationType = "info" | "warning" | "error" | "success"

export interface AppNotification {
  $id:        string
  $createdAt: string
  user_id:    string
  title:      string
  message:    string
  type:       NotificationType
  read:       boolean
  link?:      string
}

const COLLECTION_ID = "notifications"
const POLL_INTERVAL = 60_000  // 1 min

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useNotifications(userId: string | undefined) {
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [loading, setLoading]             = useState(true)

  const refresh = useCallback(async () => {
    if (!userId) return
    try {
      const res = await databases.listDocuments(DATABASE_ID, COLLECTION_ID, [
        Query.equal("user_id", userId),
        Query.orderDesc("$createdAt"),
        Query.limit(20),
      ])
      setNotifications(res.documents as unknown as AppNotification[])
    } catch {
      // Silently ignore — collection may not exist yet in dev
    } finally {
      setLoading(false)
    }
  }, [userId])

  // Fetch on mount, then poll
  useEffect(() => {
    refresh()
    const id = setInterval(refresh, POLL_INTERVAL)
    return () => clearInterval(id)
  }, [refresh])

  const markAsRead = useCallback(async (id: string) => {
    try {
      await databases.updateDocument(DATABASE_ID, COLLECTION_ID, id, { read: true })
      setNotifications((prev) =>
        prev.map((n) => (n.$id === id ? { ...n, read: true } : n)),
      )
    } catch { /* ignore */ }
  }, [])

  const markAllAsRead = useCallback(async () => {
    const unread = notifications.filter((n) => !n.read)
    if (!unread.length) return
    await Promise.all(
      unread.map((n) =>
        databases.updateDocument(DATABASE_ID, COLLECTION_ID, n.$id, { read: true }).catch(() => {}),
      ),
    )
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }, [notifications])

  const unreadCount = notifications.filter((n) => !n.read).length

  return { notifications, loading, unreadCount, markAsRead, markAllAsRead, refresh }
}

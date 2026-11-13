// Mobile-only API shapes. Hand-written (not synced): these endpoints exist only
// for the app — see BACKEND_HANDOFF.md ("Devices", "App").
import type { ComplaintCategory, NotificationCategory, Priority } from './domain';

/** GET /app/config — public, read before sign-in. */
export interface AppConfig {
  minVersion: string;
  latestVersion: string;
  pushEnabled: boolean;
  onlinePayments: boolean;
}

/** POST /devices */
export interface DeviceRegistration { pushToken: string; platform: 'ios' | 'android'; appVersion?: string }
export interface DeviceView { id: string; platform: 'ios' | 'android'; appVersion: string; registeredAt: string; lastSeenAt: string }

/** `data` on every push the API sends. `link` is the web path of the in-app notification. */
export interface PushData { notificationId: string; category: NotificationCategory; link: string | null }

/** A file picked on the phone, before upload. Replaces the web contract's `File`. */
export interface LocalFile { uri: string; name: string; mimeType: string; size: number }

/** ComplaintInput with phone files instead of browser `File`s. */
export interface MobileComplaintInput {
  category: ComplaintCategory;
  title: string;
  description: string;
  priority: Priority;
  attachments: LocalFile[];
}

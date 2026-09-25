import { api } from "./api";

export const pushSupported = () =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

const toBytes = (b64url: string) => {
  const b64 = (b64url + "=".repeat((4 - (b64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
};

async function registration() {
  return (await navigator.serviceWorker.getRegistration()) ?? navigator.serviceWorker.register("/sw.js");
}

export async function currentSubscription() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return (await reg?.pushManager.getSubscription()) ?? null;
}

export type EnableResult = "on" | "denied" | "unavailable";

export async function enablePush(): Promise<EnableResult> {
  const { available, publicKey } = await api<{ available: boolean; publicKey: string | null }>("/push/key");
  if (!available || !publicKey) return "unavailable";
  if ((await Notification.requestPermission()) !== "granted") return "denied";
  const reg = await registration();
  await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toBytes(publicKey) }));
  const json = sub.toJSON();
  await api("/push/subscriptions", { method: "POST", json: { endpoint: json.endpoint, keys: json.keys } });
  return "on";
}

/** Also runs on logout, so the next person on this device doesn't get the last one's check-ins. */
export async function disablePush() {
  const sub = await currentSubscription();
  if (!sub) return;
  await api("/push/unsubscribe", { method: "POST", json: { endpoint: sub.endpoint } }).catch(() => {});
  await sub.unsubscribe();
}

export const sendTestPush = () => api<{ sent: number }>("/push/test", { method: "POST" });

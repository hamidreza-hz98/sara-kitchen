"use client";

const EVENT = "sara-media-uploaded";
const KEY = "sara-media-uploaded-at";

/** Inform open media libraries in this tab and other tabs of a completed upload. */
export function notifyMediaUploaded() {
  window.dispatchEvent(new Event(EVENT));
  try {
    window.localStorage.setItem(KEY, `${Date.now()}-${Math.random()}`);
  } catch {
    // The current tab still receives the event when browser storage is unavailable.
  }
}

export function subscribeMediaUploads(callback: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY) callback();
  };
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", onStorage);
  };
}

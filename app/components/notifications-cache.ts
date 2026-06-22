"use client";

import { mutate } from "swr";

export const notificationsSWRConfig = {
  refreshInterval: 10_000,
  revalidateOnFocus: true,
  revalidateOnReconnect: true,
  refreshWhenHidden: false,
  refreshWhenOffline: false,
  dedupingInterval: 2_000,
};

export function revalidateNotifications() {
  return mutate((key) => typeof key === "string" && key.startsWith("/api/notifications"));
}

/// <reference path="./vendor.d.ts" />
import Constants from "expo-constants";
import { addDebugInternal, type AddDebugOptions } from "./internal";

export type { AddDebugOptions };

/** addDebug com descoberta automática do IP do dev server (Expo Go + dev builds). */
export function addDebug(options: AddDebugOptions = {}) {
  const c = Constants as any;
  const hostUri: string | undefined =
    c.expoConfig?.hostUri ??          // SDK 49+, presente em dev
    c.expoGoConfig?.debuggerHost ??   // Expo Go
    c.manifest?.debuggerHost ??      // legado
    c.manifest2?.extra?.expoClient?.hostUri;
  const devHost = hostUri ? String(hostUri).split(":")[0] : undefined;
  addDebugInternal(options, {
    devHost,
    deviceInfo: { deviceName: (Constants as any).deviceName },
    appName: c.expoConfig?.name ?? (Constants as any).manifest?.name,
  });
}

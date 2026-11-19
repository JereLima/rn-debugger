/// <reference path="./vendor.d.ts" />
import Constants from "expo-constants";
import { addDebugInternal, sendRaw, type AddDebugOptions } from "./internal";
import { debugAsyncStorageInternal, debugMMKVInternal, debugFirestoreInternal } from "./internal";
import { debugState as ds, debugRedux as dr, debugZustand as dz } from "./state";

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

export const debugState = (name: string, getState: () => unknown, subscribe?: (cb: () => void) => () => void, options?: any) => ds(sendRaw, name, getState, subscribe, options);
export const debugRedux = (store: any, name?: string) => dr(sendRaw, store, name);
export const debugZustand = (store: any, name?: string) => dz(sendRaw, store, name);
export function debugAsyncStorage(AsyncStorage: unknown) { debugAsyncStorageInternal(AsyncStorage); }
export function debugMMKV(instance: unknown, name?: string) { debugMMKVInternal(instance, name); }
export function debugFirestore(api: unknown, db: unknown, options?: { log?: boolean }) { debugFirestoreInternal(api, db, options); }

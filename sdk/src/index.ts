import { addDebugInternal, sendRaw, type AddDebugOptions } from "./internal";
import { debugAsyncStorageInternal, debugMMKVInternal } from "./internal";
import { debugState as ds, debugRedux as dr, debugZustand as dz } from "./state";

export type { AddDebugOptions };

export function addDebug(options: AddDebugOptions = {}) { addDebugInternal(options); }

export const debugState = (name: string, getState: () => unknown, subscribe?: (cb: () => void) => () => void, options?: any) => ds(sendRaw, name, getState, subscribe, options);
export const debugRedux = (store: any, name?: string) => dr(sendRaw, store, name);
export const debugZustand = (store: any, name?: string) => dz(sendRaw, store, name);
export function debugAsyncStorage(AsyncStorage: unknown) { debugAsyncStorageInternal(AsyncStorage); }
export function debugMMKV(instance: unknown, name = "mmkv") { debugMMKVInternal(instance, name); }

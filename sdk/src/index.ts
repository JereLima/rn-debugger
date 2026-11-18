import { addDebugInternal, type AddDebugOptions } from "./internal";

export type { AddDebugOptions };

export function addDebug(options: AddDebugOptions = {}) { addDebugInternal(options); }

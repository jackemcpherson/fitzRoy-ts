/**
 * The one managed runtime for a CLI process.
 *
 * Every command runs its program here, so the source services (and the AFL
 * API token cache) are built once per invocation.
 */

import { type Layer, ManagedRuntime } from "effect";
import { FitzroyLive } from "../layers";

/** The services every command program may require. */
export type CliServices = Layer.Success<typeof FitzroyLive>;

/** The process-wide runtime that provides {@link FitzroyLive}. */
export const cliRuntime = ManagedRuntime.make(FitzroyLive);

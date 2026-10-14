/** Preload for the CLI golden test: serve every request from fixtures. */
import { goldenFetch } from "./fixture-fetch";

globalThis.fetch = goldenFetch as typeof fetch;

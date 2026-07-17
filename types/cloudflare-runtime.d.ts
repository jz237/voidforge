/** Minimal runtime binding types supplied by the Sites deployment environment. */
interface Fetcher {
  fetch(input: Request): Promise<Response>;
}

// D1 is not used by VOIDFORGE, but the reusable Sites starter keeps its helper compiled.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type D1Database = any;

declare module "cloudflare:workers" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const env: Record<string, any>;
}

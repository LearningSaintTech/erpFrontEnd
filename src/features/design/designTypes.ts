/** Fields the design list endpoint returns that the shared API types do not carry yet. */
export {};

declare module '../../types/api' {
  interface Design {
    /** Small preview image (front image or sketch) — list endpoint only. */
    thumbnailUrl?: string;
  }
}

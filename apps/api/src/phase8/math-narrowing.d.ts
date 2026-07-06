export {};

declare global {
  interface Math {
    abs(value: number | null): number;
  }
}

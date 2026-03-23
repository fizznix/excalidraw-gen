/**
 * FNV-1a 32-bit hash — deterministic, fast, good distribution for short strings.
 * Returns a positive integer usable as Excalidraw element seed.
 */
export function hashId(input: string): number {
  let hash = 2166136261; // FNV offset basis
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    // 32-bit FNV prime multiply, keeping within 32-bit unsigned range
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  // Ensure positive non-zero
  return (hash >>> 0) || 1;
}

/**
 * Sleep function - promise-based wrapper over setTimeout
 */
export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Stringify function - JSON.stringify with optional indentation
 */
export function stry(obj: any, indent?: number): string {
  return JSON.stringify(obj, null, indent);
}

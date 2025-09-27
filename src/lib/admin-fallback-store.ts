const adminStore = new Map<string, Record<string, unknown>>();

const maybeStructuredClone =
  (globalThis as typeof globalThis & { structuredClone?: <T>(value: T) => T }).structuredClone;

function cloneValue<T>(value: T): T {
  if (typeof maybeStructuredClone === "function") {
    return maybeStructuredClone(value);
  }

  return JSON.parse(JSON.stringify(value)) as T;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const output: Record<string, unknown> = { ...target };

  for (const [key, value] of Object.entries(source)) {
    const existing = output[key];

    if (isPlainObject(existing) && isPlainObject(value)) {
      output[key] = deepMerge(existing, value);
      continue;
    }

    output[key] = cloneValue(value);
  }

  return output;
}

export function getFallbackAdminProfile(discordId: string): Record<string, unknown> | null {
  const stored = adminStore.get(discordId);
  if (!stored) {
    return null;
  }

  return cloneValue(stored);
}

export function setFallbackAdminProfile(
  discordId: string,
  data: Record<string, unknown>,
  { merge = false }: { merge?: boolean } = {},
): void {
  if (!discordId) {
    return;
  }

  const normalized = cloneValue(data);
  if (merge) {
    const existing = adminStore.get(discordId) ?? {};
    adminStore.set(discordId, deepMerge(existing, normalized));
  } else {
    adminStore.set(discordId, normalized);
  }
}

export function clearFallbackAdminProfile(discordId: string): void {
  adminStore.delete(discordId);
}

import { createHash } from "node:crypto";
import { getSupabaseAdminClient, hasSupabaseServerConfig } from "@/lib/supabase";

type CacheRecord<T> = {
  key: string;
  value: T;
  expiresAt: string;
};

type CacheLookupResult<T> = {
  hit: boolean;
  source: "memory" | "supabase" | "none";
  value: T | null;
};

const memoryCache = new Map<string, CacheRecord<unknown>>();

function nowIso() {
  return new Date().toISOString();
}

function isExpired(expiresAt: string) {
  return new Date(expiresAt).getTime() <= Date.now();
}

export function createCacheKey(parts: unknown[]) {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}

export async function getCachedValue<T>(key: string): Promise<CacheLookupResult<T>> {
  const memoryRecord = memoryCache.get(key) as CacheRecord<T> | undefined;

  if (memoryRecord && !isExpired(memoryRecord.expiresAt)) {
    return {
      hit: true,
      source: "memory",
      value: memoryRecord.value,
    };
  }

  if (memoryRecord && isExpired(memoryRecord.expiresAt)) {
    memoryCache.delete(key);
  }

  if (!hasSupabaseServerConfig()) {
    return {
      hit: false,
      source: "none",
      value: null,
    };
  }

  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return {
      hit: false,
      source: "none",
      value: null,
    };
  }

  const { data, error } = await supabase
    .from("api_cache")
    .select("cache_key, payload, expires_at")
    .eq("cache_key", key)
    .maybeSingle();

  if (error || !data) {
    return {
      hit: false,
      source: "none",
      value: null,
    };
  }

  if (isExpired(data.expires_at)) {
    return {
      hit: false,
      source: "none",
      value: null,
    };
  }

  return {
    hit: true,
    source: "supabase",
    value: data.payload as T,
  };
}

export async function setCachedValue<T>(key: string, value: T, ttlSeconds: number) {
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
  memoryCache.set(key, {
    key,
    value,
    expiresAt,
  });

  if (!hasSupabaseServerConfig()) {
    return;
  }

  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return;
  }

  await supabase.from("api_cache").upsert(
    {
      cache_key: key,
      payload: value,
      expires_at: expiresAt,
      updated_at: nowIso(),
    },
    { onConflict: "cache_key" }
  );
}

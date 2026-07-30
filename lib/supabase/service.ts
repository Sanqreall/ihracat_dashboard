import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types';

/**
 * Service-role Supabase istemcisi — RLS'i AŞAR. Yalnızca sunucu tarafında,
 * kullanıcı oturumu olmayan güvenilir işlemler için kullanılır (ör. Shopify
 * webhook'u). ASLA tarayıcıya/istemciye sızmamalı.
 *
 * SUPABASE_SERVICE_ROLE_KEY ortam değişkeni gerektirir (Vercel env).
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('Supabase service-role yapılandırması eksik (SUPABASE_SERVICE_ROLE_KEY).');
  }
  return createSupabaseClient<Database>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

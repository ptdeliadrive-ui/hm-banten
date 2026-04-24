import { supabase } from "@/integrations/supabase/client";

export async function invokeManageUsers<TResponse = unknown>(body: Record<string, unknown>) {
  const {
    data: { session: initialSession },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    return {
      data: null,
      error: new Error(sessionError.message),
    };
  }

  if (!initialSession?.access_token) {
    return {
      data: null,
      error: new Error("Sesi login tidak ditemukan. Silakan login ulang."),
    };
  }

  let session = initialSession;
  const expiresAtMs = session.expires_at ? session.expires_at * 1000 : 0;
  const shouldRefresh = !expiresAtMs || expiresAtMs <= Date.now() + 60_000;

  if (shouldRefresh) {
    const { data, error } = await supabase.auth.refreshSession();

    if (error) {
      return {
        data: null,
        error: new Error(`Sesi login kedaluwarsa. Silakan login ulang. ${error.message}`),
      };
    }

    if (!data.session?.access_token) {
      return {
        data: null,
        error: new Error("Gagal memperbarui sesi login. Silakan login ulang."),
      };
    }

    session = data.session;
  }

  const result = await supabase.functions.invoke<TResponse>("manage-users", {
    body,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  return result;
}
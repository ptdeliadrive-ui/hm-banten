// @ts-nocheck

import { createClient } from "npm:@supabase/supabase-js@2";

type AppRole = "admin" | "bendahara" | "ketua";

type ManageUsersRequest =
  | {
      action: "listUsers";
      page?: number;
      perPage?: number;
    }
  | {
      action: "createUser";
      email: string;
      password: string;
      role: AppRole;
      emailConfirm?: boolean;
    }
  | {
      action: "setRole";
      userId: string;
      role: AppRole;
    }
  | {
      action: "resetPassword";
      userId: string;
      newPassword: string;
    }
  | {
      action: "setDisabled";
      userId: string;
      disabled: boolean;
    }
  | {
      action: "deleteUser";
      userId: string;
    }
  | {
      action: "listAuditLogs";
      page?: number;
      perPage?: number;
      query?: string;
      actorQuery?: string;
      targetQuery?: string;
      dateFrom?: string;
      dateTo?: string;
    };

const corsHeaderBase = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function getAllowedOrigins() {
  const configuredOrigins = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return new Set([
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8080",
    "http://127.0.0.1:8080",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://keuangan-hm.vercel.app",
    ...configuredOrigins,
  ]);
}

function isOriginAllowed(origin: string) {
  const allowedOrigins = getAllowedOrigins();
  if (allowedOrigins.has(origin)) {
    return true;
  }

  for (const candidate of allowedOrigins) {
    if (!candidate.includes("*")) continue;

    const escaped = candidate
      .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, ".*");

    if (new RegExp(`^${escaped}$`).test(origin)) {
      return true;
    }
  }

  return false;
}

function resolveCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin");
  if (!origin) {
    return corsHeaderBase;
  }

  if (!isOriginAllowed(origin)) {
    return null;
  }

  return {
    ...corsHeaderBase,
    "Access-Control-Allow-Origin": origin,
    Vary: "Origin",
  };
}

function jsonResponse(req: Request, status: number, body: unknown): Response {
  const corsHeaders = resolveCorsHeaders(req);
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...(corsHeaders ?? {}),
      "Content-Type": "application/json",
    },
  });
}

function isValidRole(role: unknown): role is AppRole {
  return role === "admin" || role === "bendahara" || role === "ketua";
}

async function findUserIdsByEmailQuery(
  adminClient: ReturnType<typeof createClient>,
  emailQuery?: string,
) {
  const normalizedQuery = emailQuery?.trim().toLowerCase();
  if (!normalizedQuery) return null;

  const matchedIds: string[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const matches = data.users
      .filter((user: { email?: string; id: string }) => user.email?.toLowerCase().includes(normalizedQuery))
      .map((user: { id: string }) => user.id);

    matchedIds.push(...matches);

    if (data.users.length < perPage) {
      break;
    }

    page += 1;
  }

  return matchedIds;
}

async function getUserEmailMap(
  adminClient: ReturnType<typeof createClient>,
  userIds: string[],
) {
  const emailEntries = await Promise.all(
    userIds.map(async (userId) => {
      const { data, error } = await adminClient.auth.admin.getUserById(userId);
      if (error || !data.user) {
        return [userId, null] as const;
      }

      return [userId, data.user.email ?? null] as const;
    }),
  );

  return Object.fromEntries(emailEntries);
}

async function writeAuditLog(
  adminClient: ReturnType<typeof createClient>,
  actorUserId: string,
  action: string,
  targetUserId: string | null,
  detail: Record<string, unknown> = {},
) {
  const { error } = await adminClient.from("admin_audit_logs").insert({
    actor_user_id: actorUserId,
    action,
    target_user_id: targetUserId,
    detail,
  });

  if (error) {
    console.error("Failed to write admin audit log", error);
  }
}

Deno.serve(async (req: Request) => {
  const corsHeaders = resolveCorsHeaders(req);

  if (req.method === "OPTIONS") {
    if (!corsHeaders) {
      return new Response("Forbidden origin", { status: 403, headers: corsHeaderBase });
    }

    return new Response("ok", { headers: corsHeaders });
  }

  if (!corsHeaders) {
    return new Response(JSON.stringify({ error: "Forbidden origin" }), {
      status: 403,
      headers: {
        ...corsHeaderBase,
        "Content-Type": "application/json",
      },
    });
  }

  if (req.method !== "POST") {
    return jsonResponse(req, 405, { error: "Method not allowed" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return jsonResponse(req, 500, { error: "Missing Supabase environment variables" });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse(req, 401, { error: "Missing bearer token" });
  }

  const requesterClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user: requester },
    error: requesterError,
  } = await requesterClient.auth.getUser();

  if (requesterError || !requester) {
    return jsonResponse(req, 401, { error: "Unauthorized" });
  }

  const requesterRole = String(requester.app_metadata?.role ?? "").toLowerCase();
  if (requesterRole !== "admin") {
    return jsonResponse(req, 403, { error: "Forbidden: admin role required" });
  }

  let payload: ManageUsersRequest;
  try {
    payload = (await req.json()) as ManageUsersRequest;
  } catch {
    return jsonResponse(req, 400, { error: "Invalid JSON payload" });
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);

  if (payload.action === "listUsers") {
    const page = payload.page && payload.page > 0 ? payload.page : 1;
    const perPage = payload.perPage && payload.perPage > 0 ? payload.perPage : 100;

    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
    if (error) return jsonResponse(req, 400, { error: error.message });

    const hasMore = data.users.length >= perPage;

    return jsonResponse(req, 200, {
      page,
      perPage,
      hasMore,
      users: data.users.map((u: {
        id: string;
        email?: string;
        app_metadata?: { role?: string };
        created_at?: string;
        last_sign_in_at?: string | null;
        banned_until?: string | null;
      }) => ({
        id: u.id,
        email: u.email,
        role: u.app_metadata?.role ?? null,
        createdAt: u.created_at,
        lastSignInAt: u.last_sign_in_at,
        bannedUntil: u.banned_until,
      })),
    });
  }

  if (payload.action === "listAuditLogs") {
    const page = payload.page && payload.page > 0 ? payload.page : 1;
    const perPage = payload.perPage && payload.perPage > 0 ? payload.perPage : 50;
    const from = (page - 1) * perPage;
    const to = from + perPage - 1;
    const searchQuery = payload.query?.trim();
    const actorIds = await findUserIdsByEmailQuery(adminClient, payload.actorQuery);
    const targetIds = await findUserIdsByEmailQuery(adminClient, payload.targetQuery);

    if (actorIds && actorIds.length === 0) {
      return jsonResponse(req, 200, {
        page,
        perPage,
        total: 0,
        hasMore: false,
        logs: [],
      });
    }

    if (targetIds && targetIds.length === 0) {
      return jsonResponse(req, 200, {
        page,
        perPage,
        total: 0,
        hasMore: false,
        logs: [],
      });
    }

    let queryBuilder = adminClient
      .from("admin_audit_logs")
      .select("id, actor_user_id, action, target_user_id, detail, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (searchQuery) {
      queryBuilder = queryBuilder.ilike("action", `%${searchQuery}%`);
    }

    if (payload.dateFrom) {
      queryBuilder = queryBuilder.gte("created_at", `${payload.dateFrom}T00:00:00.000Z`);
    }

    if (payload.dateTo) {
      queryBuilder = queryBuilder.lte("created_at", `${payload.dateTo}T23:59:59.999Z`);
    }

    if (actorIds) {
      queryBuilder = queryBuilder.in("actor_user_id", actorIds);
    }

    if (targetIds) {
      queryBuilder = queryBuilder.in("target_user_id", targetIds);
    }

    const { data, error, count } = await queryBuilder;
    if (error) return jsonResponse(req, 400, { error: error.message });

    const total = count || 0;
    const hasMore = page * perPage < total;
    const relatedUserIds = Array.from(
      new Set(
        (data || [])
          .flatMap((log: { actor_user_id?: string; target_user_id?: string | null }) => [log.actor_user_id, log.target_user_id])
          .filter(Boolean),
      ),
    ) as string[];
    const emailMap = await getUserEmailMap(adminClient, relatedUserIds);

    return jsonResponse(req, 200, {
      page,
      perPage,
      total,
      hasMore,
      logs: (data || []).map((log: { actor_user_id: string; target_user_id: string | null }) => ({
        ...log,
        actor_email: emailMap[log.actor_user_id] ?? null,
        target_email: log.target_user_id ? emailMap[log.target_user_id] ?? null : null,
      })),
    });
  }

  if (payload.action === "createUser") {
    if (!payload.email || !payload.password || !isValidRole(payload.role)) {
      return jsonResponse(req, 400, { error: "email, password, and valid role are required" });
    }

    const { data, error } = await adminClient.auth.admin.createUser({
      email: payload.email,
      password: payload.password,
      email_confirm: payload.emailConfirm ?? true,
      app_metadata: { role: payload.role },
    });

    if (error) return jsonResponse(req, 400, { error: error.message });

    await writeAuditLog(adminClient, requester.id, "createUser", data.user.id, {
      email: data.user.email,
      role: payload.role,
    });

    return jsonResponse(req, 201, {
      user: {
        id: data.user.id,
        email: data.user.email,
        role: data.user.app_metadata?.role ?? null,
      },
    });
  }

  if (payload.action === "setRole") {
    if (!payload.userId || !isValidRole(payload.role)) {
      return jsonResponse(req, 400, { error: "userId and valid role are required" });
    }

    if (payload.userId === requester.id) {
      return jsonResponse(req, 400, { error: "Admin tidak bisa mengubah role akunnya sendiri" });
    }

    const { data: existingUser, error: getError } = await adminClient.auth.admin.getUserById(payload.userId);
    if (getError) return jsonResponse(req, 400, { error: getError.message });

    const currentMetadata = existingUser.user.app_metadata ?? {};

    const { data, error } = await adminClient.auth.admin.updateUserById(payload.userId, {
      app_metadata: {
        ...currentMetadata,
        role: payload.role,
      },
    });

    if (error) return jsonResponse(req, 400, { error: error.message });

    await writeAuditLog(adminClient, requester.id, "setRole", data.user.id, {
      role: payload.role,
    });

    return jsonResponse(req, 200, {
      user: {
        id: data.user.id,
        email: data.user.email,
        role: data.user.app_metadata?.role ?? null,
      },
    });
  }

  if (payload.action === "resetPassword") {
    if (!payload.userId || !payload.newPassword || payload.newPassword.length < 8) {
      return jsonResponse(req, 400, { error: "userId and newPassword (min 8 chars) are required" });
    }

    const { data, error } = await adminClient.auth.admin.updateUserById(payload.userId, {
      password: payload.newPassword,
    });

    if (error) return jsonResponse(req, 400, { error: error.message });

    await writeAuditLog(adminClient, requester.id, "resetPassword", data.user.id, {});

    return jsonResponse(req, 200, {
      user: {
        id: data.user.id,
        email: data.user.email,
      },
    });
  }

  if (payload.action === "setDisabled") {
    if (!payload.userId) {
      return jsonResponse(req, 400, { error: "userId is required" });
    }

    if (payload.userId === requester.id) {
      return jsonResponse(req, 400, { error: "Admin tidak bisa menonaktifkan akunnya sendiri" });
    }

    const { data, error } = await adminClient.auth.admin.updateUserById(payload.userId, {
      ban_duration: payload.disabled ? "876000h" : "none",
    });

    if (error) return jsonResponse(req, 400, { error: error.message });

    await writeAuditLog(adminClient, requester.id, "setDisabled", data.user.id, {
      disabled: payload.disabled,
    });

    return jsonResponse(req, 200, {
      user: {
        id: data.user.id,
        email: data.user.email,
      },
    });
  }

  if (payload.action === "deleteUser") {
    if (!payload.userId) {
      return jsonResponse(req, 400, { error: "userId is required" });
    }

    if (payload.userId === requester.id) {
      return jsonResponse(req, 400, { error: "Admin tidak bisa menghapus akunnya sendiri" });
    }

    const { error } = await adminClient.auth.admin.deleteUser(payload.userId);
    if (error) return jsonResponse(req, 400, { error: error.message });

    await writeAuditLog(adminClient, requester.id, "deleteUser", payload.userId, {});

    return jsonResponse(req, 200, { ok: true });
  }

  return jsonResponse(req, 400, { error: "Unsupported action" });
});

// @ts-nocheck

import { JWT } from "npm:google-auth-library@9";
import { createClient } from "npm:@supabase/supabase-js@2";

type UploadRequest = {
  fileName: string;
  mimeType: string;
  contentBase64: string;
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
  if (!origin) return corsHeaderBase;

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

function sanitizeFileName(fileName: string) {
  return fileName
    .replace(/[^a-zA-Z0-9-_ .]/g, "")
    .trim()
    .slice(0, 120);
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
  if (!supabaseUrl || !supabaseAnonKey) {
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

  let payload: UploadRequest;
  try {
    payload = (await req.json()) as UploadRequest;
  } catch {
    return jsonResponse(req, 400, { error: "Invalid JSON payload" });
  }

  const fileName = sanitizeFileName(payload.fileName || "");
  if (!fileName || !payload.mimeType || !payload.contentBase64) {
    return jsonResponse(req, 400, { error: "fileName, mimeType, and contentBase64 are required" });
  }

  const serviceAccountEmail = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_EMAIL");
  const serviceAccountPrivateKeyRaw = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY");
  const driveFolderId = Deno.env.get("GOOGLE_DRIVE_FOLDER_ID");

  if (!serviceAccountEmail || !serviceAccountPrivateKeyRaw || !driveFolderId) {
    return jsonResponse(req, 500, {
      error: "Missing Google Drive environment variables. Set GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY, and GOOGLE_DRIVE_FOLDER_ID",
    });
  }

  const serviceAccountPrivateKey = serviceAccountPrivateKeyRaw.replace(/\\n/g, "\n");

  const jwtClient = new JWT({
    email: serviceAccountEmail,
    key: serviceAccountPrivateKey,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });

  const accessTokenResponse = await jwtClient.getAccessToken();
  const accessToken = accessTokenResponse?.token;

  if (!accessToken) {
    return jsonResponse(req, 500, { error: "Failed to obtain Google access token" });
  }

  const boundary = `===============${Date.now()}==`;
  const metadata = {
    name: fileName,
    parents: [driveFolderId],
  };

  const multipartBody =
    `--${boundary}\r\n` +
    "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: ${payload.mimeType}\r\n` +
    "Content-Transfer-Encoding: base64\r\n\r\n" +
    `${payload.contentBase64}\r\n` +
    `--${boundary}--`;

  const uploadResponse = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink,webContentLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody,
    },
  );

  if (!uploadResponse.ok) {
    const detail = await uploadResponse.text();
    if (detail.includes("storageQuotaExceeded") || detail.includes("Service Accounts do not have storage quota")) {
      return jsonResponse(req, 500, {
        error: "Google Drive service account tidak bisa upload ke My Drive biasa. Gunakan Shared Drive, pindahkan folder tujuan ke Shared Drive, lalu share akses service account ke Shared Drive tersebut.",
      });
    }
    return jsonResponse(req, 500, { error: `Google Drive upload failed: ${detail}` });
  }

  const uploaded = await uploadResponse.json();

  const permissionResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${uploaded.id}/permissions?supportsAllDrives=true`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      role: "reader",
      type: "anyone",
    }),
  });

  if (!permissionResponse.ok) {
    const detail = await permissionResponse.text();
    return jsonResponse(req, 500, { error: `Failed to set file permission: ${detail}` });
  }

  return jsonResponse(req, 200, {
    fileId: uploaded.id,
    fileName: uploaded.name,
    webViewLink: uploaded.webViewLink,
    webContentLink: uploaded.webContentLink ?? null,
  });
});

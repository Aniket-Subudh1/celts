export type ApiResponse<T> = { ok: boolean; status: number | null; data?: T; error?: any };

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

if (typeof window !== "undefined") {
  console.log("API Base URL:", API_BASE);
}

function isFormData(body: any): body is FormData {
  return typeof FormData !== "undefined" && body instanceof FormData;
}

async function request(path: string, options: RequestInit = {}): Promise<ApiResponse<any>> {
  try {
    let headers: any = options.headers || {};

    const token = typeof window !== "undefined" ? localStorage.getItem("celts_token") : null;
    if (token) headers["Authorization"] = `Bearer ${token}`;

    // ⚠️ Only set Content-Type for JSON, not for FormData
    if (!isFormData(options.body)) {
      headers["Content-Type"] = headers["Content-Type"] || "application/json";
    }

    const res = await fetch(API_BASE + path, {
      ...options,
      headers,
      credentials: "include",
    });

    const text = await res.text();
    let payload = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = text;
    }

    if (!res.ok) {
      return { ok: false, status: res.status, error: payload || { message: "Request failed" } };
    }

    return { ok: true, status: res.status, data: payload };
  } catch (err: any) {
    return { ok: false, status: null, error: { message: err.message || "Network error" } };
  }
}

// ✅ FIXED: Detect FormData before JSON.stringify
export async function apiPost(path: string, body: any) {
  return request(path, {
    method: "POST",
    body: isFormData(body) ? body : JSON.stringify(body),
  });
}

export async function apiGet(path: string) {
  return request(path, { method: "GET" });
}

export async function apiPut(path: string, body: any) {
  return request(path, {
    method: "PUT",
    body: isFormData(body) ? body : JSON.stringify(body),
  });
}

export async function apiPatch(path: string, body: any) {
  return request(path, {
    method: "PATCH",
    body: isFormData(body) ? body : JSON.stringify(body),
  });
}

export async function apiDelete(path: string) {
  return request(path, { method: "DELETE" });
}

// Keep upload helper just in case you need it, but apiPost now supports FormData too
export async function apiUpload(path: string, form: FormData) {
  return request(path, { method: "POST", body: form });
}

export default { apiGet, apiPost, apiPut, apiDelete, apiUpload, apiPatch };

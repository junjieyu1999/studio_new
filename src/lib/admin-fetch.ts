// Browser helper for the snail-mail admin API.
//
// No token handling needed: /admin is behind HTTP Basic Auth (src/proxy.ts), and
// the browser re-sends those credentials automatically on same-origin requests.

/**
 * JSON call to an admin API route. Resolves with the parsed JSON body,
 * or throws an Error whose message is safe to show to the admin.
 */
export async function adminApi(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  body?: unknown
): Promise<Record<string, unknown>> {
  const res = await fetch(path, {
    method,
    cache: "no-store",
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(
      typeof json.error === "string" ? json.error : "Something went wrong. Please try again."
    );
  }
  return json;
}

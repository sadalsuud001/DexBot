const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";

export async function apiGet<T>(path: string): Promise<T> {
  return apiRequest<T>(path, {
    method: "GET",
  });
}

export async function apiPost<TResponse, TBody = unknown>(
  path: string,
  body: TBody
): Promise<TResponse> {
  return apiRequest<TResponse>(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function apiPatch<TResponse, TBody = unknown>(
  path: string,
  body: TBody
): Promise<TResponse> {
  return apiRequest<TResponse>(path, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

async function apiRequest<T>(path: string, options: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();

    throw new Error(
      `API request failed: ${options.method ?? "GET"} ${path} ${response.status} ${text}`
    );
  }

  return response.json() as Promise<T>;
}
import { AUTH_API_BASE } from "@/lib/env";
import { requestJsonPath } from "@/lib/api";

export const API_URL = AUTH_API_BASE;

export function api<T>(path: string, init?: RequestInit): Promise<T> {
  return requestJsonPath<T>(API_URL, path, init);
}

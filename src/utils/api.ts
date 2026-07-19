export function getApiUrl(path: string): string {
  // @ts-ignore
  const baseUrl = (import.meta.env?.VITE_API_URL as string) || "";
  // Ensure no double slashes and correct formatting
  const sanitizedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const sanitizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${sanitizedBase}${sanitizedPath}`;
}

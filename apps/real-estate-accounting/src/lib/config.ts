export const partnerDomain = import.meta.env.VITE_PARTNER_DOMAIN || window.location.hostname;

export function errorMessage(error: unknown, fallback = "Request failed"): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

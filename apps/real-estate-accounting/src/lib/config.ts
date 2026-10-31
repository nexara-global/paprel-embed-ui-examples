export type EntityConfig = { id: string; label: string; companyId?: string };

export const partnerDomain = import.meta.env.VITE_PARTNER_DOMAIN || window.location.hostname;

export function entities(): EntityConfig[] {
  const parsed = String(import.meta.env.VITE_PAPREL_ENTITIES ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => {
      const [id, label, companyId] = value.split(":").map((part) => part.trim());
      return { id, label: label || id, companyId: companyId || undefined };
    })
    .filter((entity) => entity.id);
  return parsed.length ? parsed : [{ id: "default", label: "HarborStone" }];
}

export function errorMessage(error: unknown, fallback = "Request failed"): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

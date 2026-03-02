// lib/asset-mappings.ts
export const normalize = (txt: string) =>
  txt
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, "_");

// exporta os dois mapas que já fizemos
export { permissionsIcons, statusIcons, verifiedIcons } from "@/app/components/BadgeIcons";   // idem
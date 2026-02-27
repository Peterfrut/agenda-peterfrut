export const formatDate = (iso?: string) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

export const formatNumber = (iso?: string) => {
  if (!iso) return "";
  const value = iso.replace(".", ",");
  return value;
};

export const defaultEmail = (fullName?: string) => {
  if (!fullName) return "";

  const parts = fullName.trim().split(/\s+/); // separa por qualquer espaço
  if (parts.length === 1) return parts[0]; // nome único

  const first = parts[0];
  const last = parts[parts.length - 1];

  return `${first}.${last}@peterfrut.com.br`;
};

export function isPeterfrutEmail(email: string) {
  return email.endsWith("@peterfrut.com.br");
}

export function normEmail(v: unknown) {
  return String(v ?? "").trim().toLowerCase();
}


export function splitEmails(raw: unknown): string[] {
  const s = String(raw ?? "");
  return s
    .split(/[,\n;]+/g)
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
}

export const defaultPassword = (fullName?: string) => {
  if (!fullName) return "";

  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]; 

  const first = parts[0];
  const firstLetter = first[0];
  const last = parts[parts.length - 1];
  const firstLastLetter = last[0];

  return `${firstLetter}${firstLastLetter}*25ptf`;
};

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(email);
}

export function normalizeEmailList(input: string): string {
  let v = (input ?? "").toLowerCase();

  // troca ; e quebras de linha por vírgula
  v = v.replace(/[;\n\r]+/g, ",");

  // troca múltiplos espaços por 1 espaço
  v = v.replace(/\s+/g, " ");

  // se a pessoa digitou "email " (espaço depois de um e-mail), vira "email, "
  // Isso ajuda bastante no fluxo: cola um email, dá espaço, já separa.
  v = v.replace(
    /([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})(\s)/g,
    "$1, "
  );

  // remove espaços em volta da vírgula: "a@a.com , b@b.com" => "a@a.com, b@b.com"
  v = v.replace(/\s*,\s*/g, ", ");

  // remove vírgulas duplicadas: ", ,"
  v = v.replace(/(,\s*){2,}/g, ", ");

  // remove vírgula no começo
  v = v.replace(/^,\s*/g, "");

  return v;
}

// retorna a lista de emails (limpos) e uma lista de inválidos
export function parseEmailList(input: string): {
  emails: string[];
  invalid: string[];
} {
  const raw = (input ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const emails: string[] = [];
  const invalid: string[] = [];

  for (const item of raw) {
    if (isValidEmail(item)) emails.push(item);
    else invalid.push(item);
  }

  // remove duplicados
  const unique = Array.from(new Set(emails));

  return { emails: unique, invalid };
}

export function validatePassword(password: string): boolean {
  const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{10,}$/;
  return passwordRegex.test(password);
}

export function normalizeToken(v: unknown) {
  return String(v ?? "").trim();
}

export function parseTimeToMinutes(hhmm: string) {
  const [hh, mm] = hhmm.split(":").map((x) => Number(x));
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return NaN;
  return hh * 60 + mm;
}

export function isStep30Minutes(hhmm: string) {
  const mins = parseTimeToMinutes(hhmm);
  if (!Number.isFinite(mins)) return false;
  return mins % 30 === 0;
}

export function toMins(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

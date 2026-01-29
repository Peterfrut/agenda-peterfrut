type BrasilApiHoliday = {
  date: string;
  name: string;
  type: "national" | "state" | "municipal";
};

export async function getBrazilHolidays(year: number): Promise<BrasilApiHoliday[]> {
  const res = await fetch(`https://brasilapi.com.br/api/feriados/v1/${year}`, {
    next: { revalidate: 60 * 60 * 24 }, // cache 24h
  });

  if (!res.ok) {
    throw new Error("Erro ao buscar feriados nacionais");
  }

  return res.json();
}

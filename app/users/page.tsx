"use client"

import { useMemo } from "react"
import useSWR from "swr"
import { ChevronLeft, UsersRound } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card"

import { getColumns } from "./columns"
import { DataTable } from "./data-table"
import { UserRow } from "@/lib/types/users"
import { Button } from "../components/ui/button"
import { useRouter } from "next/navigation";

const fetcher = (url: string) =>
  fetch(url, { credentials: "include" }).then(async (r) => {
    const j = await r.json().catch(() => null)
    if (!r.ok) throw new Error(j?.message || "Erro")
    return j
  })

export default function UsersPage() {
  const { data, isLoading, mutate } = useSWR<{ ok: boolean; users: UserRow[] }>(
    "/api/users?page=1&pageSize=100",
    fetcher
  )
  const router = useRouter();
  const users = data?.users ?? []
  const columns = useMemo(() => getColumns(mutate), [mutate])

  return (
    <div className="max-w-6xl mx-auto p-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Button
              variant="default"
              onClick={() => router.push("./")}
            >
              <ChevronLeft></ChevronLeft>
              Voltar
            </Button>
            <UsersRound className="w-6 h-6" />
            Usuários
          </CardTitle>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Carregando...</div>
          ) : (
            <DataTable
              columns={columns}
              data={users}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

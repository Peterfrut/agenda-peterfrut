"use client"

import { ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown } from "lucide-react"

import { Button } from "@/app/components/ui/button"
import { Badge } from "@/app/components/ui/badge"
import { permissionsIcons, statusIcons, verifiedIcons, normalize } from "@/lib/asset-mappings"

import { UserRow } from "@/lib/types/users"
import { UserActions } from "./user-actions"

export function getColumns(mutate?: () => Promise<unknown>): ColumnDef<UserRow>[] {
  return [
  {
    accessorKey: "name",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Nome
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => row.original.name ?? "-",
  },
  {
    accessorKey: "email",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          E-mail
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
  },
  {
    accessorKey: "role",
    header: "Permissão",
    cell: ({ row }) => {
      const u = row.original
      const roleRaw = u.role === "admin" ? "Admin" : "User"
      const roleKey = normalize(roleRaw)
      const roleInfo = permissionsIcons[roleKey] ?? permissionsIcons._default

      return (
        <Badge className={`flex w-fit items-center gap-2 px-2 py-1 text-xs uppercase font-medium rounded-md ${roleInfo.bg} ${roleInfo.text}`}>
          {roleInfo.icon}
          {roleInfo.label}
        </Badge>
      )
    },
  },
  {
    id: "verified",
    accessorFn: (row) => (row.emailVerifiedAt ? "Verificado" : "Não verificado"),
    header: "Verificado",
    cell: ({ row }) => {
      const emailRaw = row.original.emailVerifiedAt ? "Verificado" : "Não verificado"
      const emailKey = normalize(emailRaw)
      const emailInfo = verifiedIcons[emailKey] ?? verifiedIcons._default

      return (
        <Badge className={`flex w-fit items-center gap-2 px-2 py-1 text-xs uppercase font-medium rounded-md ${emailInfo.bg} ${emailInfo.text}`}>
          {emailInfo.icon}
          {emailInfo.label}
        </Badge>
      )
    },
  },
  {
    id: "status",
    accessorFn: (row) => (row.active ? "Active" : "Inactive"),
    header: "Status",
    cell: ({ row }) => {
      const statusRaw = row.original.active ? "Active" : "Inactive"
      const statusKey = normalize(statusRaw)
      const statusInfo = statusIcons[statusKey] ?? statusIcons._default

      return (
        <Badge className={`flex w-fit items-center gap-2 px-2 py-1 text-xs uppercase font-medium rounded-md ${statusInfo.bg} ${statusInfo.text}`}>
          {statusInfo.icon}
          {statusInfo.label}
        </Badge>
      )
    },
  },
  {
    id: "actions",
    header: "Ações",
    cell: ({ row }) => <UserActions user={row.original} mutate={mutate} />,
    enableSorting: false,
    enableHiding: false,
  },
  ]
}

export const columns = getColumns()

"use client"

import { useState } from "react"
import { toast } from "sonner"
import { SquarePen, Trash } from "lucide-react"

import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/app/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/app/components/ui/alert-dialog"

import { UserRow } from "@/lib/types/users"

type Props = {
  user: UserRow
  mutate?: () => Promise<any>
}

export function UserActions({ user, mutate }: Props) {
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [saving, setSaving] = useState(false)

  const [isEditing, setIsEditing] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const [name, setName] = useState(user.name ?? "")
  const [email, setEmail] = useState(user.email ?? "")
  const [role, setRole] = useState<"user" | "admin">(user.role === "admin" ? "admin" : "user")
  const [userVerified, setUserVerified] = useState<boolean>(!!user.emailVerifiedAt)

  function openEdit() {
    setName(user.name ?? "")
    setEmail(user.email ?? "")
    setRole(user.role === "admin" ? "admin" : "user")
    setUserVerified(!!user.emailVerifiedAt)

    setEditing(true)
    setIsEditing(false)
    setConfirmOpen(false)
  }

  function closeEdit() {
    setEditing(false)
    setIsEditing(false)
    setConfirmOpen(false)
  }

  function handlePrimaryClick() {
    if (!isEditing) setIsEditing(true)
    else setConfirmOpen(true)
  }

  async function saveEdit() {
    setSaving(true)
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name,
          email,
          role,
          verified: userVerified,
        }),
      })

      const j = await res.json().catch(() => null)
      if (!res.ok || !j?.ok) throw new Error(j?.message || "Erro ao salvar")

      toast.success("Usuário atualizado!")

      if (mutate) await mutate()
      closeEdit()
    } catch (e: any) {
      toast.error(e?.message ?? "Erro")
    } finally {
      setSaving(false)
    }
  }

  async function handleConfirmSave() {
    setConfirmOpen(false)
    await saveEdit()
  }

  async function confirmDelete() {
    setSaving(true)
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      })

      const j = await res.json().catch(() => null)
      if (!res.ok || !j?.ok) throw new Error(j?.message || "Erro ao deletar usuário")

      toast.success("Usuário deletado!")
      setDeleting(false)

      if (mutate) await mutate()
    } catch (e: any) {
      toast.error(e?.message ?? "Erro")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={openEdit}>
          <SquarePen className="h-4 w-4" />
        </Button>

        <Button variant="ghost" size="icon" onClick={() => setDeleting(true)}>
          <Trash className="h-4 w-4" />
        </Button>
      </div>

      <Dialog
        open={editing}
        onOpenChange={(o) => {
          if (!o) closeEdit()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar usuário</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Nome</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!isEditing || saving}
              />
            </div>

            <div className="space-y-1">
              <Label>E-mail</Label>
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value.toLowerCase())}
                disabled={!isEditing || saving}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>Verificado</Label>
                <Select
                  value={userVerified ? "yes" : "no"}
                  onValueChange={(v) => setUserVerified(v === "yes")}
                  disabled={!isEditing || saving}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Verificado</SelectItem>
                    <SelectItem value="no">Não verificado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Permissão</Label>
                <Select
                  value={role}
                  onValueChange={(v: "user" | "admin") => setRole(v)}
                  disabled={!isEditing || saving}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Usuário</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={closeEdit} disabled={saving}>
              Cancelar
            </Button>

            <Button
              variant="default"
              type="button"
              onClick={handlePrimaryClick}
              disabled={saving}
            >
              {isEditing ? "Salvar" : "Editar"}
            </Button>
          </DialogFooter>

          <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirmar salvamento?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação salvará as alterações realizadas.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleConfirmSave} disabled={saving}>
                  Confirmar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </DialogContent>
      </Dialog>

      <Dialog open={deleting} onOpenChange={(o) => !o && setDeleting(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir usuário</DialogTitle>
          </DialogHeader>

          <DialogDescription>
            Tem certeza que deseja excluir o usuário <strong>{user.name}</strong>?
            <br />
            <span>Essa operação não pode ser desfeita.</span>
          </DialogDescription>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleting(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={confirmDelete} disabled={saving}>
              {saving ? "Excluindo..." : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
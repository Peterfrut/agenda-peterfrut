"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/app/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/app/components/ui/select";
import { permissionsIcons, statusIcons, verifiedIcons, normalize } from "@/lib/asset-mappings";
import { Badge } from "@/app/components/ui/badge";

import { ChevronLeft, ChevronRight, RefreshCw, SquarePen, Trash, UsersRound } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "../components/ui/alert-dialog";

type UserRow = {
    id: string;
    name: string | null;
    email: string;
    emailVerifiedAt: Date | null;
    role: string | null;
};

const fetcher = (url: string) =>
    fetch(url, { credentials: "include" }).then(async (r) => {
        const j = await r.json().catch(() => null);
        if (!r.ok) throw new Error(j?.message || "Erro");
        return j;
    });

export default function UserInfos() {
    const [q, setQ] = useState("");
    const [page, setPage] = useState(1);
    const pageSize = 20;

    const key = useMemo(
        () => `/api/users?q=${encodeURIComponent(q)}&page=${page}&pageSize=${pageSize}`,
        [q, page]
    );

    const { data, isLoading, mutate } = useSWR<{
        ok: boolean;
        users: UserRow[];
        total: number;
        page: number;
        pageSize: number;
    }>(key, fetcher);

    const users = data?.users ?? [];
    const total = data?.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    const [editing, setEditing] = useState<UserRow | null>(null);
    const [deleting, setDeleting] = useState<UserRow | null>(null);

    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [role, setRole] = useState<"user" | "admin">("user");
    const [userVerified, setUserVerified] = useState<boolean>(false);

    const router = useRouter();

    const [saving, setSaving] = useState(false);

    // 👇 controla edição somente dentro do modal
    const [isEditing, setIsEditing] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);

    function openEdit(u: UserRow) {
        setEditing(u);
        setName(u.name ?? "");
        setEmail(u.email ?? "");
        setRole(u.role === "admin" ? "admin" : "user");
        setUserVerified(!!u.emailVerifiedAt);

        // 🔒 sempre abre travado
        setIsEditing(false);
        setConfirmOpen(false);
    }

    function closeEdit() {
        setEditing(null);
        setIsEditing(false);
        setConfirmOpen(false);
    }

    // Botão primário do modal:
    // - se não está editando: habilita
    // - se está editando: abre confirmação
    function handlePrimaryClick() {
        if (!isEditing) setIsEditing(true);
        else setConfirmOpen(true);
    }

    async function saveEdit() {
        if (!editing) return;

        setSaving(true);
        try {
            const res = await fetch(`/api/users/${editing.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    name,
                    email,
                    role,
                    verified: userVerified,
                }),
            });

            const j = await res.json().catch(() => null);
            if (!res.ok || !j?.ok) throw new Error(j?.message || "Erro ao salvar");

            toast.success("Usuário atualizado!");
            await mutate(); // recarrega lista

            // ✅ fecha e reseta tudo
            closeEdit();
        } catch (e: any) {
            toast.error(e?.message ?? "Erro");
        } finally {
            setSaving(false);
        }
    }

    // Confirmar no AlertDialog: chama o saveEdit real
    async function handleConfirmSave() {
        setConfirmOpen(false);
        await saveEdit();
    }

    async function openDelete(u: UserRow) {
        setDeleting(u);
    }

    async function confirmDelete() {
        if (!deleting) return;
        setSaving(true);

        try {
            const res = await fetch(`/api/users/${deleting.id}`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
            });

            const j = await res.json().catch(() => null);
            if (!res.ok || !j?.ok) throw new Error(j?.message || "Erro ao deletar usuário");

            toast.success("Usuário deletado!");
            setDeleting(null);
            await mutate();
        } catch (e: any) {
            toast.error(e?.message ?? "Erro");
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="max-w-5xl mx-auto p-4 space-y-4">
            <Card>
                <CardHeader className="flex flex-col gap-3">
                    <CardTitle className="flex flex-col items-center gap-3">
                        <Button 
                            variant="default"
                            onClick={() => router.push("./")}
                        >
                            <ChevronLeft></ChevronLeft>
                            Voltar
                        </Button>
                        <div>
                            <UsersRound className="w-10 h-10 inline mr-2" />
                            <h1 className="text-xl">Usuários</h1>
                        </div>
                    </CardTitle>

                    <div className="flex gap-2 items-end">
                        <div className="flex-1">
                            <Input
                                value={q}
                                onChange={(e) => {
                                    setQ(e.target.value);
                                    setPage(1);
                                }}
                                placeholder="Nome ou e-mail..."
                            />
                        </div>

                        <Button
                            variant="outline"
                            onClick={() => mutate()}
                            disabled={isLoading}
                        >
                            <RefreshCw className="w-4 h-4" />
                        </Button>
                    </div>
                </CardHeader>

                <CardContent>
                    <div className="overflow-auto border rounded-md">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50">
                                <tr className="text-left">
                                    <th className="p-3">Nome</th>
                                    <th className="p-3">E-mail</th>
                                    <th className="p-3">Verificado</th>
                                    <th className="p-3">Permissão</th>
                                    <th className="p-3">Status</th>
                                    <th className="p-3 w-[120px]">Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {isLoading ? (
                                    <tr>
                                        <td className="p-3 text-muted-foreground" colSpan={5}>
                                            Carregando...
                                        </td>
                                    </tr>
                                ) : users.length === 0 ? (
                                    <tr>
                                        <td className="p-3 text-muted-foreground" colSpan={5}>
                                            Nenhum usuário encontrado.
                                        </td>
                                    </tr>
                                ) : (
                                    users.map((u) => {
                                        const emailRaw = !!u.emailVerifiedAt ? "Verificado" : "Não verificado";
                                        const emailKey = normalize(emailRaw); // "verificado" / "nao_verificado" (depende do normalize)
                                        const emailInfo = verifiedIcons[emailKey] ?? verifiedIcons._default;

                                        const roleRaw = u.role === "admin" ? "Admin" : "User";
                                        const roleKey = normalize(roleRaw); // "admin" / "usuario"
                                        const roleInfo = permissionsIcons[roleKey] ?? permissionsIcons._default;

                                        const statusRaw = !!u.emailVerifiedAt ? "Active" : "Inactive";
                                        const statusKey = normalize(statusRaw); // "ativo" / "inativo"
                                        const statusInfo = statusIcons[statusKey] ?? statusIcons._default;

                                        return (
                                            <tr key={u.id} className="border-t">
                                                <td className="p-3">{u.name ?? "-"}</td>
                                                <td className="p-3">{u.email}</td>

                                                {/* Email verificado */}
                                                <td className="p-3">
                                                    <Badge
                                                        className={`flex items-center gap-2 px-2 py-1 text-xs uppercase font-medium rounded-md ${emailInfo.bg} ${emailInfo.text}`}
                                                    >
                                                        {emailInfo.icon}
                                                        {emailInfo.label}
                                                    </Badge>
                                                </td>

                                                {/* Role */}
                                                <td className="p-3">
                                                    <Badge
                                                        className={`flex items-center gap-2 px-2 py-1 text-xs uppercase font-medium rounded-md ${roleInfo.bg} ${roleInfo.text}`}
                                                    >
                                                        {roleInfo.icon}
                                                        {roleInfo.label}
                                                    </Badge>
                                                </td>

                                                <td className="p-3">
                                                    <Badge
                                                        className={`flex items-center gap-2 px-2 py-1 text-xs uppercase font-medium rounded-md ${statusInfo.bg} ${statusInfo.text}`}
                                                    >
                                                        {statusInfo.icon}
                                                        {statusInfo.label}
                                                    </Badge>
                                                </td>

                                                <td className="p-3">
                                                    <SquarePen className="w-4 h-4 inline mr-2" onClick={() => openEdit(u)} />
                                                    <Trash className="w-4 h-4 inline ml-2" onClick={() => openDelete(u)} />
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex items-center justify-between mt-3">
                        <div className="text-xs text-muted-foreground">
                            Total: {total}
                        </div>

                        <div className="flex gap-2 items-center">
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                disabled={page <= 1}
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </Button>

                            <span className="text-xs">
                                Página {page} / {totalPages}
                            </span>

                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                disabled={page >= totalPages}
                            >
                                <ChevronRight className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Dialog
                open={!!editing}
                onOpenChange={(o) => {
                    if (!o) closeEdit();
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
                                    onValueChange={(v: any) => setUserVerified(v === "yes")}
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
                                    onValueChange={(v: any) => setRole(v)}
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

                    {/* ✅ ALERTA DE CONFIRMAÇÃO (só aparece ao clicar em Salvar) */}
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

            <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Excluir usuário</DialogTitle>
                    </DialogHeader>

                    <DialogDescription className="">
                        Tem certeza que deseja excluir o usuário <strong>{deleting?.name}</strong>?
                        <br />
                        <span>Essa operação não pode ser desfeita.</span>
                    </DialogDescription>

                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setDeleting(null)} disabled={saving}>
                            Cancelar
                        </Button>
                        <Button onClick={confirmDelete} disabled={saving}>
                            {saving ? "Excluindo..." : "Excluir"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
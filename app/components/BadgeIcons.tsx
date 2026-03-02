import {
    ShieldUser, CircleUser, ClockFading,
    XCircle,
    CheckCheck,
    Package,
    AlertCircle,
}
    from "lucide-react"

export const verifiedIcons: Record<
    string,
    { icon: React.JSX.Element; bg: string; text: string; label: string }
> = {
    not_verified: {
        label: "Pendente",
        icon: <ClockFading className="h-4 w-4 text-yellow-500" />,
        bg: "bg-yellow-100 dark:bg-yellow-900/30",
        text: "text-yellow-600 dark:text-yellow-400",
    },

    verificado: {
        label: "Verificado",
        icon: <CheckCheck className="h-4 w-4 text-sky-500" />,
        bg: "bg-sky-100 dark:bg-sky-900/30",
        text: "text-sky-600 dark:text-sky-400",
    },
    _default: {
        label: "-",
        icon: <XCircle className="h-4 w-4 text-muted-foreground" />,
        bg: "bg-muted",
        text: "text-muted-foreground",
    },
};


export const permissionsIcons: Record<
    string,
    { icon: React.JSX.Element; label: string; bg: string; text: string }
> = {
    admin: {
        label: "Admin",
        icon: <ShieldUser className="h-4 w-4 text-violet-500" />,
        bg: "bg-violet-100 dark:bg-violet-900/30",
        text: "text-violet-600 dark:text-violet-300",
    },

    user: {
        label: "Usuário",
        icon: <CircleUser className="h-4 w-4 text-orange-500" />,
        bg: "bg-orange-100 dark:bg-orange-900/30",
        text: "text-orange-600 dark:text-orange-300",
    },

    _default: {
        label: "-",
        icon: <XCircle className="h-4 w-4 text-muted-foreground" />,
        bg: "bg-muted",
        text: "text-muted-foreground",
    },
};

export const statusIcons: Record<
    string,
    { icon: React.JSX.Element; label: string; bg: string; text: string }
> = {
    active: {
        label: "Ativo",
        icon: <Package className="h-4 w-4 text-green-500" />,
        bg: "bg-green-100 dark:bg-green-900/30",
        text: "text-green-600 dark:text-green-400",
    },

    inactive: {
        label: "Inativo",
        icon: <AlertCircle className="h-4 w-4 text-red-500" />,
        bg: "bg-red-100 dark:bg-red-900/30",
        text: "text-red-600 dark:text-red-400",
    },

    _default: {
        label: "-",
        icon: <XCircle className="h-4 w-4 text-muted-foreground" />,
        bg: "bg-muted",
        text: "text-muted-foreground",
    },
};


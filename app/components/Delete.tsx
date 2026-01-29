import { useState } from "react";
import { Trash } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/app/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/app/components/ui/alert-dialog";

type DeleteProps = {
  onConfirm: () => Promise<unknown> | unknown;
  title?: string;
  description?: string;
  loadingText?: string;
  successText?: string;
  errorText?: string;
  disabled?: boolean;
};

export default function Delete({
  onConfirm,
  title = "Você tem certeza disso?",
  description = "Essa ação não poderá ser revertida. Isso excluirá o registro permanentemente.",
  loadingText = "Excluindo lançamento...",
  successText = "Exclusão efetuada com sucesso!",
  errorText = "Erro ao excluir",
  disabled,
}: DeleteProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!onConfirm || loading) return;
    setLoading(true);
    try {
      await toast.promise(Promise.resolve(onConfirm()), {
        loading: loadingText,
        success: successText,
        error: errorText,
      });
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (loading) return;
    setOpen(next);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger asChild>
        <Button
          variant="destructive"
          type="button"
          className="cursor-pointer"
          disabled={disabled}
          aria-label="Excluir"
          title="Excluir"
        >
          <Trash className="h-4 w-4"/>
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading} className="cursor-pointer">Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className="bg-red-500 hover:bg-red-600 cursor-pointer"
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? "Excluindo..." : "Excluir"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

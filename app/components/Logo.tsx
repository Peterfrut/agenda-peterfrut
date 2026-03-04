import logo from "@/public/logo_peterfrut.png";

export default function Logo() {
    return (
        <div className="w-full flex flex-col items-center justify-center">
            <img src={logo.src} alt="" className="w-24" />
            <p className="text-xs text-muted-foreground text-center">
                ©{new Date().getFullYear()} Peterfrut – Todos os direitos
                reservados.
            </p>
        </div>
    );
}
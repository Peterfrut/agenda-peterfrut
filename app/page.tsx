import { Suspense } from "react";
import { SchedulePage } from "./components/SchedulePage";

export default function Home() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Carregando...</div>}>
      <SchedulePage />
    </Suspense>
  );
}

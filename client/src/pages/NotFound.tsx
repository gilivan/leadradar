import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <p className="text-6xl font-bold text-muted-foreground/20">404</p>
        <h1 className="text-xl font-semibold text-foreground">Página no encontrada</h1>
        <p className="text-sm text-muted-foreground">La página que buscas no existe o fue movida.</p>
        <Link href="/">
          <Button className="mt-2">Ir al Dashboard</Button>
        </Link>
      </div>
    </div>
  );
}

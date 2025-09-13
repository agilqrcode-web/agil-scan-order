import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ImageIcon } from "lucide-react";

export function RestaurantLogoCard() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Logo do Restaurante</CardTitle>
                <CardDescription>Faça o upload da imagem da sua marca.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
                <div className="w-48 h-48 rounded-lg bg-muted flex items-center justify-center">
                    {/* Usando um ícone como placeholder por enquanto */}
                    <ImageIcon className="h-16 w-16 text-muted-foreground" />
                </div>
                <div className="flex gap-2">
                    <Button variant="outline">Enviar nova logo</Button>
                    <Button variant="ghost">Remover</Button>
                </div>
            </CardContent>
        </Card>
    );
}

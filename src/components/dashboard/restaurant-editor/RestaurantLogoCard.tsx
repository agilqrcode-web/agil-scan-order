import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ImageIcon, Upload, Trash2 } from "lucide-react";
import { useRef } from "react";
// import { Spinner } from "@/components/ui/spinner"; // Removido

interface RestaurantLogoCardProps {
    logoPreview: string | null;
    isUploading: boolean;
    handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    handleRemovePreview: () => void;
}

export function RestaurantLogoCard({
    logoPreview,
    isUploading,
    handleFileChange,
    handleRemovePreview
}: RestaurantLogoCardProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Logo do Restaurante</CardTitle>
                <CardDescription>Faça o upload da imagem da sua marca.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
                <div className="w-48 h-48 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                    {isUploading ? (
                        <span className="text-sm text-muted-foreground">Carregando...</span> // Substituído Spinner
                    ) : logoPreview ? (
                        <img src={logoPreview} alt="Pré-visualização da logo" className="w-full h-full object-cover" />
                    ) : (
                        <ImageIcon className="h-16 w-16 text-muted-foreground" />
                    )}
                </div>

                <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileChange}
                    className="hidden" 
                    accept="image/png, image/jpeg, image/webp"
                />

                <div className="flex justify-center gap-2">
                    {!logoPreview ? (
                        <Button variant="outline" size="icon" onClick={() => fileInputRef.current?.click()} disabled={isUploading} aria-label="Escolher Imagem">
                            <Upload className="h-4 w-4" />
                        </Button>
                    ) : (
                        <Button variant="destructive" size="icon" onClick={handleRemovePreview} disabled={isUploading} aria-label="Remover Logo">
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ImageIcon, Upload, Trash2, Check } from "lucide-react";
import { useRef } from "react";
import { Restaurant } from "@/pages/dashboard/EditRestaurant";
import { useRestaurantLogoUpload } from "@/hooks/useRestaurantLogoUpload";
import { Spinner } from "@/components/ui/spinner";

interface RestaurantLogoCardProps {
    restaurant: Restaurant;
    onLogoUpdate: (newLogoUrl: string | null) => void;
}

export function RestaurantLogoCard({ restaurant, onLogoUpdate }: RestaurantLogoCardProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const { 
        logoPreview, 
        isUploading, 
        handleFileChange, 
        uploadLogo, 
        removeLogo 
    } = useRestaurantLogoUpload({
        initialLogoUrl: restaurant.logo_url,
        restaurantId: restaurant.id,
    });

    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        handleFileChange(e);
        // O upload agora é disparado por um botão de salvar no hook
    };

    const handleSaveLogo = async () => {
        const newLogoUrl = await uploadLogo();
        onLogoUpdate(newLogoUrl);
    };

    const handleRemoveLogo = async () => {
        const newLogoUrl = await removeLogo();
        onLogoUpdate(newLogoUrl);
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Logo do Restaurante</CardTitle>
                <CardDescription>Faça o upload da imagem da sua marca.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
                <div className="w-48 h-48 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                    {isUploading ? (
                        <Spinner size="large" />
                    ) : logoPreview ? (
                        <img src={logoPreview} alt="Pré-visualização da logo" className="w-full h-full object-cover" />
                    ) : (
                        <ImageIcon className="h-16 w-16 text-muted-foreground" />
                    )}
                </div>

                <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileSelect}
                    className="hidden" 
                    accept="image/png, image/jpeg, image/webp"
                />

                <div className="flex justify-center gap-2">
                    <Button variant="outline" size="icon" onClick={handleUploadClick} disabled={isUploading} aria-label="Escolher Imagem">
                        <Upload className="h-4 w-4" />
                    </Button>

                    {logoPreview && logoPreview.startsWith('blob:') && (
                         <Button size="icon" onClick={handleSaveLogo} disabled={isUploading} aria-label="Salvar Nova Logo">
                            <Check className="h-4 w-4" />
                        </Button>
                    )}

                    <Button variant="destructive" size="icon" onClick={handleRemoveLogo} disabled={isUploading || !logoPreview} aria-label="Remover Logo">
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

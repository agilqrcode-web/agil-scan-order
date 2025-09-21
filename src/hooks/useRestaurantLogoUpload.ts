import { useState, useEffect, useCallback } from 'react';
import { useSupabase } from '@/contexts/SupabaseContext';
import { useToast } from '@/components/ui/use-toast';

interface UseRestaurantLogoUploadProps {
  initialLogoUrl: string | null;
  restaurantId: string;
}

export const useRestaurantLogoUpload = ({ initialLogoUrl, restaurantId }: UseRestaurantLogoUploadProps) => {
  const supabase = useSupabase();
  const { toast } = useToast();

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(initialLogoUrl);
  const [isMarkedForDeletion, setIsMarkedForDeletion] = useState(false);

  useEffect(() => {
    setLogoPreview(initialLogoUrl);
  }, [initialLogoUrl]);

  useEffect(() => {
    return () => {
      if (logoPreview && logoPreview.startsWith('blob:')) {
        URL.revokeObjectURL(logoPreview);
      }
    };
  }, [logoPreview]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      toast({ variant: 'destructive', title: 'Formato de arquivo inválido', description: 'Use PNG, JPG ou WEBP.' });
      return;
    }
    if (file.size > 1 * 1024 * 1024) { // 1MB limit
      toast({ variant: 'destructive', title: 'Arquivo muito grande', description: 'O tamanho máximo é 1MB.' });
      return;
    }

    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
    setIsMarkedForDeletion(false);
  };

  const handleRemovePreview = () => {
    setLogoFile(null);
    setLogoPreview(null);
    setIsMarkedForDeletion(true);
  };

  const processLogoChange = useCallback(async (currentLogoUrl: string | null): Promise<string | null> => {
    const bucketName = 'restaurant-logos';

    // Case 1: A new file was selected for upload
    if (logoFile) {
      // Delete the old logo if it exists
      if (currentLogoUrl) {
        try {
          const oldLogoPath = currentLogoUrl.substring(currentLogoUrl.indexOf(bucketName) + bucketName.length + 1);
          await supabase.storage.from(bucketName).remove([oldLogoPath]);
        } catch (error) {
          console.error("Failed to delete old logo, proceeding with upload:", error);
        }
      }

      // Upload the new logo
      const fileExt = logoFile.name.split('.').pop();
      const newFilePath = `${restaurantId}/logo-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from(bucketName).upload(newFilePath, logoFile);
      if (uploadError) {
        throw new Error(`Falha no upload da logo: ${uploadError.message}`);
      }
      const { data: publicUrlData } = supabase.storage.from(bucketName).getPublicUrl(newFilePath);
      return publicUrlData.publicUrl;
    }

    // Case 2: Existing logo was marked for deletion
    if (isMarkedForDeletion && currentLogoUrl) {
        try {
            const oldLogoPath = currentLogoUrl.substring(currentLogoUrl.indexOf(bucketName) + bucketName.length + 1);
            await supabase.storage.from(bucketName).remove([oldLogoPath]);
            return null; // Return null as the new URL
        } catch (error) {
            console.error("Failed to delete logo from storage:", error);
            throw new Error("Falha ao remover a logo do armazenamento.");
        }
    }

    // Case 3: No changes were made
    return currentLogoUrl;

  }, [logoFile, isMarkedForDeletion, restaurantId, supabase]);

  return {
    logoPreview,
    handleFileChange,
    handleRemovePreview,
    processLogoChange,
  };
};

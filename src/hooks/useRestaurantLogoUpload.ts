import { useState, useEffect } from 'react';
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
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    setLogoPreview(initialLogoUrl);
  }, [initialLogoUrl]);

  // Limpa o object URL do preview para evitar memory leaks
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

    if (file.size > 1 * 1024 * 1024) { // Limite de 1MB para logos
      toast({ variant: 'destructive', title: 'Arquivo muito grande', description: 'O tamanho máximo é 1MB.' });
      return;
    }

    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const uploadLogo = async (): Promise<string | null> => {
    if (!logoFile) return initialLogoUrl; // Nenhuma nova imagem selecionada

    setIsUploading(true);
    try {
      // 1. Remove a logo antiga, se existir
      if (initialLogoUrl) {
        const oldLogoPath = `${restaurantId}/${initialLogoUrl.split('/').pop()}`;
        await supabase.storage.from('restaurant-logos').remove([oldLogoPath]);
      }

      // 2. Faz o upload da nova logo
      const fileExt = logoFile.name.split('.').pop();
      const newFilePath = `${restaurantId}/logo-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('restaurant-logos')
        .upload(newFilePath, logoFile);

      if (uploadError) {
        throw new Error(`Falha no upload da logo: ${uploadError.message}`);
      }

      // 3. Obtém a URL pública da nova logo
      const { data: publicUrlData } = supabase.storage.from('restaurant-logos').getPublicUrl(newFilePath);
      const newLogoUrl = publicUrlData.publicUrl;

      // 4. Atualiza a tabela do restaurante com a nova URL
      const { error: dbError } = await supabase
        .from('restaurants')
        .update({ logo_url: newLogoUrl })
        .eq('id', restaurantId);

      if (dbError) {
        throw new Error(`Falha ao salvar a URL no banco de dados: ${dbError.message}`);
      }

      toast({ title: 'Sucesso', description: 'Logo atualizada com sucesso!' });
      setLogoFile(null); // Reseta o arquivo após o upload
      return newLogoUrl;
    } catch (error) {
      const err = error as Error;
      toast({ variant: 'destructive', title: 'Erro no Upload', description: err.message });
      setLogoPreview(initialLogoUrl); // Reverte o preview em caso de erro
      return initialLogoUrl;
    } finally {
      setIsUploading(false);
    }
  };

  const removeLogo = async (): Promise<string | null> => {
    if (!initialLogoUrl) return null;

    setIsUploading(true);
    try {
      const bucketName = 'restaurant-logos';
      // 1. Remove a logo do storage
      const oldLogoPath = initialLogoUrl.substring(initialLogoUrl.indexOf(bucketName) + bucketName.length + 1);
      await supabase.storage.from(bucketName).remove([oldLogoPath]);

      // 2. Atualiza a tabela do restaurante para remover a URL
      const { error: dbError } = await supabase
        .from('restaurants')
        .update({ logo_url: null })
        .eq('id', restaurantId);

      if (dbError) {
        throw new Error(`Falha ao remover a URL do banco de dados: ${dbError.message}`);
      }

      toast({ title: 'Sucesso', description: 'Logo removida.' });
      setLogoPreview(null);
      setLogoFile(null);
      return null;
    } catch (error) {
      const err = error as Error;
      toast({ variant: 'destructive', title: 'Erro ao remover', description: err.message });
      return initialLogoUrl;
    } finally {
      setIsUploading(false);
    }
  };

  return {
    logoPreview,
    isUploading,
    handleFileChange,
    uploadLogo,
    removeLogo,
  };
};

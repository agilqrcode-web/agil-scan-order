import { useState, useEffect } from 'react';
import { useSupabase } from '@/contexts/SupabaseContext';

interface UseMenuBannerUploadProps {
  initialBannerUrl: string | null;
  menuId: string;
  restaurantId: string;
  setSaveMessage: (message: { text: string; type: 'success' | 'error' } | null) => void;
}

export const useMenuBannerUpload = ({
  initialBannerUrl,
  menuId,
  restaurantId,
  setSaveMessage,
}: UseMenuBannerUploadProps) => {
  const supabase = useSupabase();
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(initialBannerUrl);
  const [isBannerMarkedForDeletion, setIsBannerMarkedForDeletion] = useState(false);

  useEffect(() => {
    setBannerPreview(initialBannerUrl);
  }, [initialBannerUrl]);

  useEffect(() => {
    return () => {
      if (bannerPreview && bannerPreview.startsWith('blob:')) {
        URL.revokeObjectURL(bannerPreview);
      }
    };
  }, [bannerPreview]);

  const handleBannerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      setSaveMessage({ text: 'Formato de arquivo inválido. Use PNG ou JPG.', type: 'error' });
      setTimeout(() => setSaveMessage(null), 5000);
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setSaveMessage({ text: 'O arquivo é muito grande. O tamanho máximo é 2MB.', type: 'error' });
      setTimeout(() => setSaveMessage(null), 5000);
      return;
    }

    setBannerFile(file);
    setBannerPreview(URL.createObjectURL(file));
    setIsBannerMarkedForDeletion(false);
  };

  const handleBannerRemove = () => {
    setBannerFile(null);
    setBannerPreview(null);
    setIsBannerMarkedForDeletion(true);
  };

  const uploadBanner = async (currentBannerUrl: string | null): Promise<string | null> => {
    let newBannerUrl = currentBannerUrl;
    const bucketName = 'menu-banners';

    // Lógica de remoção (seja por substituição ou remoção explícita)
    const deleteOldBanner = async () => {
        if (!currentBannerUrl) return;
        try {
            const oldBannerPath = currentBannerUrl.substring(currentBannerUrl.indexOf(bucketName) + bucketName.length + 1);
            if (oldBannerPath) {
                await supabase.storage.from(bucketName).remove([oldBannerPath]);
            }
        } catch (error) {
            console.error("Failed to delete old banner:", error);
            // Não trava a operação principal se a exclusão falhar
        }
    };

    // Caso 1: O banner foi marcado para ser deletado
    if (isBannerMarkedForDeletion) {
      await deleteOldBanner();
      newBannerUrl = null;
    }

    // Caso 2: Um novo arquivo foi selecionado (substituição)
    if (bannerFile) {
      await deleteOldBanner(); // Deleta o antigo antes de subir o novo

      const fileExt = bannerFile.name.split('.').pop();
      const filePath = `${restaurantId}/${menuId}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(filePath, bannerFile);

      if (uploadError) {
        throw new Error(`Falha no upload do banner: ${uploadError.message}`);
      }

      const { data: publicUrlData } = supabase.storage.from(bucketName).getPublicUrl(filePath);
      newBannerUrl = publicUrlData.publicUrl;
    }

    return newBannerUrl;
  };

  return {
    bannerPreview,
    handleBannerChange,
    handleBannerRemove,
    uploadBanner,
    resetBannerState: () => {
      setBannerFile(null);
      setIsBannerMarkedForDeletion(false);
    },
  };
};
import { useState, useEffect, useCallback } from 'react';
import { SupabaseClient, StorageError } from '@supabase/supabase-js';

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
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(initialBannerUrl);
  const [currentSavedUrl, setCurrentSavedUrl] = useState<string | null>(initialBannerUrl);
  const [isBannerMarkedForDeletion, setIsBannerMarkedForDeletion] = useState(false);

  // Atualiza preview se vier URL nova do banco
  useEffect(() => {
    if (initialBannerUrl !== currentSavedUrl) {
      setBannerPreview(initialBannerUrl);
      setCurrentSavedUrl(initialBannerUrl);
    }
  }, [initialBannerUrl, currentSavedUrl]);

  // Limpa URL blob da memória
  useEffect(() => {
    return () => {
      if (bannerPreview && bannerPreview.startsWith('blob:')) {
        URL.revokeObjectURL(bannerPreview);
      }
    };
  }, [bannerPreview]);

  // Seleção de arquivo
  const handleBannerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      setSaveMessage({ text: 'Formato de arquivo inválido. Use PNG ou JPG.', type: 'error' });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setSaveMessage({ text: 'O arquivo é muito grande (máx 2MB).', type: 'error' });
      return;
    }

    setBannerFile(file);
    setBannerPreview(URL.createObjectURL(file));
    setIsBannerMarkedForDeletion(false);
  };

  // Remoção manual do banner
  const handleBannerRemove = () => {
    setBannerFile(null);
    setBannerPreview(null);
    setIsBannerMarkedForDeletion(true);
  };

  // Upload do banner
  const uploadBanner = useCallback(
    async (supabase: SupabaseClient): Promise<string | null> => {
      if (!menuId || !restaurantId) {
        throw new Error("Não é possível fazer o upload do banner: IDs do menu ou restaurante estão ausentes.");
      }

      if (!supabase) {
        throw new Error("Supabase client not available.");
      }

      const bucketName = 'menu-banners';

      // Função para remover banner antigo
      const deleteOldBanner = async () => {
        if (!currentSavedUrl) return;
        try {
          const idx = currentSavedUrl.indexOf(bucketName);
          if (idx === -1) {
            return;
          }
          const oldBannerPath = currentSavedUrl.substring(idx + bucketName.length + 1);
          if (oldBannerPath) {
            const { error } = await supabase.storage.from(bucketName).remove([oldBannerPath]);
            if (error) {
              console.error("Erro ao remover banner antigo:", error); // Keep this one as it's a real error
            }
          }
        } catch (error) {
          console.error("Failed to delete old banner:", error);
        }
      };

      // Caso de remoção
      if (isBannerMarkedForDeletion) {
        await deleteOldBanner();
        setCurrentSavedUrl(null);
        return null;
      }

      // Caso de upload de novo arquivo
      if (bannerFile) {
        await deleteOldBanner();

        const fileExt = bannerFile.name.split('.').pop();
        const filePath = `${restaurantId}/${menuId}-${Date.now()}.${fileExt}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from(bucketName)
          .upload(filePath, bannerFile, { upsert: true });

        if (uploadError) {
          throw new Error(`Falha no upload do banner: ${(uploadError as StorageError).message}`);
        }

        const { data: publicUrlData } = supabase.storage.from(bucketName).getPublicUrl(filePath);
        const newPublicUrl = publicUrlData.publicUrl;

        setCurrentSavedUrl(newPublicUrl);
        return newPublicUrl;
      }

      // Caso não tenha alteração
      return currentSavedUrl;
    },
    [bannerFile, isBannerMarkedForDeletion, currentSavedUrl, menuId, restaurantId]
  );

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

import { useState, useEffect, useCallback } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';

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

  useEffect(() => {
    if (initialBannerUrl !== currentSavedUrl) {
      setBannerPreview(initialBannerUrl);
      setCurrentSavedUrl(initialBannerUrl);
    }
  }, [initialBannerUrl, currentSavedUrl]);

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

  const handleBannerRemove = () => {
    setBannerFile(null);
    setBannerPreview(null);
    setIsBannerMarkedForDeletion(true);
  };

  const uploadBanner = useCallback(async (supabase: SupabaseClient): Promise<string | null> => {
    // ALTERAÇÃO PRINCIPAL: Adicionada uma proteção para evitar a execução com IDs vazios.
    // Isso previne a falha de upload causada pela condição de corrida.
    if (!menuId || !restaurantId) {
      console.error("DEBUG: uploadBanner abortado. menuId ou restaurantId está faltando.", { menuId, restaurantId });
      throw new Error("Não é possível fazer o upload do banner: IDs do menu ou restaurante estão ausentes.");
    }
    
    if (!supabase) {
      console.error("DEBUG: uploadBanner: Supabase client is null!");
      throw new Error("Supabase client not available.");
    }
    
    console.log("DEBUG: uploadBanner: bannerFile state:", bannerFile);
    console.log("DEBUG: uploadBanner: isBannerMarkedForDeletion state:", isBannerMarkedForDeletion);

    const bucketName = 'menu-banners';

    const deleteOldBanner = async () => {
      if (!currentSavedUrl) return;
      try {
        const oldBannerPath = currentSavedUrl.substring(currentSavedUrl.indexOf(bucketName) + bucketName.length + 1);
        if (oldBannerPath) {
          await supabase.storage.from(bucketName).remove([oldBannerPath]);
        }
      } catch (error) {
        console.error("Failed to delete old banner:", error);
      }
    };

    if (isBannerMarkedForDeletion) {
      await deleteOldBanner();
      setCurrentSavedUrl(null);
      return null;
    }

    if (bannerFile) {
      await deleteOldBanner();

      const fileExt = bannerFile.name.split('.').pop();
      const filePath = `${restaurantId}/${menuId}-${Date.now()}.${fileExt}`;

      console.log("DEBUG: Attempting banner upload to path:", filePath);
      const { error: uploadError } = await supabase.storage.from(bucketName).upload(filePath, bannerFile);
      
      if (uploadError) {
        console.error("DEBUG: Banner upload failed. Error details:", uploadError);
        throw new Error(`Falha no upload do banner: ${uploadError.message}`);
      }
      console.log("DEBUG: Banner upload successful to path:", filePath);

      const { data: publicUrlData } = supabase.storage.from(bucketName).getPublicUrl(filePath);
      const newPublicUrl = publicUrlData.publicUrl;
      
      setCurrentSavedUrl(newPublicUrl);
      return newPublicUrl;
    }

    return currentSavedUrl;
  }, [bannerFile, isBannerMarkedForDeletion, currentSavedUrl, menuId, restaurantId]);

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
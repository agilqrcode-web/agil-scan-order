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

    if (isBannerMarkedForDeletion && currentBannerUrl) {
      const oldBannerPath = currentBannerUrl.substring(currentBannerUrl.lastIndexOf('/') + 1);
      if (oldBannerPath) {
        await supabase.storage.from('menu-banners').remove([oldBannerPath]);
      }
      newBannerUrl = null;
    }

    if (bannerFile) {
      if (currentBannerUrl && !isBannerMarkedForDeletion) {
        const oldBannerPath = currentBannerUrl.substring(currentBannerUrl.lastIndexOf('/') + 1);
        if (oldBannerPath) {
          await supabase.storage.from('menu-banners').remove([oldBannerPath]);
        }
      }

      const fileExt = bannerFile.name.split('.').pop();
      const filePath = `${restaurantId}/${menuId}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('menu-banners')
        .upload(filePath, bannerFile);

      if (uploadError) {
        throw new Error(`Falha no upload do banner: ${uploadError.message}`);
      }

      const { data: publicUrlData } = supabase.storage.from('menu-banners').getPublicUrl(filePath);
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

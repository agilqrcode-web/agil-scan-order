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
  
  // State for the image file selected by the user
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  // State for the image preview URL (can be a blob URL or a remote URL)
  const [bannerPreview, setBannerPreview] = useState<string | null>(initialBannerUrl);
  // State to track the currently saved URL in the database
  const [currentSavedUrl, setCurrentSavedUrl] = useState<string | null>(initialBannerUrl);
  // State to flag if the user wants to delete the banner
  const [isBannerMarkedForDeletion, setIsBannerMarkedForDeletion] = useState(false);

  // Sync states if the initial URL from props changes
  useEffect(() => {
    setBannerPreview(initialBannerUrl);
    setCurrentSavedUrl(initialBannerUrl);
  }, [initialBannerUrl]);

  // Clean up blob URLs to prevent memory leaks
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

  const uploadBanner = async (): Promise<string | null> => {
    const bucketName = 'menu-banners';

    const deleteOldBanner = async () => {
      // Use the stateful URL, not a stale prop
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

    // Case 1: Banner is marked for deletion
    if (isBannerMarkedForDeletion) {
      await deleteOldBanner();
      setCurrentSavedUrl(null); // Update internal state
      return null;
    }

    // Case 2: A new file was selected for upload
    if (bannerFile) {
      await deleteOldBanner(); // Delete the old one before uploading

      const fileExt = bannerFile.name.split('.').pop();
      const filePath = `${restaurantId}/${menuId}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage.from(bucketName).upload(filePath, bannerFile);
      if (uploadError) {
        throw new Error(`Falha no upload do banner: ${uploadError.message}`);
      }

      const { data: publicUrlData } = supabase.storage.from(bucketName).getPublicUrl(filePath);
      const newPublicUrl = publicUrlData.publicUrl;
      
      setCurrentSavedUrl(newPublicUrl); // Update internal state with the new URL
      return newPublicUrl;
    }

    // Case 3: No changes to the banner
    return currentSavedUrl;
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

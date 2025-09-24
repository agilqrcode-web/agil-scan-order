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
  // const supabase = useSupabase(); // REMOVIDO
  
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
    if (initialBannerUrl !== currentSavedUrl) {
      setBannerPreview(initialBannerUrl);
      setCurrentSavedUrl(initialBannerUrl);
    }
  }, [initialBannerUrl, currentSavedUrl]);

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

  const uploadBanner = async (supabase: SupabaseClient): Promise<string | null> => {
    if (!supabase) {
        console.error("DEBUG: uploadBanner: Supabase client is null!"); // NEW LOG
        throw new Error("Supabase client not available.");
    }
    console.log("DEBUG: uploadBanner: Supabase client available."); // NEW LOG
    console.log("DEBUG: uploadBanner: bannerFile state:", bannerFile); // NEW LOG
    console.log("DEBUG: uploadBanner: isBannerMarkedForDeletion state:", isBannerMarkedForDeletion); // NEW LOG

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

      console.log("DEBUG: Attempting banner upload to path:", filePath); // NEW LOG
      const { error: uploadError } = await supabase.storage.from(bucketName).upload(filePath, bannerFile);
      
      if (uploadError) {
        console.error("DEBUG: Banner upload failed. Error details:", uploadError); // NEW LOG
        throw new Error(`Falha no upload do banner: ${uploadError.message}`);
      }
      console.log("DEBUG: Banner upload successful to path:", filePath); // NEW LOG

      const { data: publicUrlData } = supabase.storage.from(bucketName).getPublicUrl(filePath);
      const newPublicUrl = publicUrlData.publicUrl;
      
      setCurrentSavedUrl(newPublicUrl);
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

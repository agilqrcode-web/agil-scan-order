import { useState, useEffect } from 'react';
import { useSupabase } from '@/contexts/SupabaseContext';

interface UseItemImageUploadProps {
  initialImageUrl: string | null;
  restaurantId: string;
  setSaveMessage: (message: { text: string; type: 'success' | 'error' } | null) => void;
}

export const useItemImageUpload = ({
  initialImageUrl,
  restaurantId,
  setSaveMessage,
}: UseItemImageUploadProps) => {
  const supabase = useSupabase();
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(initialImageUrl);
  const [isImageMarkedForDeletion, setIsImageMarkedForDeletion] = useState(false);

  useEffect(() => {
    setImagePreview(initialImageUrl);
  }, [initialImageUrl]);

  // Cleanup blob URL
  useEffect(() => {
    return () => {
      if (imagePreview && imagePreview.startsWith('blob:')) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setSaveMessage({ text: 'Formato inválido. Use PNG, JPG ou WEBP.', type: 'error' });
      setTimeout(() => setSaveMessage(null), 5000);
      return;
    }

    if (file.size > 1 * 1024 * 1024) { // 1MB limit for item images
      setSaveMessage({ text: 'Arquivo muito grande. O máximo é 1MB.', type: 'error' });
      setTimeout(() => setSaveMessage(null), 5000);
      return;
    }

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setIsImageMarkedForDeletion(false);
  };

  const handleImageRemove = () => {
    setImageFile(null);
    setImagePreview(null);
    setIsImageMarkedForDeletion(true);
  };

  const uploadImage = async (currentImageUrl: string | null): Promise<string | null> => {
    let newImageUrl = currentImageUrl;

    // 1. Handle deletion
    if (isImageMarkedForDeletion && currentImageUrl) {
      const oldImagePath = new URL(currentImageUrl).pathname.split('/menu-item-images/')[1];
      if (oldImagePath) {
        await supabase.storage.from('menu-item-images').remove([oldImagePath]);
      }
      newImageUrl = null;
    }

    // 2. Handle upload
    if (imageFile) {
      // If a file is staged for upload, and there was an old image, remove the old one first.
      if (currentImageUrl && !isImageMarkedForDeletion) {
        const oldImagePath = new URL(currentImageUrl).pathname.split('/menu-item-images/')[1];
        if (oldImagePath) {
          await supabase.storage.from('menu-item-images').remove([oldImagePath]);
        }
      }

      const fileExt = imageFile.name.split('.').pop();
      // Using a random UUID for the filename to ensure uniqueness
      const filePath = `${restaurantId}/${crypto.randomUUID()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('menu-item-images')
        .upload(filePath, imageFile);

      if (uploadError) {
        throw new Error(`Falha no upload da imagem: ${uploadError.message}`);
      }

      const { data: publicUrlData } = supabase.storage.from('menu-item-images').getPublicUrl(filePath);
      newImageUrl = publicUrlData.publicUrl;
    }

    return newImageUrl;
  };

  return {
    imageFile,
    imagePreview,
    handleImageChange,
    handleImageRemove,
    uploadImage,
    resetImageState: () => {
      setImageFile(null);
      setIsImageMarkedForDeletion(false);
      setImagePreview(initialImageUrl);
    },
  };
};
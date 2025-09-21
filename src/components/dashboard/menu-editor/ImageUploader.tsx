import React, { useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Trash2 } from 'lucide-react';

interface ImageUploaderProps {
  imagePreview: string | null;
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove: () => void;
  label: string;
  inputId: string;
}

export function ImageUploader({ imagePreview, onFileChange, onRemove, label, inputId }: ImageUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="grid grid-cols-4 items-center gap-4">
      <Label htmlFor={inputId} className="text-right">{label}</Label>
      <div className="col-span-3">
        <input
          type="file"
          accept="image/png, image/jpeg, image/webp"
          ref={fileInputRef}
          onChange={onFileChange}
          className="hidden"
          id={inputId}
        />
        {!imagePreview ? (
          <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
            Adicionar Imagem
          </Button>
        ) : (
          <div className="relative w-32 h-32">
            <img src={imagePreview} alt="Preview" className="w-full h-full object-cover rounded-md border" />
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="absolute top-1 right-1 h-6 w-6"
              onClick={onRemove}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

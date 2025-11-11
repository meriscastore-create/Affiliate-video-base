import React, { useRef } from 'react';
import { ImageState } from '../App';

interface ImageUploaderProps {
  title: string;
  imagePreview: ImageState | null;
  onImageChange: (imageState: ImageState | null) => void;
  id: string;
  isActive: boolean;
  onSelect: (id: string) => void;
  isDragging: boolean;
  isRequired?: boolean;
  containerClassName?: string;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({ 
  title, 
  imagePreview, 
  onImageChange,
  id,
  isActive,
  onSelect,
  isDragging,
  isRequired = false,
  containerClassName = 'h-48'
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        onImageChange({
            data: reader.result as string,
            mimeType: file.type
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleClear = () => {
    onImageChange(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const borderStyle = isActive 
    ? (isDragging ? 'border-solid ring-2 ring-offset-2 ring-offset-surface ring-primary' : 'border-solid border-primary') 
    : 'border-dashed border-border-color';

  return (
    <div>
      {/* Title is only shown for main uploaders, not the small optional ones */}
      {containerClassName.includes('h-48') && <h3 className="text-sm font-semibold mb-2 text-white">{title} {isRequired && <span className="text-red-500">*</span>}</h3>}
      <input 
        type="file" 
        className="hidden" 
        ref={fileInputRef} 
        accept="image/*" 
        onChange={handleFileChange} 
      />
      <div 
        className={`w-full bg-brand-bg rounded-lg border-2 flex items-center justify-center overflow-hidden cursor-pointer transition-colors duration-200 ${containerClassName} ${borderStyle}`}
        onClick={() => onSelect(id)}
        aria-label={`Select ${title} uploader`}
        role="button"
      >
        {imagePreview ? (
          <img src={imagePreview.data} alt={`${title} Preview`} className="w-full h-full object-cover" />
        ) : (
          <span className="text-text-secondary text-xs px-2 text-center">
             {containerClassName.includes('h-48') 
                ? (isActive ? 'Jatuhkan atau Tempel Gambar di Sini' : 'Klik untuk Memilih')
                : title 
            }
          </span>
        )}
      </div>
      <div className="flex gap-2 mt-2">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex-1 text-sm bg-primary/20 text-primary-focus font-semibold py-2 px-2 rounded-md hover:bg-primary/40 transition-colors"
          aria-label={`Unggah ${title}`}
        >
          Unggah
        </button>
        {imagePreview && (
          <button
            onClick={handleClear}
            className="flex-1 text-sm bg-red-500/20 text-red-400 font-semibold py-2 px-2 rounded-md hover:bg-red-500/40 transition-colors"
            aria-label={`Hapus ${title}`}
          >
            Hapus
          </button>
        )}
      </div>
    </div>
  );
};

export default ImageUploader;
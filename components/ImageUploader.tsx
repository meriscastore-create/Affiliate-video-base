import React, { useRef } from 'react';

interface ImageUploaderProps {
  title: string;
  imagePreview: string | null;
  onImageChange: (base64: string | null) => void;
  id: 'model' | 'product';
  isActive: boolean;
  onSelect: (id: 'model' | 'product') => void;
  isDragging: boolean;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({ 
  title, 
  imagePreview, 
  onImageChange,
  id,
  isActive,
  onSelect,
  isDragging
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        onImageChange(reader.result as string);
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
      <h3 className="text-lg font-semibold mb-3 text-white">{title}</h3>
      <input 
        type="file" 
        className="hidden" 
        ref={fileInputRef} 
        accept="image/*" 
        onChange={handleFileChange} 
      />
      <div 
        className={`w-full h-48 bg-brand-bg rounded-lg border-2 flex items-center justify-center overflow-hidden cursor-pointer transition-all duration-200 ${borderStyle}`}
        onClick={() => onSelect(id)}
        aria-label={`Select ${title} uploader`}
        role="button"
      >
        {imagePreview ? (
          <img src={imagePreview} alt={`${title} Preview`} className="w-full h-full object-cover" />
        ) : (
          <span className="text-text-secondary text-sm px-2 text-center">
            {isActive ? 'Drop or Paste Image Here' : 'Click to Select'}
          </span>
        )}
      </div>
      <div className="flex gap-2 mt-2">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex-1 text-sm bg-primary/20 text-primary-focus font-semibold py-2 px-2 rounded-md hover:bg-primary/40 transition-colors"
          aria-label={`Upload ${title}`}
        >
          Upload
        </button>
        {imagePreview && (
          <button
            onClick={handleClear}
            className="flex-1 text-sm bg-red-500/20 text-red-400 font-semibold py-2 px-2 rounded-md hover:bg-red-500/40 transition-colors"
            aria-label={`Clear ${title}`}
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
};

export default ImageUploader;
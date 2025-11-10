import React, { useState, useRef } from 'react';
import ReactCrop, { type Crop, centerCrop, makeAspectCrop, PixelCrop } from 'react-image-crop';

interface ImageCropModalProps {
  imageUrl: string;
  onClose: () => void;
}

const MIN_RESOLUTION = 2073600; // 2.07MP (1920 * 1080)

function getCroppedImg(
  image: HTMLImageElement,
  crop: PixelCrop,
  fileName: string
): void {
  const canvas = document.createElement('canvas');
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  
  const cropWidth = crop.width * scaleX;
  const cropHeight = crop.height * scaleY;
  
  let outputWidth = cropWidth;
  let outputHeight = cropHeight;

  // Upscale if resolution is less than 2MP
  const currentPixels = cropWidth * cropHeight;
  if (currentPixels < MIN_RESOLUTION) {
    const scaleFactor = Math.sqrt(MIN_RESOLUTION / currentPixels);
    outputWidth = Math.round(cropWidth * scaleFactor);
    outputHeight = Math.round(cropHeight * scaleFactor);
  }

  canvas.width = outputWidth;
  canvas.height = outputHeight;
  
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('No 2d context');
  }

  ctx.drawImage(
    image,
    crop.x * scaleX,
    crop.y * scaleY,
    cropWidth,
    cropHeight,
    0,
    0,
    outputWidth,
    outputHeight
  );

  canvas.toBlob((blob) => {
    if (!blob) {
      console.error('Canvas is empty');
      return;
    }
    const fileUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = fileUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(fileUrl);
    document.body.removeChild(a);
  }, 'image/png');
}


const ImageCropModal: React.FC<ImageCropModalProps> = ({ imageUrl, onClose }) => {
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const imgRef = useRef<HTMLImageElement>(null);

  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const { width, height } = e.currentTarget;
    const newCrop = centerCrop(
      makeAspectCrop(
        {
          unit: '%',
          width: 90,
        },
        9 / 16,
        width,
        height
      ),
      width,
      height
    );
    setCrop(newCrop);
  }

  const handleDownload = () => {
    if (completedCrop && imgRef.current) {
        getCroppedImg(imgRef.current, completedCrop, `cropped-image-${Date.now()}.png`);
        onClose();
    }
  };
  
  const isBelowMinRes = completedCrop && (completedCrop.width * completedCrop.height < MIN_RESOLUTION);

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" aria-modal="true" role="dialog">
      <div className="bg-surface rounded-lg shadow-2xl w-full max-w-lg border border-border-color flex flex-col">
        <div className="p-4 border-b border-border-color">
            <h2 className="text-xl font-bold text-white">Crop Image</h2>
            <p className="text-sm text-text-secondary">Adjust the selection to crop the image before downloading.</p>
        </div>
        <div className="p-4 flex-grow overflow-y-auto">
             <ReactCrop
                crop={crop}
                onChange={c => setCrop(c)}
                onComplete={c => setCompletedCrop(c)}
                aspect={9 / 16}
                minWidth={100}
                minHeight={100}
              >
                <img ref={imgRef} src={imageUrl} onLoad={onImageLoad} alt="Image to crop" className="w-full h-auto" />
             </ReactCrop>
             {isBelowMinRes && (
                <div className="mt-3 text-center text-xs bg-yellow-900/50 border border-yellow-700 text-yellow-300 p-2 rounded-md">
                    Note: The selected area is below 2MP. The output will be automatically upscaled to ensure high quality.
                </div>
             )}
        </div>
        <div className="p-4 border-t border-border-color flex justify-end items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-md text-sm font-semibold bg-brand-bg hover:bg-border-color transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDownload}
              disabled={!completedCrop?.width || !completedCrop?.height}
              className="px-4 py-2 rounded-md text-sm font-semibold bg-primary text-white hover:bg-primary-focus transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed"
            >
              Download Cropped
            </button>
        </div>
      </div>
    </div>
  );
};

export default ImageCropModal;
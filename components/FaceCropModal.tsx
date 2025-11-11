import React, { useState, useRef } from 'react';
import ReactCrop, { type Crop, centerCrop, makeAspectCrop, PixelCrop } from 'react-image-crop';
import { ImageState } from '../App';

interface FaceCropModalProps {
  imageState: ImageState;
  onClose: () => void;
  onSave: (croppedImageState: ImageState) => void;
}

async function getCroppedImgBase64(
  image: HTMLImageElement,
  crop: PixelCrop,
  mimeType: string
): Promise<string> {
  const canvas = document.createElement('canvas');
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  canvas.width = crop.width * scaleX;
  canvas.height = crop.height * scaleY;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('No 2d context');
  }

  ctx.drawImage(
    image,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.width * scaleX,
    crop.height * scaleY,
    0,
    0,
    canvas.width,
    canvas.height
  );
  
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Canvas is empty'));
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(reader.result as string);
      };
      reader.readAsDataURL(blob);
    }, mimeType, 0.95); // Use high quality for jpeg
  });
}

const FaceCropModal: React.FC<FaceCropModalProps> = ({ imageState, onClose, onSave }) => {
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const imgRef = useRef<HTMLImageElement>(null);
  const [isDetecting, setIsDetecting] = useState(true);
  const [detectionError, setDetectionError] = useState<string | null>(null);

  async function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    setIsDetecting(true);
    setDetectionError(null);
    const img = e.currentTarget;
    const { width, height } = img;

    try {
      const detection = await window.faceapi.detectSingleFace(img, new window.faceapi.TinyFaceDetectorOptions());
      
      if (detection) {
        const box = detection.box;
        const centerX = box.x + box.width / 2;
        const centerY = box.y + box.height / 2;
        const size = Math.max(box.width, box.height) * 1.5;

        let pixelCrop = {
          unit: 'px' as 'px',
          x: centerX - size / 2,
          y: centerY - size / 2,
          width: size,
          height: size,
        };
        
        // Ensure crop is within image bounds
        if (pixelCrop.x < 0) pixelCrop.x = 0;
        if (pixelCrop.y < 0) pixelCrop.y = 0;
        if (pixelCrop.x + pixelCrop.width > img.naturalWidth) {
          pixelCrop.width = img.naturalWidth - pixelCrop.x;
        }
        if (pixelCrop.y + pixelCrop.height > img.naturalHeight) {
          pixelCrop.height = img.naturalHeight - pixelCrop.y;
        }
        
        const finalCrop = makeAspectCrop(pixelCrop, 1, img.naturalWidth, img.naturalHeight);

        // Convert pixel crop to percent crop for react-image-crop
        const percentCrop: Crop = {
          unit: '%',
          x: (finalCrop.x / img.naturalWidth) * 100,
          y: (finalCrop.y / img.naturalHeight) * 100,
          width: (finalCrop.width / img.naturalWidth) * 100,
          height: (finalCrop.height / img.naturalHeight) * 100,
        };

        setCrop(percentCrop);
      } else {
        setDetectionError("Wajah tidak terdeteksi otomatis. Silakan sesuaikan secara manual.");
        const defaultCrop = centerCrop(
          makeAspectCrop({ unit: '%', width: 50 }, 1, width, height),
          width,
          height
        );
        setCrop(defaultCrop);
      }
    } catch (error) {
      console.error("Face detection failed:", error);
      setDetectionError("Gagal mendeteksi wajah. Silakan sesuaikan secara manual.");
      const defaultCrop = centerCrop(
        makeAspectCrop({ unit: '%', width: 50 }, 1, width, height),
        width,
        height
      );
      setCrop(defaultCrop);
    } finally {
      setIsDetecting(false);
    }
  }

  const handleSaveCrop = async () => {
    if (completedCrop && imgRef.current) {
        try {
            const base64Data = await getCroppedImgBase64(imgRef.current, completedCrop, imageState.mimeType);
            onSave({
                data: base64Data,
                mimeType: imageState.mimeType,
            });
        } catch (error) {
            console.error("Error cropping image:", error);
            onClose();
        }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" aria-modal="true" role="dialog">
      <div className="bg-surface rounded-lg shadow-2xl w-full max-w-lg border border-border-color flex flex-col animate-fadeIn">
        <div className="p-4 border-b border-border-color">
            <h2 className="text-xl font-bold text-white">Fokus pada Wajah Model</h2>
            <p className="text-sm text-text-secondary">Pusatkan dan potong area wajah untuk membantu AI mengenali model secara akurat. Ini akan sangat meningkatkan konsistensi wajah.</p>
        </div>
        <div className="p-4 flex-grow overflow-y-auto bg-brand-bg/50 relative">
             {isDetecting && (
                <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center z-10">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    <p className="text-text-secondary mt-3">Mendeteksi wajah...</p>
                </div>
            )}
             <ReactCrop
                crop={crop}
                onChange={c => setCrop(c)}
                onComplete={c => setCompletedCrop(c)}
                aspect={1}
                minWidth={100}
                minHeight={100}
                circularCrop={true}
              >
                <img ref={imgRef} src={imageState.data} onLoad={onImageLoad} alt="Model face to crop" className="w-full h-auto max-h-[60vh] object-contain" />
             </ReactCrop>
             {detectionError && (
                <div className="mt-3 text-center text-xs bg-yellow-900/50 border border-yellow-700 text-yellow-300 p-2 rounded-md">
                   {detectionError}
                </div>
             )}
        </div>
        <div className="p-4 border-t border-border-color flex justify-end items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-md text-sm font-semibold bg-brand-bg hover:bg-border-color transition-colors"
            >
              Batal
            </button>
            <button
              onClick={handleSaveCrop}
              disabled={!completedCrop?.width || !completedCrop?.height}
              className="px-4 py-2 rounded-md text-sm font-semibold bg-primary text-white hover:bg-primary-focus transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed"
            >
              Simpan Wajah
            </button>
        </div>
      </div>
    </div>
  );
};

export default FaceCropModal;
import React, { useState } from 'react';
import { GoogleGenAI } from '@google/genai';
import { BriefData, VideoPrompt } from '../types';
import { videoPromptSchema } from '../schema';
import { DownloadIcon, CopyIcon, CodeIcon, VideoIcon, RegenerateIcon } from './Icons';
import ImageCropModal from './ImageCropModal';

interface ResultCardProps {
  id: number;
  imageUrl: string | null;
  videoPrompt: BriefData | null;
  isLoading: boolean;
  error: string | null;
  handleApiError: (error: unknown) => boolean;
  onGenerateBrief: (id: number) => void;
  onRegenerateImage: (id: number) => void;
  isNoModelMode: boolean;
}

const ResultCard: React.FC<ResultCardProps> = ({ id, imageUrl, videoPrompt, isLoading, error, handleApiError, onGenerateBrief, onRegenerateImage, isNoModelMode }) => {
  const [showJson, setShowJson] = useState(false);
  const [copied, setCopied] = useState(false);

  const [generatedVideoPrompt, setGeneratedVideoPrompt] = useState<VideoPrompt | null>(null);
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
  const [promptError, setPromptError] = useState<string | null>(null);
  const [promptCopied, setPromptCopied] = useState(false);
  
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);

  const videoPromptString = generatedVideoPrompt ? JSON.stringify(generatedVideoPrompt, null, 2) : '';
  const promptLength = videoPromptString.length;
  const isOverLimit = promptLength > 1000;


  const handleCopyBrief = () => {
    if (videoPrompt) {
      navigator.clipboard.writeText(JSON.stringify(videoPrompt, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyVideoPrompt = () => {
    if (generatedVideoPrompt) {
        navigator.clipboard.writeText(JSON.stringify(generatedVideoPrompt, null, 2));
        setPromptCopied(true);
        setTimeout(() => setPromptCopied(false), 2000);
    }
  }

  const handleDownloadImage = () => {
    if (imageUrl) {
      setImageToCrop(imageUrl);
      setIsCropModalOpen(true);
    }
  };

  const handleDownloadVideoPrompt = () => {
    if (generatedVideoPrompt) {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(generatedVideoPrompt, null, 2));
      const link = document.createElement('a');
      link.href = dataStr;
      link.download = `video-prompt-${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleGenerateVideoPrompt = async () => {
    if (!videoPrompt) {
        setPromptError('Data brief tidak ditemukan untuk membuat prompt video.');
        return;
    }

    setIsGeneratingPrompt(true);
    setPromptError(null);

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

        const baseVoiceoverInstructions = `- **VOICEOVER SCRIPT:** For the 'voice_over.text' field, you must generate a NEW, short, natural-sounding script. The tone MUST be conversational and authentic, like a real content creator sharing a personal discovery. It MUST follow this narrative structure:
    1. **RELATABLE PROBLEM (HOOK):** Start with a common frustration the product solves.
    2. **PAST SKEPTICISM/STRUGGLE:** Briefly mention past beliefs or struggles before the product.
    3. **THE DISCOVERY (PRODUCT):** Introduce the product as the solution.
    4. **EMOTIONAL REACTION (SOFT CTA):** End with a genuine reaction of satisfaction. This is the call-to-action.

- **STYLE REFERENCE (DO NOT COPY, USE FOR TONE/STRUCTURE):** "Baru dandan rapi, eh beberapa jam kemudian mascara udah luntur 😩 Aku pikir semua mascara sama aja, tapi pas coba Inesglam, ternyata beda. Nggak luntur, nggak berat, dan bulu mata tetap lentik seharian. Sumpah, senang banget!”`;

        let generationPrompt: string;
        
        if (isNoModelMode) {
          generationPrompt = `Based on the detailed video brief provided below, generate a new, concise video generation prompt JSON.
This new JSON must strictly adhere to the provided schema.
IMPORTANT: The entire final JSON output MUST be less than 1000 characters long. Be very concise.

**Instructions for PRODUCT-ONLY Video:**
- The 'prompt' field must describe a dynamic, visually appealing scene focusing ONLY on the product.
- The 'style' field MUST primarily include: "clean, no text, no watermark, no popup, no sticker". You can add other style descriptors after these.
${baseVoiceoverInstructions}
- The entire output must be a single, valid JSON object with no extra characters or formatting.

Detailed Brief for context:
${JSON.stringify(videoPrompt)}`;
        } else {
          generationPrompt = `Based on the detailed video brief provided below, generate a new, concise video generation prompt JSON.
This new JSON must strictly adhere to the provided schema.
IMPORTANT: The entire final JSON output MUST be less than 1000 characters long. Be very concise.

**Instructions for Video with Model:**
- The 'prompt' field must be a descriptive paragraph that crafts a compelling visual hook, making it feel authentic and like it's from a real content creator. It MUST include a phrase explicitly stating that the character is lip-syncing to the audio (e.g., 'the influencer is seen lip-syncing to the audio').
- The 'style' field MUST primarily include: "clean, no text, no watermark, no popup, no sticker". You can add other style descriptors after these.
${baseVoiceoverInstructions}
- The entire output must be a single, valid JSON object with no extra characters or formatting.

Detailed Brief for context:
${JSON.stringify(videoPrompt)}`;
        }

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: generationPrompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: videoPromptSchema,
            }
        });

        try {
            const generatedPrompt = JSON.parse(response.text);
            setGeneratedVideoPrompt(generatedPrompt);
        } catch (parseError) {
            console.error("Failed to parse JSON response from AI:", response.text, parseError);
            throw new Error("AI returned invalid JSON format.");
        }

    } catch (e) {
        if (!handleApiError(e)) {
             setPromptError('Gagal membuat prompt video. Silakan coba lagi.');
        }
    } finally {
        setIsGeneratingPrompt(false);
    }
  };
  
  const isImageLoading = isLoading && !imageUrl;
  const isBriefLoading = isLoading && !!imageUrl;
  const needsBriefGeneration = !!imageUrl && !videoPrompt && !isLoading && !error;

  const renderContent = () => {
    if (isBriefLoading) {
      return (
        <div className="space-y-3">
            <div className="h-4 bg-border-color rounded w-3/4 animate-pulse"></div>
            <div className="h-3 bg-border-color rounded w-full animate-pulse"></div>
            <div className="h-3 bg-border-color rounded w-1/2 animate-pulse"></div>
        </div>
      );
    }
    if (error) {
      return <div className="p-4 text-center text-red-400 text-sm">{error}</div>
    }
    if (needsBriefGeneration) {
      return (
        <div className="mt-4 pt-4 border-t border-border-color">
          <button onClick={() => onGenerateBrief(id)} className="w-full flex items-center justify-center text-sm bg-primary/20 text-primary-focus font-bold py-2 px-2 rounded-md hover:bg-primary/40 transition-colors">
            Hasilkan Brief Kreatif
          </button>
        </div>
      );
    }
    if (videoPrompt) {
      return (
          <>
            <div className="flex-grow">
                <h4 className="font-bold text-white">{videoPrompt.title}</h4>
                <p className="text-xs text-text-secondary mt-1 line-clamp-2">{videoPrompt.description}</p>
            </div>
            <div className="mt-4 pt-4 border-t border-border-color space-y-2">
                <div className="grid grid-cols-2 gap-2">
                    <button onClick={handleDownloadImage} className="flex items-center justify-center text-sm bg-green-500/20 text-green-400 font-semibold py-2 px-2 rounded-md hover:bg-green-500/40 transition-colors">
                        <DownloadIcon /> Image
                    </button>
                    <button onClick={() => setShowJson(!showJson)} className="flex items-center justify-center text-sm bg-primary/20 text-primary-focus font-semibold py-2 px-2 rounded-md hover:bg-primary/40 transition-colors">
                       <CodeIcon /> {showJson ? 'Hide' : 'View'} Brief
                    </button>
                </div>
                 {showJson && (
                    <div className="mt-2 relative">
                        <textarea
                            readOnly
                            className="w-full h-40 bg-brand-bg border border-border-color rounded-md p-2 text-xs font-mono resize-none"
                            value={JSON.stringify(videoPrompt, null, 2)}
                        />
                        <button onClick={handleCopyBrief} className="absolute top-2 right-2 flex items-center text-xs bg-surface text-text-secondary px-2 py-1 rounded hover:bg-brand-bg">
                           <CopyIcon /> {copied ? 'Copied!' : 'Copy'}
                        </button>
                    </div>
                )}
                <button onClick={handleGenerateVideoPrompt} disabled={isGeneratingPrompt} className="w-full flex items-center justify-center text-sm bg-blue-500/20 text-blue-400 font-bold py-2 px-2 rounded-md hover:bg-blue-500/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                    <VideoIcon /> {isGeneratingPrompt ? 'Generating...' : 'Generate Video Prompt'}
                </button>
                {isGeneratingPrompt && (
                    <div className="flex items-center justify-center text-center p-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-400"></div>
                        <p className="text-sm text-blue-400 ml-3">Generating JSON...</p>
                    </div>
                )}
                {promptError && <p className="text-red-400 text-xs text-center">{promptError}</p>}
                {generatedVideoPrompt && (
                    <div className="mt-2 relative">
                         <div className="flex justify-between items-center mb-2">
                            <h5 className="text-sm font-semibold text-white">Video Prompt JSON</h5>
                            <span className={`text-xs font-mono ${isOverLimit ? 'text-red-400 font-bold' : 'text-text-secondary'}`}>
                                {promptLength} / 1000
                            </span>
                        </div>
                        <textarea
                            readOnly
                            className="w-full h-40 bg-brand-bg border border-border-color rounded-md p-2 text-xs font-mono resize-none"
                            value={videoPromptString}
                        />
                        <div className="absolute top-8 right-2 flex flex-col gap-2">
                           <button onClick={handleCopyVideoPrompt} className="flex items-center text-xs bg-surface text-text-secondary px-2 py-1 rounded hover:bg-brand-bg">
                                <CopyIcon /> {promptCopied ? 'Copied!' : 'Copy'}
                            </button>
                             <button onClick={handleDownloadVideoPrompt} className="flex items-center text-xs bg-surface text-text-secondary px-2 py-1 rounded hover:bg-brand-bg">
                                <DownloadIcon />
                            </button>
                        </div>
                        {isOverLimit && (
                            <button 
                                onClick={handleGenerateVideoPrompt} 
                                disabled={isGeneratingPrompt}
                                className="w-full mt-2 flex items-center justify-center text-sm bg-yellow-500/20 text-yellow-400 font-bold py-2 px-2 rounded-md hover:bg-yellow-500/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <RegenerateIcon />
                                {isGeneratingPrompt ? 'Regenerating...' : 'Regenerate (Over Limit)'}
                            </button>
                        )}
                    </div>
                )}
            </div>
          </>
      );
    }
    return null;
  }

  return (
    <>
    <div className="bg-surface rounded-lg shadow-lg border border-border-color overflow-hidden flex flex-col animate-fadeIn">
      <div className="w-full aspect-[9/16] bg-brand-bg flex items-center justify-center relative group">
        {isImageLoading && <div className="w-full h-full bg-surface animate-pulse"></div>}
        {error && !imageUrl && <div className="p-4 text-center text-red-400 text-sm">{error}</div>}
        {imageUrl && <img src={imageUrl} alt="Generated content" className="w-full h-full object-cover" />}
        {imageUrl && !isLoading && (
            <button 
                onClick={() => onRegenerateImage(id)} 
                className="absolute top-2 right-2 bg-black/60 p-2 rounded-full text-white opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-primary focus:opacity-100"
                aria-label="Regenerate Image"
                title="Regenerate Image"
            >
                <RegenerateIcon className="h-5 w-5" />
            </button>
        )}
      </div>
      <div className="p-4 flex-grow flex flex-col">
       {renderContent()}
      </div>
    </div>
    {isCropModalOpen && imageToCrop && (
        <ImageCropModal
          imageUrl={imageToCrop}
          onClose={() => setIsCropModalOpen(false)}
        />
    )}
    </>
  );
};

export default ResultCard;
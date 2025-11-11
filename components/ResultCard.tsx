import React, { useState } from 'react';
import { GoogleGenAI } from '@google/genai';
import { BriefData, VideoPrompt } from '../types';
import { videoPromptSchema } from '../schema';
import { DownloadIcon, CopyIcon, CodeIcon, VideoIcon, RegenerateIcon } from './Icons';
import ImageCropModal from './ImageCropModal';

interface ResultCardProps {
  imageUrl: string | null;
  videoPrompt: BriefData | null;
  isLoading: boolean;
  error: string | null;
}

const ResultCard: React.FC<ResultCardProps> = ({ imageUrl, videoPrompt, isLoading, error }) => {
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
    if (!videoPrompt) return;

    setIsGeneratingPrompt(true);
    setPromptError(null);

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

        const voiceOverText = videoPrompt.audio_generation_parameters.voiceover.script_lines
            .map(line => line.text)
            .join(' ');

        const generationPrompt = `Based on the following detailed video brief, generate a new, concise video generation prompt JSON.
This new JSON must strictly adhere to the provided schema.
IMPORTANT: The entire final JSON output MUST be less than 1000 characters long. Be very concise.
- The 'prompt' field must be a descriptive paragraph that crafts a compelling visual hook, making it feel authentic and like it's from a real content creator. It MUST include a phrase explicitly stating that the character is lip-syncing to the voice-over audio (e.g., 'the influencer is seen lip-syncing to the audio').
- The 'voice_over.text' field must be this exact string: "${voiceOverText}"
- Keep all string values concise and engaging.
- The entire output must be a single, valid JSON object with no extra characters or formatting.

Detailed Brief for context:
${JSON.stringify(videoPrompt)}`;

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
        console.error("Video prompt generation failed:", e);
        const errorMessage = e instanceof Error ? e.message : "An unknown error occurred.";
        if (errorMessage.includes('API key not valid') || errorMessage.includes('Requested entity was not found')) {
            setPromptError('Your API key is invalid. Please check your configuration.');
        } else {
            setPromptError(`Failed to generate video prompt. ${errorMessage}`);
        }
    } finally {
        setIsGeneratingPrompt(false);
    }
  };

  return (
    <>
    <div className="bg-surface rounded-lg shadow-lg border border-border-color overflow-hidden flex flex-col animate-fadeIn">
      <div className="w-full aspect-[9/16] bg-brand-bg flex items-center justify-center">
        {isLoading && !imageUrl && !error && <div className="w-full h-full bg-surface animate-pulse"></div>}
        {error && !isLoading && <div className="p-4 text-center text-red-400 text-sm">{error}</div>}
        {imageUrl && <img src={imageUrl} alt="Generated content" className="w-full h-full object-cover" />}
      </div>
      <div className="p-4 flex-grow flex flex-col">
        {isLoading && !videoPrompt ? (
            <div className="space-y-3">
                <div className="h-4 bg-border-color rounded w-3/4 animate-pulse"></div>
                <div className="h-3 bg-border-color rounded w-full animate-pulse"></div>
                <div className="h-3 bg-border-color rounded w-1/2 animate-pulse"></div>
            </div>
        ) : videoPrompt && (
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
        )}
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
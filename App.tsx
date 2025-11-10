
import React, { useState, useEffect } from 'react';
import { GoogleGenAI, Modality } from "@google/genai";
import { BriefData } from './types';
import { briefDataSchema } from './schema';
import ImageUploader from './components/ImageUploader';
import ResultCard from './components/ResultCard';
import { CAMERA_OPTIONS, LOCATION_OPTIONS, MOOD_OPTIONS } from './constants';

// FIX: Removed conflicting global type declaration for 'window.aistudio'.
// The TypeScript error indicates that a declaration for 'window.aistudio'
// already exists in the global scope. This redundant declaration was causing a conflict.
// By removing it, the component will use the existing global type definition.

type ResultItem = {
  id: number;
  imageUrl: string | null;
  videoPrompt: BriefData | null;
  isLoading: boolean;
  error: string | null;
};

type ActiveUploader = 'model' | 'product';
export type ImageState = { data: string; mimeType: string };


const App: React.FC = () => {
  const [modelImage, setModelImage] = useState<ImageState | null>(null);
  const [productImage, setProductImage] = useState<ImageState | null>(null);
  const [results, setResults] = useState<ResultItem[]>([]);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  
  // New state for creative controls
  const [campaignTitle, setCampaignTitle] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [cameraStyle, setCameraStyle] = useState(CAMERA_OPTIONS[0]);
  const [mood, setMood] = useState(MOOD_OPTIONS[0]);
  const [locationType, setLocationType] = useState(LOCATION_OPTIONS[0]);
  const [isStorytellingMode, setIsStorytellingMode] = useState(false);

  // State for enhanced uploader
  const [activeUploader, setActiveUploader] = useState<ActiveUploader>('model');
  const [isDragging, setIsDragging] = useState(false);
  
  const [apiKeyReady, setApiKeyReady] = useState(false);

  useEffect(() => {
    const checkKey = async () => {
        try {
            setApiKeyReady(await window.aistudio.hasSelectedApiKey());
        } catch (e) {
            console.error("aistudio API not available", e);
            setApiKeyReady(false); 
        }
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    try {
        await window.aistudio.openSelectKey();
        setApiKeyReady(true);
    } catch (e) {
        console.error("Could not open API key selection:", e);
    }
  };

  const onApiKeyInvalid = () => {
    setGlobalError('Your API key appears to be invalid. Please select a new one.');
    setApiKeyReady(false);
  };


  const processFile = (file: File, callback: (imageState: ImageState) => void) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      callback({
        data: reader.result as string,
        mimeType: file.type,
      });
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const file = event.clipboardData?.files[0];
      if (file && file.type.startsWith('image/')) {
        event.preventDefault();
        processFile(file, (imageState) => {
          if (activeUploader === 'model') {
            setModelImage(imageState);
          } else {
            setProductImage(imageState);
          }
        });
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('paste', handlePaste);
    };
  }, [activeUploader]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      processFile(file, (imageState) => {
        if (activeUploader === 'model') {
          setModelImage(imageState);
        } else {
          setProductImage(imageState);
        }
      });
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Prevent flickering when dragging over child elements
    if (e.currentTarget.contains(e.relatedTarget as Node)) {
        return;
    }
    setIsDragging(false);
  };


  const handleGenerate = async () => {
    if (!modelImage || !productImage || !campaignTitle || !productDescription) {
      setGlobalError('Please fill in all fields and upload both photos.');
      return;
    }
    setGlobalError(null);
    setIsGenerating(true);
    const initialResults: ResultItem[] = Array.from({ length: 6 }, (_, i) => ({
      id: i,
      imageUrl: null,
      videoPrompt: null,
      isLoading: true,
      error: null,
    }));
    setResults(initialResults);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

      const basePromptInstruction = `Generate a ${mood}, ${locationType} photo with a ${cameraStyle} camera aesthetic. Meticulously analyze the provided model's facial features, hair, and clothing, and the product's design, color, and branding to ensure the generated image is a faithful and accurate representation.`;

      const imagePrompts = isStorytellingMode
        ? [
            `Part 1: A cinematic shot of the influencer unboxing the product, with a look of genuine excitement and anticipation. The product is the clear hero. ${basePromptInstruction}`,
            `Part 2: A close-up, authentic shot of the influencer using the product for the first time. Focus on their reaction and the product in action. ${basePromptInstruction}`,
            `Part 3: A lifestyle shot showing how the product seamlessly integrates into the influencer's daily routine. The setting should feel natural and relatable. ${basePromptInstruction}`,
            `Part 4: An energetic, dynamic shot of the influencer showcasing a key feature or benefit of the product. Convey a sense of fun and effectiveness. ${basePromptInstruction}`,
            `Part 5: A beautifully composed shot of the influencer confidently holding up the product, looking directly at the camera with a satisfied smile. ${basePromptInstruction}`,
            `Part 6: A final call-to-action shot. The influencer points towards the product or gestures invitingly, with the product displayed prominently. ${basePromptInstruction}`
          ]
        : [
            `Create an authentic, informal, Gen Z influencer-style photo. The person is in a bright, airy cafe, naturally holding and showing off the product. ${basePromptInstruction}`,
            `Generate a candid, energetic photo on a vibrant city street. The person is interacting with the product in a dynamic, fun way. ${basePromptInstruction}`,
            `Produce a cozy, 'at-home' style photo. The influencer is relaxing on a sofa, using the product in their daily routine. ${basePromptInstruction}`,
            `Create a sleek, minimalist studio shot. The influencer presents the product against a clean, solid-color background. ${basePromptInstruction}`,
            `Generate an outdoor photo in a park during golden hour. The influencer is smiling, looking happy and confident while showcasing the product. ${basePromptInstruction}`,
            `Produce a 'get ready with me' style photo in a modern bathroom/vanity setting. The influencer is incorporating the product into their morning routine. ${basePromptInstruction}`
          ];
      
      if (isStorytellingMode) {
        let previousScript: string | null = null;
        for (const [index, imageGenPrompt] of imagePrompts.entries()) {
            const result = await generateSingleResult(
                ai,
                imageGenPrompt,
                index,
                modelImage,
                productImage,
                campaignTitle,
                productDescription,
                previousScript
            );
            setResults(prev => prev.map(r => (r.id === result.id ? result : r)));
            if (result.videoPrompt) {
                previousScript = result.videoPrompt.audio_generation_parameters.voiceover.script_lines
                    .map(line => line.text)
                    .join(' ');
            }
        }
      } else {
        const generationPromises = imagePrompts.map((prompt, index) => 
          generateSingleResult(ai, prompt, index, modelImage, productImage, campaignTitle, productDescription, null).then(result => {
              setResults(prev => prev.map(r => (r.id === result.id ? result : r)));
              return result;
          })
        );
        await Promise.all(generationPromises);
      }

    } catch (e) {
      if (e instanceof Error && e.message.includes('Requested entity was not found')) {
        onApiKeyInvalid();
        setResults([]);
      } else {
        console.error(e);
        setGlobalError('An unexpected error occurred during generation. Please check the console.');
        setResults([]);
      }
    } finally {
      setIsGenerating(false);
    }
  };
  
  const generateSingleResult = async (ai: GoogleGenAI, imageGenPrompt: string, index: number, modelImg: ImageState, productImg: ImageState, title: string, description: string, previousScript: string | null = null): Promise<ResultItem> => {
    try {
      const modelPart = { inlineData: { mimeType: modelImg.mimeType, data: modelImg.data.split(',')[1] } };
      const productPart = { inlineData: { mimeType: productImg.mimeType, data: productImg.data.split(',')[1] } };


      const imageResponse = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: { parts: [modelPart, productPart, { text: imageGenPrompt }] },
          config: { responseModalities: [Modality.IMAGE] },
      });
      
      const generatedImagePart = imageResponse.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
      // FIX: Corrected a ReferenceError by using the correct variable 'generatedImagePart' to check for image data.
      if (!generatedImagePart || !generatedImagePart.inlineData?.data) {
        throw new Error("Image data not found in response.");
      }
      const base64Image = generatedImagePart.inlineData.data;
      const mimeType = generatedImagePart.inlineData.mimeType;
      const imageUrl = `data:${mimeType};base64,${base64Image}`;
      
      setResults(prev => prev.map(r => r.id === index ? { ...r, imageUrl, isLoading: true } : r));
      
      let jsonPrompt = `Campaign Title: ${title}. Product Description: ${description}. Based on the image of a Gen Z influencer, create a detailed JSON brief for a short vertical video (TikTok/Reel). The script must be in Indonesian. The entire output must be a single JSON object that strictly follows the provided schema. Ensure the description and script lines are concise.`;

      if (previousScript) {
        jsonPrompt += `\n\nIMPORTANT CONTEXT: This video is part of a sequence. The script for the PREVIOUS video was: "${previousScript}". Please generate a new script that continues this story logically and creatively.`;
      }

      const jsonResponse = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: {
              parts: [
                  { inlineData: { mimeType: mimeType, data: base64Image } },
                  { text: jsonPrompt }
              ]
          },
          config: {
              responseMimeType: "application/json",
              responseSchema: briefDataSchema,
          }
      });
      
      const videoPrompt = JSON.parse(jsonResponse.text);
      return { id: index, imageUrl, videoPrompt, isLoading: false, error: null };

    } catch (error) {
      console.error(`Error generating result ${index}:`, error);
      if (error instanceof Error && error.message.includes('Requested entity was not found')) {
        throw error; // Re-throw to be caught by the main handler
      }
      return { id: index, imageUrl: null, videoPrompt: null, isLoading: false, error: 'Generation failed.' };
    }
  };

  if (!apiKeyReady) {
    return (
        <div className="min-h-screen bg-brand-bg text-text-main flex flex-col items-center justify-center text-center p-8">
            <div className="max-w-md">
                <h1 className="text-3xl font-bold text-white mb-4">Welcome to Affiliate Video Base</h1>
                <p className="text-text-secondary mb-6">To generate creative briefs and visual concepts, you'll need to select a Google AI API key. This key will be used to access the Gemini models.</p>
                <p className="text-text-secondary mb-8">
                    For information on billing and how to set up your key, please visit the{' '}
                    <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-primary-focus underline hover:text-primary">
                        official documentation
                    </a>.
                </p>
                <button
                    onClick={handleSelectKey}
                    className="w-full bg-primary text-white font-bold py-3 px-4 rounded-md hover:bg-primary-focus focus:outline-none focus:ring-2 focus:ring-primary-focus focus:ring-offset-2 focus:ring-offset-surface transition-colors duration-300"
                >
                    Select API Key
                </button>
                 {globalError && <p className="text-red-400 mt-4 text-sm text-center" role="alert">{globalError}</p>}
            </div>
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-bg text-text-main font-sans">
      <header className="py-4 px-8 border-b border-border-color flex justify-between items-center">
        <div className="text-left">
            <h1 className="text-3xl font-bold text-white">Affiliate video base</h1>
            <p className="text-text-secondary mt-1">Generate creative briefs and visual concepts for your affiliate marketing videos.</p>
        </div>
        <button
            onClick={handleSelectKey}
            className="bg-surface text-primary-focus font-semibold py-2 px-4 rounded-md border border-primary hover:bg-primary/20 transition-colors duration-200"
        >
            Change API Key
        </button>
      </header>

      <main className="p-4 md:p-8">
        <div 
            className="max-w-6xl mx-auto bg-surface rounded-lg p-6 shadow-lg border border-border-color"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
        >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                {/* Inputs Column */}
                <div className="space-y-4">
                    <div>
                        <label htmlFor="campaignTitle" className="block text-sm font-semibold mb-2 text-white">Campaign Title</label>
                        <input type="text" id="campaignTitle" value={campaignTitle} onChange={e => setCampaignTitle(e.target.value)} className="w-full bg-brand-bg border border-border-color rounded-md p-2 text-sm focus:ring-2 focus:ring-primary-focus outline-none" placeholder="e.g. Morning Brew & Smartwatch Vibe" />
                    </div>
                    <div>
                        <label htmlFor="productDescription" className="block text-sm font-semibold mb-2 text-white">Product Description</label>
                        <textarea id="productDescription" value={productDescription} onChange={e => setProductDescription(e.target.value)} rows={4} className="w-full bg-brand-bg border border-border-color rounded-md p-2 text-sm resize-none focus:ring-2 focus:ring-primary-focus outline-none" placeholder="e.g. Smartwatch hitam dengan layar bulat, strap silikon, untuk fitness dan daily use." />
                    </div>
                     <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                            <label htmlFor="cameraStyle" className="block text-sm font-semibold mb-2 text-white">Camera Style</label>
                            <select id="cameraStyle" value={cameraStyle} onChange={e => setCameraStyle(e.target.value)} className="w-full bg-brand-bg border border-border-color rounded-md p-2 text-sm focus:ring-2 focus:ring-primary-focus outline-none appearance-none">
                                {CAMERA_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="mood" className="block text-sm font-semibold mb-2 text-white">Mood</label>
                            <select id="mood" value={mood} onChange={e => setMood(e.target.value)} className="w-full bg-brand-bg border border-border-color rounded-md p-2 text-sm focus:ring-2 focus:ring-primary-focus outline-none appearance-none">
                                {MOOD_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="location" className="block text-sm font-semibold mb-2 text-white">Location</label>
                            <select id="location" value={locationType} onChange={e => setLocationType(e.target.value)} className="w-full bg-brand-bg border border-border-color rounded-md p-2 text-sm focus:ring-2 focus:ring-primary-focus outline-none appearance-none">
                                {LOCATION_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                        </div>
                    </div>
                     <div>
                        <label htmlFor="storytelling" className="flex items-center space-x-3 cursor-pointer">
                            <input type="checkbox" id="storytelling" checked={isStorytellingMode} onChange={e => setIsStorytellingMode(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
                            <span className="text-sm font-semibold text-white">Enable Storytelling Mode</span>
                        </label>
                    </div>
                </div>

                {/* Image Uploaders Column */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <ImageUploader 
                        title="Model Photo" 
                        imagePreview={modelImage} 
                        onImageChange={setModelImage} 
                        id="model"
                        isActive={activeUploader === 'model'}
                        onSelect={setActiveUploader}
                        isDragging={isDragging}
                    />
                    <ImageUploader 
                        title="Product Photo" 
                        imagePreview={productImage} 
                        onImageChange={setProductImage}
                        id="product"
                        isActive={activeUploader === 'product'}
                        onSelect={setActiveUploader}
                        isDragging={isDragging}
                    />
                </div>
            </div>

          <button
            onClick={handleGenerate}
            disabled={!modelImage || !productImage || !campaignTitle || !productDescription || isGenerating}
            className="w-full mt-6 bg-primary text-white font-bold py-3 px-4 rounded-md hover:bg-primary-focus focus:outline-none focus:ring-2 focus:ring-primary-focus focus:ring-offset-2 focus:ring-offset-surface transition-colors duration-300 disabled:bg-gray-500 disabled:cursor-not-allowed"
          >
            {isGenerating ? 'Generating Content...' : 'Generate 6 Concepts'}
          </button>
          {globalError && <p className="text-red-400 mt-4 text-sm text-center" role="alert">{globalError}</p>}
        </div>

        {results.length > 0 && (
          <div className="mt-10">
            <h2 className="text-2xl font-bold text-center mb-6 text-white">Generated Concepts</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {results.map(result => (
                <ResultCard key={result.id} {...result} onApiKeyInvalid={onApiKeyInvalid} />
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;

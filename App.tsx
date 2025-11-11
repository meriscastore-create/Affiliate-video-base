
import React, { useState, useEffect } from 'react';
import { GoogleGenAI, Modality } from "@google/genai";
import { BriefData } from './types';
import { briefDataSchema } from './schema';
import ImageUploader from './components/ImageUploader';
import GenerationSidebar from './components/GenerationSidebar';
import FaceCropModal from './components/FaceCropModal';
import { 
  CAMERA_OPTIONS, 
  MOOD_OPTIONS, 
  CAMERA_ANGLE_OPTIONS,
  INDOOR_LOCATIONS,
  OUTDOOR_LOCATIONS,
  PRODUCT_CATEGORIES,
  LOCATION_TYPE_OPTIONS,
  VOICEOVER_STYLE_OPTIONS
} from './constants';

declare global {
  interface Window {
    faceapi: any;
  }
}

export type ResultItem = {
  id: number;
  imageUrl: string | null;
  mimeType: string | null;
  videoPrompt: BriefData | null;
  isLoading: boolean;
  error: string | null;
};

export type ImageState = { data: string; mimeType: string };

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

const App: React.FC = () => {
  const [modelImages, setModelImages] = useState<(ImageState | null)[]>(Array(5).fill(null));
  const [productImages, setProductImages] = useState<(ImageState | null)[]>(Array(6).fill(null));
  const [results, setResults] = useState<ResultItem[]>([]);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  
  const [campaignTitle, setCampaignTitle] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [productReviews, setProductReviews] = useState('');
  const [cameraStyle, setCameraStyle] = useState(CAMERA_OPTIONS[0]);
  const [mood, setMood] = useState(MOOD_OPTIONS[0]);
  const [locationType, setLocationType] = useState(LOCATION_TYPE_OPTIONS[0]);
  const [subLocation, setSubLocation] = useState(INDOOR_LOCATIONS[0]);
  const [productCategory, setProductCategory] = useState(PRODUCT_CATEGORIES[0]);
  const [voiceoverStyle, setVoiceoverStyle] = useState(VOICEOVER_STYLE_OPTIONS[0]);
  const [isStorytellingMode, setIsStorytellingMode] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('buat model tersebut sebagai model utama dan jangan ganti dengan model lainya, termasuk wajah dan posture sebagai penekanan');
  const [isApparel, setIsApparel] = useState(false);
  const [cameraAngle, setCameraAngle] = useState(CAMERA_ANGLE_OPTIONS[0]);
  const [numConcepts, setNumConcepts] = useState(6);
  const [isNoModelMode, setIsNoModelMode] = useState(false);

  const [activeUploader, setActiveUploader] = useState<string>('model-0');
  const [isDragging, setIsDragging] = useState(false);
  
  const [viewMode, setViewMode] = useState<'form' | 'results'>('form');
  const [generationStatus, setGenerationStatus] = useState<string | null>(null);

  // State for face cropping
  const [croppedModelFace, setCroppedModelFace] = useState<ImageState | null>(null);
  const [isFaceCropModalOpen, setIsFaceCropModalOpen] = useState(false);
  const [imageForFaceCrop, setImageForFaceCrop] = useState<ImageState | null>(null);
  
  // State for face-api.js models
  const [faceApiReady, setFaceApiReady] = useState(false);

  // State for regeneration
  const [imagePrompts, setImagePrompts] = useState<string[]>([]);
  const [creativePrompt, setCreativePrompt] = useState('');


  useEffect(() => {
    const loadFaceApiModels = async () => {
      const checkFaceApi = async () => {
        if (window.faceapi) {
          try {
            const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';
            await window.faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
            console.log("FaceAPI models loaded successfully");
            setFaceApiReady(true);
          } catch (error) {
            console.error("Failed to load FaceAPI models:", error);
            setGlobalError("Gagal memuat model deteksi wajah. Fitur pemotongan otomatis mungkin tidak berfungsi.");
          }
        } else {
          setTimeout(checkFaceApi, 100);
        }
      };
      checkFaceApi();
    };
    loadFaceApiModels();
  }, []);

  useEffect(() => {
    if (locationType === 'Indoor') {
      setSubLocation(INDOOR_LOCATIONS[0]);
    } else {
      setSubLocation(OUTDOOR_LOCATIONS[0]);
    }
  }, [locationType]);

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
  
  const handleNoModelToggle = (checked: boolean) => {
    setIsNoModelMode(checked);
    if (checked) {
      setIsStorytellingMode(false);
      setIsApparel(false);
      setModelImages(Array(5).fill(null)); // Clear model images
      setCroppedModelFace(null); // Clear cropped face
    }
  };


  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const file = event.clipboardData?.files[0];
      if (file && file.type.startsWith('image/')) {
        event.preventDefault();
        processFile(file, (imageState) => {
          const [type, indexStr] = activeUploader.split('-');
          const index = parseInt(indexStr, 10);
          if (type === 'model' && !isNoModelMode) {
             handleModelImageChange(imageState, index);
          } else if (type === 'product') {
            handleProductImageChange(imageState, index);
          }
        });
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('paste', handlePaste);
    };
  }, [activeUploader, isNoModelMode]);
  
  const handleModelImageChange = (imageState: ImageState | null, index: number) => {
    setModelImages(prev => {
        const newImages = [...prev];
        newImages[index] = imageState;
        return newImages;
    });

    // Trigger face crop modal ONLY for the main model image (index 0)
    if (index === 0 && imageState) {
        setImageForFaceCrop(imageState);
        setIsFaceCropModalOpen(true);
    } else if (index === 0 && !imageState) {
        // If the main image is cleared, clear the cropped face too
        setCroppedModelFace(null);
    }
  };

  const handleProductImageChange = (imageState: ImageState | null, index: number) => {
    setProductImages(prev => {
        const newImages = [...prev];
        newImages[index] = imageState;
        return newImages;
    });
  };

  const handleFaceCropSave = (croppedImage: ImageState) => {
    setCroppedModelFace(croppedImage);
    setIsFaceCropModalOpen(false);
    setImageForFaceCrop(null);
  };

  const handleFaceCropClose = () => {
    setIsFaceCropModalOpen(false);
    setImageForFaceCrop(null);
  };

  const handleApiError = (error: unknown) => {
      console.error("An API error occurred:", error);
      const errorMessage = error instanceof Error ? error.message.toLowerCase() : '';
      if (errorMessage.includes('api key not valid') || errorMessage.includes('permission denied') || errorMessage.includes('api key is invalid') || errorMessage.includes('requested entity was not found')) {
          setGlobalError('Terjadi masalah dengan Kunci API. Pastikan kunci API telah dikonfigurasi dengan benar di lingkungan.');
          setIsGenerating(false);
          setResults(prev => prev.map(r => r.isLoading ? { ...r, isLoading: false, error: 'Kesalahan Konfigurasi API' } : r));
          setGenerationStatus(null);
          return true; // API key error was handled
      }
      return false; // It was a different error
  }
  
  const handleGenerateBrief = async (id: number) => {
      const resultItem = results.find(r => r.id === id);
      if (!resultItem || !resultItem.imageUrl || !resultItem.mimeType) return;
      
      setResults(prev => prev.map(r => r.id === id ? { ...r, isLoading: true, error: null } : r));
      
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

        let previousScript: string | null = null;
        if (isStorytellingMode && !isNoModelMode) {
            const previousResult = results
                .slice(0, id)
                .reverse()
                .find(r => r.videoPrompt);
            
            if (previousResult && previousResult.videoPrompt) {
                previousScript = previousResult.videoPrompt.audio_generation_parameters.voiceover.script_lines
                    .map(line => line.text)
                    .join(' ');
            }
        }

        let jsonPrompt = `As a creative strategist, create a detailed JSON brief for a short vertical video (TikTok/Reel).
Campaign Title: ${campaignTitle}.
Product Category: ${productCategory}.`;

        if (productDescription.trim()) {
          jsonPrompt += `\nProduct Description: ${productDescription}.`;
        }
        
        jsonPrompt += `\nInstructions:`;
        if(isNoModelMode) {
          jsonPrompt += `\n- This is a PRODUCT-ONLY video. Do not include any people, models, or influencers in the concept.
- The tone must be clean, engaging, and focused on the product's features and aesthetic.`;
        } else {
          jsonPrompt += `\n- The concept should feature an influencer.
- The tone must be conversational, authentic, and relatable (like a real content creator), not a hard-sell advertisement.`
        }

        jsonPrompt += `
- The script must be in Indonesian.
- The entire output must be a single JSON object that strictly follows the provided schema.
- Include creative and fitting suggestions for background music based on the overall mood.
- Ensure the description and script lines are concise and engaging.
- **CRITICAL**: The voiceover script MUST follow this 9-part structure:
    1. HOOK: A scroll-stopping opening line.
    2. PROBLEM: The audience's pain point.
    3. PRODUCT INTRO: Introduce the product.
    4. BENEFIT 1: Main advantage.
    5. BENEFIT 2: Secondary advantage.
    6. DEMO / HOW-TO: Show it in action.
    7. SOCIAL PROOF: A quick testimonial or stat.
    8. OFFER / URGENCY: The deal.
    9. CTA: Call to Action.
- The total length of all combined script lines must be ${voiceoverStyle === 'Simpel' ? 'less than 170 characters for a SIMPLE style.' : 'less than 300 characters for a DETAILED style.'}`;
        
        if (productReviews.trim()) {
          jsonPrompt += `\n\n- INSPIRATION: Use the following customer reviews as strong inspiration for the voiceover script lines (especially for the 'Social Proof' part):\n${productReviews}`;
        }

        if (previousScript) {
          jsonPrompt += `\n\nIMPORTANT CONTEXT: This video is part of a sequence. The script for the PREVIOUS video was: "${previousScript}". Please generate a new script that continues this story logically and creatively.`;
        }

        const jsonResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    { inlineData: { mimeType: resultItem.mimeType, data: resultItem.imageUrl.split(',')[1] } },
                    { text: jsonPrompt }
                ]
            },
            config: {
                responseMimeType: "application/json",
                responseSchema: briefDataSchema,
            }
        });
        
        const videoPrompt = JSON.parse(jsonResponse.text);
        setResults(prev => prev.map(r => r.id === id ? { ...r, videoPrompt, isLoading: false, error: null } : r));
      } catch (error) {
        console.error(`Error generating brief for result ${id}:`, error);
        if (!handleApiError(error)) {
          setResults(prev => prev.map(r => r.id === id ? { ...r, isLoading: false, error: 'Gagal membuat brief.' } : r));
        }
      }
  }

  const generateImage = async (prompt: string, index: number, anchorImage: ImageState | null) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
        const requestParts = [];

        // --- IDENTITY & REFERENCE IMAGES ---
        if (!isNoModelMode) {
            // IMAGE 1 (for prompt): The cropped face is the non-negotiable MASTER REFERENCE for facial geometry.
            if (croppedModelFace) {
                requestParts.push({ inlineData: { mimeType: croppedModelFace.mimeType, data: croppedModelFace.data.split(',')[1] } });
            }
            // IMAGE 2 (for prompt): The main model image provides context for hair, body, etc.
            if (modelImages[0]) {
                 requestParts.push({ inlineData: { mimeType: modelImages[0].mimeType, data: modelImages[0].data.split(',')[1] } });
            }

            // IMAGE 3 (for prompt): For subsequent images, the anchor image becomes a critical reference for style and AI's memory.
            if (anchorImage) { // This condition is only true for index > 0
                requestParts.push({ inlineData: { mimeType: anchorImage.mimeType, data: anchorImage.data.split(',')[1] } });
            }
        }

        // --- PRODUCT IMAGES ---
        const productParts = productImages
            .filter((img): img is ImageState => img !== null)
            .map(img => ({ inlineData: { mimeType: img.mimeType, data: img.data.split(',')[1] } }));
        requestParts.push(...productParts);
        
        // --- TEXT PROMPT ---
        let finalImageGenPrompt = prompt;
        let selectedAngle = cameraAngle;
        if (cameraAngle === 'Random (Auto)' && !isStorytellingMode) {
            selectedAngle = CAMERA_ANGLE_OPTIONS[Math.floor(Math.random() * (CAMERA_ANGLE_OPTIONS.length - 1)) + 1];
        }
        if (selectedAngle !== 'Random (Auto)') {
            finalImageGenPrompt += ` The shot must be a ${selectedAngle}.`;
        }
        requestParts.push({ text: finalImageGenPrompt });

        const imageResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            
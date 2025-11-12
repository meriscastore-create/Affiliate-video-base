import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Modality, Type } from "@google/genai";
import { BriefData } from './types';
import { briefDataSchema, scenePromptsSchema } from './schema';
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
  const [customPrompt, setCustomPrompt] = useState('buat model tersebut sebagai model utama dan jangan ganti dengan model lainya, termasuk wajah dan posture sebagai penekanan\nfokus pengaplikasian ke product\nframe le bih fokus ke model dan product\ntanpa text, tanpa watermark, tanpa sticker');
  const [isApparel, setIsApparel] = useState(false);
  const [cameraAngle, setCameraAngle] = useState(CAMERA_ANGLE_OPTIONS[0]);
  const [numConcepts, setNumConcepts] = useState(6);
  const [isNoModelMode, setIsNoModelMode] = useState(false);
  const [faceReferenceStrength, setFaceReferenceStrength] = useState(100);
  const [productReferenceStrength, setProductReferenceStrength] = useState(100);


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
  
  // Ref for stopping generation
  const isStoppingRef = useRef(false);

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
    1. HOOK: A scroll-stopping opening line that acts as a **problem-solving hook**. It should present a relatable problem that the product solves. (e.g., "Capek kan kalau...", "Pernah gak sih kamu...").
    2. PROBLEM: Briefly elaborate on the pain point introduced in the hook.
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
  
  const generateScenePrompts = async (count: number): Promise<string[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    let creativeDirectorPrompt: string;

    if (isNoModelMode) {
        creativeDirectorPrompt = `You are a world-class Product Photographer's Creative Director.
Your task is to generate ${count} unique, visually stunning concepts for a product-only photoshoot.
The core theme is to make the product look iconic and desirable.
Think about unique environments, lighting, and compositions. DO NOT be generic.

**Product Information:**
- Category: ${productCategory}
- Description: ${productDescription || 'No description provided.'}
- Location Context: ${subLocation}
- Overall Mood: ${mood}

Each concept must be a single, descriptive paragraph.
Your final output MUST be a JSON object that strictly follows the provided schema.`;
    } else {
        creativeDirectorPrompt = `You are an expert Creative Director specializing in authentic, engaging Gen Z influencer content for platforms like TikTok and Instagram Reels.
Your task is to generate ${count} unique, detailed, and visually compelling scene concepts.

**THEME & PERSONA:**
The central theme is **ENTHUSIASTIC & HONEST REVIEW**. The influencer genuinely loves this product and is enthusiastically sharing their excitement with their followers. This is NOT a polished ad. It should feel like a real, candid moment from a content creator's life, showing the product within a familiar, relatable routine.

**Creative Constraints & Inspiration:**
- **Product:** A ${productCategory} described as: "${productDescription || 'No description provided.'}"
- **Location:** The scene MUST take place in a setting like: **${subLocation}**.
- **Overall Mood:** The vibe should be **${mood}**.

**Instructions:**
- Generate ${count} completely different scene ideas.
- Each concept should be a single, descriptive paragraph focusing on the action, environment, and the influencer's enthusiastic expression.
- Emphasize natural interaction with the product.
- DO NOT be generic. DO NOT create boring studio shots. DO NOT repeat ideas.
- Your final output MUST be a JSON object that strictly follows the provided schema.`;
    }

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: creativeDirectorPrompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: scenePromptsSchema,
            }
        });
        const parsed = JSON.parse(response.text);
        return parsed.prompts.map((p: { scene_prompt: string }) => p.scene_prompt);
    } catch (error) {
        console.error("Failed to generate scene prompts:", error);
        handleApiError(error);
        throw new Error("Could not generate creative scenes from AI Director.");
    }
  };


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
        const mainProductImage = productImages.find((img): img is ImageState => img !== null);
        if (mainProductImage) {
            requestParts.push({ inlineData: { mimeType: mainProductImage.mimeType, data: mainProductImage.data.split(',')[1] } });
        }
        
        // --- TEXT PROMPT ---
        requestParts.push({ text: prompt });

        const imageResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: requestParts },
            config: { responseModalities: [Modality.IMAGE] },
        });

        const generatedImagePart = imageResponse.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
        if (!generatedImagePart || !generatedImagePart.inlineData?.data) {
            throw new Error("Data gambar tidak ditemukan dalam respons.");
        }
        const base64Image = generatedImagePart.inlineData.data;
        const mimeType = generatedImagePart.inlineData.mimeType;
        const imageUrl = `data:${mimeType};base64,${base64Image}`;
        
        setResults(prev => prev.map(r => r.id === index ? { ...r, imageUrl, mimeType, isLoading: false } : r));
        return { data: imageUrl, mimeType: mimeType };

    } catch (error) {
        console.error(`Error generating image for result ${index}:`, error);
        if (!handleApiError(error)) {
             setResults(prev => prev.map(r => r.id === index ? { ...r, isLoading: false, error: 'Generasi Gagal. Ini mungkin karena filter keamanan AI. Coba ubah prompt kustom atau gunakan gambar yang berbeda.' } : r));
        }
        return null;
    }
  }

  const getIdentityProtocolPrompt = (hasAnchorImage: boolean, strength: number): string => {
    let faceMatchInstruction: string;
    let primaryObjective: string;

    if (strength >= 95) {
        primaryObjective = `Your most critical task is to perfectly replicate the identity of the person in the reference images. Failure to match the face, especially its unique contour and structure, is a complete failure of the entire task.`;
        faceMatchInstruction = `The generated person's facial features—eyes, nose, mouth, jawline, cheekbones, and especially the overall **facial contour and structure**—MUST be an EXACT, non-negotiable match to the cropped face provided in IMAGE 1. This is the master face template. Study it meticulously.`;
    } else if (strength >= 75) {
        primaryObjective = `Your primary task is to create a person who is immediately and unmistakably recognizable as the model in the reference images. A very high degree of likeness is required.`;
        faceMatchInstruction = `The generated person's facial features MUST be a VERY CLOSE MATCH to the cropped face in IMAGE 1. Prioritize capturing the key **facial contour and structure** (jawline, cheekbones). Minor variations in expression are acceptable, but the core identity must be immediately recognizable.`;
    } else { // 50-74
        primaryObjective = `Your primary task is to create a person who is strongly inspired by the model in the reference images. A clear resemblance is required, but some artistic interpretation is allowed.`;
        faceMatchInstruction = `The generated person's face MUST be STRONGLY INSPIRED by the cropped face in IMAGE 1. A clear resemblance is required, especially in the **facial contour and structure**, but you have artistic freedom for the expression and subtle details. The person should look like a plausible version of the model, not an exact copy.`;
    }
    
    let prompt = `
== CORE IDENTITY PROTOCOL (NON-NEGOTIABLE) ==
1.  **PRIMARY OBJECTIVE:** ${primaryObjective}
2.  **FACE REFERENCE (IMAGE 1):** ${faceMatchInstruction}
3.  **BODY & STYLE REFERENCE (IMAGE 2):** The person's body type, physique, hair style, hair color, and skin tone MUST match the main model photo in IMAGE 2.
`;

    if (hasAnchorImage) {
        prompt += `4. **CONSISTENCY CHECK (IMAGE 3):** The previous image (IMAGE 3) is provided as a reference. Ensure the identity remains perfectly consistent with this last successful generation.\n`;
    }

    prompt += `
== CREATIVE BRIEF (YOUR MAIN TASK) ==
Your creative assignment is to place the person defined above into a completely NEW, unique, and compelling scene as described in the 'SCENE DIRECTIVE' that follows this protocol. The reference images are ONLY for identity, not for creative inspiration.

== FORBIDDEN ACTIONS (STRICTLY ENFORCED) ==
- **DO NOT** copy the pose from any reference image.
- **DO NOT** copy the background, environment, or location from any reference image.
- **DO NOT** copy the lighting style from any reference image.
- **DO NOT** create a simple portrait or studio shot unless the SCENE DIRECTIVE explicitly asks for it. Be creative.
---
`;
    return prompt;
};

const getProductProtocolPrompt = (strength: number): string => {
    const mainProductImage = productImages.find((img): img is ImageState => img !== null);
    if (!mainProductImage) return '';

    let productMatchInstruction: string;
    let primaryObjective: string;

    if (strength >= 95) {
        primaryObjective = `Replikasi produk yang ditampilkan dalam gambar referensi dengan TEPAT dan akurat. Kegagalan dalam mencocokkan model, warna, dan merek spesifik produk adalah kegagalan besar.`;
        productMatchInstruction = `Produk yang ditampilkan dalam adegan HARUS merupakan salinan yang TEPAT dan tidak bisa ditawar dari gambar produk utama yang disediakan. Ini termasuk model, warna, merek, tekstur, dan detail uniknya. Pelajari gambar produk dengan cermat.`;
    } else if (strength >= 75) {
        primaryObjective = `Buat produk yang sangat mirip dan dapat dikenali sebagai produk dalam gambar referensi. Tingkat kemiripan yang sangat tinggi diperlukan.`;
        productMatchInstruction = `Produk yang ditampilkan HARUS SANGAT MIRIP dengan gambar produk utama. Harus jenis produk, warna, dan merek yang sama. Variasi kecil dalam sudut atau pantulan dapat diterima, tetapi identitas inti produk harus identik.`;
    } else { // 50-74
        primaryObjective = `Buat produk yang sangat terinspirasi oleh gambar referensi. Diperlukan kemiripan yang jelas, tetapi beberapa interpretasi artistik diizinkan.`;
        productMatchInstruction = `Produk yang ditampilkan HARUS SANGAT TERINSPIRASI oleh gambar produk utama. Harus kategori dan gaya umum yang sama (misalnya, jam tangan pintar hitam yang tampak serupa), tetapi tidak harus model atau merek yang sama persis. Anda memiliki kebebasan artistik untuk detail halusnya.`;
    }
    
    return `
== PROTOKOL IDENTITAS PRODUK (TIDAK BISA DITAWAR) ==
1.  **TUJUAN UTAMA:** ${primaryObjective}
2.  **REFERENSI PRODUK:** ${productMatchInstruction}
---
`;
};


  const handleStopGeneration = () => {
    isStoppingRef.current = true;
    setGenerationStatus('Menghentikan...');
  };

  const handleGenerate = async () => {
    if ((!isNoModelMode && !modelImages[0]) || !productImages[0] || !campaignTitle) {
      setGlobalError('Mohon isi kolom yang wajib diisi dan unggah foto yang diperlukan (Judul Kampanye, Foto Produk, dan Foto Model kecuali dalam mode Produk Saja).');
      return;
    }
    isStoppingRef.current = false;
    setGlobalError(null);
    setIsGenerating(true);
    const initialResults: ResultItem[] = Array.from({ length: numConcepts }, (_, i) => ({
      id: i,
      imageUrl: null,
      mimeType: null,
      videoPrompt: null,
      isLoading: true,
      error: null,
    }));
    setResults(initialResults);
    setViewMode('results');

    const statusUpdates = [
        'Menganalisis foto model...',
        'Mengekstrak detail wajah & postur...',
        'Menganalisis semua foto produk...',
        'Menghubungi Sutradara AI untuk ide...',
        'Menyusun prompt visual...',
        'Menghubungi AI untuk membuat visual...',
    ];
    
    for (const status of statusUpdates) {
        if (isStoppingRef.current) break;
        setGenerationStatus(status);
        await delay(900);
    }

    try {
      if (!isStoppingRef.current) {
        setGenerationStatus('Sutradara AI sedang menyusun konsep...');
        const prompts = await generateScenePrompts(numConcepts);
        setImagePrompts(prompts);

        let anchorImage: ImageState | null = null;

        for (let i = 0; i < prompts.length; i++) {
          if (isStoppingRef.current) {
              setGenerationStatus('Generasi dihentikan oleh pengguna.');
              setResults(prev => prev.map(r => r.isLoading ? { ...r, isLoading: false, error: 'Dibatalkan' } : r));
              break;
          }

          setGenerationStatus(`Membuat konsep gambar (${i + 1} dari ${numConcepts})...`);
          
          const scenePrompt = prompts[i];
          
          const selectedAngle = (cameraAngle === 'Random (Auto)' && !isStorytellingMode)
              ? CAMERA_ANGLE_OPTIONS[Math.floor(Math.random() * (CAMERA_ANGLE_OPTIONS.length - 1)) + 1]
              : cameraAngle;
          
          const sceneDirective = `
---
**SCENE DIRECTIVE**
- **Core Concept:** ${scenePrompt}
- **Location:** ${subLocation} (This is mandatory).
- **Overall Mood:** ${mood}.
- **Camera Style:** ${cameraStyle}.
- **Camera Angle:** ${selectedAngle === 'Random (Auto)' ? 'As described in concept' : selectedAngle}.
- **Product Focus:** The product (${productCategory}) from the provided images must be clearly and accurately represented. ${isApparel && !isNoModelMode ? 'The model MUST be wearing the product.' : ''}
- **Custom Notes:** ${customPrompt || 'None.'}
---`;
          
          let finalPrompt;
          const productProtocol = getProductProtocolPrompt(productReferenceStrength);

          if (isNoModelMode) {
            finalPrompt = `${productProtocol}${sceneDirective}`;
          } else {
            const identityPrompt = getIdentityProtocolPrompt(!!anchorImage, faceReferenceStrength);
            finalPrompt = `${identityPrompt}${productProtocol}${sceneDirective}`;
          }

          const newImage = await generateImage(finalPrompt, i, anchorImage);
          
          if (isStorytellingMode && newImage) {
            anchorImage = newImage;
          }
        }
      }
    } catch (e) {
      if (!handleApiError(e)) {
        setGlobalError('Terjadi kesalahan tak terduga selama pembuatan. Silakan periksa konsol.');
        setResults([]);
      }
    } finally {
      setIsGenerating(false);
      setGenerationStatus(null);
      isStoppingRef.current = false;
    }
  };

  const handleRegenerateImage = async (id: number) => {
    setResults(prev => prev.map(r => r.id === id ? { ...r, isLoading: true, error: null, imageUrl: null, mimeType: null, videoPrompt: null } : r));
    setIsGenerating(true);
    setGenerationStatus('Sutradara AI sedang memikirkan ide baru...');

    try {
        const anchorImage = (isStorytellingMode && id > 0 && results[0]?.imageUrl && results[0]?.mimeType) 
            ? { data: results[0].imageUrl, mimeType: results[0].mimeType } 
            : null;

        if (isStorytellingMode && id > 0 && !anchorImage) {
            throw new Error("Cannot regenerate storytelling image without a valid anchor image.");
        }
        
        const newScenePrompts = await generateScenePrompts(1);
        const newScenePrompt = newScenePrompts[0];
        
        const newImagePrompts = [...imagePrompts];
        newImagePrompts[id] = newScenePrompt;
        setImagePrompts(newImagePrompts);

        const selectedAngle = (cameraAngle === 'Random (Auto)' && !isStorytellingMode)
            ? CAMERA_ANGLE_OPTIONS[Math.floor(Math.random() * (CAMERA_ANGLE_OPTIONS.length - 1)) + 1]
            : cameraAngle;

        const sceneDirective = `
---
**SCENE DIRECTIVE**
- **Core Concept:** ${newScenePrompt}
- **Location:** ${subLocation} (This is mandatory).
- **Overall Mood:** ${mood}.
- **Camera Style:** ${cameraStyle}.
- **Camera Angle:** ${selectedAngle === 'Random (Auto)' ? 'As described in concept' : selectedAngle}.
- **Product Focus:** The product (${productCategory}) from the provided images must be clearly and accurately represented. ${isApparel && !isNoModelMode ? 'The model MUST be wearing the product.' : ''}
- **Custom Notes:** ${customPrompt || 'None.'}
---`;

        let finalPrompt;
        const productProtocol = getProductProtocolPrompt(productReferenceStrength);

        if (isNoModelMode) {
            finalPrompt = `${productProtocol}${sceneDirective}`;
        } else {
            const identityPrompt = getIdentityProtocolPrompt(!!anchorImage, faceReferenceStrength);
            finalPrompt = `${identityPrompt}${productProtocol}${sceneDirective}`;
        }

        setGenerationStatus(`Membuat ulang gambar ${id + 1}...`);
        await generateImage(finalPrompt, id, anchorImage);
    } catch (e) {
        if (!handleApiError(e)) {
            setResults(prev => prev.map(r => r.id === id ? { ...r, isLoading: false, error: 'Gagal membuat ulang gambar.' } : r));
        }
    } finally {
        setGenerationStatus(null);
        setIsGenerating(false);
    }
  };

  const getButtonText = () => {
    if (!faceApiReady) return 'Mempersiapkan Deteksi Wajah...';
    return 'Hasilkan Konsep';
  };

  return (
    <div className="min-h-screen bg-brand-bg text-text-main font-sans">
      <header className="py-4 px-8 border-b border-border-color flex justify-between items-center sticky top-0 bg-brand-bg/80 backdrop-blur-sm z-10">
        <div className="text-left">
            <h1 className="text-3xl font-bold text-white">Affiliate video base</h1>
            <p className="text-text-secondary mt-1">Buat brief kreatif dan konsep visual untuk video pemasaran afiliasi Anda.</p>
        </div>
      </header>
      
      {isFaceCropModalOpen && imageForFaceCrop && (
        <FaceCropModal
            imageState={imageForFaceCrop}
            onClose={handleFaceCropClose}
            onSave={handleFaceCropSave}
        />
       )}

      <div className={`lg:flex transition-all duration-500 ease-in-out`}>
        <main className={`p-4 md:p-8 transition-all duration-500 ease-in-out w-full ${viewMode === 'results' ? 'lg:w-[45%]' : 'lg:w-full'}`}>
          <div className="max-w-7xl mx-auto bg-surface rounded-lg p-6 shadow-lg border border-border-color">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-6">
                  {/* Inputs Column */}
                  <div className="space-y-4">
                      <div>
                          <label htmlFor="campaignTitle" className="block text-sm font-semibold mb-2 text-white">Judul Kampanye <span className="text-red-500">*</span></label>
                          <input type="text" id="campaignTitle" value={campaignTitle} onChange={e => setCampaignTitle(e.target.value)} className="w-full bg-brand-bg border border-border-color rounded-md p-2 text-sm focus:ring-2 focus:ring-primary-focus outline-none transition-colors" placeholder="cth. Kopi Pagi & Vibe Smartwatch" />
                      </div>
                      <div>
                          <label htmlFor="productCategory" className="block text-sm font-semibold mb-2 text-white">Kategori Produk</label>
                          <select id="productCategory" value={productCategory} onChange={e => setProductCategory(e.target.value)} className="w-full bg-brand-bg border border-border-color rounded-md p-2 text-sm focus:ring-2 focus:ring-primary-focus outline-none appearance-none transition-colors">
                              {PRODUCT_CATEGORIES.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                      </div>
                      <div>
                          <label htmlFor="productDescription" className="block text-sm font-semibold mb-2 text-white">Deskripsi Produk (Opsional)</label>
                          <textarea id="productDescription" value={productDescription} onChange={e => setProductDescription(e.target.value)} rows={3} className="w-full bg-brand-bg border border-border-color rounded-md p-2 text-sm resize-none focus:ring-2 focus:ring-primary-focus outline-none transition-colors" placeholder="cth. Smartwatch hitam dengan layar bulat, tali silikon, untuk kebugaran dan penggunaan sehari-hari." />
                      </div>
                      <div>
                          <label htmlFor="productReviews" className="block text-sm font-semibold mb-2 text-white">Ulasan Produk (Referensi Voiceover)</label>
                          <textarea 
                              id="productReviews" 
                              value={productReviews} 
                              onChange={e => setProductReviews(e.target.value)} 
                              rows={4} 
                              className="w-full bg-brand-bg border border-border-color rounded-md p-2 text-sm resize-none focus:ring-2 focus:ring-primary-focus outline-none transition-colors" 
                              placeholder={"cth.\nKualitasnya top banget, gak nyangka!\nBaterainya awet seharian lebih.\nDesainnya keren, cocok buat OOTD."}
                          />
                      </div>
                      <div>
                          <label htmlFor="customPrompt" className="block text-sm font-semibold mb-2 text-white">Prompt Kreatif Kustom (Opsional)</label>
                          <textarea id="customPrompt" value={customPrompt} onChange={e => setCustomPrompt(e.target.value)} rows={4} className="w-full bg-brand-bg border border-border-color rounded-md p-2 text-sm resize-none focus:ring-2 focus:ring-primary-focus outline-none transition-colors" placeholder="cth. Model tertawa sambil berlari di ladang bunga, memakai jam tangan..." />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div>
                              <label htmlFor="cameraStyle" className="block text-sm font-semibold mb-2 text-white">Gaya Kamera</label>
                              <select id="cameraStyle" value={cameraStyle} onChange={e => setCameraStyle(e.target.value)} className="w-full bg-brand-bg border border-border-color rounded-md p-2 text-sm focus:ring-2 focus:ring-primary-focus outline-none appearance-none transition-colors">
                                  {CAMERA_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                              </select>
                          </div>
                          <div>
                              <label htmlFor="mood" className="block text-sm font-semibold mb-2 text-white">Mood</label>
                              <select id="mood" value={mood} onChange={e => setMood(e.target.value)} className="w-full bg-brand-bg border border-border-color rounded-md p-2 text-sm focus:ring-2 focus:ring-primary-focus outline-none appearance-none transition-colors">
                                  {MOOD_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                              </select>
                          </div>
                          <div>
                              <label htmlFor="voiceoverStyle" className="block text-sm font-semibold mb-2 text-white">Gaya Voiceover</label>
                              <select id="voiceoverStyle" value={voiceoverStyle} onChange={e => setVoiceoverStyle(e.target.value)} className="w-full bg-brand-bg border border-border-color rounded-md p-2 text-sm focus:ring-2 focus:ring-primary-focus outline-none appearance-none transition-colors">
                                  {VOICEOVER_STYLE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                              </select>
                          </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                              <label htmlFor="location" className="block text-sm font-semibold mb-2 text-white">Tipe Lokasi</label>
                              <select id="location" value={locationType} onChange={e => setLocationType(e.target.value)} className="w-full bg-brand-bg border border-border-color rounded-md p-2 text-sm focus:ring-2 focus:ring-primary-focus outline-none appearance-none transition-colors">
                                  {LOCATION_TYPE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                              </select>
                          </div>
                          <div>
                              <label htmlFor="subLocation" className="block text-sm font-semibold mb-2 text-white">Sub-Lokasi</label>
                              <select id="subLocation" value={subLocation} onChange={e => setSubLocation(e.target.value)} className="w-full bg-brand-bg border border-border-color rounded-md p-2 text-sm focus:ring-2 focus:ring-primary-focus outline-none appearance-none transition-colors">
                                  {(locationType === 'Indoor' ? INDOOR_LOCATIONS : OUTDOOR_LOCATIONS).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                              </select>
                          </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                              <label htmlFor="cameraAngle" className="block text-sm font-semibold mb-2 text-white">Sudut Kamera</label>
                              <select id="cameraAngle" value={cameraAngle} onChange={e => setCameraAngle(e.target.value)} className="w-full bg-brand-bg border border-border-color rounded-md p-2 text-sm focus:ring-2 focus:ring-primary-focus outline-none appearance-none transition-colors">
                                  {CAMERA_ANGLE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                              </select>
                          </div>
                          <div>
                              <label htmlFor="numConcepts" className="block text-sm font-semibold mb-2 text-white">Jumlah Konsep</label>
                              <select 
                                  id="numConcepts" 
                                  value={numConcepts} 
                                  onChange={e => setNumConcepts(parseInt(e.target.value, 10))} 
                                  className="w-full bg-brand-bg border border-border-color rounded-md p-2 text-sm focus:ring-2 focus:ring-primary-focus outline-none appearance-none transition-colors"
                              >
                                  {[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n}</option>)}
                              </select>
                          </div>
                      </div>
                      <div>
                          <label htmlFor="faceReferenceStrength" className={`block text-sm font-semibold mb-2 ${isNoModelMode ? 'text-text-secondary' : 'text-white'}`}>
                              Kekuatan Referensi Wajah ({faceReferenceStrength}%)
                          </label>
                          <input
                              type="range"
                              id="faceReferenceStrength"
                              min="50"
                              max="100"
                              value={faceReferenceStrength}
                              onChange={e => setFaceReferenceStrength(parseInt(e.target.value, 10))}
                              disabled={isNoModelMode}
                              className="w-full h-2 bg-border-color rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
                          />
                          <p className={`text-xs text-text-secondary mt-1 ${isNoModelMode ? 'opacity-50' : ''}`}>
                              Kontrol seberapa ketat AI harus mengikuti wajah model. 100% untuk kemiripan yang tepat.
                          </p>
                      </div>
                      <div>
                          <label htmlFor="productReferenceStrength" className={`block text-sm font-semibold mb-2 ${!productImages[0] ? 'text-text-secondary' : 'text-white'}`}>
                              Kekuatan Referensi Produk ({productReferenceStrength}%)
                          </label>
                          <input
                              type="range"
                              id="productReferenceStrength"
                              min="50"
                              max="100"
                              value={productReferenceStrength}
                              onChange={e => setProductReferenceStrength(parseInt(e.target.value, 10))}
                              disabled={!productImages[0]}
                              className="w-full h-2 bg-border-color rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
                          />
                          <p className={`text-xs text-text-secondary mt-1 ${!productImages[0] ? 'opacity-50' : ''}`}>
                              Kontrol seberapa ketat AI harus mengikuti foto produk. 100% untuk duplikasi yang tepat.
                          </p>
                      </div>
                      <div className="flex items-center pt-2 space-x-6">
                          <label htmlFor="isApparel" className="flex items-center space-x-3 cursor-pointer">
                              <input type="checkbox" id="isApparel" checked={isApparel} onChange={e => setIsApparel(e.target.checked)} disabled={isNoModelMode} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary disabled:opacity-50" />
                              <span className={`text-sm font-semibold ${isNoModelMode ? 'text-text-secondary' : 'text-white'}`}>Produk adalah Pakaian</span>
                          </label>
                          <label htmlFor="storytelling" className="flex items-center space-x-3 cursor-pointer">
                              <input type="checkbox" id="storytelling" checked={isStorytellingMode} onChange={e => setIsStorytellingMode(e.target.checked)} disabled={isNoModelMode} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary disabled:opacity-50" />
                              <span className={`text-sm font-semibold ${isNoModelMode ? 'text-text-secondary' : 'text-white'}`}>Mode Bercerita</span>
                          </label>
                          <label htmlFor="noModelMode" className="flex items-center space-x-3 cursor-pointer">
                              <input type="checkbox" id="noModelMode" checked={isNoModelMode} onChange={e => handleNoModelToggle(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
                              <span className="text-sm font-semibold text-white">Produk Saja (Tanpa Model)</span>
                          </label>
                      </div>
                  </div>

                  {/* Image Uploaders Column */}
                  <div className="space-y-6">
                      {!isNoModelMode && (
                        <div>
                          <h3 className="text-lg font-semibold mb-3 text-white">Foto Model <span className="text-red-500">*</span></h3>
                          <div className="grid grid-cols-1 gap-4">
                            <div className="relative">
                                <ImageUploader 
                                    title="Foto Model Utama"
                                    imagePreview={modelImages[0]} 
                                    onImageChange={(img) => handleModelImageChange(img, 0)} 
                                    id="model-0"
                                    isActive={activeUploader === 'model-0'}
                                    onSelect={setActiveUploader}
                                    isDragging={isDragging}
                                    isRequired={true}
                                    containerClassName="h-48"
                                />
                                {croppedModelFace && (
                                    <img 
                                        src={croppedModelFace.data} 
                                        alt="Cropped face" 
                                        className="absolute bottom-2 right-2 h-16 w-16 rounded-full border-2 border-primary object-cover shadow-lg"
                                        title="Wajah yang difokuskan untuk AI"
                                    />
                                )}
                             </div>
                            <div className="grid grid-cols-4 gap-2">
                              {[1, 2, 3, 4].map(i => (
                                <ImageUploader 
                                    key={i}
                                    title={`Opsional ${i}`}
                                    imagePreview={modelImages[i]} 
                                    onImageChange={(img) => handleModelImageChange(img, i)}
                                    id={`model-${i}`}
                                    isActive={activeUploader === `model-${i}`}
                                    onSelect={setActiveUploader}
                                    isDragging={isDragging}
                                    containerClassName="h-20"
                                  />
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                      <div>
                          <h3 className="text-lg font-semibold mb-3 text-white">Foto Produk <span className="text-red-500">*</span></h3>
                          <ImageUploader 
                              title="Foto Produk Utama" 
                              imagePreview={productImages[0]} 
                              onImageChange={(img) => handleProductImageChange(img, 0)}
                              id="product-0"
                              isActive={activeUploader === 'product-0'}
                              onSelect={setActiveUploader}
                              isDragging={isDragging}
                              isRequired={true}
                              containerClassName="h-48"
                          />
                          <div className="grid grid-cols-5 gap-2 mt-2">
                            {[1, 2, 3, 4, 5].map(i => (
                              <ImageUploader 
                                key={i}
                                title={`Opsional ${i}`}
                                imagePreview={productImages[i]} 
                                onImageChange={(img) => handleProductImageChange(img, i)}
                                id={`product-${i}`}
                                isActive={activeUploader === `product-${i}`}
                                onSelect={setActiveUploader}
                                isDragging={isDragging}
                                containerClassName="h-20"
                              />
                            ))}
                          </div>
                      </div>
                  </div>
              </div>
              
              <div className="mt-8 text-center">
                  {!isGenerating ? (
                      <button 
                          onClick={handleGenerate} 
                          disabled={!faceApiReady || ((!isNoModelMode && !modelImages[0]) || !productImages[0] || !campaignTitle)}
                          className="bg-primary text-white font-bold py-3 px-10 rounded-lg text-lg hover:bg-primary-focus focus:outline-none focus:ring-4 focus:ring-primary-focus/50 transition-all duration-300 disabled:bg-gray-600 disabled:cursor-not-allowed shadow-lg hover:shadow-primary/40 disabled:shadow-none transform hover:-translate-y-1"
                      >
                          {getButtonText()}
                      </button>
                  ) : (
                      <button 
                          onClick={handleStopGeneration} 
                          className="bg-red-600 text-white font-bold py-3 px-10 rounded-lg text-lg hover:bg-red-700 focus:outline-none focus:ring-4 focus:ring-red-700/50 transition-all duration-300 shadow-lg hover:shadow-red-600/40 transform hover:-translate-y-1"
                      >
                          Hentikan Generasi
                      </button>
                  )}
                  {globalError && <p className="text-red-400 text-sm mt-4">{globalError}</p>}
              </div>
          </div>
        </main>

        <GenerationSidebar
          isOpen={viewMode === 'results'}
          onClose={() => setViewMode('form')}
          results={results}
          isGenerating={isGenerating}
          generationStatus={generationStatus}
          handleApiError={handleApiError}
          onGenerateBrief={handleGenerateBrief}
          onRegenerateImage={handleRegenerateImage}
          isNoModelMode={isNoModelMode}
        />
      </div>
    </div>
  );
};

export default App;
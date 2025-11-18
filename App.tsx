

// Fix: Corrected the import statement for React and its hooks.
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Modality, Type } from "@google/genai";
import { BriefData } from './types';
import { briefDataSchema, scenePromptsSchema, productAnalysisSchema } from './schema';
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
  VOICEOVER_STYLE_OPTIONS,
  STUDIO_MINI_LOCATIONS
} from './constants';
import { productHandPrompt, productPlacedPrompt } from './prompts';


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

const App: React.FC = () => {
  const [modelImages, setModelImages] = useState<(ImageState | null)[]>(Array(5).fill(null));
  const [productImages, setProductImages] = useState<(ImageState | null)[]>(Array(6).fill(null));
  const [results, setResults] = useState<ResultItem[]>([]);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  
  const [campaignTitle, setCampaignTitle] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [productLink, setProductLink] = useState('');
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
  const [customBackground, setCustomBackground] = useState<ImageState | null>(null);
  const [productPresentationStyle, setProductPresentationStyle] = useState<'hand' | 'placed'>('placed');


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

  // State for product data fetching
  const [isFetchingProductData, setIsFetchingProductData] = useState(false);
  const [productFetchStatus, setProductFetchStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);


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
    } else if (locationType === 'Outdoor') {
      setSubLocation(OUTDOOR_LOCATIONS[0]);
    } else if (locationType === 'Studio Mini') {
      setSubLocation(STUDIO_MINI_LOCATIONS[0]);
    }
  }, [locationType]);
  
  const userCustomPromptRef = useRef(customPrompt);

  // Update user's custom prompt ref whenever it's not one of the special prompts
  useEffect(() => {
      if (customPrompt !== productHandPrompt && customPrompt !== productPlacedPrompt) {
          userCustomPromptRef.current = customPrompt;
      }
  }, [customPrompt]);

  // Automatically set/unset the prompt for "Product Only" mode
  useEffect(() => {
      if (isNoModelMode) {
          if (productPresentationStyle === 'hand') {
              setCustomPrompt(productHandPrompt);
          } else {
              setCustomPrompt(productPlacedPrompt);
          }
      } else {
          // Revert to user's last known prompt when leaving no model mode
          if (customPrompt === productHandPrompt || customPrompt === productPlacedPrompt) {
             setCustomPrompt(userCustomPromptRef.current);
          }
      }
  }, [isNoModelMode, productPresentationStyle]);


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
    } else {
      // When disabling no-model mode, reset selections that are only available in that mode.
      setCustomBackground(null);
      setProductPresentationStyle('placed');
      if (locationType === 'Studio Mini') {
        setLocationType(LOCATION_TYPE_OPTIONS[0]); // Reset to 'Indoor'
      }
      if (cameraAngle === 'Product Close-up') {
        setCameraAngle(CAMERA_ANGLE_OPTIONS[0]); // Reset to first default option
      }
    }
  };


  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const file = event.clipboardData?.files[0];
      if (file && file.type.startsWith('image/')) {
        event.preventDefault();
        processFile(file, (imageState) => {
          if (activeUploader === 'custom-bg' && isNoModelMode) {
            setCustomBackground(imageState);
            return;
          }
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
  
    const handleFetchProductData = async () => {
        if (!productLink || !productLink.startsWith('http')) {
            setProductFetchStatus({ type: 'error', message: 'Harap masukkan URL produk yang valid.' });
            return;
        }

        setIsFetchingProductData(true);
        setProductFetchStatus(null);
        setGlobalError(null);

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            
            const availableCategories = PRODUCT_CATEGORIES.join(', ');
            const analysisPrompt = `You are an expert data extractor for e-commerce, specifically for Shopee links (shopee.co.id, id.shp.ee). Your task is to extract information from the provided URL with extreme precision. Do NOT summarize or rephrase.
            
            URL: ${productLink}
            
            Provide the following details in a JSON format that strictly adheres to the provided schema.
            
            1. **product_name (VITAL):** Copy the product title EXACTLY as it appears on the product page. Do not alter it in any way.
            2. **description (VITAL):** Copy the entire product description text EXACTLY as it appears on the page. Do not summarize, shorten, or rephrase it.
            3. **product_category (VITAL):** Analyze the product and select the single most appropriate category from this exact list: [${availableCategories}]. The output must be one of the strings from this list.
            4. **reviews_summary**: Summarize 2-3 of the most helpful or representative customer reviews. Format them as short, quoted sentences.
            5. **image_search_terms**: Provide 3-4 specific Google search terms for finding high-quality images of this product.

            The entire output must be a single, valid JSON object. The accuracy of 'product_name', 'description', and 'product_category' is your highest priority.`;

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: analysisPrompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: productAnalysisSchema,
                }
            });

            const productData = JSON.parse(response.text);
            
            setCampaignTitle(productData.product_name || '');
            setProductDescription(productData.description || '');
            setProductReviews(productData.reviews_summary || '');
            if (productData.product_category && PRODUCT_CATEGORIES.includes(productData.product_category)) {
                setProductCategory(productData.product_category);
            }
            
            // Clear existing images and prompt user to upload new ones
            setProductImages(Array(6).fill(null));

            const searchTermsText = productData.image_search_terms.join('; ');
            setProductFetchStatus({ type: 'success', message: `Data teks berhasil diambil. Sekarang, silakan unggah gambar produk. Coba cari dengan: "${searchTermsText}"` });

        } catch (error) {
            console.error("Error fetching product data with AI:", error);
            if (!handleApiError(error)) {
                 setProductFetchStatus({ type: 'error', message: 'Gagal menganalisis URL. Pastikan link dapat diakses publik dan coba lagi.' });
            }
        } finally {
            setIsFetchingProductData(false);
        }
    };
  
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
    9. CTA: ${voiceoverStyle === 'Simpel' ? 'This MUST be exactly: "ada diskon 70% via keranjang kiri bawah..!!"' : 'Create a compelling Call to Action.'}
- The total length of all combined script lines must be ${voiceoverStyle === 'Simpel' ? 'less than 175 characters for a SIMPLE style.' : 'less than 300 characters for a DETAILED style.'}`;
        
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
        let presentationContext: string;
        if (customBackground) {
            presentationContext = productPresentationStyle === 'hand'
                ? `The product is presented being held by an elegant, beautiful female hand. This is all set against a custom user-provided background.`
                : `The product is presented placed aesthetically on a custom user-provided background.`;
        } else {
            presentationContext = `The scene takes place in a setting like: ${subLocation}.`;
        }

        creativeDirectorPrompt = `You are a world-class Product Photographer's Creative Director.
Your task is to generate ${count} unique, visually stunning concepts for a product-only photoshoot.
The core theme is to make the product look iconic and desirable.
Think about unique environments, lighting, and compositions. DO NOT be generic.

**Product Information:**
- Category: ${productCategory}
- Description: ${productDescription || 'No description provided.'}
${productLink ? `- Product Link for Analysis: ${productLink}\n` : ''}
- Presentation Context: ${presentationContext}
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
${productLink ? `- Product Link for additional context: ${productLink}\n` : ''}
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
        } else {
             // CRITICAL: Custom background MUST be the first image if provided.
             if (customBackground) {
                requestParts.push({ inlineData: { mimeType: customBackground.mimeType, data: customBackground.data.split(',')[1] } });
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
    } else if (strength >= 80) {
        primaryObjective = `Your primary goal is to create a person who is strongly identifiable as the person in the reference images. Minor deviations are acceptable only if they enhance realism.`;
        faceMatchInstruction = `The generated person's facial features MUST be a very strong likeness to the cropped face in IMAGE 1. Pay close attention to the unique shape of the face and key features.`;
    } else if (strength >= 60) {
        primaryObjective = `Your goal is to generate a person who is clearly inspired by the reference images, maintaining key recognizable traits.`;
        faceMatchInstruction = `Use the cropped face in IMAGE 1 as a strong visual guide. Ensure the generated person shares a clear family resemblance, particularly in hair color, skin tone, and general face shape.`;
    } else {
        primaryObjective = `Your goal is to generate a new, unique person who is loosely inspired by the general aesthetic of the reference images.`;
        faceMatchInstruction = `Use the reference images for general inspiration regarding ethnicity, hair style, and overall vibe. Do NOT attempt to create a direct copy of the face.`;
    }

    const anchorImageInstruction = hasAnchorImage
        ? `Additionally, IMAGE 3 is a previously generated image from this same sequence. Use it as a secondary, but still very important, reference to maintain consistency in style, lighting, and the person's appearance from the previous frame.`
        : '';

    return `\n\n**IDENTITY PROTOCOL (STRENGTH: ${strength}/100):**
${primaryObjective}
- ${faceMatchInstruction}
- IMAGE 2 (the full body shot) provides context for hair style, body type, and overall aesthetic.
- ${anchorImageInstruction}`;
  };

  const getProductProtocolPrompt = (strength: number): string => {
      let productMatchInstruction: string;
      if (strength >= 95) {
          productMatchInstruction = `The product shown in the generated image MUST be an EXACT, pixel-perfect replica of the product in the reference image. Every detail, logo, color, and texture must be identical. No creative liberties are allowed.`;
      } else if (strength >= 80) {
          productMatchInstruction = `The product shown MUST be a very close match to the reference image. It should be immediately identifiable as the same product, allowing for only minor, almost unnoticeable, variations in lighting or angle.`;
      } else {
          productMatchInstruction = `The generated product should be strongly inspired by the reference image in terms of type, shape, and color. It should fit the same category and general design, but can be a different model or have slight variations.`;
      }
      return `\n\n**PRODUCT PROTOCOL (STRENGTH: ${strength}/100):**
- ${productMatchInstruction}`;
  };
  
  const getBackgroundProtocolPrompt = (): string => {
    return `\n\n**BACKGROUND PROTOCOL (CRITICAL INSTRUCTION):**
- The VERY FIRST image provided in the input is the custom background.
- You MUST use this exact image as the background for the final scene.
- DO NOT change, alter, modify, or generate a new background. Your task is to place the product onto this specific background image.
- The final generated image must be a seamless composite. The lighting on the product must realistically match the lighting in the background image.`;
  };

  const constructFinalPrompt = (basePrompt: string, hasAnchorImage: boolean): string => {
      let finalPrompt = basePrompt;
      
      if (!isNoModelMode) {
          finalPrompt += getIdentityProtocolPrompt(hasAnchorImage, faceReferenceStrength);
      }
      
      if (isNoModelMode && customBackground) {
          finalPrompt += getBackgroundProtocolPrompt();
      }

      if (productImages.some(img => img !== null)) {
          finalPrompt += getProductProtocolPrompt(productReferenceStrength);
      }

      finalPrompt += `\n\n**SCENE & STYLE DIRECTIVES:**
- Camera/Lens Style: Recreate the distinct visual signature of a **${cameraStyle}**.
- Camera Angle: ${isApparel ? 'Full Body Shot' : (isNoModelMode && !customBackground ? 'Product Close-up' : cameraAngle)}.
- Mood & Atmosphere: The overall feeling must be **${mood}**.
- Custom Instructions: ${customPrompt}`;

      return finalPrompt;
  };
  
  const handleStop = () => {
      isStoppingRef.current = true;
      setIsGenerating(false);
      setGenerationStatus('Stopping...');
  };

  const handleGenerate = async () => {
    isStoppingRef.current = false;
    setViewMode('results');
    setGlobalError(null);
    setIsGenerating(true);
    setGenerationStatus('Generating creative concepts...');
    
    // Validate inputs
    const mainProductImage = productImages.find(img => img !== null);
    if (!mainProductImage) {
        setGlobalError("Harap unggah setidaknya satu gambar produk.");
        setIsGenerating(false);
        return;
    }
    if (!isNoModelMode && !croppedModelFace) {
        setGlobalError("Harap unggah gambar model dan konfirmasi pemotongan wajah.");
        setIsGenerating(false);
        return;
    }
    
    const initialResults: ResultItem[] = Array.from({ length: numConcepts }, (_, i) => ({
      id: i,
      imageUrl: null,
      mimeType: null,
      videoPrompt: null,
      isLoading: true,
      error: null
    }));
    setResults(initialResults);

    try {
        const prompts = await generateScenePrompts(numConcepts);
        setImagePrompts(prompts); // Save prompts for regeneration
        setGenerationStatus(`Generated ${numConcepts} concepts. Now generating images... (1/${numConcepts})`);
        
        let lastSuccessfulImage: ImageState | null = null;

        for (let i = 0; i < numConcepts; i++) {
            if (isStoppingRef.current) {
                console.log('Stopping generation process.');
                setResults(prev => prev.map(r => r.isLoading ? { ...r, isLoading: false, error: 'Generation stopped by user.' } : r));
                setGenerationStatus(null);
                isStoppingRef.current = false; // Reset for next run
                return;
            }
          
            setGenerationStatus(`Generating image concept ${i + 1} of ${numConcepts}...`);
            const finalPrompt = constructFinalPrompt(prompts[i], i > 0 && lastSuccessfulImage !== null);
            const generatedImageState = await generateImage(finalPrompt, i, lastSuccessfulImage);

            if (generatedImageState) {
                lastSuccessfulImage = generatedImageState;
                 // Delay only if not the last item
                if (i < numConcepts - 1) {
                    await new Promise(res => setTimeout(res, 1000)); 
                }
            } else {
                // If an image fails, we don't update lastSuccessfulImage to avoid propagating a broken style
                 if (i < numConcepts - 1) {
                    await new Promise(res => setTimeout(res, 1000));
                }
            }
        }

        setGenerationStatus(null);

    } catch (error) {
      console.error("An error occurred during the generation process:", error);
      if (!handleApiError(error)) {
        setGlobalError(error instanceof Error ? error.message : "An unknown error occurred.");
      }
      setResults(prev => prev.map(r => r.isLoading ? { ...r, isLoading: false, error: 'Generation failed.' } : r));
      setGenerationStatus(null);
    } finally {
      setIsGenerating(false);
    }
  };
  
  const handleRegenerateImage = async (id: number) => {
    const originalPrompt = imagePrompts[id];
    if (!originalPrompt) {
        console.error(`No original prompt found for regeneration of ID ${id}`);
        setResults(prev => prev.map(r => r.id === id ? { ...r, error: 'Prompt asli tidak ditemukan.' } : r));
        return;
    }

    setResults(prev => prev.map(r => r.id === id ? { ...r, isLoading: true, error: null, videoPrompt: null } : r));

    // Find the last successful image before this one to use as an anchor
    let anchorImage: ImageState | null = null;
    if (id > 0) {
        const previousResult = results.slice(0, id).reverse().find(r => r.imageUrl);
        if (previousResult) {
            anchorImage = { data: previousResult.imageUrl!, mimeType: previousResult.mimeType! };
        }
    }
    
    const finalPrompt = constructFinalPrompt(originalPrompt, !!anchorImage);
    await generateImage(finalPrompt, id, anchorImage);
  };
  
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
       processFile(file, (imageState) => {
         if (activeUploader === 'custom-bg' && isNoModelMode) {
           setCustomBackground(imageState);
           return;
         }
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
  
  const locationDisabled = isNoModelMode && !!customBackground;

  return (
    <div 
        className="flex min-h-screen flex-col lg:flex-row"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
    >
      <main className={`flex-1 p-4 md:p-6 lg:p-8 transition-all duration-300 ${viewMode === 'results' ? 'lg:w-[45%]' : 'w-full'}`}>
        <div className="max-w-3xl mx-auto">
          <header className="mb-8">
            <h1 className="text-3xl md:text-4xl font-extrabold text-white">Affiliate Video Base</h1>
            <p className="text-md md:text-lg text-text-secondary mt-2">Hasilkan brief kreatif dan konsep visual untuk video pemasaran afiliasi Anda.</p>
          </header>
          
          {globalError && (
              <div className="bg-red-900/50 border border-red-700 text-red-300 p-4 rounded-lg mb-6 animate-fadeIn">
                  <p className="font-bold">Terjadi Kesalahan</p>
                  <p className="text-sm">{globalError}</p>
              </div>
          )}

          <div className="space-y-8">
            {/* Section 1: Product Analysis */}
            <section className="bg-surface p-6 rounded-xl border border-border-color">
              <h2 className="text-xl font-bold mb-2 text-white">1. Analisis Produk dari Link</h2>
              <p className="text-sm text-text-secondary mb-6">Mulai dengan menempelkan link produk. AI akan mencoba mengambil gambar, deskripsi, dan ulasan secara otomatis.</p>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                    id="productLink"
                    type="url"
                    value={productLink}
                    onChange={(e) => setProductLink(e.target.value)}
                    className="flex-grow bg-brand-bg border border-border-color rounded-md p-2.5 text-sm focus:ring-2 focus:ring-primary-focus outline-none"
                    placeholder="https://tokopedia.com/..."
                    disabled={isFetchingProductData}
                />
                <button 
                  onClick={handleFetchProductData}
                  disabled={isFetchingProductData}
                  className="flex items-center justify-center sm:w-auto px-5 py-2.5 bg-primary text-white font-bold rounded-md hover:bg-primary-focus transition-colors disabled:bg-gray-600 disabled:cursor-wait"
                >
                  {isFetchingProductData ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Mengambil...
                    </>
                  ) : 'Ambil Data Produk'}
                </button>
              </div>
              {productFetchStatus && (
                <div className={`mt-3 text-sm p-3 rounded-md flex justify-between items-start ${productFetchStatus.type === 'success' ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'}`}>
                    <span className="flex-1 pr-2">{productFetchStatus.message}</span>
                    <button onClick={() => setProductFetchStatus(null)} className="opacity-70 hover:opacity-100">&times;</button>
                 </div>
              )}
            </section>
            
            {/* Section 2: Model & Product Images */}
            <section className="bg-surface p-6 rounded-xl border border-border-color">
              <h2 className="text-xl font-bold mb-2 text-white">2. Unggah Aset Visual</h2>
              <p className="text-sm text-text-secondary mb-6">Sediakan gambar model dan produk Anda. Untuk hasil terbaik, gunakan gambar berkualitas tinggi.</p>

              <div className="space-y-2 mb-6">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isNoModelMode}
                    onChange={(e) => handleNoModelToggle(e.target.checked)}
                    className="h-5 w-5 rounded bg-brand-bg border-border-color text-primary focus:ring-primary-focus"
                  />
                  <span className="font-semibold text-white">Mode "Product Only" (Tanpa Model)</span>
                </label>
                <p className="text-xs text-text-secondary ml-8">Aktifkan untuk menghasilkan konsep yang hanya berfokus pada produk, tanpa model manusia.</p>
              </div>
              
              {!isNoModelMode && (
                <div className="mb-6 animate-fadeIn">
                   <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                     <div className="col-span-2">
                        <ImageUploader
                            title="Gambar Model Utama"
                            imagePreview={modelImages[0]}
                            onImageChange={(img) => handleModelImageChange(img, 0)}
                            id="model-0"
                            isActive={activeUploader === 'model-0'}
                            onSelect={setActiveUploader}
                            isDragging={isDragging}
                            isRequired={!isNoModelMode}
                        />
                        {croppedModelFace && (
                            <div className="mt-2 p-2 bg-brand-bg rounded-lg border border-border-color flex items-center gap-3">
                                <img src={croppedModelFace.data} alt="Cropped face" className="w-12 h-12 rounded-full object-cover border-2 border-primary" />
                                <div className="flex-1">
                                    <p className="text-xs font-semibold text-green-400">Wajah Terdeteksi & Siap</p>
                                    <p className="text-xs text-text-secondary">AI akan menggunakan wajah ini sebagai referensi utama.</p>
                                </div>
                            </div>
                        )}
                     </div>
                     {modelImages.slice(1).map((img, i) => (
                        <ImageUploader
                            key={i+1}
                            title={`Pose ${i+1}`}
                            imagePreview={img}
                            onImageChange={(img) => handleModelImageChange(img, i + 1)}
                            id={`model-${i+1}`}
                            isActive={activeUploader === `model-${i+1}`}
                            onSelect={setActiveUploader}
                            isDragging={isDragging}
                            containerClassName="h-24"
                        />
                     ))}
                  </div>
                </div>
              )}

              <div>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
                  {productImages.map((img, i) => (
                      <ImageUploader
                        key={i}
                        title={`Produk ${i+1}`}
                        imagePreview={img}
                        onImageChange={(img) => handleProductImageChange(img, i)}
                        id={`product-${i}`}
                        isActive={activeUploader === `product-${i}`}
                        onSelect={setActiveUploader}
                        isDragging={isDragging}
                        isRequired={i === 0}
                        containerClassName="h-32"
                      />
                  ))}
                </div>
              </div>
            </section>
            
            {/* Section 3: Product & Campaign Details */}
            <section className="bg-surface p-6 rounded-xl border border-border-color">
              <h2 className="text-xl font-bold mb-2 text-white">3. Detail Produk & Kampanye</h2>
              <p className="text-sm text-text-secondary mb-6">Berikan konteks pada AI tentang apa yang Anda promosikan. Data di bawah ini dapat diisi otomatis dari link.</p>
              <div className="space-y-4">
                <div className="space-y-1">
                    <label htmlFor="campaignTitle" className="block text-sm font-semibold text-white">Judul Kampanye (Opsional)</label>
                    <input
                        id="campaignTitle"
                        type="text"
                        value={campaignTitle}
                        onChange={(e) => setCampaignTitle(e.target.value)}
                        className="w-full bg-brand-bg border border-border-color rounded-md p-2.5 text-sm focus:ring-2 focus:ring-primary-focus outline-none"
                        placeholder="Contoh: Peluncuran Serum Ajaib Musim Panas"/>
                </div>

                <div className="space-y-1">
                    <label htmlFor="productCategory" className="block text-sm font-semibold text-white">Kategori Produk</label>
                    <select
                        id="productCategory"
                        value={productCategory}
                        onChange={(e) => setProductCategory(e.target.value)}
                        className="w-full bg-brand-bg border border-border-color rounded-md p-2.5 text-sm focus:ring-2 focus:ring-primary-focus outline-none">
                        {PRODUCT_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                </div>
                
                <div className="space-y-1">
                    <label htmlFor="productDescription" className="block text-sm font-semibold text-white">Deskripsi Singkat Produk</label>
                    <textarea
                        id="productDescription"
                        value={productDescription}
                        onChange={(e) => setProductDescription(e.target.value)}
                        className="w-full bg-brand-bg border border-border-color rounded-md p-2.5 text-sm focus:ring-2 focus:ring-primary-focus outline-none resize-none"
                        rows={4}
                        placeholder="Contoh: Serum wajah dengan vitamin C dan asam hialuronat untuk mencerahkan kulit dan mengurangi noda hitam."/>
                </div>

                <div className="space-y-1">
                    <label htmlFor="productReviews" className="block text-sm font-semibold text-white">Ulasan Pelanggan (Opsional)</label>
                     <p className="text-xs text-text-secondary">Tempel 1-3 ulasan terbaik. Ini akan sangat membantu AI dalam membuat skrip yang meyakinkan.</p>
                    <textarea
                        id="productReviews"
                        value={productReviews}
                        onChange={(e) => setProductReviews(e.target.value)}
                        className="w-full bg-brand-bg border border-border-color rounded-md p-2.5 text-sm focus:ring-2 focus:ring-primary-focus outline-none resize-none"
                        rows={4}
                        placeholder="Contoh: 'Suka banget sama serumnya, flek hitamku memudar dalam seminggu!' - 'Teksturnya ringan dan cepat meresap, gak lengket sama sekali.'"/>
                </div>
              </div>
            </section>


            {/* Section 4: Creative Direction */}
            <section className="bg-surface p-6 rounded-xl border border-border-color">
              <h2 className="text-xl font-bold mb-2 text-white">4. Arahan Kreatif</h2>
              <p className="text-sm text-text-secondary mb-6">Pandu AI untuk menghasilkan visual yang sesuai dengan visi Anda.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                    <label htmlFor="cameraStyle" className="block text-sm font-semibold text-white">Gaya Kamera & Lensa</label>
                    <select
                        id="cameraStyle"
                        value={cameraStyle}
                        onChange={(e) => setCameraStyle(e.target.value)}
                        className="w-full bg-brand-bg border border-border-color rounded-md p-2.5 text-sm focus:ring-2 focus:ring-primary-focus outline-none">
                        {CAMERA_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                </div>
                <div className="space-y-1">
                    <label htmlFor="mood" className="block text-sm font-semibold text-white">Mood & Suasana</label>
                    <select
                        id="mood"
                        value={mood}
                        onChange={(e) => setMood(e.target.value)}
                        className="w-full bg-brand-bg border border-border-color rounded-md p-2.5 text-sm focus:ring-2 focus:ring-primary-focus outline-none">
                        {MOOD_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                </div>

                <div className="space-y-1">
                    <label htmlFor="locationType" className="block text-sm font-semibold text-white">Tipe Lokasi</label>
                    <select
                        id="locationType"
                        value={locationType}
                        onChange={(e) => setLocationType(e.target.value)}
                        disabled={locationDisabled}
                        className={`w-full bg-brand-bg border border-border-color rounded-md p-2.5 text-sm focus:ring-2 focus:ring-primary-focus outline-none ${locationDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                       {LOCATION_TYPE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                       <option value="Studio Mini">Studio Mini</option>
                    </select>
                     {locationDisabled && <p className="text-xs text-yellow-400 mt-1">Lokasi dinonaktifkan saat menggunakan background kustom.</p>}
                </div>

                <div className="space-y-1">
                    <label htmlFor="subLocation" className="block text-sm font-semibold text-white">Spesifik Lokasi</label>
                    <select
                        id="subLocation"
                        value={subLocation}
                        onChange={(e) => setSubLocation(e.target.value)}
                        disabled={locationDisabled}
                        className={`w-full bg-brand-bg border border-border-color rounded-md p-2.5 text-sm focus:ring-2 focus:ring-primary-focus outline-none ${locationDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        {(locationType === 'Indoor' ? INDOOR_LOCATIONS : locationType === 'Outdoor' ? OUTDOOR_LOCATIONS : STUDIO_MINI_LOCATIONS).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                </div>

                 <div className="space-y-1">
                    <label htmlFor="voiceoverStyle" className="block text-sm font-semibold text-white">Gaya Voiceover</label>
                    <select
                        id="voiceoverStyle"
                        value={voiceoverStyle}
                        onChange={(e) => setVoiceoverStyle(e.target.value)}
                        className="w-full bg-brand-bg border border-border-color rounded-md p-2.5 text-sm focus:ring-2 focus:ring-primary-focus outline-none">
                        {VOICEOVER_STYLE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                </div>

                <div className="space-y-1">
                     <label htmlFor="cameraAngle" className="block text-sm font-semibold text-white">Sudut Kamera</label>
                    <select
                        id="cameraAngle"
                        value={cameraAngle}
                        onChange={(e) => setCameraAngle(e.target.value)}
                        disabled={isApparel}
                        className={`w-full bg-brand-bg border border-border-color rounded-md p-2.5 text-sm focus:ring-2 focus:ring-primary-focus outline-none ${isApparel ? 'opacity-50 cursor-not-allowed' : ''}`}>
                         {isNoModelMode && !customBackground ? 
                            [<option key="product-close-up" value="Product Close-up">Product Close-up</option>] 
                            : CAMERA_ANGLE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                     {isApparel && <p className="text-xs text-yellow-400 mt-1">Otomatis diatur ke "Full Body Shot" untuk Pakaian.</p>}
                </div>

                 <div className="space-y-2 col-span-1 md:col-span-2">
                    <label className="flex items-center space-x-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isStorytellingMode}
                        onChange={(e) => setIsStorytellingMode(e.target.checked)}
                        disabled={isNoModelMode}
                        className="h-5 w-5 rounded bg-brand-bg border-border-color text-primary focus:ring-primary-focus disabled:opacity-50"
                      />
                      <span className={`font-semibold text-white ${isNoModelMode ? 'text-text-secondary' : ''}`}>Mode Storytelling Berkelanjutan</span>
                    </label>
                    <p className={`text-xs ml-8 ${isNoModelMode ? 'text-text-secondary/50' : 'text-text-secondary'}`}>Aktifkan untuk membuat serangkaian video yang saling berhubungan, di mana setiap brief baru akan melanjutkan cerita dari brief sebelumnya.</p>
                </div>

                <div className="space-y-2 col-span-1 md:col-span-2">
                    <label className="flex items-center space-x-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isApparel}
                        onChange={(e) => setIsApparel(e.target.checked)}
                        disabled={isNoModelMode}
                        className="h-5 w-5 rounded bg-brand-bg border-border-color text-primary focus:ring-primary-focus disabled:opacity-50"
                      />
                      <span className={`font-semibold text-white ${isNoModelMode ? 'text-text-secondary' : ''}`}>Mode Pakaian (Apparel)</span>
                    </label>
                    <p className={`text-xs ml-8 ${isNoModelMode ? 'text-text-secondary/50' : 'text-text-secondary'}`}>Optimalkan AI untuk menampilkan produk pakaian dengan pose seluruh badan.</p>
                </div>

                {isNoModelMode && (
                    <div className="col-span-1 md:col-span-2 space-y-4 border-l-4 border-primary pl-4 py-2 mt-2 animate-fadeIn">
                        <h4 className="font-bold text-lg text-primary-focus">Opsi Product-Only</h4>
                        
                        <div>
                            <h3 className="text-sm font-semibold mb-2 text-white">Background Kustom (Opsional)</h3>
                            <ImageUploader
                                title="Background Kustom"
                                imagePreview={customBackground}
                                onImageChange={setCustomBackground}
                                id="custom-bg"
                                isActive={activeUploader === 'custom-bg'}
                                onSelect={setActiveUploader}
                                isDragging={isDragging}
                                containerClassName="h-32"
                            />
                        </div>
                        
                        <div>
                            <h3 className="text-sm font-semibold mb-2 text-white">Gaya Presentasi Produk</h3>
                            <div className="flex gap-4">
                                <label className={`flex-1 flex items-center p-3 rounded-lg cursor-pointer transition-all border-2 ${productPresentationStyle === 'hand' ? 'border-primary bg-primary/10' : 'border-border-color bg-brand-bg'}`}>
                                    <input type="radio" name="presentationStyle" value="hand" checked={productPresentationStyle === 'hand'} onChange={() => setProductPresentationStyle('hand')} className="hidden" />
                                    <div className="ml-2 text-center w-full">
                                        <p className="font-semibold">Dipegang Tangan</p>
                                        <p className="text-xs text-text-secondary">Produk dipegang oleh tangan yang elegan.</p>
                                    </div>
                                </label>
                                <label className={`flex-1 flex items-center p-3 rounded-lg cursor-pointer transition-all border-2 ${productPresentationStyle === 'placed' ? 'border-primary bg-primary/10' : 'border-border-color bg-brand-bg'}`}>
                                    <input type="radio" name="presentationStyle" value="placed" checked={productPresentationStyle === 'placed'} onChange={() => setProductPresentationStyle('placed')} className="hidden" />
                                    <div className="ml-2 text-center w-full">
                                        <p className="font-semibold">Diletakkan</p>
                                        <p className="text-xs text-text-secondary">Produk diletakkan secara estetik.</p>
                                    </div>
                                </label>
                            </div>
                        </div>
                    </div>
                )}


                 <div className="space-y-1 col-span-1 md:col-span-2">
                    <label htmlFor="customPrompt" className="block text-sm font-semibold text-white">Prompt Kustom (Opsi Lanjutan)</label>
                    <textarea
                        id="customPrompt"
                        value={customPrompt}
                        onChange={(e) => setCustomPrompt(e.target.value)}
                        className="w-full bg-brand-bg border border-border-color rounded-md p-2.5 text-sm font-mono focus:ring-2 focus:ring-primary-focus outline-none resize-y"
                        rows={4}
                        placeholder="Tambahkan instruksi spesifik di sini..."/>
                </div>

              </div>
            </section>

            {/* Section 5: Generation Settings */}
            <section className="bg-surface p-6 rounded-xl border border-border-color">
                <h2 className="text-xl font-bold mb-2 text-white">5. Pengaturan Generasi</h2>
                <p className="text-sm text-text-secondary mb-6">Konfigurasikan bagaimana AI menangani gambar referensi Anda.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                    <div className="space-y-2">
                        <label htmlFor="numConcepts" className="block text-sm font-semibold text-white">Jumlah Konsep: {numConcepts}</label>
                        <input
                            id="numConcepts"
                            type="range"
                            min="1"
                            max="10"
                            value={numConcepts}
                            onChange={(e) => setNumConcepts(parseInt(e.target.value, 10))}
                            className="w-full h-2 bg-brand-bg rounded-lg appearance-none cursor-pointer accent-primary"
                        />
                    </div>
                    <div className={`space-y-2 ${isNoModelMode ? 'opacity-50' : ''}`}>
                        <label htmlFor="faceReferenceStrength" className="block text-sm font-semibold text-white">Kekuatan Referensi Wajah: {faceReferenceStrength}%</label>
                        <input
                            id="faceReferenceStrength"
                            type="range"
                            min="50"
                            max="100"
                            step="5"
                            value={faceReferenceStrength}
                            onChange={(e) => setFaceReferenceStrength(parseInt(e.target.value, 10))}
                            disabled={isNoModelMode}
                            className="w-full h-2 bg-brand-bg rounded-lg appearance-none cursor-pointer accent-primary disabled:cursor-not-allowed"
                        />
                        <p className="text-xs text-text-secondary">
                          {faceReferenceStrength > 90 ? 'Sangat ketat, memaksa kemiripan wajah.' : faceReferenceStrength > 70 ? 'Seimbang, kemiripan kuat dengan sedikit fleksibilitas.' : 'Lebih longgar, terinspirasi oleh wajah referensi.'}
                        </p>
                    </div>

                     <div className="space-y-2 col-span-1 md:col-span-2">
                        <label htmlFor="productReferenceStrength" className="block text-sm font-semibold text-white">Kekuatan Referensi Produk: {productReferenceStrength}%</label>
                        <input
                            id="productReferenceStrength"
                            type="range"
                            min="70"
                            max="100"
                            step="5"
                            value={productReferenceStrength}
                            onChange={(e) => setProductReferenceStrength(parseInt(e.target.value, 10))}
                            className="w-full h-2 bg-brand-bg rounded-lg appearance-none cursor-pointer accent-primary"
                        />
                         <p className="text-xs text-text-secondary">
                          {productReferenceStrength > 90 ? 'Sangat ketat, mencoba mereplikasi produk secara persis.' : productReferenceStrength > 75 ? 'Seimbang, kemiripan produk yang kuat.' : 'Lebih longgar, terinspirasi oleh bentuk dan warna produk.'}
                        </p>
                    </div>

                </div>
            </section>

             <div className="mt-8 pt-6 border-t border-border-color">
                {isGenerating ? (
                    <button
                        onClick={handleStop}
                        className="w-full text-center text-lg font-bold py-4 px-6 rounded-lg bg-red-600 text-white shadow-lg hover:bg-red-700 transition-all duration-300"
                    >
                        Hentikan Generasi
                    </button>
                ) : (
                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating}
                        className="w-full text-center text-lg font-bold py-4 px-6 rounded-lg bg-primary text-white shadow-lg hover:bg-primary-focus focus:ring-4 focus:ring-primary-focus/50 transition-all duration-300 disabled:bg-gray-600 disabled:cursor-not-allowed"
                    >
                        Hasilkan Konsep
                    </button>
                )}
            </div>

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

      {isFaceCropModalOpen && imageForFaceCrop && (
          <FaceCropModal 
            imageState={imageForFaceCrop}
            onClose={handleFaceCropClose}
            onSave={handleFaceCropSave}
          />
      )}
      
    </div>
  );
};

export default App;
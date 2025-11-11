import React, { useState, useEffect } from 'react';
import { GoogleGenAI, Modality } from "@google/genai";
import { BriefData } from './types';
import { briefDataSchema } from './schema';
import ImageUploader from './components/ImageUploader';
import GenerationSidebar from './components/GenerationSidebar';
import ApiKeyModal from './components/ApiKeyModal';
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
  
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);

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
  const [customPrompt, setCustomPrompt] = useState('');
  const [isApparel, setIsApparel] = useState(false);
  const [cameraAngle, setCameraAngle] = useState(CAMERA_ANGLE_OPTIONS[0]);
  const [numConcepts, setNumConcepts] = useState(6);
  const [isNoModelMode, setIsNoModelMode] = useState(false);

  const [activeUploader, setActiveUploader] = useState<string>('model-0');
  const [isDragging, setIsDragging] = useState(false);
  
  const [viewMode, setViewMode] = useState<'form' | 'results'>('form');
  const [generationStatus, setGenerationStatus] = useState<string | null>(null);

  useEffect(() => {
    const storedApiKey = localStorage.getItem('gemini-api-key');
    if (storedApiKey) {
      setApiKey(storedApiKey);
    } else {
      setIsApiKeyModalOpen(true);
    }
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
  };

  const handleProductImageChange = (imageState: ImageState | null, index: number) => {
    setProductImages(prev => {
        const newImages = [...prev];
        newImages[index] = imageState;
        return newImages;
    });
  };
  
  const handleSaveApiKey = (key: string) => {
    const trimmedKey = key.trim();
    if (trimmedKey) {
      setApiKey(trimmedKey);
      localStorage.setItem('gemini-api-key', trimmedKey);
      setIsApiKeyModalOpen(false);
      setGlobalError(null); 
    }
  };

  const handleApiError = (error: unknown) => {
      console.error("An API error occurred:", error);
      const errorMessage = error instanceof Error ? error.message.toLowerCase() : '';
      if (errorMessage.includes('api key not valid') || errorMessage.includes('permission denied') || errorMessage.includes('api key is invalid') || errorMessage.includes('requested entity was not found')) {
          setGlobalError('Kunci API Anda tidak valid atau kedaluwarsa. Harap masukkan kunci yang valid dari Google AI Studio.');
          localStorage.removeItem('gemini-api-key');
          setApiKey(null);
          setIsApiKeyModalOpen(true);
          setIsGenerating(false);
          setResults([]);
          setGenerationStatus(null);
          setViewMode('form');
          return true; // API key error was handled
      }
      return false; // It was a different error
  }
  
  const handleGenerateBrief = async (id: number) => {
      if (!apiKey) return;
      const resultItem = results.find(r => r.id === id);
      if (!resultItem || !resultItem.imageUrl || !resultItem.mimeType) return;
      
      setResults(prev => prev.map(r => r.id === id ? { ...r, isLoading: true, error: null } : r));
      
      try {
        const ai = new GoogleGenAI({ apiKey });

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
         if (error instanceof Error && (error.message.includes('API key not valid') || error.message.includes('Requested entity was not found'))) {
          handleApiError(error);
        } else {
          setResults(prev => prev.map(r => r.id === id ? { ...r, isLoading: false, error: 'Gagal membuat brief.' } : r));
        }
      }
  }

  const handleGenerate = async () => {
    if (!apiKey) {
      setGlobalError('Harap atur Kunci API Gemini Anda sebelum membuat.');
      setIsApiKeyModalOpen(true);
      return;
    }
    if ((!isNoModelMode && !modelImages[0]) || !productImages[0] || !campaignTitle) {
      setGlobalError('Mohon isi kolom yang wajib diisi dan unggah foto yang diperlukan (Judul Kampanye, Foto Produk, dan Foto Model kecuali dalam mode Produk Saja).');
      return;
    }
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
        'Menyusun prompt kreatif...',
        'Menghubungi AI untuk membuat visual...',
    ];
    
    for (const status of statusUpdates) {
        setGenerationStatus(status);
        await delay(900);
    }

    try {
      const ai = new GoogleGenAI({ apiKey });

      let creativePrompt = `The overall mood is '${mood}', the location is '${subLocation}', and the camera aesthetic is '${cameraStyle}'. The product category is '${productCategory}'. Analyze ALL provided product images for design, color, and branding to ensure a faithful product representation.`;
      
      if (isApparel && !isNoModelMode) {
        creativePrompt += " The model MUST be wearing the product apparel naturally and stylishly.";
      }
      if (customPrompt) {
        creativePrompt += ` Also, follow these creative directions: ${customPrompt}`;
      }

      const identityConstraint = `
---
NON-NEGOTIABLE CORE DIRECTIVE:
Your primary and most critical task is to create a photorealistic, 100% accurate digital double of the person shown in ALL the provided model photos.
1.  **ANALYZE & SYNTHESIZE:** Analyze every detail from all model images (main and optional) to form a single, consistent composite identity. This includes exact facial features, bone structure, skin tone, hair color, texture, and style, and body type/posture.
2.  **REPLICATE PRECISELY:** The person in the generated image MUST be an identical match to this composite identity. This is not a creative interpretation or "inspired by." It is an exact replication.
3.  **FAILURE CONDITION:** Any change or deviation to the face, hair, or body is a failure. Maintaining the person's identity is more important than any other creative instruction in this prompt.
---`;
      
       const withModelStorytellingPrompts = [
          `Part 1: A cinematic shot of the influencer unboxing the product, with a look of genuine excitement and anticipation. The product is the clear hero.`,
          `Part 2: A close-up, authentic shot of the influencer using the product for the first time. Focus on their reaction and the product in action.`,
          `Part 3: A lifestyle shot showing how the product seamlessly integrates into the influencer's daily routine. The setting should feel natural and relatable.`,
          `Part 4: An energetic, dynamic shot of the influencer showcasing a key feature or benefit of the product. Convey a sense of fun and effectiveness.`,
          `Part 5: A beautifully composed shot of the influencer confidently holding up the product, looking directly at the camera with a satisfied smile.`,
          `Part 6: A final call-to-action shot. The influencer points towards the product or gestures invitingly, with the product displayed prominently.`
        ];

      const withModelSinglePrompts = [
          `Create an authentic, informal, Gen Z influencer-style photo. The person is in a bright, airy cafe, naturally holding and showing off the product.`,
          `Generate a candid, energetic photo on a vibrant city street. The person is interacting with the product in a dynamic, fun way.`,
          `Produce a cozy, 'at-home' style photo. The influencer is relaxing on a sofa, using the product in their daily routine.`,
          `Create a sleek, minimalist studio shot. The influencer presents the product against a clean, solid-color background.`,
          `Generate an outdoor photo in a park during golden hour. The influencer is smiling, looking happy and confident while showcasing the product.`,
          `Produce a 'get ready with me' style photo in a modern bathroom/vanity setting. The influencer is incorporating the product into their morning routine.`
        ];

      const noModelPrompts = [
        `A stunning hero shot of the product against a clean, minimalist background that complements its color palette. Use soft, studio lighting.`,
        `A dynamic, in-context lifestyle shot showing the product on a wooden coffee table next to a steaming mug and an open book. Golden hour lighting.`,
        `An artistic flat lay composition featuring the product, surrounded by elements that evoke its use case (e.g., tech gadgets, makeup brushes, sports gear).`,
        `An extreme close-up (macro) shot focusing on the product's most intricate design detail or texture, highlighting its quality craftsmanship.`,
        `The product unboxed, with its packaging elegantly arranged around it. A sense of premium quality and anticipation.`,
        `A creative shot where the product is interacting with nature, like being placed on a mossy rock or next to a delicate flower, creating a beautiful contrast.`
      ];

      const imagePromptsSource = isNoModelMode
          ? noModelPrompts
          : isStorytellingMode
          ? withModelStorytellingPrompts
          : withModelSinglePrompts;


      const imagePrompts = imagePromptsSource.slice(0, numConcepts).map(scenePrompt => {
        if(isNoModelMode) {
          return `${scenePrompt} ${creativePrompt}`;
        }
        return `${identityConstraint} ${scenePrompt} ${creativePrompt}`;
      });

      const generateImage = async (prompt: string, index: number) => {
        const localAi = new GoogleGenAI({ apiKey });
        try {
            const requestParts = [];
            if (!isNoModelMode) {
                const modelParts = modelImages.filter((img): img is ImageState => img !== null).map(img => ({ inlineData: { mimeType: img.mimeType, data: img.data.split(',')[1] } }));
                requestParts.push(...modelParts);
            }
            const productParts = productImages.filter((img): img is ImageState => img !== null).map(img => ({ inlineData: { mimeType: img.mimeType, data: img.data.split(',')[1] } }));
            requestParts.push(...productParts);
            
            let finalImageGenPrompt = prompt;
            let selectedAngle = cameraAngle;
            if (cameraAngle === 'Random (Auto)' && !isStorytellingMode) {
                selectedAngle = CAMERA_ANGLE_OPTIONS[Math.floor(Math.random() * (CAMERA_ANGLE_OPTIONS.length - 1)) + 1];
            }
            if (selectedAngle !== 'Random (Auto)') {
                finalImageGenPrompt += ` The shot must be a ${selectedAngle}.`;
            }
            requestParts.push({ text: finalImageGenPrompt });

            const imageResponse = await localAi.models.generateContent({
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

        } catch (error) {
            console.error(`Error generating image for result ${index}:`, error);
            if (error instanceof Error && (error.message.includes('API key not valid') || error.message.includes('Requested entity was not found'))) {
                handleApiError(error);
            } else {
                setResults(prev => prev.map(r => r.id === index ? { ...r, isLoading: false, error: 'Generasi Gagal.' } : r));
            }
        }
      }

      const generationPromises = imagePrompts.map((prompt, index) => 
        generateImage(prompt, index)
      );
      await Promise.all(generationPromises);

    } catch (e) {
      const isApiKeyError = handleApiError(e);
      if (!isApiKeyError) {
        setGlobalError('Terjadi kesalahan tak terduga selama pembuatan. Silakan periksa konsol.');
        setResults([]);
      }
    } finally {
      setIsGenerating(false);
      setGenerationStatus(null);
    }
  };

  return (
    <div className="min-h-screen bg-brand-bg text-text-main font-sans">
      <ApiKeyModal
        isOpen={isApiKeyModalOpen}
        onClose={() => { if (apiKey) setIsApiKeyModalOpen(false); }}
        onSave={handleSaveApiKey}
        currentKey={apiKey}
      />
      <header className="py-4 px-8 border-b border-border-color flex justify-between items-center sticky top-0 bg-brand-bg/80 backdrop-blur-sm z-10">
        <div className="text-left">
            <h1 className="text-3xl font-bold text-white">Affiliate video base</h1>
            <p className="text-text-secondary mt-1">Buat brief kreatif dan konsep visual untuk video pemasaran afiliasi Anda.</p>
        </div>
        <div>
            <button onClick={() => setIsApiKeyModalOpen(true)} className="bg-surface hover:bg-border-color text-text-secondary font-semibold py-2 px-4 rounded-lg text-sm transition-colors border border-border-color">
                Atur Kunci API
            </button>
        </div>
      </header>

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
                          <textarea id="customPrompt" value={customPrompt} onChange={e => setCustomPrompt(e.target.value)} rows={3} className="w-full bg-brand-bg border border-border-color rounded-md p-2 text-sm resize-none focus:ring-2 focus:ring-primary-focus outline-none transition-colors" placeholder="cth. Model tertawa sambil berlari di ladang bunga, memakai jam tangan..." />
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
                  <button 
                      onClick={handleGenerate} 
                      disabled={isGenerating || ((!isNoModelMode && !modelImages[0]) || !productImages[0] || !campaignTitle)}
                      className="bg-primary text-white font-bold py-3 px-10 rounded-lg text-lg hover:bg-primary-focus focus:outline-none focus:ring-4 focus:ring-primary-focus/50 transition-all duration-300 disabled:bg-gray-600 disabled:cursor-not-allowed shadow-lg hover:shadow-primary/40 disabled:shadow-none transform hover:-translate-y-1"
                  >
                      {isGenerating ? 'Menghasilkan...' : 'Hasilkan Konsep'}
                  </button>
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
          apiKey={apiKey}
          handleApiError={handleApiError}
          onGenerateBrief={handleGenerateBrief}
        />
      </div>
    </div>
  );
};

export default App;
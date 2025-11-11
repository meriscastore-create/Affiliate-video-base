import React, { useState, useEffect } from 'react';
import { GoogleGenAI, Modality } from "@google/genai";
import { BriefData } from './types';
import { briefDataSchema } from './schema';
import ImageUploader from './components/ImageUploader';
import GenerationSidebar from './components/GenerationSidebar';
import FaceCropModal from './components/FaceCropModal';
import ApiKeyModal from './components/ApiKeyModal';
import { KeyIcon } from './components/Icons';
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
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);

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
    const storedApiKey = localStorage.getItem('gemini-api-key');
    if (storedApiKey) {
      setApiKey(storedApiKey);
    } else {
      setIsApiKeyModalOpen(true);
    }
  }, []);

  const handleSaveApiKey = (newKey: string) => {
    setApiKey(newKey);
    localStorage.setItem('gemini-api-key', newKey);
    setIsApiKeyModalOpen(false);
    setGlobalError(null); 
  };

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
      const errorMessage = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
      
      if (errorMessage.includes('api key not valid') || errorMessage.includes('permission denied') || errorMessage.includes('api key is invalid') || errorMessage.includes('api_key_not_valid') || errorMessage.includes('requested entity was not found')) {
          setGlobalError('Kunci API Anda tidak valid. Silakan periksa dan masukkan kunci yang benar dari Google AI Studio.');
          setIsApiKeyModalOpen(true); // Re-open the modal
          setIsGenerating(false);
          setResults(prev => prev.map(r => r.isLoading ? { ...r, isLoading: false, error: 'Kunci API tidak valid' } : r));
          setGenerationStatus(null);
          return true; // API key error was handled
      }
      return false; // It was a different error
  }
  
  const handleGenerateBrief = async (id: number) => {
      if (!apiKey) {
          setIsApiKeyModalOpen(true);
          return;
      }

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
        if (!handleApiError(error)) {
          setResults(prev => prev.map(r => r.id === id ? { ...r, isLoading: false, error: 'Gagal membuat brief.' } : r));
        }
      }
  }

  const generateImage = async (prompt: string, index: number, anchorImage: ImageState | null) => {
    if (!apiKey) {
      setIsApiKeyModalOpen(true);
      return null;
    }

    const ai = new GoogleGenAI({ apiKey });
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
        // ONLY send the primary product image to reduce payload size and complexity.
        if (productImages[0]) {
            requestParts.push({ inlineData: { mimeType: productImages[0].mimeType, data: productImages[0].data.split(',')[1] } });
        }
        
        // --- TEXT PROMPT ---
        let finalImageGenPrompt = prompt;
        let selectedAngle = cameraAngle;
        if (cameraAngle === 'Random (Auto)' && !isStorytellingMode) {
            selectedAngle = CAMERA_ANGLE_OPTIONS[Math.floor(Math.random() * (CAMERA_ANGLE_OPTIONS.length - 1)) + 1];
        }
        if (selectedAngle !== 'Random (Auto)') {
            finalImageGenPrompt += ` Sudut kamera: ${selectedAngle}.`;
        }
        requestParts.push({ text: finalImageGenPrompt });

        const imageResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: requestParts },
            config: { responseModalities: [Modality.IMAGE] },
        });

        const generatedImagePart = imageResponse.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
        if (!generatedImagePart || !generatedImagePart.inlineData?.data) {
            throw new Error("Data gambar tidak ditemukan dalam respons. Ini mungkin karena filter keamanan.");
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

  const getIdentityProtocolPrompt = (hasAnchorImage: boolean): string => {
    let prompt = `**PERINTAH KETAT:** Ciptakan ulang orang dari foto referensi ke dalam adegan baru.
- **WAJAH:** Harus sama persis dengan gambar wajah yang dipotong. Ini adalah prioritas utama.
- **TUBUH & GAYA:** Harus cocok dengan tipe tubuh dan gaya rambut dari gambar seluruh tubuh.
- **JANGAN SALIN:** Jangan meniru pose, pencahayaan, atau latar belakang dari foto referensi. Buat adegan yang sepenuhnya baru.
`;

    if (hasAnchorImage) {
        prompt += `- **KONSISTENSI:** Orang yang dihasilkan juga harus cocok dengan orang di gambar 'jangkar' (gambar pertama yang berhasil dibuat). Ini adalah referensi visual Anda.
`;
    }

    prompt += `
Tempatkan orang yang konsisten ini dalam adegan berikut:`;

    return prompt;
};

  const handleGenerate = async () => {
    if (!apiKey) {
      setIsApiKeyModalOpen(true);
      setGlobalError('Silakan masukkan Kunci API Gemini Anda untuk memulai.');
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
        'Menganalisis foto produk utama...',
        'Menyusun prompt kreatif...',
        'Menghubungi AI untuk membuat visual...',
    ];
    
    for (const status of statusUpdates) {
        setGenerationStatus(status);
        await delay(900);
    }

    try {
      const creativePromptBase = `Lokasi: '${subLocation}'. Suasana: '${mood}'. Gaya Kamera: '${cameraStyle}'. Kategori Produk: '${productCategory}'. Analisis gambar produk yang disediakan untuk desain dan warna yang akurat.`;
      
      let finalCreativePrompt = creativePromptBase;
      if (isApparel && !isNoModelMode) {
        finalCreativePrompt += " Model harus mengenakan produk pakaian.";
      }
      if (customPrompt) {
        finalCreativePrompt += ` Arahan tambahan: ${customPrompt}`;
      }
      setCreativePrompt(finalCreativePrompt);
      
      const withModelStorytellingPrompts = [
          `Model pertama kali menemukan produk. Ekspresi: Penasaran, tertarik. Pencahayaan: Cerah, ramah.`,
          `Close-up detail tangan model yang berinteraksi dengan produk. Fokus pada tekstur dan kualitas produk.`,
          `Medium shot model menunjukkan kegembiraan tulus saat menggunakan produk.`,
          `Full body shot dinamis, model aktif menggunakan produk, menunjukkan energi dan gerakan.`,
          `Medium close-up percaya diri, model memegang produk ke arah kamera, tersenyum, kontak mata langsung.`,
          `Wide shot gaya hidup, produk terintegrasi secara alami di lingkungan model.`
        ];

      const withModelSinglePrompts = [
          `Model duduk di lantai, menata produk dengan properti seperti buku atau kopi. Pencahayaan: Lembut, alami.`,
          `Medium close-up dinamis, model tertawa sambil memegang produk, melihat ke kamera.`,
          `Full body shot percaya diri, model berdiri dan berinteraksi dengan lingkungan, produk terlihat jelas.`,
          `Artistik close-up produk, dengan pantulan wajah model di permukaan terdekat (cermin, jendela).`,
          `Candid shot, model sedang membaca atau menulis, produk ditempatkan secara alami dalam adegan.`,
          `Shot gerakan dinamis, menangkap model di tengah aksi, menunjukkan energi.`
        ];

      const noModelPrompts = [
        `Product hero shot. Latar belakang: bersih, minimalis. Pencahayaan: studio, lembut.`,
        `Produk dalam konteks gaya hidup. Di atas meja kopi kayu, di samping cangkir dan buku. Pencahayaan: Golden hour.`,
        `Komposisi flat lay artistik. Produk dikelilingi oleh elemen yang relevan (gadget, kuas makeup, dll).`,
        `Extreme close-up (makro) pada detail desain atau tekstur produk. Menyoroti kualitas.`,
        `Produk baru dibuka, dengan kemasan yang ditata elegan di sekitarnya. Kesan: premium.`,
        `Shot kreatif, produk berinteraksi dengan alam (di atas batu berlumut, di samping bunga).`
      ];

      const imagePromptsSource = isNoModelMode
          ? noModelPrompts
          : isStorytellingMode
          ? withModelStorytellingPrompts
          : withModelSinglePrompts;
      
      const prompts = imagePromptsSource.slice(0, numConcepts);
      setImagePrompts(prompts);

      // --- SEQUENTIAL GENERATION WITH ANCHOR IMAGE ---
      let anchorImage: ImageState | null = null;

      for (let i = 0; i < prompts.length; i++) {
        setGenerationStatus(`Membuat konsep gambar (${i + 1} dari ${numConcepts})...`);
        
        const scenePrompt = prompts[i];
        let finalPrompt;

        if (isNoModelMode) {
          finalPrompt = `${scenePrompt} ${finalCreativePrompt}`;
        } else {
          const identityPrompt = getIdentityProtocolPrompt(!!anchorImage);
          finalPrompt = `${identityPrompt} ${scenePrompt} ${finalCreativePrompt}`;
        }

        const newImage = await generateImage(finalPrompt, i, anchorImage);
        
        if (newImage === null) {
          // An error occurred (e.g., bad API key), stop the whole process.
          break;
        }

        if (i === 0 && newImage) {
          anchorImage = newImage;
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
    }
  };

  const handleRegenerateImage = async (id: number) => {
    setResults(prev => prev.map(r => r.id === id ? { ...r, isLoading: true, error: null, imageUrl: null, mimeType: null, videoPrompt: null } : r));
    setIsGenerating(true);

    const anchorImage = (id > 0 && results[0]?.imageUrl && results[0]?.mimeType) 
        ? { data: results[0].imageUrl, mimeType: results[0].mimeType } 
        : null;

    if (id > 0 && !anchorImage) {
        console.error("Cannot regenerate image without a valid anchor image.");
        setResults(prev => prev.map(r => r.id === id ? { ...r, isLoading: false, error: 'Butuh anchor image.' } : r));
        setIsGenerating(false);
        return;
    }

    const scenePrompt = imagePrompts[id];
    let finalPrompt;

    if (isNoModelMode) {
        finalPrompt = `${scenePrompt} ${creativePrompt}`;
    } else {
        const identityPrompt = getIdentityProtocolPrompt(!!anchorImage);
        finalPrompt = `${identityPrompt} ${scenePrompt} ${creativePrompt}`;
    }

    setGenerationStatus(`Membuat ulang gambar ${id + 1}...`);
    const newImage = await generateImage(finalPrompt, id, anchorImage);
    
    if (newImage === null) {
      // API error handled inside generateImage, just stop here.
      setIsGenerating(false);
      setGenerationStatus(null);
      return;
    }

    if (id === 0 && newImage) {
        const newAnchor = newImage;
        for (let i = 1; i < numConcepts; i++) {
            setGenerationStatus(`Membuat ulang konsep (${i + 1} dari ${numConcepts}) dengan anchor baru...`);
            const subsequentScenePrompt = imagePrompts[i];
            const identityPrompt = getIdentityProtocolPrompt(true);
            const subsequentFinalPrompt = `${identityPrompt} ${subsequentScenePrompt} ${creativePrompt}`;
            const result = await generateImage(subsequentFinalPrompt, i, newAnchor);
            if (result === null) break;
        }
    }
    setGenerationStatus(null);
    setIsGenerating(false);
  };

  const getButtonText = () => {
    if (isGenerating) return 'Menghasilkan...';
    if (!faceApiReady) return 'Mempersiapkan Deteksi Wajah...';
    if (!apiKey) return 'Setel Kunci API untuk Memulai';
    return 'Hasilkan Konsep';
  };

  const isGenerateDisabled = isGenerating || !faceApiReady || !apiKey || ((!isNoModelMode && !modelImages[0]) || !productImages[0] || !campaignTitle);

  return (
    <div className="min-h-screen bg-brand-bg text-text-main font-sans">
      <ApiKeyModal 
        isOpen={isApiKeyModalOpen}
        onClose={() => setIsApiKeyModalOpen(false)}
        onSave={handleSaveApiKey}
        currentKey={apiKey}
      />
      <header className="py-4 px-8 border-b border-border-color flex justify-between items-center sticky top-0 bg-brand-bg/80 backdrop-blur-sm z-20">
        <div className="text-left">
            <h1 className="text-3xl font-bold text-white">Affiliate video base</h1>
            <p className="text-text-secondary mt-1">Buat brief kreatif dan konsep visual untuk video pemasaran afiliasi Anda.</p>
        </div>
        <button 
          onClick={() => setIsApiKeyModalOpen(true)}
          className="flex items-center bg-surface px-4 py-2 rounded-lg text-sm font-semibold hover:bg-primary/20 hover:text-primary-focus focus:outline-none focus:ring-2 focus:ring-primary-focus transition-colors"
        >
          <KeyIcon className="h-5 w-5 mr-2" />
          Setel Kunci API
        </button>
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
                  <button 
                      onClick={handleGenerate} 
                      disabled={isGenerateDisabled}
                      className="bg-primary text-white font-bold py-3 px-10 rounded-lg text-lg hover:bg-primary-focus focus:outline-none focus:ring-4 focus:ring-primary-focus/50 transition-all duration-300 disabled:bg-gray-600 disabled:cursor-not-allowed shadow-lg hover:shadow-primary/40 disabled:shadow-none transform hover:-translate-y-1"
                  >
                      {getButtonText()}
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
          handleApiError={handleApiError}
          onGenerateBrief={handleGenerateBrief}
          onRegenerateImage={handleRegenerateImage}
          apiKey={apiKey}
        />
      </div>
    </div>
  );
};

export default App;
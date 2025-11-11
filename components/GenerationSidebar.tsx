import React from 'react';
import { ResultItem } from '../App';
import ResultCard from './ResultCard';
import { CloseIcon } from './Icons';

interface GenerationSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  results: ResultItem[];
  isGenerating: boolean;
  generationStatus: string | null;
}

const GenerationStatus: React.FC<{ status: string | null }> = ({ status }) => (
  <div className="text-center mb-8 p-4 bg-brand-bg rounded-lg border border-border-color">
    <div className="flex items-center justify-center">
      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary mr-3"></div>
      <p key={status} className="text-lg text-text-secondary animate-fadeIn">
        {status || 'Mempersiapkan...'}
      </p>
    </div>
  </div>
);

const GenerationSidebar: React.FC<GenerationSidebarProps> = ({ 
    isOpen, 
    onClose, 
    results, 
    isGenerating, 
    generationStatus 
}) => {
  return (
    <>
      <div 
        className={`fixed inset-0 bg-black/60 z-30 transition-opacity duration-300 lg:hidden ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} 
        onClick={onClose} 
        aria-hidden="true"
      />
      
      <aside className={`fixed top-0 right-0 h-full bg-surface shadow-2xl z-40 transition-transform duration-500 ease-in-out transform flex flex-col
                         w-full lg:w-[55%]
                         ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        
        <div className="p-4 flex justify-between items-center border-b border-border-color flex-shrink-0">
          <h2 className="text-xl font-bold text-white">Konsep yang Dihasilkan</h2>
          <button 
            onClick={onClose} 
            className="p-2 rounded-full text-text-secondary hover:bg-brand-bg hover:text-white transition-colors"
            aria-label="Tutup sidebar"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {isGenerating && <GenerationStatus status={generationStatus} />}
          
          {results.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {results.map(result => (
                <ResultCard 
                  key={result.id} 
                  imageUrl={result.imageUrl} 
                  videoPrompt={result.videoPrompt} 
                  isLoading={result.isLoading}
                  error={result.error}
                />
              ))}
            </div>
          ) : (
            !isGenerating && (
                 <div className="flex items-center justify-center h-full">
                    <p className="text-text-secondary">Hasil generasi akan muncul di sini.</p>
                </div>
            )
          )}
        </div>
      </aside>
    </>
  );
};

export default GenerationSidebar;

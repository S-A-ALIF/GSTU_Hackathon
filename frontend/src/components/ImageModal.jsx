import { useEffect, useState } from 'react';

export default function ImageModal({ imageUrl, onClose }) {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
    return () => {
        window.removeEventListener('keydown', handleEsc);
        document.body.style.overflow = 'unset';
    };
  }, [onClose]);

  if (!imageUrl) return null;

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div className="relative w-full max-w-4xl h-full max-h-[90vh] flex items-center justify-center p-2">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-300 border-t-white"></div>
          </div>
        )}
        <img 
          src={imageUrl} 
          alt="Full size" 
          className={`max-w-full max-h-full object-contain rounded-lg shadow-2xl transition-opacity duration-300 cursor-zoom-out ${isLoading ? 'opacity-0' : 'opacity-100'}`}
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          onLoad={() => setIsLoading(false)}
        />
      </div>
    </div>
  );
}

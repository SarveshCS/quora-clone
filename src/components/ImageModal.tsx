import React, { useEffect } from 'react';
import { FiX, FiMaximize2, FiMinimize2 } from 'react-icons/fi';

interface ImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  src: string;
  alt?: string;
  title?: string;
}

export const ImageModal: React.FC<ImageModalProps> = ({
  isOpen,
  onClose,
  src,
  alt = 'Image',
  title
}) => {
  const [isFullscreen, setIsFullscreen] = React.useState(false);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isFullscreen) {
          setIsFullscreen(false);
        } else {
          onClose();
        }
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, isFullscreen, onClose]);

  // Handle fullscreen toggle
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  // Close modal when clicking outside the image
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black transition-opacity duration-300 ${
        isFullscreen ? 'bg-opacity-100' : 'bg-opacity-75'
      }`}
      onClick={handleBackdropClick}
    >
      {/* Modal Content */}
      <div
        className={`relative max-w-full max-h-full p-4 transition-all duration-300 ${
          isFullscreen ? 'w-full h-full p-0' : 'w-auto h-auto'
        }`}
      >
        {/* Control Bar */}
        <div
          className={`absolute top-4 right-4 z-10 flex items-center space-x-2 bg-black bg-opacity-50 rounded-lg p-2 transition-opacity duration-300 ${
            isFullscreen ? 'bg-opacity-30' : ''
          }`}
        >
          <button
            onClick={toggleFullscreen}
            className="text-white hover:text-gray-300 transition-colors p-1 rounded"
            title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            {isFullscreen ? (
              <FiMinimize2 size={20} />
            ) : (
              <FiMaximize2 size={20} />
            )}
          </button>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-300 transition-colors p-1 rounded"
            title="Close (ESC)"
          >
            <FiX size={20} />
          </button>
        </div>

        {/* Image */}
        <img
          src={src}
          alt={alt}
          className={`max-w-full max-h-full object-contain rounded-lg shadow-2xl transition-all duration-300 ${
            isFullscreen ? 'w-full h-full rounded-none' : ''
          }`}
          style={{
            maxWidth: isFullscreen ? '100vw' : '90vw',
            maxHeight: isFullscreen ? '100vh' : '90vh'
          }}
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
          }}
        />

        {/* Image Title/Caption */}
        {title && !isFullscreen && (
          <div className="absolute bottom-4 left-4 right-4 text-center">
            <div className="bg-black bg-opacity-50 text-white px-4 py-2 rounded-lg text-sm">
              {title}
            </div>
          </div>
        )}
      </div>

      {/* Loading indicator for slow images */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-white border-t-transparent"></div>
      </div>
    </div>
  );
};

export default ImageModal;

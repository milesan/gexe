import React, { useState, useEffect } from 'react';
import heic2any from 'heic2any';

interface SmartImageProps {
  src: string;
  alt: string;
  className?: string;
  onClick?: () => void;
}

export function SmartImage({ src, alt, className, onClick }: SmartImageProps) {
  const [imageSrc, setImageSrc] = useState<string>(src);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [conversionAttempted, setConversionAttempted] = useState(false);

  const isHEIC = (url: string) => {
    return /\.heic$/i.test(url) || /\.heif$/i.test(url);
  };

  const convertHEICToJPEG = async (heicUrl: string): Promise<string> => {
    console.log('SmartImage: Starting HEIC conversion for:', heicUrl);
    try {
      setLoading(true);
      
      // Fetch the HEIC file
      console.log('SmartImage: Fetching HEIC file...');
      const response = await fetch(heicUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch HEIC file: ${response.status} ${response.statusText}`);
      }
      
      console.log('SmartImage: HEIC file fetched, converting...');
      const heicBlob = await response.blob();
      console.log('SmartImage: Blob size:', heicBlob.size, 'bytes');
      
      // Add timeout wrapper for heic2any conversion
      const conversionPromise = heic2any({
        blob: heicBlob,
        toType: 'image/jpeg',
        quality: 0.8
      }) as Promise<Blob>;
      
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('HEIC conversion timeout after 5 seconds')), 5000);
      });
      
      console.log('SmartImage: Starting heic2any conversion...');
      const jpegBlob = await Promise.race([conversionPromise, timeoutPromise]);
      
      console.log('SmartImage: Conversion successful, JPEG size:', jpegBlob.size, 'bytes');
      
      // Create object URL from converted blob
      const jpegUrl = URL.createObjectURL(jpegBlob);
      console.log('SmartImage: Created blob URL:', jpegUrl);
      return jpegUrl;
    } catch (error) {
      console.error('SmartImage: Error converting HEIC to JPEG:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const handleImageError = async () => {
    console.log('SmartImage: Image error for:', src, 'Current imageSrc:', imageSrc, 'Conversion attempted:', conversionAttempted);
    
    // Prevent infinite loops - only try conversion once
    if (isHEIC(src) && imageSrc === src && !conversionAttempted) {
      setConversionAttempted(true);
      try {
        console.log('SmartImage: Attempting HEIC conversion...');
        const convertedUrl = await convertHEICToJPEG(src);
        setImageSrc(convertedUrl);
        setError(false);
        console.log('SmartImage: Successfully set converted URL');
      } catch (conversionError) {
        console.error('SmartImage: Failed to convert HEIC image:', conversionError);
        setError(true);
      }
    } else {
      console.log('SmartImage: Setting error state - not HEIC or already attempted conversion');
      setError(true);
    }
  };

  // Reset states when src changes
  useEffect(() => {
    setImageSrc(src);
    setError(false);
    setConversionAttempted(false);
    setLoading(false);
  }, [src]);

  // Cleanup object URLs to prevent memory leaks
  useEffect(() => {
    return () => {
      if (imageSrc !== src && imageSrc.startsWith('blob:')) {
        console.log('SmartImage: Cleaning up blob URL:', imageSrc);
        URL.revokeObjectURL(imageSrc);
      }
    };
  }, [imageSrc, src]);

  if (loading) {
    console.log('SmartImage: Rendering loading state for:', src);
    return (
      <div className={`flex items-center justify-center bg-gray-100 ${className}`}>
        <div className="flex flex-col items-center gap-2">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-400"></div>
          <span className="text-xs text-gray-500">Converting HEIC...</span>
        </div>
      </div>
    );
  }

  if (error) {
    console.log('SmartImage: Rendering error state for:', src);
    const isHEICFile = isHEIC(src);
    
    if (isHEICFile) {
      return (
        <div className={`flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 text-gray-600 text-xs p-4 ${className}`}>
          <div className="text-center space-y-2">
            <div className="text-sm font-medium">📱 HEIC Photo</div>
            <div className="text-xs text-gray-500">Apple format - view in new tab</div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                window.open(src, '_blank');
              }}
              className="px-3 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 transition-colors"
            >
              Open Original
            </button>
          </div>
        </div>
      );
    }
    
    return (
      <div className={`flex items-center justify-center bg-gray-100 text-gray-500 text-xs p-2 ${className}`}>
        <div className="text-center">
          <div>Failed to load image</div>
        </div>
      </div>
    );
  }

  console.log('SmartImage: Rendering image with src:', imageSrc);
  return (
    <img
      src={imageSrc}
      alt={alt}
      className={className}
      onClick={onClick}
      onError={handleImageError}
    />
  );
} 
import React, { useState, useCallback } from 'react';
import { generateMonumentImage, extractLocationFromPrompt } from './services/geminiService'; // Import extractLocationFromPrompt
import { APIStatus } from './types';
import { saveCreation } from './services/apiService';

// Define props for the App component (now the Create Monument Page)
interface AppProps {
  onNavigateToMap: () => void; // Callback to navigate to the Map Page
}

const App: React.FC<AppProps> = ({ onNavigateToMap }) => {
  const [monumentPrompt, setMonumentPrompt] = useState<string>('');
  const [scenePrompt, setScenePrompt] = useState<string>('');
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [apiStatus, setApiStatus] = useState<APIStatus>(APIStatus.IDLE);
  const [error, setError] = useState<string | null>(null);

  // New state for location feedback
  const [locationFeedback, setLocationFeedback] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Helper function to render error messages consistently
  const renderError = (message: string | null) => {
    if (!message) return null;
    return (
      <div
        className="bg-[#fee2e2] border border-[#fca5a5] text-[#dc2626] px-4 py-3 rounded-md relative text-center"
        role="alert"
      >
        <strong className="font-bold">Error: </strong>
        <span className="block sm:inline">{message}</span>
      </div>
    );
  };

  const handleGenerate = useCallback(async () => {
    setError(null);
    setGeneratedImageUrl(null);
    setLocationFeedback(null); // Clear previous location feedback

    if (!monumentPrompt || !scenePrompt) {
      setError('Please enter both monument and scene descriptions.');
      return;
    }

    setApiStatus(APIStatus.LOADING);
    try {
      // 1. Generate the image first
      const imageResponse = await generateMonumentImage(monumentPrompt, scenePrompt);
      const newImageUrl = `data:${imageResponse.mimeType};base64,${imageResponse.base64ImageData}`;
      setGeneratedImageUrl(newImageUrl);

      // 2. Extract location using Gemini
      let derivedLocationString = "Generic World Location"; // Default fallback
      let latitude: number = 0.0;
      let longitude: number = 0.0;

      try {
        derivedLocationString = await extractLocationFromPrompt(monumentPrompt, scenePrompt);
        setLocationFeedback(`Gemini inferred location: "${derivedLocationString}"`);

        // 3. Geocode the extracted location string using Google Maps Geocoding API
        if (derivedLocationString && derivedLocationString !== "Generic World Location") {
          if (!window.google || !window.google.maps || !window.google.maps.Geocoder) {
            console.warn("Google Maps Geocoding API not loaded. Falling back to generic location.");
            setLocationFeedback("Google Maps API not fully loaded for geocoding. Pinning at generic world location.");
          } else {
            const geocoder = new window.google.maps.Geocoder();
            const geocodeResult = await new Promise<google.maps.GeocoderResult[]>((resolve, reject) => {
              geocoder.geocode({ address: derivedLocationString }, (results, status) => {
                if (status === window.google.maps.GeocoderStatus.OK && results && results.length > 0) {
                  resolve(results);
                } else {
                  reject(new Error(`Geocoding failed with status: ${status}`));
                }
              });
            });

            if (geocodeResult && geocodeResult.length > 0) {
              latitude = geocodeResult[0].geometry.location.lat();
              longitude = geocodeResult[0].geometry.location.lng();
              setLocationFeedback(`Location derived from prompt: ${geocodeResult[0].formatted_address}`);
            } else {
              console.warn("Geocoding returned no results. Falling back to generic location.");
              setLocationFeedback("Could not find specific coordinates for the inferred location. Pinning at generic world location.");
            }
          }
        } else {
          setLocationFeedback("No specific real-world location inferred from prompts. Pinning at generic world location (Null Island).");
        }
      } catch (locationErr) {
        console.error('Error in location derivation (Gemini or Geocoding):', locationErr);
        setLocationFeedback("Failed to derive location from prompts. Pinning at generic world location (Null Island).");
        // Lat/Lng remain 0,0 from initialization
      }

      // 4. Save the generated image and derived location to the database
      setIsSaving(true);
      try {
        await saveCreation({
          monumentPrompt,
          scenePrompt,
          imageUrl: newImageUrl,
          latitude, // Derived latitude
          longitude, // Derived longitude
        });
      } catch (saveErr) {
        console.error('Failed to save creation to database:', saveErr);
        setError(`Failed to save this creation to history: ${saveErr instanceof Error ? saveErr.message : String(saveErr)}`);
      } finally {
        setIsSaving(false);
      }

      setApiStatus(APIStatus.SUCCESS);

    } catch (err: unknown) {
      console.error('Failed to generate image or process location:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(`${errorMessage}`);
      setApiStatus(APIStatus.ERROR);
    }
  }, [monumentPrompt, scenePrompt]);

  const handleShare = useCallback(async () => {
    if (generatedImageUrl && navigator.share) {
      try {
        const response = await fetch(generatedImageUrl);
        const blob = await response.blob();
        const file = new File([blob], 'ai-monument.png', { type: blob.type });

        await navigator.share({
          files: [file],
          title: 'AI Monument',
          text: `Check out this AI-generated monument: "${monumentPrompt}" in "${scenePrompt}"!`,
        });
        console.log('Image shared successfully');
      } catch (err) {
        console.error('Error sharing image:', err);
        setError('Failed to share image. Your browser might have restrictions or you cancelled the share.');
      }
    } else if (generatedImageUrl && !navigator.share) {
      setError('Web Share API is not supported in your browser.');
    } else {
      setError('No image available to share.');
    }
  }, [generatedImageUrl, monumentPrompt, scenePrompt]);


  return (
    <div className="container mx-auto p-4 md:p-8 max-w-4xl bg-white rounded-xl shadow-2xl border border-blue-100 relative">
      {/* Header and View Map button */}
      <div className="absolute top-0 left-0 right-0 z-10 p-4 flex justify-between items-center">
        <h1 className="text-xl md:text-2xl font-extrabold text-[#1a73e8]">
          Create Monument
        </h1>
        <button
          onClick={onNavigateToMap}
          className="py-2 px-4 bg-[#4285F4] text-white font-bold rounded-lg shadow-lg hover:bg-[#346dc9] focus:outline-none focus:ring-4 focus:ring-[#a0c3ff] transition-all duration-300 transform active:scale-98 disabled:opacity-50"
          aria-label="View created monuments on map"
        >
          View Map
        </button>
      </div>

      <div className="pt-20 space-y-6 mb-8"> {/* Added padding top to account for header */}
        {renderError(error)}

        <div>
          <label htmlFor="monumentPrompt" className="block text-lg font-semibold text-gray-700 mb-2">
            1. Describe the Monument:
          </label>
          <textarea
            id="monumentPrompt"
            className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-[#4285F4] focus:border-[#4285F4] transition-all duration-200 resize-y min-h-[80px]"
            rows={3}
            value={monumentPrompt}
            onChange={(e) => setMonumentPrompt(e.target.value)}
            placeholder="e.g., 'a towering statue of a futuristic cyborg on a pedestal'"
            aria-label="Monument description prompt"
            disabled={apiStatus === APIStatus.LOADING}
          ></textarea>
        </div>

        <div>
          <label htmlFor="scenePrompt" className="block text-lg font-semibold text-gray-700 mb-2">
            2. Describe the Scene:
          </label>
          <textarea
            id="scenePrompt"
            className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-[#4285F4] focus:border-[#4285F4] transition-all duration-200 resize-y min-h-[80px]"
            rows={3}
            value={scenePrompt}
            onChange={(e) => setScenePrompt(e.target.value)}
            placeholder="e.g., 'a peaceful Japanese garden with cherry blossom trees and a koi pond'"
            aria-label="Scene description prompt"
            disabled={apiStatus === APIStatus.LOADING}
          ></textarea>
        </div>

        {/* Removed Geolocation Input Section - location is now derived from prompts */}

        <button
          onClick={handleGenerate}
          disabled={apiStatus === APIStatus.LOADING || !monumentPrompt || !scenePrompt}
          className="w-full py-3 px-6 bg-[#4285F4] text-white font-bold rounded-lg shadow-lg hover:bg-[#346dc9] focus:outline-none focus:ring-4 focus:ring-[#a0c3ff] transition-all duration-300 transform active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
        >
          {apiStatus === APIStatus.LOADING ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Generating Monument & Locating...
            </>
          ) : (
            'Generate Monument Image'
          )}
        </button>
      </div>

      {generatedImageUrl && (
        <div className="mt-8 pt-8 border-t border-blue-200">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-[#1a73e8] mb-6">
            Your Generated Monument
          </h2>
          {locationFeedback && (
            <p className="text-center text-gray-700 text-sm mb-4 bg-blue-50 p-2 rounded-md shadow-sm" aria-live="polite">
              {locationFeedback}
            </p>
          )}
          <div className="relative w-full h-auto bg-gray-100 rounded-xl overflow-hidden shadow-xl border border-gray-200 flex items-center justify-center p-2">
            <img
              src={generatedImageUrl}
              alt="Generated Monument"
              className="max-w-full h-auto rounded-lg object-contain"
              onLoad={() => console.log('Image loaded successfully')}
              onError={() => setError('Failed to load generated image.')}
            />
          </div>
          <p className="text-center text-gray-500 text-sm mt-4">
            (The monument is seamlessly integrated into the scene.)
          </p>
          <div className="flex justify-center space-x-4 mt-6">
            <a
              href={generatedImageUrl}
              download="ai-monument.png"
              className="py-2 px-4 bg-[#34A853] text-white font-bold rounded-lg shadow-md hover:bg-[#288a44] focus:outline-none focus:ring-4 focus:ring-[#7DDA86] transition-all duration-300 flex items-center"
              aria-label="Download generated image"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 11.586V4a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
              Download Image
            </a>
            <button
              onClick={handleShare}
              disabled={!navigator.share || apiStatus === APIStatus.LOADING}
              className="py-2 px-4 bg-[#EA4335] text-white font-bold rounded-lg shadow-md hover:bg-[#c23321] focus:outline-none focus:ring-4 focus:ring-[#FF8A8A] transition-all duration-300 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Share generated image"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.832-1.664l-4.94-2.47a3.027 3 0 000-.629l4.94-2.47C13.856 7.638 14.123 8 15 8z" />
              </svg>
              Share
            </button>
          </div>
          {!navigator.share && (
            <p className="text-center text-gray-500 text-sm mt-2" aria-live="polite">
              (Sharing is not supported in this browser.)
            </p>
          )}
          {isSaving && (
            <div className="mt-4 flex items-center justify-center text-gray-600">
              <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Saving to history...
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
import React, { useState, useCallback, useEffect } from 'react';
import { generateMonumentImage } from './services/geminiService';
import { APIStatus, LocationStatus } from './types';
import { saveCreation } from './services/apiService'; // Import saveCreation

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

  // New states for geolocation
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>(LocationStatus.IDLE);
  const [locationError, setLocationError] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState<boolean>(false); // Used when saving the generated image + location

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

  const getUserLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser.');
      setLocationStatus(LocationStatus.UNAVAILABLE);
      return;
    }

    setLocationStatus(LocationStatus.LOADING);
    setLocationError(null); // Clear previous location errors

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude);
        setLongitude(position.coords.longitude);
        setLocationStatus(LocationStatus.SUCCESS);
        setLocationError(null);
      },
      (geoError) => {
        console.error('Geolocation error:', geoError);
        setLocationStatus(LocationStatus.ERROR);
        let errorMessage = 'Failed to get location.';
        switch (geoError.code) {
          case geoError.PERMISSION_DENIED:
            errorMessage = 'Permission denied to access location. Please enable it in browser settings.';
            setLocationStatus(LocationStatus.PERMISSION_DENIED);
            break;
          case geoError.POSITION_UNAVAILABLE:
            errorMessage = 'Location information is unavailable.';
            setLocationStatus(LocationStatus.UNAVAILABLE);
            break;
          case geoError.TIMEOUT:
            errorMessage = 'The request to get user location timed out.';
            setLocationStatus(LocationStatus.TIMEOUT);
            break;
          default:
            errorMessage = `An unknown geolocation error occurred: ${geoError.message}`;
            break;
        }
        setLocationError(errorMessage);
        setLatitude(null);
        setLongitude(null);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000, // 10 seconds
        maximumAge: 0, // No cached position
      }
    );
  }, []);

  const handleGenerate = useCallback(async () => {
    setError(null);
    setGeneratedImageUrl(null);

    if (!monumentPrompt || !scenePrompt) {
      setError('Please enter both monument and scene descriptions.');
      return;
    }

    // Ensure location is provided before generating and saving
    if (latitude === null || longitude === null) {
      setError('Please provide a location for the monument (using current location or manual input).');
      return;
    }

    setApiStatus(APIStatus.LOADING);
    try {
      const response = await generateMonumentImage(monumentPrompt, scenePrompt);
      const newImageUrl = `data:${response.mimeType};base64,${response.base64ImageData}`;
      setGeneratedImageUrl(newImageUrl);
      setApiStatus(APIStatus.SUCCESS);

      // Attempt to save the new creation to the database with location
      setIsSaving(true);
      try {
        await saveCreation({
          monumentPrompt,
          scenePrompt,
          imageUrl: newImageUrl,
          latitude, // Include latitude
          longitude, // Include longitude
        });
        // We don't need to update local state for savedCreations here anymore,
        // as the map page will fetch its own updated list upon navigation.
      } catch (saveErr) {
        console.error('Failed to save creation to database:', saveErr);
        setError(`Failed to save this creation to history: ${saveErr instanceof Error ? saveErr.message : String(saveErr)}`);
      } finally {
        setIsSaving(false);
      }

    } catch (err: unknown) {
      console.error('Failed to generate image:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(`${errorMessage}`);
      setApiStatus(APIStatus.ERROR);
    }
  }, [monumentPrompt, scenePrompt, latitude, longitude]); // Dependencies for useCallback

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

        {/* Geolocation Input Section */}
        <div className="bg-blue-50 p-4 rounded-lg shadow-inner">
          <h3 className="text-xl font-bold text-[#1a73e8] mb-4">3. Monument Location</h3>
          {renderError(locationError)}

          <div className="flex flex-col sm:flex-row gap-4 mb-4 items-center">
            <button
              onClick={getUserLocation}
              disabled={locationStatus === LocationStatus.LOADING || apiStatus === APIStatus.LOADING}
              className="w-full sm:w-auto py-2 px-4 bg-[#34A853] text-white font-bold rounded-lg shadow-md hover:bg-[#288a44] focus:outline-none focus:ring-4 focus:ring-[#7DDA86] transition-all duration-300 transform active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              aria-label="Use current location"
            >
              {locationStatus === LocationStatus.LOADING ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Getting Location...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM12.75 9a.75.75 0 00-1.5 0v2.25H9a.75.75 0 000 1.5h2.25V15a.75.75 0 001.5 0v-2.25H15a.75.75 0 000-1.5h-2.25V9z" clipRule="evenodd" />
                  </svg>
                  Use Current Location
                </>
              )}
            </button>
            <span className="text-gray-600">OR</span>
            <div className="flex-grow flex flex-col sm:flex-row gap-2">
              <input
                type="number"
                step="any"
                className="w-full p-2 border border-gray-300 rounded-lg shadow-sm focus:ring-[#4285F4] focus:border-[#4285F4] transition-all duration-200"
                placeholder="Latitude (e.g., 34.05)"
                value={latitude === null ? '' : latitude}
                onChange={(e) => setLatitude(parseFloat(e.target.value) || null)}
                disabled={apiStatus === APIStatus.LOADING}
                aria-label="Manual latitude input"
              />
              <input
                type="number"
                step="any"
                className="w-full p-2 border border-gray-300 rounded-lg shadow-sm focus:ring-[#4285F4] focus:border-[#4285F4] transition-all duration-200"
                placeholder="Longitude (e.g., -118.25)"
                value={longitude === null ? '' : longitude}
                onChange={(e) => setLongitude(parseFloat(e.target.value) || null)}
                disabled={apiStatus === APIStatus.LOADING}
                aria-label="Manual longitude input"
              />
            </div>
          </div>
          {latitude !== null && longitude !== null && (
            <p className="text-center text-sm text-gray-700">
              Location selected: <span className="font-semibold">Lat: {latitude.toFixed(5)}, Lng: {longitude.toFixed(5)}</span>
            </p>
          )}
        </div>

        <button
          onClick={handleGenerate}
          disabled={apiStatus === APIStatus.LOADING || latitude === null || longitude === null}
          className="w-full py-3 px-6 bg-[#4285F4] text-white font-bold rounded-lg shadow-lg hover:bg-[#346dc9] focus:outline-none focus:ring-4 focus:ring-[#a0c3ff] transition-all duration-300 transform active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
        >
          {apiStatus === APIStatus.LOADING ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Generating Monument...
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
import React, { useState, useCallback, useEffect } from 'react';
import { generateMonumentImage } from './services/geminiService';
import { APIStatus } from './types';
import { saveCreation, getCreations, Creation } from './services/apiService'; // Import new API service

function App(): React.JSX.Element {
  const [monumentPrompt, setMonumentPrompt] = useState<string>('');
  const [scenePrompt, setScenePrompt] = useState<string>('');
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [apiStatus, setApiStatus] = useState<APIStatus>(APIStatus.IDLE);
  const [error, setError] = useState<string | null>(null);

  // New states for database interaction
  const [savedCreations, setSavedCreations] = useState<Creation[]>([]);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(true);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // Effect to load history on component mount
  useEffect(() => {
    const fetchHistory = async () => {
      setLoadingHistory(true);
      setHistoryError(null);
      try {
        const history = await getCreations();
        setSavedCreations(history);
      } catch (err) {
        console.error('Failed to load creation history:', err);
        setHistoryError(`Failed to load history: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setLoadingHistory(false);
      }
    };
    fetchHistory();
  }, []); // Run only once on mount

  const handleGenerate = useCallback(async () => {
    setError(null);
    setGeneratedImageUrl(null);

    if (!monumentPrompt || !scenePrompt) {
      setError('Please enter both monument and scene descriptions.');
      return;
    }

    setApiStatus(APIStatus.LOADING);
    try {
      const response = await generateMonumentImage(monumentPrompt, scenePrompt);
      const newImageUrl = `data:${response.mimeType};base64,${response.base64ImageData}`;
      setGeneratedImageUrl(newImageUrl);
      setApiStatus(APIStatus.SUCCESS);

      // Attempt to save the new creation to the database
      setIsSaving(true);
      setHistoryError(null); // Clear previous history errors
      try {
        const saved = await saveCreation({
          monumentPrompt,
          scenePrompt,
          imageUrl: newImageUrl,
        });
        setSavedCreations((prev) => [saved, ...prev]); // Add new creation to the top of the history
      } catch (saveErr) {
        console.error('Failed to save creation to database:', saveErr);
        setHistoryError(`Failed to save this creation to history: ${saveErr instanceof Error ? saveErr.message : String(saveErr)}`);
      } finally {
        setIsSaving(false);
      }

    } catch (err: unknown) {
      console.error('Failed to generate image:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(`${errorMessage}`);
      setApiStatus(APIStatus.ERROR);
    }
  }, [monumentPrompt, scenePrompt]);

  // handleShare function for sharing the generated image
  const handleShare = useCallback(async () => {
    if (generatedImageUrl && navigator.share) {
      try {
        // Fetch the image data to create a Blob for sharing
        const response = await fetch(generatedImageUrl);
        const blob = await response.blob();
        const file = new File([blob], 'ai-monument.png', { type: blob.type });

        await navigator.share({
          files: [file],
          title: 'AI Monument',
          text: 'Check out this AI-generated monument!',
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
  }, [generatedImageUrl]);

  // Helper function to render HTML from a string (for error messages with links)
  const renderError = (message: string | null) => {
    if (!message) return null;
    return (
      <div
        className="bg-[#fee2e2] border border-[#fca5a5] text-[#dc2626] px-4 py-3 rounded-md relative"
        role="alert"
      >
        <strong className="font-bold">Error: </strong>
        <span className="block sm:inline" dangerouslySetInnerHTML={{ __html: message }}></span>
      </div>
    );
  };


  return (
    <div className="container mx-auto p-4 md:p-8 max-w-4xl bg-white rounded-xl shadow-2xl border border-blue-100">
      <h1 className="text-3xl md:text-4xl font-extrabold text-center text-[#1a73e8] mb-8 tracking-tight">
        AI Monument Creator
      </h1>

      <div className="space-y-6 mb-8">
        {renderError(error)} {/* Use renderError helper for displaying messages */}

        <div>
          <label htmlFor="monumentPrompt" className="block text-lg font-semibold text-gray-700 mb-2">
            1. Describe the Monument (e.g., "a majestic lion", "a brave astronaut"):
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
            2. Describe the Scene (e.g., "a bustling city square", "a serene forest clearing"):
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

        <button
          onClick={handleGenerate}
          disabled={apiStatus === APIStatus.LOADING}
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
              disabled={!navigator.share || apiStatus === APIStatus.LOADING} // Disable share button if loading
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

      {/* Creation History Section */}
      <div className="mt-12 pt-8 border-t-2 border-blue-300">
        <h2 className="text-2xl md:text-3xl font-bold text-center text-[#1a73e8] mb-6">
          Creation History
        </h2>
        {renderError(historyError)} {/* Display history-specific errors */}

        {loadingHistory ? (
          <div className="flex items-center justify-center text-gray-600">
            <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Loading history...
          </div>
        ) : savedCreations.length === 0 ? (
          <p className="text-center text-gray-500 text-lg">No past creations yet. Generate one above!</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {savedCreations.map((creation) => (
              <div key={creation.id} className="bg-white border border-gray-200 rounded-lg shadow-md p-4 flex flex-col items-center text-center">
                <p className="text-sm text-gray-500 mb-2">
                  {new Date(creation.created_at).toLocaleString()}
                </p>
                <p className="font-semibold text-gray-800 mb-2 break-words">
                  "{creation.monument_prompt}" in "{creation.scene_prompt}"
                </p>
                <a
                  href={creation.image_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block mt-2 w-full max-w-[200px] h-auto overflow-hidden rounded-md border border-gray-300 hover:border-[#4285F4] transition-all duration-200"
                  aria-label={`View image for monument: ${creation.monument_prompt}`}
                >
                  <img
                    src={creation.image_url}
                    alt={`${creation.monument_prompt} in ${creation.scene_prompt}`}
                    className="w-full h-auto object-cover"
                    style={{ aspectRatio: '1 / 1' }} // Maintain aspect ratio for thumbnails
                  />
                </a>
                <a
                  href={creation.image_url}
                  download={`ai-monument-${creation.id}.png`}
                  className="mt-4 py-1 px-3 bg-blue-500 text-white text-sm rounded-md hover:bg-blue-600 transition-colors duration-200 flex items-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 11.586V4a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                  Download
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
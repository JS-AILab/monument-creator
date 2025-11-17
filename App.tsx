import React, { useState, useCallback } from 'react';
import { generateMonumentImage } from './services/geminiService';
import { APIStatus } from './types';

function App(): React.JSX.Element {
  const [monumentPrompt, setMonumentPrompt] = useState<string>('');
  const [scenePrompt, setScenePrompt] = useState<string>('');
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [apiStatus, setApiStatus] = useState<APIStatus>(APIStatus.IDLE);
  const [error, setError] = useState<string | null>(null);

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
      setGeneratedImageUrl(`data:${response.mimeType};base64,${response.base64ImageData}`);
      setApiStatus(APIStatus.SUCCESS);
    } catch (err: unknown) {
      console.error('Failed to generate image:', err);
      setError(`Failed to generate image: ${err instanceof Error ? err.message : String(err)}`);
      setApiStatus(APIStatus.ERROR);
    }
  }, [monumentPrompt, scenePrompt]);

  const handleShare = useCallback(async () => {
    if (generatedImageUrl && navigator.share) {
      try {
        await navigator.share({
          title: 'AI Monument Creator',
          text: 'Check out this amazing monument image I created with the AI Monument Creator!',
          // Note: Directly sharing data URLs as files via navigator.share is not universally supported.
          // For a true image share, the image would need to be hosted or converted to a Blob with a proper filename.
          // As a fallback, we share text about the creation.
        });
      } catch (err) {
        console.error('Error sharing:', err);
        setError('Failed to share. Your browser might not support sharing this content, or you cancelled the share operation.');
      }
    } else if (!navigator.share) {
      setError('Web Share API is not supported in your browser.');
    }
  }, [generatedImageUrl]);

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-4xl bg-white rounded-xl shadow-2xl border border-blue-100">
      <h1 className="text-3xl md:text-4xl font-extrabold text-center text-[#1a73e8] mb-8 tracking-tight">
        AI Monument Creator
      </h1>

      <div className="space-y-6 mb-8">
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
          ></textarea>
        </div>

        {error && (
          <div className="bg-[#fee2e2] border border-[#fca5a5] text-[#dc2626] px-4 py-3 rounded-md relative" role="alert">
            <strong className="font-bold">Error: </strong>
            <span className="block sm:inline">{error}</span>
          </div>
        )}

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
              disabled={!navigator.share}
              className="py-2 px-4 bg-[#EA4335] text-white font-bold rounded-lg shadow-md hover:bg-[#c23321] focus:outline-none focus:ring-4 focus:ring-[#FF8A8A] transition-all duration-300 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Share generated image"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.832-1.664l-4.94-2.47a3.027 3.027 0 000-.629l4.94-2.47C13.856 7.638 14.123 8 15 8z" />
              </svg>
              Share
            </button>
          </div>
          {!navigator.share && (
            <p className="text-center text-gray-500 text-sm mt-2" aria-live="polite">
              (Sharing is not supported in this browser.)
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
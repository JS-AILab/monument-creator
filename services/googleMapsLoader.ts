import { APIStatus } from '../types';

let googleMapsScriptStatus: APIStatus = APIStatus.IDLE;
let googleMapsScriptPromise: Promise<void> | null = null;

/**
 * Dynamically loads the Google Maps JavaScript API script.
 * @param apiKey Your Google Maps JavaScript API key.
 * @returns A promise that resolves when the Google Maps API is loaded.
 */
export function loadGoogleMapsScript(apiKey: string): Promise<void> {
  // If the script is already loading or loaded, return the existing promise.
  if (googleMapsScriptPromise) {
    return googleMapsScriptPromise;
  }

  // If google.maps is already available, resolve immediately.
  // This can happen if the script was loaded by another means (e.g., directly in index.html, though we're avoiding that for dynamic loading).
  if (typeof window.google === 'object' && typeof window.google.maps === 'object') {
    googleMapsScriptStatus = APIStatus.SUCCESS;
    return Promise.resolve();
  }

  // Validate API Key
  if (!apiKey) {
    googleMapsScriptStatus = APIStatus.ERROR;
    console.error("Google Maps API Key is not configured. Please ensure your 'GOOGLE_MAPS_API_KEY' environment variable is set.");
    return Promise.reject(new Error("Google Maps API Key is missing."));
  }

  // Create and return a new promise for loading the script.
  googleMapsScriptPromise = new Promise((resolve, reject) => {
    googleMapsScriptStatus = APIStatus.LOADING;

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`; // 'places' library is useful but optional, can be removed if not needed.
    script.async = true;
    script.defer = true;
    script.onerror = (error) => {
      googleMapsScriptStatus = APIStatus.ERROR;
      console.error("Failed to load Google Maps script:", error);
      reject(new Error("Failed to load Google Maps JavaScript API."));
      googleMapsScriptPromise = null; // Allow retry on error
    };
    script.onload = () => {
      // Ensure google.maps is actually available after onload
      if (typeof window.google === 'object' && typeof window.google.maps === 'object') {
        googleMapsScriptStatus = APIStatus.SUCCESS;
        resolve();
      } else {
        googleMapsScriptStatus = APIStatus.ERROR;
        console.error("Google Maps script loaded, but google.maps object not found.");
        reject(new Error("Google Maps script loaded, but API object not initialized."));
        googleMapsScriptPromise = null; // Allow retry on error
      }
    };

    document.head.appendChild(script);
    console.log("Attempting to load Google Maps script...");
  });

  return googleMapsScriptPromise;
}

/**
 * Provides the current loading status of the Google Maps script.
 */
export function getGoogleMapsScriptStatus(): APIStatus {
  return googleMapsScriptStatus;
}
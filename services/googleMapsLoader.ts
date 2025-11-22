import { APIStatus } from '../types'; // Assuming types.ts is in the parent directory

// Fix: Add minimal type declarations for google.maps to satisfy TypeScript compiler.
// This defines the google.maps namespace and its types before they are used to extend the Window interface.
declare global {
  namespace google {
    namespace maps {
      // Basic interfaces and classes used in the application
      interface LatLngLiteral {
        lat: number;
        lng: number;
      }
      class LatLng {
        // Minimal placeholder for LatLng class if it's used as a type (e.g., in unions with LatLngLiteral).
        // Actual implementation is handled by the Google Maps API runtime.
      }
      interface MapOptions {
        center?: LatLngLiteral | LatLng;
        zoom?: number;
        minZoom?: number;
        maxZoom?: number;
        streetViewControl?: boolean;
        mapTypeControl?: boolean;
        fullscreenControl?: boolean;
      }
      class Map {
        constructor(mapDiv: HTMLElement, opts?: MapOptions);
        fitBounds(bounds: LatLngBounds): void;
        setZoom(zoom: number): void;
        setCenter(latLng: LatLngLiteral | LatLng): void;
        getZoom(): number;
      }
      enum Animation {
        BOUNCE,
        DROP,
      }
      interface MarkerOptions {
        position?: LatLngLiteral | LatLng;
        map?: Map;
        title?: string;
        animation?: Animation;
      }
      class Marker {
        constructor(opts?: MarkerOptions);
        addListener(eventName: string, handler: Function): void;
      }
      interface InfoWindowOptions {}
      class InfoWindow {
        constructor(opts?: InfoWindowOptions);
        setContent(content: string | HTMLElement): void;
        open(map?: Map | null, anchor?: Marker | null): void;
      }
      class LatLngBounds {
        constructor(sw?: LatLngLiteral | LatLng, ne?: LatLngLiteral | LatLng);
        extend(latLng: LatLngLiteral | LatLng): void;
      }
      class Size {
        constructor(width: number, height: number, widthUnit?: string, heightUnit?: string);
      }
    }
  }

  // Extend the Window interface to include google, referencing the declared namespace
  interface Window {
    google: {
      maps: typeof google.maps;
      // You can add other top-level google services here if needed, e.g.,
      // places?: typeof google.maps.places; // If places library is used
    };
  }
}

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
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`; // 'places' library is useful but optional
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
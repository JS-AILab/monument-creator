import React, { useState, useEffect, useRef, useCallback } from 'react';
import { APIStatus, Creation } from './types';
import { loadGoogleMapsScript, getGoogleMapsScriptStatus } from './services/googleMapsLoader';
import { getCreations } from './services/apiService';

// Define the type for the props MapPage will receive
interface MapPageProps {
  onNavigateToCreate: () => void; // Callback to navigate to the Create Monument page
}

const MapPage: React.FC<MapPageProps> = ({ onNavigateToCreate }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  // Fix: Use a ref to store markers for proper management (clearing them).
  const markersRef = useRef<google.maps.Marker[]>([]);

  const [mapLoadingStatus, setMapLoadingStatus] = useState<APIStatus>(APIStatus.IDLE);
  const [creations, setCreations] = useState<Creation[]>([]);
  const [dataLoadingStatus, setDataLoadingStatus] = useState<APIStatus>(APIStatus.IDLE);
  const [error, setError] = useState<string | null>(null);

  // Retrieve API key from environment variables
  // IMPORTANT: Ensure GOOGLE_MAPS_API_KEY is set in your Vercel project settings (and locally)
  const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

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

  // Memoized function to create marker content for the InfoWindow
  const createMarkerContent = useCallback((creation: Creation) => {
    return `
      <div class="info-window p-2">
        <h3 class="font-bold text-md mb-1">${creation.monument_prompt}</h3>
        <p class="text-sm text-gray-700 mb-2">in "${creation.scene_prompt}"</p>
        <img src="${creation.image_url}" alt="${creation.monument_prompt}" class="w-48 h-auto rounded shadow-md object-cover" />
        <p class="text-xs text-gray-500 mt-2">${new Date(creation.created_at).toLocaleString()}</p>
        <a href="${creation.image_url}" target="_blank" rel="noopener noreferrer" class="block text-center text-blue-600 hover:text-blue-800 text-sm mt-2">View Full Image</a>
      </div>
    `;
  }, []);

  // Effect to load Google Maps script dynamically
  useEffect(() => {
    console.log("MapPage: useEffect for Google Maps script load. Status:", getGoogleMapsScriptStatus());
    // Only attempt to load if not already loading or loaded, and API Key is present
    if (getGoogleMapsScriptStatus() === APIStatus.IDLE || getGoogleMapsScriptStatus() === APIStatus.ERROR) {
      if (!GOOGLE_MAPS_API_KEY) {
        setMapLoadingStatus(APIStatus.ERROR);
        setError("Google Maps API Key is missing. Please set 'GOOGLE_MAPS_API_KEY' environment variable.");
        return;
      }

      setMapLoadingStatus(APIStatus.LOADING);
      loadGoogleMapsScript(GOOGLE_MAPS_API_KEY)
        .then(() => {
          setMapLoadingStatus(APIStatus.SUCCESS);
          setError(null); // Clear map-related errors if successful
          console.log("MapPage: Google Maps script loaded successfully.");
        })
        .catch((err) => {
          setMapLoadingStatus(APIStatus.ERROR);
          setError(`Map script failed to load: ${err.message}`);
          console.error('MapPage: Map script load error:', err);
        });
    }
  }, [GOOGLE_MAPS_API_KEY]); // Dependency on API key to re-trigger if it changes

  // Effect to fetch creations data
  useEffect(() => {
    console.log("MapPage: useEffect for fetching creations data.");
    setDataLoadingStatus(APIStatus.LOADING);
    getCreations()
      .then((data) => {
        setCreations(data);
        setDataLoadingStatus(APIStatus.SUCCESS);
        setError(null); // Clear data-related errors if successful
        console.log("MapPage: Creations data fetched successfully.", data);
      })
      .catch((err) => {
        setDataLoadingStatus(APIStatus.ERROR);
        setError(`Failed to load monuments: ${err instanceof Error ? err.message : String(err)}`);
        console.error('MapPage: Fetch creations error:', err);
      });
  }, []); // Run only once on mount to fetch all creations

  // Effect to initialize map and place markers once both map script and data are ready
  useEffect(() => {
    console.log("MapPage: useEffect for map init/marker placement. Map status:", mapLoadingStatus, "Data status:", dataLoadingStatus, "MapRef:", mapRef.current);
    // Only proceed if map script and data are loaded successfully, and mapRef is attached to a DOM element
    if (mapLoadingStatus === APIStatus.SUCCESS && dataLoadingStatus === APIStatus.SUCCESS && mapRef.current) {
      if (!window.google || !window.google.maps) {
        setError("Google Maps API object not found after script load.");
        setMapLoadingStatus(APIStatus.ERROR);
        console.error("MapPage: window.google.maps not found.");
        return;
      }

      // Initialize the map if it hasn't been already
      if (!mapInstanceRef.current) {
        const defaultLatLng = { lat: 0, lng: 0 }; // Default to center of the world
        mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
          center: defaultLatLng,
          zoom: 2, // World view zoom
          minZoom: 2, // Prevent zooming out too far
          maxZoom: 18, // Prevent zooming in too close
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
        });

        infoWindowRef.current = new window.google.maps.InfoWindow(); // Initialize info window
        console.log("MapPage: Google Map initialized.");
      }

      // Fix: Clear all existing markers before adding new ones
      if (markersRef.current.length > 0) {
        markersRef.current.forEach((marker) => marker.setMap(null));
        markersRef.current = []; // Clear the array
        console.log("MapPage: Cleared existing markers.");
      }

      const bounds = new window.google.maps.LatLngBounds();
      let hasValidCoords = false;
      let allCoordsAreNullIsland = true; // Track if all valid coords are 0,0

      creations.forEach(creation => {
        // Ensure creation has valid latitude and longitude numbers
        if (typeof creation.latitude === 'number' && typeof creation.longitude === 'number' && mapInstanceRef.current) {
          hasValidCoords = true;
          const position = { lat: creation.latitude, lng: creation.longitude };

          if (position.lat !== 0 || position.lng !== 0) {
            allCoordsAreNullIsland = false; // Found a non-Null Island coordinate
          }
          
          console.log(`MapPage: Placing marker for "${creation.monument_prompt}" at Lat: ${position.lat}, Lng: ${position.lng}`);

          const marker = new window.google.maps.Marker({
            position: position,
            map: mapInstanceRef.current,
            title: creation.monument_prompt,
            animation: window.google.maps.Animation.DROP, // Drop animation on load
          });

          // Store marker reference for potential clearing later
          markersRef.current.push(marker);


          // Add click listener to show info window
          marker.addListener('click', () => {
            if (infoWindowRef.current && mapInstanceRef.current) {
              infoWindowRef.current.setContent(createMarkerContent(creation));
              infoWindowRef.current.open(mapInstanceRef.current, marker);
            }
          });
          bounds.extend(position); // Extend bounds to include this marker
        } else {
          console.warn(`MapPage: Skipping marker for creation ID ${creation.id} due to invalid coordinates.`);
        }
      });

      // Adjust map bounds to fit all markers if there are any valid coordinates
      if (hasValidCoords && mapInstanceRef.current) {
        if (allCoordsAreNullIsland && creations.length > 0) { // Check if there's at least one creation at 0,0
          // If all valid points are at 0,0, set a reasonable default zoom to make them visible
          mapInstanceRef.current.setCenter({ lat: 0, lng: 0 });
          mapInstanceRef.current.setZoom(8); // Zoom level to see Null Island clearly
          console.log("MapPage: All markers at Null Island, setting default zoom to 8.");
        } else {
          mapInstanceRef.current.fitBounds(bounds);
          // Prevent excessive zoom if all markers are very close
          if (mapInstanceRef.current.getZoom() > 15) {
            mapInstanceRef.current.setZoom(15);
            console.log("MapPage: Adjusted zoom to prevent excessive close-up.");
          }
        }
      } else if (mapInstanceRef.current) {
        // If no valid coords, revert to default world view
        mapInstanceRef.current.setCenter({ lat: 0, lng: 0 });
        mapInstanceRef.current.setZoom(2);
        console.log("MapPage: No valid coordinates found, setting to default world view.");
      }
    }
  }, [mapLoadingStatus, dataLoadingStatus, creations, createMarkerContent]); // Re-run if any of these states change

  // Determine overall loading and error states for the UI
  const isLoading = mapLoadingStatus === APIStatus.LOADING || dataLoadingStatus === APIStatus.LOADING;
  const hasError = mapLoadingStatus === APIStatus.ERROR || dataLoadingStatus === APIStatus.ERROR || error;

  return (
    <div className="relative w-full h-screen flex flex-col">
      {/* Header and Create Monument button */}
      <div className="absolute top-0 left-0 right-0 z-10 p-4 bg-white bg-opacity-90 shadow-md flex justify-between items-center">
        <h1 className="text-2xl md:text-3xl font-extrabold text-[#1a73e8]">
          Monument Map
        </h1>
        <button
          onClick={onNavigateToCreate}
          className="py-2 px-4 bg-[#4285F4] text-white font-bold rounded-lg shadow-lg hover:bg-[#346dc9] focus:outline-none focus:ring-4 focus:ring-[#a0c3ff] transition-all duration-300 transform active:scale-98 disabled:opacity-50"
          aria-label="Create a new monument"
        >
          Create Monument
        </button>
      </div>

      {/* Map Container */}
      <div ref={mapRef} className="flex-grow w-full h-full bg-gray-200">
        {(isLoading || hasError) && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-60 z-20">
            <div className="text-white text-center p-6 rounded-lg shadow-xl bg-gray-800">
              {isLoading && (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-8 w-8 text-white mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <p className="text-xl">Loading map and monuments...</p>
                </>
              )}
              {hasError && (
                <>
                  <p className="text-xl font-bold mb-2">Failed to Load Map or Data</p>
                  {renderError(error || "An unknown error occurred.")}
                  {!GOOGLE_MAPS_API_KEY && ( // Specific warning if API key is missing
                    <p className="mt-4 text-orange-300">
                      **Warning:** Google Maps API Key is missing. Please set `GOOGLE_MAPS_API_KEY` environment variable.
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MapPage;
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
  const markersRef = useRef<google.maps.Marker[]>([]); // Ref to store markers for proper management

  const [mapLoadingStatus, setMapLoadingStatus] = useState<APIStatus>(APIStatus.IDLE);
  const [creations, setCreations] = useState<Creation[]>([]);
  const [dataLoadingStatus, setDataLoadingStatus] = useState<APIStatus>(APIStatus.IDLE);
  const [error, setError] = useState<string | null>(null);

  // Retrieve API key from environment variables
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

  // Helper function to group monuments by location
  const groupMonumentsByLocation = useCallback((monuments: Creation[]) => {
    const grouped = new Map<string, Creation[]>();
    
    monuments.forEach(monument => {
      // Round to 4 decimal places to group nearby monuments (about 11 meters accuracy)
      const key = `${monument.latitude.toFixed(4)},${monument.longitude.toFixed(4)}`;
      
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(monument);
    });
    
    return grouped;
  }, []);

  // Memoized function to create marker content for multiple monuments
  const createMarkerContent = useCallback((monuments: Creation[]) => {
    if (monuments.length === 1) {
      // Single monument - simple view
      const creation = monuments[0];
      return `
        <div class="info-window p-3 max-w-xs">
          <h3 class="font-bold text-lg mb-1">${creation.monument_prompt}</h3>
          <p class="text-sm text-gray-700 mb-2">in "${creation.scene_prompt}"</p>
          <img src="${creation.image_url}" alt="${creation.monument_prompt}" class="w-full h-auto rounded shadow-md object-cover mb-2" />
          <p class="text-xs text-gray-500">${new Date(creation.created_at).toLocaleString()}</p>
          <a href="${creation.image_url}" download="monument-${creation.id}.png" class="block text-center text-blue-600 hover:text-blue-800 text-sm mt-2">Download Full Image</a>
        </div>
      `;
    } else {
      // Multiple monuments - carousel view
      const monumentsHtml = monuments.map((creation, index) => `
        <div class="monument-slide" data-index="${index}" style="display: ${index === 0 ? 'block' : 'none'}">
          <h3 class="font-bold text-lg mb-1">${creation.monument_prompt}</h3>
          <p class="text-sm text-gray-700 mb-2">in "${creation.scene_prompt}"</p>
          <img src="${creation.image_url}" alt="${creation.monument_prompt}" class="w-full h-auto rounded shadow-md object-cover mb-2" />
          <p class="text-xs text-gray-500">${new Date(creation.created_at).toLocaleString()}</p>
          <a href="${creation.image_url}" download="monument-${creation.id}.png" class="block text-center text-blue-600 hover:text-blue-800 text-sm mt-2">Download Full Image</a>
        </div>
      `).join('');

      return `
        <div class="info-window p-3 max-w-xs">
          <div class="flex justify-between items-center mb-2">
            <span class="text-sm font-semibold text-gray-700">
              <span id="current-index">1</span> of ${monuments.length} monuments here
            </span>
          </div>
          <div id="carousel-container">
            ${monumentsHtml}
          </div>
          <div class="flex justify-between mt-3">
            <button id="prev-btn" class="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm">
              ← Previous
            </button>
            <button id="next-btn" class="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm">
              Next →
            </button>
          </div>
        </div>
      `;
    }
  }, []);

  // Function to setup carousel controls
  const setupCarouselControls = useCallback((monuments: Creation[]) => {
    if (monuments.length <= 1) return;

    let currentIndex = 0;

    const updateDisplay = () => {
      const slides = document.querySelectorAll('.monument-slide');
      const indexDisplay = document.getElementById('current-index');
      
      slides.forEach((slide, index) => {
        (slide as HTMLElement).style.display = index === currentIndex ? 'block' : 'none';
      });
      
      if (indexDisplay) {
        indexDisplay.textContent = String(currentIndex + 1);
      }
    };

    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');

    if (prevBtn) {
      prevBtn.onclick = (e) => {
        e.stopPropagation();
        currentIndex = (currentIndex - 1 + monuments.length) % monuments.length;
        updateDisplay();
      };
    }

    if (nextBtn) {
      nextBtn.onclick = (e) => {
        e.stopPropagation();
        currentIndex = (currentIndex + 1) % monuments.length;
        updateDisplay();
      };
    }
  }, []);

  // Effect to load Google Maps script dynamically
  useEffect(() => {
    console.log("MapPage (render): GOOGLE_MAPS_API_KEY:", GOOGLE_MAPS_API_KEY ? "Present" : "Missing");
    console.log("MapPage: useEffect for Google Maps script load. Status:", getGoogleMapsScriptStatus());
    
    if (getGoogleMapsScriptStatus() === APIStatus.IDLE || getGoogleMapsScriptStatus() === APIStatus.ERROR) {
      if (!GOOGLE_MAPS_API_KEY) {
        setMapLoadingStatus(APIStatus.ERROR);
        setError("Google Maps API Key is missing. Please set 'GOOGLE_MAPS_API_KEY' environment variable.");
        console.error("MapPage: GOOGLE_MAPS_API_KEY is not defined.");
        return;
      }

      setMapLoadingStatus(APIStatus.LOADING);
      loadGoogleMapsScript(GOOGLE_MAPS_API_KEY)
        .then(() => {
          setMapLoadingStatus(APIStatus.SUCCESS);
          setError(null);
          console.log("MapPage: Google Maps script loaded successfully.");
        })
        .catch((err) => {
          setMapLoadingStatus(APIStatus.ERROR);
          setError(`Map script failed to load: ${err.message}`);
          console.error('MapPage: Map script load error:', err);
        });
    }
  }, [GOOGLE_MAPS_API_KEY]);

  // Effect to fetch creations data
  useEffect(() => {
    console.log("MapPage: useEffect for fetching creations data.");
    setDataLoadingStatus(APIStatus.LOADING);
    
    getCreations()
      .then((data) => {
        console.log("MapPage: Raw data received:", data);
        console.log("MapPage: Number of creations:", data.length);
        
        data.forEach((creation, index) => {
          console.log(`Creation ${index}:`, {
            id: creation.id,
            monument: creation.monument_prompt,
            lat: creation.latitude,
            lng: creation.longitude,
            latType: typeof creation.latitude,
            lngType: typeof creation.longitude,
          });
        });
        
        setCreations(data);
        setDataLoadingStatus(APIStatus.SUCCESS);
        setError(null);
        console.log("MapPage: Creations data fetched successfully:", data);
      })
      .catch((err) => {
        console.error('MapPage: Full error object:', err);
        setDataLoadingStatus(APIStatus.ERROR);
        setError(`Failed to load monuments: ${err instanceof Error ? err.message : String(err)}`);
      });
  }, []);

  // Effect to initialize map and place markers
  useEffect(() => {
    console.log("MapPage: useEffect for map init/marker placement. Map status:", mapLoadingStatus, "Data status:", dataLoadingStatus);
    
    if (mapLoadingStatus === APIStatus.SUCCESS && dataLoadingStatus === APIStatus.SUCCESS && mapRef.current) {
      if (!window.google || !window.google.maps) {
        setError("Google Maps API object not found after script load.");
        setMapLoadingStatus(APIStatus.ERROR);
        console.error("MapPage: window.google.maps not found after SUCCESS status.");
        return;
      }

      // Initialize the map if it hasn't been already
      if (!mapInstanceRef.current) {
        const defaultLatLng = { lat: 0, lng: 0 };
        mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
          center: defaultLatLng,
          zoom: 2,
          minZoom: 2,
          maxZoom: 18,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
        });

        infoWindowRef.current = new window.google.maps.InfoWindow();
        console.log("MapPage: Google Map instance initialized.");
      }

      // Clear existing markers
      if (markersRef.current.length > 0) {
        markersRef.current.forEach((marker) => marker.setMap(null));
        markersRef.current = [];
        console.log("MapPage: Cleared existing markers.");
      }

      // Group monuments by location
      const groupedMonuments = groupMonumentsByLocation(creations);
      console.log(`MapPage: Grouped ${creations.length} monuments into ${groupedMonuments.size} locations`);

      const bounds = new window.google.maps.LatLngBounds();
      let hasValidCoords = false;
      let markerCount = 0;

      // Create markers for each location group
      groupedMonuments.forEach((monuments, locationKey) => {
        const firstMonument = monuments[0];
        
        if (typeof firstMonument.latitude === 'number' && 
            typeof firstMonument.longitude === 'number' && 
            !isNaN(firstMonument.latitude) && 
            !isNaN(firstMonument.longitude) && 
            mapInstanceRef.current) {
          
          hasValidCoords = true;
          const position = { lat: firstMonument.latitude, lng: firstMonument.longitude };
          
          console.log(`MapPage: Creating marker at (${position.lat}, ${position.lng}) for ${monuments.length} monument(s)`);

          // Create custom label for multiple monuments
          const label = monuments.length > 1 ? {
            text: String(monuments.length),
            color: 'white',
            fontSize: '14px',
            fontWeight: 'bold'
          } : undefined;

          const marker = new window.google.maps.Marker({
            position: position,
            map: mapInstanceRef.current,
            title: monuments.length > 1 
              ? `${monuments.length} monuments at this location` 
              : firstMonument.monument_prompt,
            animation: window.google.maps.Animation.DROP,
            label: label,
          });

          markersRef.current.push(marker);
          markerCount++;

          // Add click listener
          marker.addListener('click', () => {
            if (infoWindowRef.current && mapInstanceRef.current) {
              infoWindowRef.current.setContent(createMarkerContent(monuments));
              infoWindowRef.current.open(mapInstanceRef.current, marker);
              
              // Setup carousel controls after info window opens
              setTimeout(() => setupCarouselControls(monuments), 100);
              
              console.log(`MapPage: Info window opened for ${monuments.length} monument(s)`);
            }
          });

          bounds.extend(position);
        }
      });

      console.log(`MapPage: Created ${markerCount} markers for ${creations.length} monuments`);

      // Adjust map view
      if (hasValidCoords && mapInstanceRef.current) {
        if (markerCount === 1) {
          // Single marker - center on it with reasonable zoom
          const firstPosition = markersRef.current[0].getPosition();
          if (firstPosition) {
            mapInstanceRef.current.setCenter(firstPosition);
            mapInstanceRef.current.setZoom(firstPosition.lat() === 0 && firstPosition.lng() === 0 ? 8 : 12);
          }
        } else {
          // Multiple markers - fit bounds
          mapInstanceRef.current.fitBounds(bounds);
          const currentZoom = mapInstanceRef.current.getZoom();
          if (currentZoom && currentZoom > 15) {
            mapInstanceRef.current.setZoom(15);
          }
        }
      } else if (mapInstanceRef.current) {
        mapInstanceRef.current.setCenter({ lat: 0, lng: 0 });
        mapInstanceRef.current.setZoom(2);
        console.log("MapPage: No valid coordinates, default world view.");
      }
    }
  }, [mapLoadingStatus, dataLoadingStatus, creations, createMarkerContent, setupCarouselControls, groupMonumentsByLocation]);

  const isLoading = mapLoadingStatus === APIStatus.LOADING || dataLoadingStatus === APIStatus.LOADING;
  const hasError = mapLoadingStatus === APIStatus.ERROR || dataLoadingStatus === APIStatus.ERROR || error;

  return (
    <div className="relative w-full h-screen flex flex-col">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 p-4 bg-white bg-opacity-90 shadow-md flex justify-between items-center">
        <h1 className="text-2xl md:text-3xl font-extrabold text-[#1a73e8]">
          Monument Map {creations.length > 0 && `(${creations.length} monuments)`}
        </h1>
        <button
          onClick={onNavigateToCreate}
          className="py-2 px-4 bg-[#4285F4] text-white font-bold rounded-lg shadow-lg hover:bg-[#346dc9] focus:outline-none focus:ring-4 focus:ring-[#a0c3ff] transition-all duration-300 transform active:scale-98"
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
                  <p className="text-xl font-bold mb-2">Failed to Load</p>
                  {renderError(error)}
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
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
  const markersRef = useRef<google.maps.Marker[]>([]);

  const [mapLoadingStatus, setMapLoadingStatus] = useState<APIStatus>(APIStatus.IDLE);
  const [creations, setCreations] = useState<Creation[]>([]);
  const [dataLoadingStatus, setDataLoadingStatus] = useState<APIStatus>(APIStatus.IDLE);
  const [error, setError] = useState<string | null>(null);

  const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

  // Helper function to render error messages
  const renderError = (message: string | null) => {
    if (!message) return null;
    return (
      <div className="bg-[#fee2e2] border border-[#fca5a5] text-[#dc2626] px-4 py-3 rounded-md relative text-center" role="alert">
        <strong className="font-bold">Error: </strong>
        <span className="block sm:inline">{message}</span>
      </div>
    );
  };

  // Function to load image for a specific monument
  const loadMonumentImage = useCallback(async (monumentId: number) => {
    console.log(`Loading image for monument ${monumentId}...`);
    try {
      const response = await fetch(`/api/creations?id=${monumentId}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const data = await response.json();
      
      // Update state
      setCreations(prev => 
        prev.map(c => c.id === monumentId ? { ...c, image_url: data.image_url } : c)
      );
      
      return data.image_url;
    } catch (error) {
      console.error('Error loading monument image:', error);
      return null;
    }
  }, []);

  // Helper function to group monuments by location
  const groupMonumentsByLocation = useCallback((monuments: Creation[]) => {
    const grouped = new Map<string, Creation[]>();
    
    monuments.forEach(monument => {
      const key = `${monument.latitude.toFixed(4)},${monument.longitude.toFixed(4)}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(monument);
    });
    
    return grouped;
  }, []);

  // Create marker content with lazy loading support
  const createMarkerContent = useCallback((monuments: Creation[], currentIndex: number = 0) => {
    if (monuments.length === 1) {
      const creation = monuments[0];
      const hasImage = !!creation.image_url;
      
      return `
        <div class="info-window p-3 max-w-xs">
          <h3 class="font-bold text-lg mb-1">${creation.monument_prompt}</h3>
          <p class="text-sm text-gray-700 mb-2">in "${creation.scene_prompt}"</p>
          ${hasImage 
            ? `<img src="${creation.image_url}" alt="${creation.monument_prompt}" class="w-full h-auto rounded shadow-md object-cover mb-2" />`
            : `<div id="loading-${creation.id}" class="w-full h-48 bg-gray-200 rounded flex items-center justify-center mb-2"><p class="text-gray-500">Loading image...</p></div>`
          }
          <p class="text-xs text-gray-500">${new Date(creation.created_at).toLocaleString()}</p>
          ${hasImage ? `<a href="${creation.image_url}" download="monument-${creation.id}.png" class="block text-center text-blue-600 hover:text-blue-800 text-sm mt-2">Download Full Image</a>` : ''}
        </div>
      `;
    } else {
      // Multiple monuments - carousel
      const monumentsHtml = monuments.map((creation, index) => {
        const hasImage = !!creation.image_url;
        return `
          <div class="monument-slide" data-index="${index}" data-monument-id="${creation.id}" style="display: ${index === currentIndex ? 'block' : 'none'}">
            <h3 class="font-bold text-lg mb-1">${creation.monument_prompt}</h3>
            <p class="text-sm text-gray-700 mb-2">in "${creation.scene_prompt}"</p>
            ${hasImage 
              ? `<img src="${creation.image_url}" alt="${creation.monument_prompt}" class="w-full h-auto rounded shadow-md object-cover mb-2" />`
              : `<div id="loading-${creation.id}" class="w-full h-48 bg-gray-200 rounded flex items-center justify-center mb-2"><p class="text-gray-500">Loading image...</p></div>`
            }
            <p class="text-xs text-gray-500">${new Date(creation.created_at).toLocaleString()}</p>
            ${hasImage ? `<a href="${creation.image_url}" download="monument-${creation.id}.png" class="block text-center text-blue-600 hover:text-blue-800 text-sm mt-2">Download Full Image</a>` : ''}
          </div>
        `;
      }).join('');

      return `
        <div class="info-window p-3 max-w-xs">
          <div class="flex justify-between items-center mb-2">
            <span class="text-sm font-semibold text-gray-700">
              <span id="current-index">${currentIndex + 1}</span> of ${monuments.length} monuments here
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

  // Setup carousel controls with lazy loading
  const setupCarouselControls = useCallback((monuments: Creation[], loadImage: (id: number) => Promise<string | null>) => {
    if (monuments.length <= 1) return;

    let currentIndex = 0;

    const updateDisplay = async () => {
      const slides = document.querySelectorAll('.monument-slide');
      const indexDisplay = document.getElementById('current-index');
      
      slides.forEach((slide, index) => {
        (slide as HTMLElement).style.display = index === currentIndex ? 'block' : 'none';
      });
      
      if (indexDisplay) {
        indexDisplay.textContent = String(currentIndex + 1);
      }

      // Load image for current slide if not loaded
      const currentSlide = slides[currentIndex] as HTMLElement;
      const monumentId = parseInt(currentSlide.dataset.monumentId || '0');
      const monument = monuments.find(m => m.id === monumentId);
      
      if (monument && !monument.image_url && monumentId) {
        console.log(`Loading image for monument ${monumentId} in carousel...`);
        const imageUrl = await loadImage(monumentId);
        
        if (imageUrl) {
          const loadingDiv = document.getElementById(`loading-${monumentId}`);
          if (loadingDiv) {
            loadingDiv.outerHTML = `
              <div>
                <img src="${imageUrl}" alt="${monument.monument_prompt}" class="w-full h-auto rounded shadow-md object-cover mb-2" />
                <a href="${imageUrl}" download="monument-${monumentId}.png" class="block text-center text-blue-600 hover:text-blue-800 text-sm mt-2">Download Full Image</a>
              </div>
            `;
          }
        }
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

    // Load first image
    updateDisplay();
  }, []);

  // Effect to load Google Maps script
  useEffect(() => {
    console.log("MapPage: GOOGLE_MAPS_API_KEY:", GOOGLE_MAPS_API_KEY ? "Present" : "Missing");
    
    const currentStatus = getGoogleMapsScriptStatus();
    
    if (currentStatus === APIStatus.SUCCESS) {
      console.log("MapPage: Google Maps already loaded");
      setMapLoadingStatus(APIStatus.SUCCESS);
      return;
    }
    
    if (currentStatus === APIStatus.IDLE || currentStatus === APIStatus.ERROR) {
      if (!GOOGLE_MAPS_API_KEY) {
        setMapLoadingStatus(APIStatus.ERROR);
        setError("Google Maps API Key is missing.");
        return;
      }

      setMapLoadingStatus(APIStatus.LOADING);
      loadGoogleMapsScript(GOOGLE_MAPS_API_KEY)
        .then(() => {
          setMapLoadingStatus(APIStatus.SUCCESS);
          setError(null);
        })
        .catch((err) => {
          setMapLoadingStatus(APIStatus.ERROR);
          setError(`Map script failed to load: ${err.message}`);
        });
    }
  }, [GOOGLE_MAPS_API_KEY]);

  // Effect to fetch creations
  useEffect(() => {
    setDataLoadingStatus(APIStatus.LOADING);
    getCreations()
      .then((data) => {
        setCreations(data);
        setDataLoadingStatus(APIStatus.SUCCESS);
        console.log("MapPage: Loaded", data.length, "monuments");
      })
      .catch((err) => {
        setDataLoadingStatus(APIStatus.ERROR);
        setError(`Failed to load monuments: ${err.message}`);
      });
  }, []);

  // Effect to initialize map and markers
  useEffect(() => {
    if (mapLoadingStatus === APIStatus.SUCCESS && dataLoadingStatus === APIStatus.SUCCESS && mapRef.current) {
      if (!window.google || !window.google.maps) {
        setError("Google Maps not available");
        return;
      }

      // Initialize map
      if (!mapInstanceRef.current) {
        mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
          center: { lat: 0, lng: 0 },
          zoom: 2,
          minZoom: 2,
          maxZoom: 18,
        });

        infoWindowRef.current = new window.google.maps.InfoWindow({
          maxWidth: 350
        });
      }

      // Clear existing markers
      markersRef.current.forEach(marker => marker.setMap(null));
      markersRef.current = [];

      // Group and create markers
      const groupedMonuments = groupMonumentsByLocation(creations);
      const bounds = new window.google.maps.LatLngBounds();
      let hasValidCoords = false;

      groupedMonuments.forEach((monuments, locationKey) => {
        const firstMonument = monuments[0];
        
        if (typeof firstMonument.latitude === 'number' && typeof firstMonument.longitude === 'number' && mapInstanceRef.current) {
          hasValidCoords = true;
          const position = { lat: firstMonument.latitude, lng: firstMonument.longitude };
          
          const label = monuments.length > 1 ? {
            text: String(monuments.length),
            color: 'white',
            fontSize: '14px',
            fontWeight: 'bold'
          } : undefined;

          const marker = new window.google.maps.Marker({
            position,
            map: mapInstanceRef.current,
            title: monuments.length > 1 ? `${monuments.length} monuments` : firstMonument.monument_prompt,
            label,
          });

          markersRef.current.push(marker);

          // Click handler with lazy loading
          marker.addListener('click', async () => {
            if (!infoWindowRef.current || !mapInstanceRef.current) return;
            
            // Get fresh data from state
            const freshMonuments = monuments.map(m => 
              creations.find(c => c.id === m.id) || m
            );
            
            infoWindowRef.current.setContent(createMarkerContent(freshMonuments, 0));
            infoWindowRef.current.open(mapInstanceRef.current, marker);
            
            // Setup carousel (handles lazy loading internally)
            setTimeout(() => setupCarouselControls(freshMonuments, loadMonumentImage), 100);
          });

          bounds.extend(position);
        }
      });

      // Adjust view
      if (hasValidCoords && mapInstanceRef.current) {
        mapInstanceRef.current.fitBounds(bounds);
        const zoom = mapInstanceRef.current.getZoom();
        if (zoom && zoom > 15) mapInstanceRef.current.setZoom(15);
      }
    }
  }, [mapLoadingStatus, dataLoadingStatus, creations, createMarkerContent, setupCarouselControls, loadMonumentImage, groupMonumentsByLocation]);

  const isLoading = mapLoadingStatus === APIStatus.LOADING || dataLoadingStatus === APIStatus.LOADING;
  const hasError = mapLoadingStatus === APIStatus.ERROR || dataLoadingStatus === APIStatus.ERROR || error;

  return (
    <div className="relative w-full h-screen flex flex-col">
      <div className="absolute top-0 left-0 right-0 z-10 p-4 bg-white bg-opacity-90 shadow-md flex justify-between items-center">
        <h1 className="text-2xl md:text-3xl font-extrabold text-[#1a73e8]">
          Monument Map {creations.length > 0 && `(${creations.length} monuments)`}
        </h1>
        <button
          onClick={onNavigateToCreate}
          className="py-2 px-4 bg-[#4285F4] text-white font-bold rounded-lg shadow-lg hover:bg-[#346dc9] focus:outline-none focus:ring-4 focus:ring-[#a0c3ff] transition-all duration-300 transform active:scale-98"
        >
          Create Monument
        </button>
      </div>

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
                  <p className="text-xl">Loading map...</p>
                </>
              )}
              {hasError && <>{renderError(error)}</>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MapPage;
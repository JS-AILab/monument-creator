import React, { useState, useEffect, useRef, useCallback } from 'react';
import { APIStatus, Creation } from './types';
import { loadGoogleMapsScript, getGoogleMapsScriptStatus } from './services/googleMapsLoader';
import { getCreations } from './services/apiService';

interface MapPageProps {
  onNavigateToCreate: () => void;
}

const MapPage: React.FC<MapPageProps> = ({ onNavigateToCreate }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const imageCache = useRef<Map<number, string>>(new Map());

  const [mapLoadingStatus, setMapLoadingStatus] = useState<APIStatus>(APIStatus.IDLE);
  const [creations, setCreations] = useState<Creation[]>([]);
  const [dataLoadingStatus, setDataLoadingStatus] = useState<APIStatus>(APIStatus.IDLE);
  const [error, setError] = useState<string | null>(null);

  const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

  const renderError = (message: string | null) => {
    if (!message) return null;
    return (
      <div className="bg-[#fee2e2] border border-[#fca5a5] text-[#dc2626] px-4 py-3 rounded-md relative text-center" role="alert">
        <strong className="font-bold">Error: </strong>
        <span className="block sm:inline">{message}</span>
      </div>
    );
  };

  // Load single image with caching
  const loadImage = useCallback(async (monumentId: number): Promise<string | null> => {
    if (imageCache.current.has(monumentId)) {
      return imageCache.current.get(monumentId)!;
    }

    try {
      const response = await fetch(`/api/creations?id=${monumentId}`);
      if (!response.ok) return null;
      
      const data = await response.json();
      if (data.image_url) {
        imageCache.current.set(monumentId, data.image_url);
        return data.image_url;
      }
      return null;
    } catch (err) {
      console.error(`Error loading image for monument ${monumentId}:`, err);
      return null;
    }
  }, []);

  // Group monuments by location
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

  // Load Google Maps
  useEffect(() => {
    const currentStatus = getGoogleMapsScriptStatus();
    
    if (currentStatus === APIStatus.SUCCESS) {
      setMapLoadingStatus(APIStatus.SUCCESS);
      return;
    }
    
    if (currentStatus === APIStatus.IDLE || currentStatus === APIStatus.ERROR) {
      if (!GOOGLE_MAPS_API_KEY) {
        setMapLoadingStatus(APIStatus.ERROR);
        setError("Google Maps API Key missing");
        return;
      }

      setMapLoadingStatus(APIStatus.LOADING);
      loadGoogleMapsScript(GOOGLE_MAPS_API_KEY)
        .then(() => setMapLoadingStatus(APIStatus.SUCCESS))
        .catch((err) => {
          setMapLoadingStatus(APIStatus.ERROR);
          setError(`Map failed: ${err.message}`);
        });
    }
  }, [GOOGLE_MAPS_API_KEY]);

  // Fetch monuments list (fast - no images)
  useEffect(() => {
    setDataLoadingStatus(APIStatus.LOADING);
    getCreations()
      .then((data) => {
        setCreations(data);
        setDataLoadingStatus(APIStatus.SUCCESS);
        console.log(`Loaded ${data.length} monuments`);
      })
      .catch((err) => {
        setDataLoadingStatus(APIStatus.ERROR);
        setError(`Failed to load: ${err.message}`);
      });
  }, []);

  // Initialize map and markers
  useEffect(() => {
    if (mapLoadingStatus !== APIStatus.SUCCESS || dataLoadingStatus !== APIStatus.SUCCESS || !mapRef.current || !window.google?.maps) {
      return;
    }

    // Create map once
    if (!mapInstanceRef.current) {
      mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
        center: { lat: 0, lng: 0 },
        zoom: 2,
      });
      infoWindowRef.current = new window.google.maps.InfoWindow();
    }

    // Clear old markers
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];

    const grouped = groupMonumentsByLocation(creations);
    const bounds = new window.google.maps.LatLngBounds();

    grouped.forEach((monuments) => {
      const first = monuments[0];
      const position = { lat: first.latitude, lng: first.longitude };
      
      // Create marker with number badge
      const marker = new window.google.maps.Marker({
        position,
        map: mapInstanceRef.current!,
        label: {
          text: String(monuments.length),
          color: 'white',
          fontSize: '14px',
          fontWeight: 'bold'
        },
        title: `${monuments.length} monument${monuments.length > 1 ? 's' : ''} here`
      });

      markersRef.current.push(marker);

      // Click handler
      marker.addListener('click', async () => {
        if (!infoWindowRef.current || !mapInstanceRef.current) return;

        let currentIndex = 0;
        const monumentsData: Array<Creation & { image_url?: string }> = [...monuments];

        // Function to render content
        const renderContent = (index: number, imageUrl?: string) => {
          const monument = monumentsData[index];
          const isLoading = !imageUrl && !imageCache.current.has(monument.id);
          
          let html = '<div style="padding: 15px; max-width: 320px; font-family: Arial, sans-serif;">';
          
          // Header with counter for multiple monuments
          if (monumentsData.length > 1) {
            html += `<div style="text-align: center; font-weight: bold; color: #1a73e8; margin-bottom: 10px; font-size: 15px;">Monument ${index + 1} of ${monumentsData.length}</div>`;
          }
          
          // Title and scene
          html += `<h3 style="margin: 0 0 8px 0; font-size: 18px; font-weight: bold; color: #202124;">${monument.monument_prompt}</h3>`;
          html += `<p style="margin: 0 0 12px 0; font-size: 14px; color: #5f6368;">in "${monument.scene_prompt}"</p>`;
          
          // Image or loading placeholder
          if (isLoading) {
            html += `
              <div id="image-container-${monument.id}" style="width: 100%; height: 200px; background: linear-gradient(45deg, #f0f0f0 25%, #e0e0e0 25%, #e0e0e0 50%, #f0f0f0 50%, #f0f0f0 75%, #e0e0e0 75%, #e0e0e0); background-size: 40px 40px; animation: loading 1s linear infinite; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #999; font-size: 14px;">
                <div style="text-align: center;">
                  <div style="margin-bottom: 8px;">⏳</div>
                  <div>Loading image...</div>
                </div>
              </div>
              <style>@keyframes loading { 0% { background-position: 0 0; } 100% { background-position: 40px 40px; } }</style>
            `;
          } else if (imageUrl) {
            html += `<img src="${imageUrl}" alt="${monument.monument_prompt}" style="width: 100%; height: auto; border-radius: 8px; margin-bottom: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">`;
            html += `<p style="margin: 0 0 10px 0; font-size: 12px; color: #999;">${new Date(monument.created_at).toLocaleString()}</p>`;
            html += `<a href="${imageUrl}" download="monument-${monument.id}.png" style="display: block; text-align: center; background: #e8f0fe; color: #1a73e8; text-decoration: none; padding: 10px; border-radius: 6px; font-size: 14px; font-weight: 500;">📥 Download Image</a>`;
          }
          
          // Navigation buttons for multiple monuments
          if (monumentsData.length > 1) {
            html += `
              <div style="display: flex; gap: 10px; margin-top: 15px;">
                <button id="prev-btn-${monument.id}" style="flex: 1; padding: 10px; background: #4285F4; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 14px;">← Previous</button>
                <button id="next-btn-${monument.id}" style="flex: 1; padding: 10px; background: #4285F4; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 14px;">Next →</button>
              </div>
            `;
          }
          
          html += '</div>';
          return html;
        };

        // Function to update window with loaded image
        const updateWithImage = async (index: number) => {
          const monument = monumentsData[index];
          
          // Check if already have image
          let imageUrl = imageCache.current.get(monument.id);
          
          // Open window immediately with loading state
          infoWindowRef.current!.setContent(renderContent(index, imageUrl));
          infoWindowRef.current!.open(mapInstanceRef.current!, marker);
          
          // Setup button handlers
          setTimeout(() => {
            const prevBtn = document.getElementById(`prev-btn-${monument.id}`);
            const nextBtn = document.getElementById(`next-btn-${monument.id}`);
            
            if (prevBtn) {
              prevBtn.onclick = (e) => {
                e.stopPropagation();
                currentIndex = (currentIndex - 1 + monumentsData.length) % monumentsData.length;
                updateWithImage(currentIndex);
              };
            }
            
            if (nextBtn) {
              nextBtn.onclick = (e) => {
                e.stopPropagation();
                currentIndex = (currentIndex + 1) % monumentsData.length;
                updateWithImage(currentIndex);
              };
            }
          }, 50);
          
          // If no image yet, load it
          if (!imageUrl) {
            imageUrl = await loadImage(monument.id);
            
            // Update the content with loaded image
            if (imageUrl && infoWindowRef.current) {
              const container = document.getElementById(`image-container-${monument.id}`);
              if (container) {
                // Replace loading placeholder with actual image
                container.outerHTML = `
                  <div>
                    <img src="${imageUrl}" alt="${monument.monument_prompt}" style="width: 100%; height: auto; border-radius: 8px; margin-bottom: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                    <p style="margin: 0 0 10px 0; font-size: 12px; color: #999;">${new Date(monument.created_at).toLocaleString()}</p>
                    <a href="${imageUrl}" download="monument-${monument.id}.png" style="display: block; text-align: center; background: #e8f0fe; color: #1a73e8; text-decoration: none; padding: 10px; border-radius: 6px; font-size: 14px; font-weight: 500;">📥 Download Image</a>
                  </div>
                `;
              }
            }
          }
        };

        // Start with first monument
        updateWithImage(0);
      });

      bounds.extend(position);
    });

    if (mapInstanceRef.current && !bounds.isEmpty()) {
      mapInstanceRef.current.fitBounds(bounds);
    }
  }, [mapLoadingStatus, dataLoadingStatus, creations, groupMonumentsByLocation, loadImage]);

  const isLoading = mapLoadingStatus === APIStatus.LOADING || dataLoadingStatus === APIStatus.LOADING;
  const hasError = mapLoadingStatus === APIStatus.ERROR || dataLoadingStatus === APIStatus.ERROR;

  return (
    <div className="relative w-full h-screen flex flex-col">
      <div className="absolute top-0 left-0 right-0 z-10 p-4 bg-white bg-opacity-90 shadow-md flex justify-between items-center">
        <h1 className="text-2xl md:text-3xl font-extrabold text-[#1a73e8]">
          Monument Map {creations.length > 0 && `(${creations.length})`}
        </h1>
        <button onClick={onNavigateToCreate} className="py-2 px-4 bg-[#4285F4] text-white font-bold rounded-lg shadow-lg hover:bg-[#346dc9]">
          Create Monument
        </button>
      </div>

      <div ref={mapRef} className="flex-grow w-full h-full bg-gray-200">
        {(isLoading || hasError) && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-60 z-20">
            <div className="text-white text-center p-6 rounded-lg bg-gray-800">
              {isLoading && (
                <>
                  <div className="animate-spin h-8 w-8 border-4 border-white border-t-transparent rounded-full mx-auto mb-4"></div>
                  <p className="text-lg">Loading map...</p>
                </>
              )}
              {hasError && renderError(error)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MapPage;
/**
 * Represents the state of an API call.
 */
export enum APIStatus {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
}

/**
 * Represents the status of a geolocation request.
 * (Note: Direct geolocation input removed from App.tsx, but enum remains if needed for other contexts)
 */
export enum LocationStatus {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  UNAVAILABLE = 'UNAVAILABLE',
  TIMEOUT = 'TIMEOUT',
}

/**
 * Interface for a saved monument creation.
 */
export interface Creation {
  id: number;
  monument_prompt: string;
  scene_prompt: string;
  image_url: string; // Base64 data URI
  created_at: string; // ISO string representation of the timestamp
  latitude: number; // Latitude of the monument
  longitude: number; // Longitude of the monument
}

/**
 * Interface for the response structure when generating content with an image.
 */
export interface GenerateImageResponse {
  base64ImageData: string;
  mimeType: string;
}
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
 * Interface for the response structure when generating content with an image.
 */
export interface GenerateImageResponse {
  base64ImageData: string;
  mimeType: string;
}

/**
 * Global interface for the AI Studio environment to manage API keys.
 */
declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
  interface Window {
    aistudio: AIStudio;
  }
}

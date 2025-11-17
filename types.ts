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
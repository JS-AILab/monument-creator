import { Creation } from '../types'; // Import updated Creation interface

/**
 * Sends a new monument creation to the backend API for storage.
 * @param data An object containing the monument prompt, scene prompt, generated image URL, latitude, longitude, and reCAPTCHA token.
 * @returns A promise that resolves to the newly created Creation object from the database.
 * @throws An error if the API call fails.
 */
export async function saveCreation(data: {
  monumentPrompt: string;
  scenePrompt: string;
  imageUrl: string;
  latitude: number;
  longitude: number;
  recaptchaToken: string; // Added reCAPTCHA token
}): Promise<Creation> {
  const response = await fetch('/api/creations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  const rawText = await response.text();

  if (!response.ok) {
    let errorData;
    try {
      errorData = JSON.parse(rawText.trim());
    } catch (parseError) {
      console.error('Failed to parse error response:', parseError, 'Raw text:', rawText);
      throw new Error(`Failed to save creation. Server responded with malformed JSON: ${rawText}`);
    }
    
    // Throw with the specific error message from the server (includes rate limit messages)
    throw new Error(errorData.error || 'Failed to save creation to the backend.');
  }

  try {
    return JSON.parse(rawText.trim());
  } catch (parseError) {
    console.error('Failed to parse successful creation response:', parseError, 'Raw text:', rawText);
    throw new Error(`Failed to parse creation response. Raw text: ${rawText}`);
  }
}

/**
 * Fetches all stored monument creations from the backend API.
 * @returns A promise that resolves to an array of Creation objects.
 * @throws An error if the API call fails.
 */
export async function getCreations(): Promise<Creation[]> {
  const response = await fetch('/api/creations');

  const rawText = await response.text();

  if (!response.ok) {
    let errorData;
    try {
      errorData = JSON.parse(rawText.trim());
    } catch (parseError) {
      console.error('Failed to parse history error response:', parseError, 'Raw text:', rawText);
      throw new Error(`Failed to fetch history. Server responded with malformed JSON: ${rawText}`);
    }
    throw new Error(errorData.error || 'Failed to fetch creations from the backend.');
  }

  try {
    return JSON.parse(rawText.trim());
  } catch (parseError) {
    console.error('Failed to parse history response:', parseError, 'Raw text:', rawText);
    throw new Error(`Failed to parse history response. Raw text: ${rawText}`);
  }
}

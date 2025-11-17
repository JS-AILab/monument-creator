import { GoogleGenAI, Modality, GenerateContentResponse } from "@google/genai";
import { GenerateImageResponse } from "../types";

const GEMINI_IMAGE_MODEL = 'gemini-2.5-flash-image';

/**
 * Encodes a Uint8Array to a base64 string.
 * @param bytes The Uint8Array to encode.
 * @returns The base64 encoded string.
 */
function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Decodes a base64 string to a Uint8Array.
 * @param base64 The base64 string to decode.
 * @returns The decoded Uint8Array.
 */
function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Generates a monument image by combining two prompts using the Gemini API.
 * The monument is intelligently placed, grounded, and realistically sized within the scene.
 *
 * @param monumentPrompt A description of the person, animal, bird, or object for the monument.
 * @param scenePrompt A description of the scene where the monument needs to be placed.
 * @returns A promise that resolves to an object containing the base64 image data and its mime type.
 * @throws Throws an error if the API call fails or the response does not contain image data.
 */
export async function generateMonumentImage(
  monumentPrompt: string,
  scenePrompt: string
): Promise<GenerateImageResponse> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // Construct the composite prompt based on user requirements.
  const compositePrompt = `Create a photorealistic image where "${monumentPrompt}" is designed as a monument and seamlessly placed in "${scenePrompt}". The monument must be intelligently positioned as a focal point, firmly grounded, and realistically sized relative to its surroundings. Ensure lighting, shadows, and perspective perfectly match the scene, making it indistinguishable from a real photograph.`;

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: GEMINI_IMAGE_MODEL,
      contents: {
        parts: [{ text: compositePrompt }],
      },
      config: {
        responseModalities: [Modality.IMAGE],
      },
    });

    const imageDataPart = response.candidates?.[0]?.content?.parts?.[0]?.inlineData;

    if (imageDataPart && imageDataPart.data && imageDataPart.mimeType) {
      // Decode the base64 string provided by the API if needed, though typically it's already base64 for inlineData.
      // The API returns image data directly as base64 in inlineData.data
      const base64ImageBytes: string = imageDataPart.data;
      const mimeType: string = imageDataPart.mimeType;

      return {
        base64ImageData: base64ImageBytes,
        mimeType: mimeType,
      };
    } else {
      throw new Error("No image data found in the API response.");
    }
  } catch (error) {
    console.error("Error generating monument image:", error);
    // Re-throw to be handled by the calling component
    throw new Error(`Failed to generate image: ${error instanceof Error ? error.message : String(error)}`);
  }
}

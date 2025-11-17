import { GoogleGenAI, Modality, GenerateContentResponse } from "@google/genai";
import { GenerateImageResponse } from "../types";

const GEMINI_IMAGE_MODEL = 'gemini-2.5-flash-image';

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
  const apiKey = process.env.API_KEY;

  if (!apiKey) {
    throw new Error(
      "Google Gemini API Key is not configured. Please ensure your 'API_KEY' " +
      "environment variable is set correctly in your deployment environment (e.g., Vercel)."
    );
  }

  // Always initialize GoogleGenAI here to ensure the latest API_KEY is used.
  const ai = new GoogleGenAI({ apiKey: apiKey });

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
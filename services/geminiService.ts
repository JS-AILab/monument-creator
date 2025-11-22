import { GoogleGenAI, Modality, GenerateContentResponse } from "@google/genai";
import { GenerateImageResponse } from "../types";

const GEMINI_IMAGE_MODEL = 'gemini-2.5-flash-image';
// Using a text model for extracting location, typically a fast one like flash
const GEMINI_TEXT_MODEL = 'gemini-2.5-flash';

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

/**
 * Uses Gemini API to extract the most prominent real-world geographic location from text.
 * If no clear real-world location is found, it returns "Generic World Location".
 *
 * @param monumentPrompt The monument description.
 * @param scenePrompt The scene description.
 * @returns A promise that resolves to a string representing the extracted location or "Generic World Location".
 * @throws Throws an error if the API call fails or the response is invalid.
 */
export async function extractLocationFromPrompt(
  monumentPrompt: string,
  scenePrompt: string
): Promise<string> {
  const apiKey = process.env.API_KEY;

  if (!apiKey) {
    throw new Error(
      "Google Gemini API Key is not configured. Please ensure your 'API_KEY' " +
      "environment variable is set correctly in your deployment environment (e.g., Vercel)."
    );
  }

  const ai = new GoogleGenAI({ apiKey: apiKey });

  const combinedPrompt = `From the following text, strictly identify and return the single most prominent real-world geographic location (city, country, landmark, region, etc.) mentioned or strongly implied.
  If multiple locations are present, pick the one most relevant to the "scene".
  If no clear real-world geographic location is found or implied, explicitly return ONLY the string "Generic World Location".
  Do NOT return fictional places or general descriptors like "forest," "mountain," "city," unless they are part of a specific named location (e.g., "Black Forest, Germany").
  Return the location name only. Do NOT add any other text, explanations, or punctuation.
  Text: "A monument described as '${monumentPrompt}' in a scene of '${scenePrompt}'."`;

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: GEMINI_TEXT_MODEL,
      contents: {
        parts: [{ text: combinedPrompt }],
      },
      config: {
        maxOutputTokens: 50, // Limit output to just the location name
        temperature: 0.1, // Keep temperature low for factual extraction
      },
    });

    const extractedText = response.text?.trim();

    if (extractedText) {
      // Basic cleanup and validation
      const cleanedLocation = extractedText.replace(/['".]/g, '').trim();
      if (cleanedLocation === "Generic World Location") {
        return "Generic World Location";
      }
      return cleanedLocation;
    } else {
      console.warn("Gemini API returned no text for location extraction. Defaulting to 'Generic World Location'.");
      return "Generic World Location";
    }
  } catch (error) {
    console.error("Error extracting location with Gemini:", error);
    // Fallback to generic if API call itself fails
    return "Generic World Location";
  }
}
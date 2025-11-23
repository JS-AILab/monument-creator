import { GoogleGenAI, Modality, GenerateContentResponse } from "@google/genai";
import { GenerateImageResponse } from "../types";

const GEMINI_IMAGE_MODEL = 'models/gemini-2.5-flash-image';
const GEMINI_TEXT_MODEL = 'models/gemini-2.5-flash';

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
    console.error("API_KEY not configured for location extraction");
    throw new Error(
      "Google Gemini API Key is not configured. Please ensure your 'API_KEY' " +
      "environment variable is set correctly in your deployment environment (e.g., Vercel)."
    );
  }

  console.log("Extracting location with API_KEY:", apiKey ? "Present" : "Missing");

  const ai = new GoogleGenAI({ apiKey: apiKey });

  // Improved prompt with more explicit instructions
  const combinedPrompt = `Extract the geographic location from this text and return ONLY the location name.

Text: "A monument described as '${monumentPrompt}' in a scene of '${scenePrompt}'."

Rules:
1. Return the most specific real-world geographic location mentioned (city, landmark, state/province, country)
2. Format: "City, State/Province, Country" or "Landmark, City, Country" (as specific as possible)
3. If multiple locations, choose the one most relevant to the scene
4. If NO real-world location is found, return exactly: "Generic World Location"
5. Do NOT include quotes, explanations, or extra text
6. Examples of GOOD responses: "Atlanta, Georgia, United States" or "Piedmont Park, Atlanta, Georgia" or "Paris, France"

Location:`;

  try {
    console.log("Calling Gemini API for location extraction...");
    
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: GEMINI_TEXT_MODEL,
      contents: {
        parts: [{ text: combinedPrompt }],
      },
      config: {
        maxOutputTokens: 500, // Increased from 50 to allow fuller location names
        temperature: 0.2, // Keep temperature low for factual extraction
      },
    });

    console.log("Gemini response received:", response);
    console.log("Response text:", response.text);

    const extractedText = response.text?.trim();

    if (!extractedText) {
      console.warn("Gemini API returned no text for location extraction. Full response:", JSON.stringify(response, null, 2));
      return "Generic World Location";
    }

    // Basic cleanup and validation
    const cleanedLocation = extractedText.replace(/^["']|["']$/g, '').trim(); // Remove leading/trailing quotes only
    
    console.log("Extracted location after cleanup:", cleanedLocation);

    if (cleanedLocation === "Generic World Location" || cleanedLocation === "") {
      return "Generic World Location";
    }
    
    return cleanedLocation;
    
  } catch (error) {
    console.error("Error extracting location with Gemini:", error);
    console.error("Error details:", error instanceof Error ? error.message : String(error));
    // Fallback to generic if API call itself fails
    return "Generic World Location";
  }
}
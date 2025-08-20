// src/groq.ts

import Groq from "groq-sdk";
import { config } from "./config";
import fs from "fs";

// Initialize the Groq client with your API key from the config.
const groq = new Groq({ apiKey: config.groqApiKey });

/**
 * Transcribes an audio file to text using Groq's Whisper API.
 * @param audioFilePath - The local path to the audio file (e.g., './audio/message.ogg').
 * @returns A promise that resolves to the transcribed text string.
 */
export const transcribeAudio = async (
  audioFilePath: string
): Promise<string> => {
  console.log(`Transcribing audio file: ${audioFilePath}`);
  try {
    const transcription = await groq.audio.transcriptions.create({
      file: fs.createReadStream(audioFilePath),
      model: "whisper-large-v3", // This is a powerful and accurate speech-to-text model.
    });
    console.log("Transcription successful.");
    return transcription.text;
  } catch (error) {
    console.error("Error during transcription:", error);
    return ""; // Return an empty string on failure.
  }
};

/**
 * Extracts booking details from a text prompt using the LLaMA 3 language model.
 * @param text - The user's message (either typed or transcribed).
 * @returns A promise that resolves to a structured object with extracted details.
 */
export const getBookingDetails = async (
  text: string
): Promise<
  Partial<{ service: string; date: string; name: string; missing: string }>
> => {
  console.log(`Getting booking details for text: "${text}"`);
  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          // This is the "prompt engineering" part. We give the AI its persona and instructions.
          content: `You are an expert appointment booking assistant for a salon. Your goal is to extract the service type, date, and time from the user's message.
          - Today's date is ${new Date().toISOString()}.
          - The current time zone is ${config.timezone}.
          - The services available are: "haircut", "beard trim", "coloring", "shave".
          - If a name is provided, extract it.
          - If any information is missing, identify exactly what is needed.
          - Respond ONLY with a JSON object.
          - Example response for a complete request: {"service": "haircut", "date": "2025-08-15T15:00:00.000Z", "name": "Alex"}
          - Example response for an incomplete request: {"missing": "date and time"}
          - Example response if only a name is missing: {"missing": "name"}`,
        },
        {
          role: "user",
          content: text, // The user's actual message.
        },
      ],
      model: "llama3-8b-8192", // A fast and capable model for this task.
      temperature: 0.1, // Low temperature makes the output more predictable and less "creative".
      response_format: { type: "json_object" }, // We explicitly ask for a JSON response.
    });

    const result = chatCompletion.choices[0]?.message?.content;
    if (!result) return {};

    console.log("LLaMA 3 responded with:", result);
    return JSON.parse(result); // Parse the JSON string into a JavaScript object.
  } catch (error) {
    console.error("Error getting booking details from LLaMA 3:", error);
    return {}; // Return an empty object on failure.
  }
};

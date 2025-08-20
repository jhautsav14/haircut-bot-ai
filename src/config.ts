// src/config.ts

import dotenv from "dotenv";

// This line loads the variables from your .env file into process.env
dotenv.config();

/**
 * Configuration object for the application.
 * It pulls values from environment variables, providing default fallbacks
 * and ensuring required variables are present.
 */
export const config = {
  // Your Telegram bot token from BotFather. Required.
  telegramToken: process.env.TELEGRAM_BOT_TOKEN || "",

  // Your API key from GroqCloud. Required.
  groqApiKey: process.env.GROQ_API_KEY || "",

  // Optional: Supabase credentials for a cloud database.
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY,

  // Optional: Set to "true" in .env to enable text-to-speech replies.
  enableTTS: process.env.ENABLE_TTS?.toLowerCase() === "true",

  // The default timezone for interpreting dates like "tomorrow at 5pm".
  timezone: "Asia/Kolkata",
};

// --- Self-check to prevent startup errors ---
// This block ensures the bot won't even try to start if the essential keys are missing.
if (!config.telegramToken || !config.groqApiKey) {
  throw new Error(
    "Missing required environment variables: TELEGRAM_BOT_TOKEN or GROQ_API_KEY must be set in your .env file."
  );
}

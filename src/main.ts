// src/main.ts

import { setupBot } from "./bot";
import { initDB } from "./database";

/**
 * The main function to start the application.
 */
const main = async () => {
  console.log("Initializing database...");
  await initDB(); // Wait for the database to be ready.

  console.log("Setting up bot...");
  const bot = setupBot(); // Configure all bot listeners.

  console.log("Starting bot with long polling...");
  // Launch the bot. It will now start listening for messages from Telegram.
  bot.launch(() => {
    console.log("Bot is running! 🚀");
  });

  // These lines ensure that if you stop the process (e.g., with Ctrl+C),
  // the bot shuts down gracefully instead of just crashing.
  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
};

// Execute the main function and catch any top-level errors.
main().catch((err) => {
  // The error was here. The string needs to be properly closed.
  console.error("❌ Failed to start the bot:", err);
});

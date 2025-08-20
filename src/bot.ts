// src/bot.ts

import { Telegraf, Context, Markup } from "telegraf";
import { message } from "telegraf/filters";
import axios from "axios";
import fs from "fs";
import path from "path";
const Gtts = require("gtts");
import {
  format,
  setHours,
  setMinutes,
  setSeconds,
  isAfter,
  isBefore,
} from "date-fns";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";
import { config } from "./config";
import {
  saveBooking,
  getNearbySalons,
  getSalonById,
  getBookingsForSalonOnDate,
  Salon,
} from "./database";
import { transcribeAudio, getBookingDetails } from "./groq";

const bot = new Telegraf(config.telegramToken);
const audioDir = path.join(__dirname, "../audio");
const userState = new Map<number, any>();

// --- Bot Setup and Main Handlers ---

export const setupBot = () => {
  if (!fs.existsSync(audioDir)) fs.mkdirSync(audioDir);

  bot.start((ctx) => {
    userState.delete(ctx.from.id);
    ctx.reply(
      "Welcome! 💇‍♂️ To find salons, please share your location.",
      Markup.keyboard([
        Markup.button.locationRequest("📍 Share My Location"),
      ]).resize()
    );
  });

  bot.on(message("location"), handleLocation);
  bot.on(message("text"), handleText);
  bot.on(message("voice"), handleVoice);
  bot.on("callback_query", handleCallbackQuery);

  return bot;
};

// --- Message Handlers ---

const handleLocation = async (ctx: Context) => {
  const { latitude, longitude } = (ctx.message as any).location;
  userState.set(ctx.from!.id, { latitude, longitude, awaiting: "details" });
  await ctx.reply(
    'Thanks! Now, what service would you like and for when? (e.g., "haircut for tomorrow for Alex")',
    Markup.removeKeyboard()
  );
};

const handleText = async (ctx: Context) => {
  const text = (ctx.message as any).text;
  const state = userState.get(ctx.from!.id);

  if (!state || !state.latitude) {
    return promptForLocation(ctx);
  }

  if (state.awaiting === "details") {
    await processBookingDetails(ctx, text);
  } else if (state.awaiting === "name") {
    const fullDetails = { ...state, name: text };
    userState.set(ctx.from!.id, fullDetails);
    await showNearbySalons(ctx, fullDetails);
  }
};

const handleVoice = async (ctx: Context) => {
  const transcribedText = await transcribeVoiceMessage(ctx);
  if (transcribedText) {
    await ctx.reply(`I heard: "${transcribedText}"`);
    (ctx.message as any).text = transcribedText;
    await handleText(ctx);
  }
};

const handleCallbackQuery = async (ctx: Context) => {
  const callbackData = (ctx.callbackQuery as any).data;
  const userId = ctx.from!.id;
  const state = userState.get(userId);

  if (!state) return;

  if (callbackData.startsWith("select_salon_")) {
    const salonId = parseInt(callbackData.replace("select_salon_", ""));
    userState.set(ctx.from!.id, { ...state, salon_id: salonId });
    await ctx.answerCbQuery(`Fetching slots...`);
    await showAvailableSlots(ctx, salonId);
  } else if (callbackData.startsWith("select_time_")) {
    const time = callbackData.replace("select_time_", "");
    const [hours, minutes] = time.split(":").map(Number);

    const bookingDate = toZonedTime(new Date(state.date), config.timezone);
    bookingDate.setHours(hours, minutes, 0, 0);

    const finalDetails = { ...state, date: bookingDate.toISOString() };
    await ctx.answerCbQuery(`Booking for ${time}...`);
    await bookAppointment(ctx, finalDetails);
  }
};

// --- Core Logic Functions ---

const processBookingDetails = async (ctx: Context, text: string) => {
  const userId = ctx.from!.id;
  const state = userState.get(userId);

  await ctx.replyWithChatAction("typing");
  const details = await getBookingDetails(text);

  if (!details.service || !details.date) {
    return reply(
      ctx,
      `I'm sorry, I didn't catch that. Please tell me the service and the date.`
    );
  }

  const fullDetails = { ...state, ...details };
  userState.set(userId, fullDetails);

  if (!details.name) {
    userState.set(userId, { ...fullDetails, awaiting: "name" });
    await reply(ctx, "Got it. And what name should I use for the booking?");
  } else {
    await showNearbySalons(ctx, fullDetails);
  }
};

const showNearbySalons = async (ctx: Context, details: any) => {
  const { latitude, longitude } = details;
  await reply(ctx, "Perfect! Searching for salons...");
  const salons = await getNearbySalons(latitude, longitude);

  if (salons.length === 0) {
    return reply(ctx, "Sorry, I couldn’t find any salons within 5km.");
  }

  await reply(
    ctx,
    "Here are the best options. Please choose a salon to see available times:"
  );
  for (const salon of salons) {
    const caption = `${salon.name}\nStarting Price: ₹${salon.starting_price}`;
    const inlineKeyboard = Markup.inlineKeyboard([
      Markup.button.callback(
        "Choose & See Times 🕒",
        `select_salon_${salon.id}`
      ),
    ]);
    try {
      await ctx.replyWithPhoto(
        { url: salon.image_url },
        { caption, ...inlineKeyboard }
      );
    } catch (error) {
      await ctx.reply(caption, inlineKeyboard);
    }
  }
};

const showAvailableSlots = async (ctx: Context, salonId: number) => {
  const state = userState.get(ctx.from!.id);
  if (!state || !state.date) return;

  const salon = await getSalonById(salonId);
  if (!salon)
    return reply(ctx, "Sorry, I couldn’t find details for that salon.");

  const requestedDate = toZonedTime(new Date(state.date), config.timezone);
  const existingBookings = await getBookingsForSalonOnDate(
    salonId,
    requestedDate
  );
  const serviceDuration = 30;

  const [openH, openM] = salon.opening_time.split(":").map(Number);
  const [closeH, closeM] = salon.closing_time.split(":").map(Number);

  let slot = setSeconds(
    setMinutes(setHours(new Date(requestedDate), openH), openM),
    0
  );
  const closingTime = setSeconds(
    setMinutes(setHours(new Date(requestedDate), closeH), closeM),
    0
  );

  const availableSlots: string[] = [];

  while (isBefore(slot, closingTime)) {
    const bookingsAtThisSlot = existingBookings.filter(
      (bookingTime) => new Date(bookingTime).getTime() === slot.getTime()
    ).length;

    if (bookingsAtThisSlot < salon.barber_count) {
      if (isAfter(slot, new Date())) {
        availableSlots.push(format(slot, "HH:mm"));
      }
    }
    slot = new Date(slot.getTime() + serviceDuration * 60000);
  }

  if (availableSlots.length === 0) {
    return reply(
      ctx,
      `Sorry, ${salon.name} has no available slots on ${format(
        requestedDate,
        "MMMM d"
      )}. Would you like to try another day?`
    );
  }

  const slotButtons = availableSlots.map((time) =>
    Markup.button.callback(time, `select_time_${time}`)
  );
  const keyboard = Markup.inlineKeyboard(slotButtons, { columns: 4 });

  await ctx.reply(
    `Here are the available slots for ${salon.name} on ${format(
      requestedDate,
      "MMMM d"
    )}. Please choose a time:`,
    keyboard
  );
};

const bookAppointment = async (ctx: Context, details: any) => {
  const { name, service, date, salon_id } = details;
  userState.delete(ctx.from!.id);

  const bookingTime = new Date(date);
  const salon = await getSalonById(salon_id);

  if (!salon) {
    return reply(ctx, "Sorry, an error occurred while fetching salon details.");
  }

  const success = await saveBooking({
    name,
    service,
    booking_time: bookingTime.toISOString(),
    salon_id,
  });

  if (success) {
    const formattedDate = formatInTimeZone(
      bookingTime,
      config.timezone,
      "eeee, MMMM d 'at' h:mm a"
    );
    const assignedBarber = Math.floor(Math.random() * salon.barber_count) + 1;
    const locationLink = `https://www.google.com/maps?q=${salon.latitude},${salon.longitude}`;
    const otp = Math.floor(1000 + Math.random() * 9000);

    const escapeMarkdown = (text: string) =>
      text.replace(/([_*\[\]()~`>#+-=|{}.!])/g, "\\$1");

    const confirmationText = `
✅ *Booking Confirmed\\!*

*Salon:* ${escapeMarkdown(salon.name)}
*Service:* ${escapeMarkdown(service)}
*For:* ${escapeMarkdown(name)}

*Date & Time:* ${escapeMarkdown(formattedDate)}
*Assigned to:* Barber \\#${assignedBarber}
*Your OTP:* *${otp}*

*Location:* [View on Google Maps](${locationLink})

Please show this confirmation and provide your OTP at the salon\\.
    `;

    // Send the final confirmation message
    await ctx.telegram.sendMessage(ctx.chat!.id, confirmationText, {
      parse_mode: "MarkdownV2",
    });
  } else {
    await reply(ctx, "Sorry, there was an error saving your booking.");
  }
};

// --- Utility Functions ---

const promptForLocation = (ctx: Context) => {
  ctx.reply(
    "I need your location to get started. Please use the button below.",
    Markup.keyboard([
      Markup.button.locationRequest("📍 Share My Location"),
    ]).resize()
  );
};

const reply = async (ctx: Context, text: string) => {
  await ctx.reply(text);
};

const transcribeVoiceMessage = async (ctx: Context): Promise<string | null> => {
  try {
    const fileId = (ctx.message as any).voice.file_id;
    const fileLink = await ctx.telegram.getFileLink(fileId);
    const response = await axios({
      url: fileLink.href,
      responseType: "stream",
    });
    const filePath = path.join(audioDir, `${fileId}.ogg`);
    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);

    await new Promise<void>((resolve, reject) => {
      writer.on("finish", resolve);
      writer.on("error", reject);
    });

    const text = await transcribeAudio(filePath);
    fs.unlinkSync(filePath);
    return text;
  } catch (error) {
    console.error("Error processing voice message:", error);
    await reply(ctx, "Sorry, I had trouble with that voice message.");
    return null;
  }
};

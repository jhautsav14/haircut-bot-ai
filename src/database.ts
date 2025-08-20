// src/database.ts

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { config } from "./config";

let db: SupabaseClient;

export const initDB = async () => {
  if (config.supabaseUrl && config.supabaseAnonKey) {
    console.log("Using Supabase for database.");
    db = createClient(config.supabaseUrl, config.supabaseAnonKey);
  } else {
    throw new Error(
      "Supabase URL and Key are required. Please update your .env file."
    );
  }
};

/**
 * Interface for a Salon object, now including location coordinates.
 */
export interface Salon {
  id: number;
  name: string;
  starting_price: number;
  image_url: string;
  opening_time: string;
  closing_time: string;
  barber_count: number;
  latitude: number;
  longitude: number;
}

/**
 * Fetches the full details for a single salon by its ID using an RPC.
 */
export const getSalonById = async (salonId: number): Promise<Salon | null> => {
  try {
    const { data, error } = await db
      .rpc("get_salon_details", { salon_id_input: salonId })
      .single();

    if (error) throw error;
    return data as Salon | null;
  } catch (error) {
    console.error(`Error fetching salon with ID ${salonId}:`, error);
    return null;
  }
};

/**
 * Finds salons within a 5km radius of the user's location.
 */
export const getNearbySalons = async (
  latitude: number,
  longitude: number
): Promise<Salon[]> => {
  try {
    const { data, error } = await db.rpc("get_nearby_salons", {
      lat: latitude,
      long: longitude,
      radius: 5000,
    });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("Error fetching nearby salons:", error);
    return [];
  }
};

/**
 * Fetches all bookings for a specific salon on a given date.
 */
export const getBookingsForSalonOnDate = async (
  salonId: number,
  date: Date
): Promise<string[]> => {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  try {
    const { data, error } = await db
      .from("bookings")
      .select("booking_time")
      .eq("salon_id", salonId)
      .gte("booking_time", startOfDay.toISOString())
      .lte("booking_time", endOfDay.toISOString());

    if (error) throw error;
    return data.map((b) => b.booking_time);
  } catch (error) {
    console.error(
      `Error fetching bookings for salon ${salonId} on ${date}:`,
      error
    );
    return [];
  }
};

export interface Booking {
  name: string;
  service: string;
  booking_time: string;
  salon_id: number;
}

export const saveBooking = async (booking: Booking): Promise<boolean> => {
  try {
    const { error } = await db.from("bookings").insert([booking]);
    if (error) throw error;
    console.log("✅ Booking saved successfully:", booking);
    return true;
  } catch (error) {
    console.error("❌ Failed to save booking:", error);
    return false;
  }
};

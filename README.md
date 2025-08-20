# 🤖 AI Haircut Booking Bot for Telegram

An intelligent, location-aware **Telegram bot** that allows users to find nearby hair salons and book appointments in real-time through a natural, conversational interface.

This project leverages a **modern free-tech stack**, using **Groq’s LLaMA 3** for Natural Language Understanding, **Whisper API** for voice-to-text transcription, and **Supabase with PostGIS** for efficient geographic data management and booking storage.

---

## ✨ Key Features
- **Conversational AI** – Understands natural language requests for services, dates, and times via text or voice messages.  
- **Location-Aware Salon Search** – Asks for the user’s location to find and display the closest salons.  
- **Real-Time Slot Management** – Dynamically calculates and shows available appointment slots based on a salon’s operating hours, number of barbers, and existing bookings (prevents overbooking).  
- **Interactive Booking Flow** – Guides the user through selecting a salon and an available time slot using interactive buttons.  
- **Detailed Confirmations** – Sends a final confirmation with all appointment details, a Google Maps link, and a unique OTP for verification.  
- **Voice & Text Support** – Accepts both typed messages and voice notes for maximum accessibility.  
- **Free Tech Stack** – Built entirely with free-tier services, making it cost-effective to run and deploy.  

---

## 🛠️ Tech Stack
- **Bot Framework**: [Telegraf.js](https://telegraf.js.org/)  
- **Language**: TypeScript  
- **AI & NLU**: [GroqCloud (LLaMA 3)](https://groq.com/)  
- **Speech-to-Text**: [GroqCloud Whisper](https://groq.com/)  
- **Database**: [Supabase (PostgreSQL + PostGIS)](https://supabase.com/)  
- **Date & Time Management**: [date-fns](https://date-fns.org/) & [date-fns-tz](https://date-fns.org/v2.30.0/docs/Time-Zones)  
- **Deployment**: Ready for [Railway](https://railway.app/) or [Render](https://render.com/)  

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or newer)  
- A Telegram Bot Token from [@BotFather](https://t.me/botfather)  
- A **Groq API Key** from [GroqCloud](https://groq.com/)  
- A free [Supabase](https://supabase.com/) project for the database  

---

### Installation
Clone the repository:

```bash
git clone https://github.com/jhautsav14/haircut-bot-ai.git
cd haircut-bot-ai

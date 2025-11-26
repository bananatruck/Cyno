Project Proposal: Cyno - The Agentic Astronomy Companion (72-Hour Sprint Edition)

Table of Contents

Executive Summary

Core Feature Set (MVP Scope)

UI/UX Design Philosophy

The "Speed-Run" Tech Stack

The 72-Hour Development Roadmap

Phased Store Rollout Strategy

Google Play Store Submission Guide

1. Executive Summary

Cyno is an intelligent, agentic companion for the modern astronomer, designed to be built in a high-intensity 3-day sprint. By leveraging native Android capabilities and a multi-agent AI architecture, Cyno transforms raw astronomical data into a personalized, serene experience.

The core philosophy is "Comfort in the Cosmos." We prioritize preserving night vision, reducing information overload through AI summarization, and fostering connection through social stargazing.

2. Core Feature Set (MVP Scope)

A. "Cyno Vision" (AR Sky Mapper)

Functionality: Users point their phone at the sky. Using sensor fusion (GPS + Gyroscope), the app overlays constellations and planets.

The "Agentic" Twist: The Vision Agent highlights objects based on immediate relevance (e.g., "Jupiter is at opposition right now—best visibility in 12 months").

Tech: Google ARCore, SceneView.

B. The Cosmic Briefer (Enhanced AI News)

Functionality: An autonomous agent ingests raw feeds (NASA APOD, SpaceWeather.com).

AI Value Add:

Context Awareness: It doesn't just show news; it correlates it with your weather. Cloudy night? It suggests a relevant space documentary or article. Clear skies? It pushes a "Go Outside Now" alert for a visible satellite pass.

Hyper-Personalization: The AI learns if you prefer "Planetary Science" over "Cosmology" and filters the daily briefing accordingly.

C. The Smart Stargazing Planner

Functionality: A "One-Click Plan" button.

The Agentic Logic: The agent queries weather APIs and Light Pollution maps instantly. It produces a "Go/No-Go" score for the night and suggests the nearest dark park if your backyard is too bright.

3. UI/UX Design Philosophy: "Nebula & Glass"

Red-Light Mode Protocol: A global tint toggle to preserve night vision (essential for credibility with astronomers).

Glassmorphism: Translucent UI elements that float over the AR feed, keeping the user immersed in the sky.

4. The "Speed-Run" Tech Stack

To achieve this in 3 days, we rely on managed services and rapid frameworks:

A. Mobile (Android Native)

Language: Kotlin (Jetpack Compose for UI speed).

AR Engine: SceneView (Simplifies ARCore implementation significantly).

Location: FusedLocationProviderClient.

B. Backend & AI (Serverless/Edge)

Logic: Python (FastAPI) running on a serverless container (e.g., Google Cloud Run) for instant deployment.

Database: Supabase (PostgreSQL wrapper) for instant setup of Auth, Database, and Vector Embeddings.

AI Models: Gemini 1.5 Flash (Low latency, high speed) via API.

Role: Summarizing news, generating "Stargazing Forecasts," and parsing natural language queries.

5. The 72-Hour Development Roadmap

Day 1: The Eye & The Skeleton (Core Mechanics)

0-4 Hours: Project setup (Kotlin, Supabase, Gradle dependencies).

4-12 Hours: AR Implementation. Get the camera feed running and overlay a single static 3D object (e.g., the Moon) anchored to a compass direction.

12-24 Hours: Sensor Fusion. Connect Gyroscope data to the AR view so the "Moon" stays in place when the user turns.

Day 2: The Brain (AI Integration)

0-8 Hours: News Agent. Build the Python script to fetch NASA RSS feeds. Pipe them into Gemini 1.5 Flash with the prompt: "Summarize this for a casual stargazer."

8-16 Hours: Planner Agent. Integrate OpenWeatherMap API. Create the logic: IF (CloudCover < 20% AND MoonPhase == 'New') THEN recommend = TRUE.

16-24 Hours: Vector Search. Store news summaries in Supabase Vector. Enable a chat interface where users can ask, "What's happening in the sky tonight?"

Day 3: The Skin & Polish (UI/UX)

0-8 Hours: Glassmorphism UI. Build the transparent cards in Jetpack Compose. Implement the Red-Light Mode (color matrix filter).

8-16 Hours: Social Features. Simple "Invite Friend" link generation that shares the AI's "Go/No-Go" score.

16-20 Hours: Testing & Bug Fixes. Calibrate compass offset. Ensure text is readable in Red Mode.

Final 4 Hours: Deployment. Push APK to internal track, deploy FastAPI to Cloud Run.

6. Phased Store Rollout Strategy

Launching "small" first reduces risk and complexity.

Phase 1: "Cyno Buddy" (The Low-Risk Launch)

Features: Only the AI Planner, News Agent, and Dark Sky Map.

Why: No complex AR camera permissions, no sensor calibration issues, very stable.

Goal: Pass Google Play review quickly and build a user base of people interested in planning.

Phase 2: "Cyno Vision" (The Big Update)

Features: Add the AR Sky Mapper as a "v2.0" update.

Why: You now have time to perfect the compass/gyroscope smoothing while users enjoy Phase 1.

7. Google Play Store Submission Guide

Step 1: The Account ($25)

Go to the Google Play Console.

Pay the one-time $25 registration fee.

Verify your identity (ID upload required).

Step 2: The "Closed Testing" Gauntlet (Crucial!)

Note: Personal accounts created after Nov 2023 must do this.

Requirement: You must run a "Closed Test" with at least 20 testers for 14 consecutive days.

Action: Recruit 20 friends (or use a testing community). Add their emails to the Closed Testing track.

They must install the app and keep it installed for 2 weeks.

Step 3: Store Listing

Screenshots: Take clean screenshots (use "Red Mode" screenshots to show off the unique feature).

Privacy Policy: Essential because you use the Camera and Location. You must host a simple privacy policy page (GitHub Pages works for this).

Content Rating: Fill out the questionnaire (Rated "E" for Everyone).

Step 4: Production Review

After the 14-day test, apply for Production Access.

Google reviews the app (usually takes 3–7 days).

Once approved, your app is live!

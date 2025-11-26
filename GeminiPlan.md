
# Project Proposal: Cyno – The Agentic Astronomy Companion (72-Hour Sprint Edition)

## Table of Contents

* [Executive Summary](#1-executive-summary)
* [Core Feature Set (MVP Scope)](#2-core-feature-set-mvp-scope)
* [UI/UX Design Philosophy](#3-uiux-design-philosophy)
* [The "Speed-Run" Tech Stack](#4-the-speed-run-tech-stack)
* [The 72-Hour Development Roadmap](#5-the-72-hour-development-roadmap)
* [Phased Store Rollout Strategy](#6-phased-store-rollout-strategy)
* [Google Play Store Submission Guide](#7-google-play-store-submission-guide)

---

## 1. Executive Summary

**Cyno** is an intelligent, agentic companion for the modern astronomer, designed to be built in a high-intensity **3-day sprint**.
By leveraging native Android capabilities and a **multi-agent AI architecture**, Cyno transforms raw astronomical data into a personalized, serene experience.

**Philosophy:** “Comfort in the Cosmos.”
We focus on:

* Preserving night vision.
* Reducing information overload through AI summarization.
* Fostering connection via social stargazing.

---

## 2. Core Feature Set (MVP Scope)

### A. **Cyno Vision (AR Sky Mapper)**

**Functionality:**
Users point their phone at the sky; using **sensor fusion (GPS + Gyroscope)**, the app overlays constellations and planets.

**Agentic Twist:**
The Vision Agent highlights objects based on relevance —

> e.g., “Jupiter is at opposition right now — best visibility in 12 months.”

**Tech:**
Google ARCore, SceneView.

---

### B. **The Cosmic Briefer (Enhanced AI News)**

**Functionality:**
An autonomous agent ingests raw feeds (e.g., NASA APOD, SpaceWeather.com).

**AI Value Add:**

* **Context Awareness:**
  Cloudy night? Suggest a documentary.
  Clear skies? Trigger a “Go Outside Now” alert for satellite passes.
* **Hyper-Personalization:**
  Learns user preferences (e.g., Planetary Science vs Cosmology).

---

### C. **The Smart Stargazing Planner**

**Functionality:**
A “One-Click Plan” button that analyzes weather, moon phase, and light pollution.

**Agentic Logic:**
Combines data to produce a **Go/No-Go Score** and suggests nearby dark parks.

---

## 3. UI/UX Design Philosophy: “Nebula & Glass”

* **Red-Light Mode Protocol:**
  A global tint toggle to preserve night vision — a must for astronomers.
* **Glassmorphism:**
  Translucent UI elements float over the AR feed, keeping immersion intact.

---

## 4. The "Speed-Run" Tech Stack

To deliver in 72 hours, Cyno uses rapid-deploy frameworks and managed services.

### A. **Mobile (Android Native)**

* Language: **Kotlin** (Jetpack Compose for UI)
* AR Engine: **SceneView** (simplified ARCore integration)
* Location: **FusedLocationProviderClient**

### B. **Backend & AI (Serverless/Edge)**

* Framework: **Python (FastAPI)** on **Google Cloud Run**
* Database: **Supabase** (PostgreSQL + Vector embeddings)
* AI Model: **Gemini 1.5 Flash**

  * Summarizes news
  * Generates stargazing forecasts
  * Parses natural language queries

---

## 5. The 72-Hour Development Roadmap

### **Day 1: The Eye & The Skeleton (Core Mechanics)**

| Time      | Milestone                                         |
| --------- | ------------------------------------------------- |
| 0-4 hrs   | Project setup (Kotlin, Supabase, Gradle)          |
| 4-12 hrs  | AR camera feed & static overlay (e.g., Moon)      |
| 12-24 hrs | Sensor fusion (Gyroscope + Compass stabilization) |

---

### **Day 2: The Brain (AI Integration)**

| Time      | Milestone                                            |
| --------- | ---------------------------------------------------- |
| 0-8 hrs   | Build “News Agent” to fetch and summarize NASA feeds |
| 8-16 hrs  | Integrate weather API & planning logic               |
| 16-24 hrs | Add vector search + chat interface for sky queries   |

---

### **Day 3: The Skin & Polish (UI/UX)**

| Time        | Milestone                                           |
| ----------- | --------------------------------------------------- |
| 0-8 hrs     | Build Glassmorphism UI + Red-Light Mode             |
| 8-16 hrs    | Add “Invite Friend” social share for Go/No-Go score |
| 16-20 hrs   | Testing, calibration, readability tuning            |
| Final 4 hrs | Deploy APK + FastAPI backend                        |

---

## 6. Phased Store Rollout Strategy

### **Phase 1: “Cyno Buddy” (Low-Risk Launch)**

* **Includes:** AI Planner, News Agent, Dark Sky Map
* **Excludes:** AR features (no sensor calibration risk)
* **Goal:** Quick approval and early adoption.

### **Phase 2: “Cyno Vision” (Major Update)**

* **Adds:** AR Sky Mapper module
* **Why:** Focused optimization and compass refinement post-launch.

---

## 7. Google Play Store Submission Guide

### **Step 1: Account Setup ($25)**

* Go to [Google Play Console](https://play.google.com/console)
* Pay one-time fee
* Verify identity (upload ID)

---

### **Step 2: Closed Testing (Mandatory)**

> Required for new developer accounts (after Nov 2023)

* Run a **Closed Test** with at least **20 testers** for **14 days**
* Add tester emails in Play Console
* Ensure they install and keep the app for 2 weeks

---

### **Step 3: Store Listing**

* **Screenshots:** Highlight “Red Mode”
* **Privacy Policy:** Must host a public page (GitHub Pages works)
* **Content Rating:** Rated “E for Everyone”

---

### **Step 4: Production Review**

* Apply for production access post-test
* Google review: typically **3–7 days**
* Once approved → **App is live!**

---

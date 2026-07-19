# Full-Stack Streaming & Downloader Web Application

This repository contains a full-stack web application designed for high performance, ease of deployment, and cost efficiency. The architecture is split into a **backend service** optimized for the **Koyeb Free Tier** and a **frontend user interface** optimized for **Cloudflare Pages**.

---

## 🚀 Architecture Overview

### 1. Backend Service (Koyeb Free Tier)
The backend is an Express Node.js application (`server.ts`) that manages:
- MongoDB connection and automated collection/column schema migrations.
- R2 Storage stream indexes, analytics, and file metadata.
- Download token generation and secure task validation endpoints.
- Auto-ping self-keepawake mechanisms to prevent the container from sleeping on the free tier.

**Designed for:** **Koyeb (Web Service / Docker container)** or any Node.js container hosting provider.

### 2. Frontend Application (Cloudflare Pages)
The frontend is a fast React application powered by Vite and styled with Tailwind CSS. It handles:
- Interactive user dashboard and video player view.
- Secure Admin dashboard with custom paginated video streaming records.
- Responsive task completion views with external unlock keys.

**Designed for:** **Cloudflare Pages** (Static hosting platform for lightning-fast delivery and free global CDN).

---

## 📋 Required Environment Variables

To successfully connect your frontend (Cloudflare Pages) with your backend (Koyeb), you must configure the following environment variables on each respective hosting platform.

### A. Koyeb Environment Variables (Backend)
These variables must be set in your Koyeb service dashboard:

| Variable Name | Required / Optional | Description | Example Value |
| :--- | :--- | :--- | :--- |
| `MONGODB_URI` | **Required** | MongoDB connection string for database storage. Without this, the server falls back to a temporary local JSON file, showing "MongoDB is Offline". | `mongodb+srv://user:pass@cluster.mongodb.net/dbname` |
| `GEMINI_API_KEY` | Optional | API Key for any integrated Gemini AI capabilities. | `AIzaSy...` |
| `APP_URL` | Optional | The canonical URL of your deployed application backend. | `https://your-backend.koyeb.app` |
| `SELF_URL` | Optional | Your backend's Koyeb public URL to trigger the self-keepawake ping. | `https://your-backend.koyeb.app` |
| `PING_INTERVAL_MINUTES` | Optional | The auto-ping interval in minutes to keep the container awake (Default: `5`). | `5` |
| `CHANNEL_LINK` | Optional | Support / Channel link for video stream issues. | `https://t.me/your_channel` |
| `TASK1_LINK` | Optional | External unlock link for Task 1. | `https://linkvertise.com/...` |
| `TASK2_LINK` | Optional | External unlock link for Task 2. | `https://linkvertise.com/...` |
| `TASK3_LINK` | Optional | External unlock link for Task 3. | `https://linkvertise.com/...` |

---

### B. Cloudflare Pages Environment Variables (Frontend)
These variables must be set in the **Cloudflare Pages dashboard** under **Settings > Environment variables > Production** (and Preview):

| Variable Name | Required / Optional | Description | Example Value |
| :--- | :--- | :--- | :--- |
| `VITE_API_URL` | **Required** | The public URL of your backend server deployed on Koyeb. This bridges the frontend with the database. | `https://your-backend.koyeb.app` |
| `VITE_ADMIN_PASSWORD` | **Required** | The security password required to unlock and access the Admin Dashboard. | `MySecureAdminPassword123` |

---

## 🛠️ Troubleshooting: "MongoDB is Offline" or "Local JSON File" Error

If your Cloudflare Pages site displays **"MongoDB is Offline (Local file)"**, it is because the frontend static app cannot communicate with a running database-connected backend. 

### How to Fix:
1. **Deploy your backend on Koyeb**: Ensure you deploy this project as a Web Service on Koyeb.
2. **Add `MONGODB_URI` on Koyeb**: Make sure your valid MongoDB Atlas connection string is saved in the Koyeb Environment Variables.
3. **Link Frontend to Backend**: In your Cloudflare Pages project settings, add the environment variable `VITE_API_URL` and set its value to your **Koyeb public URL** (e.g., `https://your-app-name.koyeb.app`).
4. **Redeploy**: Redeploy your Cloudflare Pages site to apply the new environment variables. Once connected, your database status will change to **Online (MongoDB)**!

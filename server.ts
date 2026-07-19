import express from "express";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { fileURLToPath } from "url";
import { MongoClient } from "mongodb";
import http from "http";
import https from "https";

// Load environment variables
dotenv.config();

// Support both ESM and CJS environments safely without TypeScript block-scope errors
const getAppDirname = (): string => {
  try {
    if (import.meta && import.meta.url) {
      return path.dirname(fileURLToPath(import.meta.url));
    }
  } catch (e) {}
  
  try {
    // @ts-ignore
    if (typeof __dirname !== "undefined" && __dirname) {
      // @ts-ignore
      return __dirname;
    }
  } catch (e) {}

  return process.cwd();
};

const currentDirname = getAppDirname();

const DB_PATH = path.join(currentDirname, "src", "db", "videos.json");

// Define custom session store
interface DownloadSession {
  slug: string;
  task1StartedAt?: number;
  task1Completed: boolean;
  task2StartedAt?: number;
  task2Completed: boolean;
  task3StartedAt?: number;
  task3Completed: boolean;
}

const sessions: Record<string, any> = {};

// Helper to read database
function readVideos(): any[] {
  try {
    if (fs.existsSync(DB_PATH)) {
      const data = fs.readFileSync(DB_PATH, "utf-8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.error("Error reading database:", error);
  }
  return [];
}

// Helper to write database
function writeVideos(videos: any[]) {
  try {
    // Ensure src/db exists
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DB_PATH, JSON.stringify(videos, null, 2), "utf-8");
  } catch (error) {
    console.error("Error writing database:", error);
  }
}

// --- MONGODB CONNECTION & WRAPPER LAYERS ---
let mongoClient: MongoClient | null = null;
let dbInstance: any = null;
let isMongoActive = false;

async function getMongoDb() {
  if (!process.env.MONGODB_URI) {
    isMongoActive = false;
    return null;
  }
  if (dbInstance) {
    isMongoActive = true;
    return dbInstance;
  }
  try {
    mongoClient = new MongoClient(process.env.MONGODB_URI);
    await mongoClient.connect();
    dbInstance = mongoClient.db();
    isMongoActive = true;
    console.log("MongoDB connection successfully established!");
    return dbInstance;
  } catch (err) {
    console.error("MongoDB connection failed, using local JSON database fallback:", err);
    isMongoActive = false;
    return null;
  }
}

async function dbFetchVideos(): Promise<any[]> {
  const db = await getMongoDb();
  if (db && isMongoActive) {
    try {
      const col = db.collection("videos");
      const videos = await col.find({}).toArray();
      if (videos.length === 0) {
        // Auto-seed database from local videos.json if collection is empty
        const local = readVideos();
        if (local.length > 0) {
          console.log("Seeding MongoDB collection 'videos' with initial items...");
          await col.insertMany(local);
          return local;
        }
      }
      return videos;
    } catch (err) {
      console.error("Failed to fetch from MongoDB, falling back to JSON:", err);
    }
  }
  return readVideos();
}

async function dbFetchVideoBySlug(slug: string): Promise<any | null> {
  const db = await getMongoDb();
  if (db && isMongoActive) {
    try {
      const video = await db.collection("videos").findOne({ slug });
      if (video) return video;
    } catch (err) {
      console.error("Failed to find video by slug from MongoDB:", err);
    }
  }
  const local = readVideos();
  return local.find((v) => v.slug === slug) || null;
}

async function dbIncrementVideoViews(slug: string): Promise<void> {
  const db = await getMongoDb();
  if (db && isMongoActive) {
    try {
      await db.collection("videos").updateOne({ slug }, { $inc: { views: 1 } });
      return;
    } catch (err) {
      console.error("Failed to increment views on MongoDB:", err);
    }
  }
  const local = readVideos();
  const video = local.find((v) => v.slug === slug);
  if (video) {
    video.views = (video.views || 0) + 1;
    writeVideos(local);
  }
}

async function dbInsertVideo(newVideo: any): Promise<boolean> {
  const db = await getMongoDb();
  if (db && isMongoActive) {
    try {
      const col = db.collection("videos");
      const existing = await col.findOne({ slug: newVideo.slug });
      if (existing) return false;
      await col.insertOne(newVideo);
      return true;
    } catch (err) {
      console.error("Failed to insert video on MongoDB:", err);
    }
  }
  const local = readVideos();
  if (local.some((v) => v.slug === newVideo.slug)) return false;
  local.push(newVideo);
  writeVideos(local);
  return true;
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(express.json());

  // --- HEALTH & AUTO-PING ROUTES ---

  // Health check routes
  app.get(["/health", "/api/health"], (req, res) => {
    res.json({
      status: "ok",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      mongodbConnected: isMongoActive
    });
  });

  // --- API ROUTES ---

  // Get task link configuration
  app.get("/api/config", (req, res) => {
    res.json({
      task1Link: process.env.TASK1_LINK || "https://google.com?q=task1",
      task2Link: process.env.TASK2_LINK || "https://google.com?q=task2",
      task3Link: process.env.TASK3_LINK || "https://google.com?q=task3",
      channelLink: process.env.CHANNEL_LINK || "",
    });
  });

  // Get list of all videos (minimal info, hiding downloadUrl)
  app.get("/api/videos", async (req, res) => {
    try {
      const videos = await dbFetchVideos();
      const publicVideos = videos.map(({ downloadUrl, ...rest }) => rest);
      res.json(publicVideos);
    } catch (err) {
      res.status(500).json({ error: "Failed to retrieve streaming directories" });
    }
  });

  // Fetch details of a specific video by slug
  app.get("/api/videos/:slug", async (req, res) => {
    try {
      const { slug } = req.params;
      const video = await dbFetchVideoBySlug(slug);

      if (!video) {
        return res.status(404).json({ error: "Video not found" });
      }

      // Increment views safely on the active database
      await dbIncrementVideoViews(slug);

      // Omit downloadUrl from details response to prevent scraping
      const { downloadUrl, ...publicDetails } = video;
      res.json(publicDetails);
    } catch (err) {
      res.status(500).json({ error: "Failed to retrieve stream details" });
    }
  });

  // Create a new video entry (Admin panel feature)
  app.post("/api/videos", async (req, res) => {
    try {
      const { title, description, videoUrl, downloadUrl, thumbnailUrl, duration, slug } = req.body;

      if (!title || !videoUrl || !downloadUrl) {
        return res.status(400).json({ error: "Title, Video URL, and Download URL are required" });
      }

      const videoSlug = slug || title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      
      const newVideo = {
        slug: videoSlug,
        title,
        description: description || "No description provided.",
        videoUrl,
        downloadUrl,
        thumbnailUrl: thumbnailUrl || "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=800&auto=format&fit=crop&q=60",
        duration: duration || "00:00",
        views: 0,
        createdAt: new Date().toISOString().split("T")[0],
      };

      const success = await dbInsertVideo(newVideo);
      if (!success) {
        return res.status(400).json({ error: "A video with this slug or title already exists." });
      }

      res.status(201).json(newVideo);
    } catch (err) {
      res.status(500).json({ error: "Failed to publish streaming channel" });
    }
  });

  // Start a new downloader session
  app.post("/api/session/start", (req, res) => {
    const { slug } = req.body;
    if (!slug) {
      return res.status(400).json({ error: "Video slug is required" });
    }

    const sessionId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    sessions[sessionId] = {
      slug,
      task1Completed: false,
      task2Completed: false,
      task3Completed: false,
    };

    res.json({ sessionId });
  });

  // Start a specific task countdown on server
  app.post("/api/session/task/start", (req, res) => {
    const { sessionId, task } = req.body;
    if (!sessionId || !task || ![1, 2, 3].includes(task)) {
      return res.status(400).json({ error: "Invalid session ID or task number" });
    }

    const session = sessions[sessionId];
    if (!session) {
      return res.status(404).json({ error: "Session expired or invalid" });
    }

    const key = `task${task}StartedAt` as keyof DownloadSession;
    session[key] = Date.now() as any;

    res.json({ success: true, message: `Task ${task} timer started on server.` });
  });

  // Complete a specific task after verification
  app.post("/api/session/task/complete", (req, res) => {
    const { sessionId, task } = req.body;
    if (!sessionId || !task || ![1, 2, 3].includes(task)) {
      return res.status(400).json({ error: "Invalid session ID or task number" });
    }

    const session = sessions[sessionId];
    if (!session) {
      return res.status(404).json({ error: "Session expired or invalid" });
    }

    // Verify task ordering (Task 2 needs Task 1, Task 3 needs Task 2)
    if (task === 2 && !session.task1Completed) {
      return res.status(400).json({ error: "Please complete Task 1 first." });
    }
    if (task === 3 && !session.task2Completed) {
      return res.status(400).json({ error: "Please complete Task 2 first." });
    }

    const startKey = `task${task}StartedAt` as keyof DownloadSession;
    const startTime = session[startKey] as number | undefined;

    if (!startTime) {
      return res.status(400).json({ error: `Task ${task} was not started properly.` });
    }

    const elapsed = Date.now() - startTime;
    // Standard 10 seconds (10000ms), we can allow a small 500ms network buffer
    if (elapsed < 9500) {
      const remaining = Math.ceil((10000 - elapsed) / 1000);
      return res.status(400).json({
        error: `Please wait. You must stay on the link for 10 seconds. (${remaining}s remaining)`
      });
    }

    const completeKey = `task${task}Completed` as keyof DownloadSession;
    session[completeKey] = true as any;

    res.json({
      success: true,
      completed: true,
      message: `Task ${task} completed successfully!`,
    });
  });

  // Check the full session status
  app.get("/api/session/status/:sessionId", (req, res) => {
    const { sessionId } = req.params;
    const session = sessions[sessionId];
    if (!session) {
      return res.status(404).json({ error: "Session expired or invalid" });
    }

    res.json({
      task1Completed: session.task1Completed,
      task2Completed: session.task2Completed,
      task3Completed: session.task3Completed,
    });
  });

  // Securely retrieve the download link after complete verification
  app.post("/api/session/download", async (req, res) => {
    try {
      const { sessionId } = req.body;
      if (!sessionId) {
        return res.status(400).json({ error: "Session ID is required" });
      }

      const session = sessions[sessionId];
      if (!session) {
        return res.status(404).json({ error: "Session expired or invalid" });
      }

      if (!session.task1Completed || !session.task2Completed || !session.task3Completed) {
        return res.status(403).json({ error: "Access denied. You must complete all 3 tasks first." });
      }

      const video = await dbFetchVideoBySlug(session.slug);

      if (!video) {
        return res.status(404).json({ error: "Video not found in database." });
      }

      // Clean up session after generating download token/link to prevent re-use
      delete sessions[sessionId];

      res.json({
        downloadUrl: video.downloadUrl,
        title: video.title,
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to process secure download request" });
    }
  });

  // --- VITE AND STATIC FILE SERVING ---

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Bind to port 3000 and 0.0.0.0
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
    setupAutoPing();
  });
}

function setupAutoPing() {
  const selfUrl = process.env.SELF_URL || process.env.APP_URL;
  if (!selfUrl) {
    console.log("[Auto-Ping] Auto-ping is disabled. Configure SELF_URL or APP_URL in environment variables to enable.");
    return;
  }

  const intervalMinutes = parseInt(process.env.PING_INTERVAL_MINUTES || "5", 10);
  const intervalMs = intervalMinutes * 60 * 1000;
  console.log(`[Auto-Ping] Initialized self-ping for ${selfUrl} every ${intervalMinutes} minutes.`);

  // Self-pinger function
  const ping = () => {
    const targetUrl = `${selfUrl.replace(/\/$/, "")}/api/health`;
    console.log(`[Auto-Ping] Pinging endpoint: ${targetUrl}`);
    try {
      const client = targetUrl.startsWith("https") ? https : http;
      client.get(targetUrl, (res) => {
        console.log(`[Auto-Ping] Ping response code: ${res.statusCode}`);
      }).on("error", (err) => {
        console.error(`[Auto-Ping] Ping request failed: ${err.message}`);
      });
    } catch (err: any) {
      console.error(`[Auto-Ping] Unexpected error during ping: ${err.message}`);
    }
  };

  // Run initial ping after 30 seconds to allow the server to fully start
  setTimeout(ping, 30 * 1000);

  // Set interval for continuous pinging
  setInterval(ping, intervalMs);
}

startServer();

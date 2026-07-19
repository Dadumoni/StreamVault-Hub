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
const LOGS_PATH = path.join(currentDirname, "src", "db", "view_logs.json");

// Generate mixed random letters, numbers, and characters slug (e.g. Fsj_te39c7)
function generateRandomSlug(length = 10): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

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

// Helper to read logs
function readLogs(): any[] {
  try {
    if (fs.existsSync(LOGS_PATH)) {
      const data = fs.readFileSync(LOGS_PATH, "utf-8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.error("Error reading logs:", error);
  }
  return [];
}

// Helper to write logs
function writeLogs(logs: any[]) {
  try {
    const dir = path.dirname(LOGS_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(LOGS_PATH, JSON.stringify(logs, null, 2), "utf-8");
  } catch (error) {
    console.error("Error writing logs:", error);
  }
}

// --- MONGODB CONNECTION & WRAPPER LAYERS ---
let mongoClient: MongoClient | null = null;
let dbInstance: any = null;
let isMongoActive = false;

async function ensureMongoSchemaAndColumns(db: any) {
  try {
    console.log("Checking MongoDB collections and schema integrity...");
    // 1. Ensure Collections ("tables") exist
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map((c: any) => c.name);

    if (!collectionNames.includes("videos")) {
      console.log("Creating missing collection: 'videos'...");
      await db.createCollection("videos");
    }

    if (!collectionNames.includes("view_logs")) {
      console.log("Creating missing collection: 'view_logs'...");
      await db.createCollection("view_logs");
    }

    // 2. Ensure "Columns" (fields) exist in 'videos' collection
    const col = db.collection("videos");

    // Check if there are any documents to seed first if it's empty
    const count = await col.countDocuments();
    if (count === 0) {
      const local = readVideos();
      if (local.length > 0) {
        console.log("Seeding MongoDB collection 'videos' with initial items...");
        await col.insertMany(local);
      }
    }

    // Auto-migrate: If any existing document is missing standard fields (columns), update them automatically!
    const defaultThumbnail = "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=800&auto=format&fit=crop&q=60";
    const defaultDate = new Date().toISOString().split("T")[0];

    await col.updateMany({ title: { $exists: false } }, { $set: { title: "Untitled Stream" } });
    await col.updateMany({ description: { $exists: false } }, { $set: { description: "" } });
    await col.updateMany({ videoUrl: { $exists: false } }, { $set: { videoUrl: "" } });
    await col.updateMany({ downloadUrl: { $exists: false } }, { $set: { downloadUrl: "" } });
    await col.updateMany({ thumbnailUrl: { $exists: false } }, { $set: { thumbnailUrl: defaultThumbnail } });
    await col.updateMany({ duration: { $exists: false } }, { $set: { duration: "00:00" } });
    await col.updateMany({ fileSize: { $exists: false } }, { $set: { fileSize: 124.5 } });
    await col.updateMany({ views: { $exists: false } }, { $set: { views: 0 } });
    await col.updateMany({ downloads: { $exists: false } }, { $set: { downloads: 0 } });
    await col.updateMany({ createdAt: { $exists: false } }, { $set: { createdAt: defaultDate } });

    console.log("MongoDB collections and columns verified successfully!");
  } catch (err) {
    console.error("Error ensuring MongoDB collections and columns schema:", err);
  }
}

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
    
    // Automatically ensure collections and columns exist
    await ensureMongoSchemaAndColumns(dbInstance);

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

function parseUserAgent(ua: string) {
  let browser = "Other";
  let device = "Desktop";
  let os = "Other";

  // Browser detection
  if (ua.includes("Firefox") && !ua.includes("Seamonkey")) {
    browser = "Firefox";
  } else if (ua.includes("Chrome") && !ua.includes("Chromium") && !ua.includes("Edg")) {
    browser = "Chrome";
  } else if (ua.includes("Safari") && !ua.includes("Chrome") && !ua.includes("Chromium")) {
    browser = "Safari";
  } else if (ua.includes("Edg")) {
    browser = "Edge";
  } else if (ua.includes("OPR") || ua.includes("Opera")) {
    browser = "Opera";
  }

  // Device detection
  if (/Mobi|Android|iPhone|iPad|iPod|Windows Phone|IEMobile|BlackBerry|webOS/i.test(ua)) {
    if (/iPad|tablet/i.test(ua)) {
      device = "Tablet";
    } else {
      device = "Mobile";
    }
  } else {
    device = "Desktop";
  }

  // OS detection
  if (ua.includes("Windows NT")) {
    os = "Windows";
  } else if (ua.includes("Macintosh") || ua.includes("Mac OS X")) {
    if (/iPhone|iPad|iPod/.test(ua)) {
      os = "iOS";
    } else {
      os = "macOS";
    }
  } else if (ua.includes("Android")) {
    os = "Android";
  } else if (ua.includes("Linux")) {
    os = "Linux";
  }

  return { browser, device, os };
}

async function dbLogView(slug: string, ip: string, userAgent: string): Promise<boolean> {
  const { browser, device, os } = parseUserAgent(userAgent);
  const timestamp = new Date();
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const db = await getMongoDb();
  if (db && isMongoActive) {
    try {
      const col = db.collection("view_logs");
      // Check if this IP viewed this video in the last 24 hours
      const existing = await col.findOne({
        slug,
        ip,
        timestamp: { $gte: twentyFourHoursAgo }
      });

      if (existing) {
        return false;
      }

      // Record log
      await col.insertOne({
        slug,
        ip,
        userAgent,
        browser,
        device,
        os,
        timestamp
      });

      // Increment video views in videos collection
      await db.collection("videos").updateOne({ slug }, { $inc: { views: 1 } });
      return true;
    } catch (err) {
      console.error("Failed to log view in MongoDB:", err);
    }
  }

  // Fallback to local files
  const logs = readLogs();
  const existingLocal = logs.find(
    (l) => l.slug === slug && l.ip === ip && new Date(l.timestamp) >= twentyFourHoursAgo
  );

  if (existingLocal) {
    return false;
  }

  // Add local log
  logs.push({
    slug,
    ip,
    userAgent,
    browser,
    device,
    os,
    timestamp: timestamp.toISOString()
  });
  writeLogs(logs);

  // Increment local video views
  const localVideos = readVideos();
  const video = localVideos.find((v) => v.slug === slug);
  if (video) {
    video.views = (video.views || 0) + 1;
    writeVideos(localVideos);
  }
  return true;
}

async function dbDeleteVideo(slug: string): Promise<boolean> {
  const db = await getMongoDb();
  if (db && isMongoActive) {
    try {
      const col = db.collection("videos");
      const result = await col.deleteOne({ slug });
      // Also delete view logs for this video
      await db.collection("view_logs").deleteMany({ slug });
      return (result.deletedCount || 0) > 0;
    } catch (err) {
      console.error("Failed to delete video on MongoDB:", err);
    }
  }
  const local = readVideos();
  const filtered = local.filter((v) => v.slug !== slug);
  if (local.length === filtered.length) return false;
  writeVideos(filtered);
  
  // Also delete local view logs
  const localLogs = readLogs();
  const filteredLogs = localLogs.filter((l) => l.slug !== slug);
  writeLogs(filteredLogs);
  return true;
}

async function dbUpdateVideo(slug: string, updatedFields: any): Promise<boolean> {
  const db = await getMongoDb();
  if (db && isMongoActive) {
    try {
      const col = db.collection("videos");
      const result = await col.updateOne({ slug }, { $set: updatedFields });
      return (result.matchedCount || 0) > 0;
    } catch (err) {
      console.error("Failed to update video on MongoDB:", err);
    }
  }
  const local = readVideos();
  const idx = local.findIndex((v) => v.slug === slug);
  if (idx === -1) return false;
  local[idx] = { ...local[idx], ...updatedFields };
  writeVideos(local);
  return true;
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

  // CORS middleware to support separate frontend hosting (e.g., Cloudflare Pages)
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

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
      
      const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "127.0.0.1").toString().split(",")[0].trim();
      const userAgent = req.headers["user-agent"] || "";

      // Log view and increment if unique in last 24h
      await dbLogView(slug, ip, userAgent);

      const video = await dbFetchVideoBySlug(slug);

      if (!video) {
        return res.status(404).json({ error: "Video not found" });
      }

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
      const { title, description, videoUrl, downloadUrl, thumbnailUrl, duration, slug, fileSize } = req.body;

      if (!title || !videoUrl || !downloadUrl) {
        return res.status(400).json({ error: "Title, Video URL, and Download URL are required" });
      }

      const videoSlug = slug || generateRandomSlug(10);
      
      const newVideo = {
        slug: videoSlug,
        title,
        description: "",
        videoUrl,
        downloadUrl,
        thumbnailUrl: thumbnailUrl || "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=800&auto=format&fit=crop&q=60",
        duration: duration || "00:00",
        fileSize: fileSize ? parseFloat(fileSize) : 124.5, // Default size in MB
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

  // Update a video entry
  app.put("/api/videos/:slug", async (req, res) => {
    try {
      const { slug } = req.params;
      const { title, description, videoUrl, downloadUrl, thumbnailUrl, duration, fileSize } = req.body;

      const fieldsToUpdate: any = {};
      if (title !== undefined) fieldsToUpdate.title = title;
      fieldsToUpdate.description = "";
      if (videoUrl !== undefined) fieldsToUpdate.videoUrl = videoUrl;
      if (downloadUrl !== undefined) fieldsToUpdate.downloadUrl = downloadUrl;
      if (thumbnailUrl !== undefined) fieldsToUpdate.thumbnailUrl = thumbnailUrl;
      if (duration !== undefined) fieldsToUpdate.duration = duration;
      if (fileSize !== undefined) fieldsToUpdate.fileSize = parseFloat(fileSize) || 124.5;

      const success = await dbUpdateVideo(slug, fieldsToUpdate);
      if (!success) {
        return res.status(404).json({ error: "Video not found or no changes made." });
      }

      res.json({ success: true, message: "Video updated successfully." });
    } catch (err) {
      res.status(500).json({ error: "Failed to update video" });
    }
  });

  // Delete a video entry
  app.delete("/api/videos/:slug", async (req, res) => {
    try {
      const { slug } = req.params;
      const success = await dbDeleteVideo(slug);
      if (!success) {
        return res.status(404).json({ error: "Video not found." });
      }
      res.json({ success: true, message: "Video deleted successfully." });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete video" });
    }
  });

  // Analytics endpoint
  app.get("/api/analytics", async (req, res) => {
    try {
      const videos = await dbFetchVideos();
      
      let logs: any[] = [];
      let mongoStorageSize = "0.00 KB";
      let mongoCollections = 0;
      let mongoDocuments = 0;

      const db = await getMongoDb();
      if (db && isMongoActive) {
        try {
          logs = await db.collection("view_logs").find({}).toArray();
          
          // Fetch MongoDB Stats
          const stats = await db.command({ dbStats: 1 });
          if (stats) {
            mongoCollections = stats.collections || 0;
            mongoDocuments = stats.objects || 0;
            const bytes = stats.storageSize || stats.dataSize || 0;
            if (bytes >= 1024 * 1024 * 1024) {
              mongoStorageSize = `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
            } else if (bytes >= 1024 * 1024) {
              mongoStorageSize = `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
            } else {
              mongoStorageSize = `${(bytes / 1024).toFixed(2)} KB`;
            }
          }
        } catch (err) {
          console.error("Failed to fetch logs or stats from MongoDB:", err);
          logs = readLogs();
        }
      } else {
        logs = readLogs();
      }

      const totalFiles = videos.length;
      const totalViews = logs.length;

      const totalStorageMB = videos.reduce((acc, v) => acc + (v.fileSize || 124.5), 0);
      const totalStorage = totalStorageMB >= 1024 
        ? `${(totalStorageMB / 1024).toFixed(2)} GB`
        : `${totalStorageMB.toFixed(1)} MB`;

      const dailyViewsMap: { [key: string]: number } = {};
      const today = new Date();
      for (let i = 14; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const dateStr = d.toISOString().split("T")[0];
        dailyViewsMap[dateStr] = 0;
      }

      logs.forEach(log => {
        try {
          const logDate = new Date(log.timestamp).toISOString().split("T")[0];
          if (dailyViewsMap[logDate] !== undefined) {
            dailyViewsMap[logDate]++;
          }
        } catch (e) {}
      });

      const dailyViews = Object.keys(dailyViewsMap).sort().map(date => ({
        date,
        views: dailyViewsMap[date]
      }));

      const deviceStatsMap: { [key: string]: number } = { Desktop: 0, Mobile: 0, Tablet: 0 };
      logs.forEach(log => {
        const device = log.device || "Desktop";
        if (deviceStatsMap[device] !== undefined) {
          deviceStatsMap[device]++;
        } else {
          deviceStatsMap[device] = (deviceStatsMap[device] || 0) + 1;
        }
      });
      const deviceStats = Object.keys(deviceStatsMap).map(key => ({
        name: key,
        value: deviceStatsMap[key]
      }));

      const browserStatsMap: { [key: string]: number } = {};
      logs.forEach(log => {
        const browser = log.browser || "Other";
        browserStatsMap[browser] = (browserStatsMap[browser] || 0) + 1;
      });
      const browserStats = Object.keys(browserStatsMap).map(key => ({
        name: key,
        value: browserStatsMap[key]
      }));

      const osStatsMap: { [key: string]: number } = {};
      logs.forEach(log => {
        const os = log.os || "Other";
        osStatsMap[os] = (osStatsMap[os] || 0) + 1;
      });
      const osStats = Object.keys(osStatsMap).map(key => ({
        name: key,
        value: osStatsMap[key]
      }));

      const topVideos = [...videos]
        .sort((a, b) => (b.views || 0) - (a.views || 0))
        .slice(0, 5)
        .map(v => ({
          title: v.title,
          slug: v.slug,
          views: v.views || 0,
          fileSize: v.fileSize || 124.5
        }));

      const videoTitleMap = videos.reduce((acc, v) => {
        acc[v.slug] = v.title;
        return acc;
      }, {} as { [key: string]: string });

      const sortedLogs = [...logs]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 50);

      const recentLogs = sortedLogs.map(log => ({
        title: videoTitleMap[log.slug] || log.slug,
        slug: log.slug,
        ip: log.ip || "Unknown",
        browser: log.browser || "Other",
        device: log.device || "Desktop",
        os: log.os || "Other",
        timestamp: log.timestamp
      }));

      res.json({
        totalFiles,
        totalViews,
        totalStorage,
        dailyViews,
        deviceStats,
        browserStats,
        osStats,
        topVideos,
        recentLogs,
        mongoStorageSize,
        mongoCollections,
        mongoDocuments,
        isMongoActive
      });
    } catch (err) {
      console.error("Analytics endpoint error:", err);
      res.status(500).json({ error: "Failed to load analytics details" });
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

  const isProduction = 
    process.env.NODE_ENV === "production" || 
    (!process.env.DISABLE_HMR && fs.existsSync(path.join(process.cwd(), "dist", "index.html")));

  if (!isProduction) {
    console.log("[Server] Starting in development mode with Vite middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("[Server] Starting in production mode serving static files...");
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

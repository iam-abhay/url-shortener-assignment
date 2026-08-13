import "dotenv/config";
import express from "express";
import cors from "cors";
import crypto from "node:crypto";
import {
  initDatabase,
  getDbMode,
  healthCheck,
  codeExists,
  insertLink,
  getAllLinks,
  incrementAndGetOriginalUrl
} from "./db.js";

const app = express();
const PORT = Number(process.env.PORT || 5000);

app.disable("x-powered-by");
app.use(
  cors({
    origin: process.env.FRONTEND_URL
      ? process.env.FRONTEND_URL.split(",").map((value) => value.trim())
      : true
  })
);
app.use(express.json());

function getBaseUrl(req) {
  if (process.env.BASE_URL) {
    return process.env.BASE_URL.replace(/\/$/, "");
  }
  const host = req.get("host");
  const protocol = req.headers["x-forwarded-proto"] || req.protocol || "http";
  return `${protocol}://${host}`;
}

function isValidHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function generateShortCode() {
  return crypto.randomBytes(6).toString("base64url").slice(0, 8);
}

async function createUniqueCode() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateShortCode();
    const exists = await codeExists(code);
    if (!exists) return code;
  }
  throw new Error("Could not generate a unique short code.");
}

app.get("/favicon.ico", (_req, res) => {
  res.status(204).end();
});

app.get("/api/health", async (_req, res) => {
  try {
    await healthCheck();
    res.json({ status: "ok", database: getDbMode() });
  } catch {
    res.status(503).json({ status: "error", database: "unavailable" });
  }
});

app.post("/api/links", async (req, res, next) => {
  try {
    let originalUrl = String(req.body?.url || "").trim();

    if (!originalUrl) {
      return res.status(400).json({ message: "URL is required." });
    }

    if (!/^https?:\/\//i.test(originalUrl)) {
      originalUrl = `https://${originalUrl}`;
    }

    if (originalUrl.length > 2048) {
      return res.status(400).json({ message: "URL must be 2048 characters or fewer." });
    }

    if (!isValidHttpUrl(originalUrl)) {
      return res.status(400).json({ message: "Enter a valid HTTP or HTTPS URL." });
    }

    const shortCode = await createUniqueCode();
    const link = await insertLink(originalUrl, shortCode);

    res.status(201).json({
      id: link.id,
      originalUrl: link.originalUrl,
      shortCode: link.shortCode,
      shortUrl: `${getBaseUrl(req)}/${link.shortCode}`,
      clicks: link.clicks,
      createdAt: link.createdAt
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/links", async (req, res, next) => {
  try {
    const links = await getAllLinks();

    res.json({
      data: links.map((link) => ({
        id: link.id,
        originalUrl: link.originalUrl,
        shortCode: link.shortCode,
        shortUrl: `${getBaseUrl(req)}/${link.shortCode}`,
        clicks: link.clicks,
        createdAt: link.createdAt
      }))
    });
  } catch (error) {
    next(error);
  }
});

app.get("/:shortCode", async (req, res, next) => {
  try {
    const code = String(req.params.shortCode || "").trim();
    if (!code) {
      return res.status(404).send("Short link not found.");
    }

    const targetUrl = await incrementAndGetOriginalUrl(code);
    if (!targetUrl) {
      return res.status(404).send("Short link not found.");
    }

    return res.redirect(302, targetUrl);
  } catch (error) {
    next(error);
  }
});

app.use((_req, res) => {
  res.status(404).json({ message: "Route not found." });
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ message: "Internal server error." });
});

initDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`LinkLite API running on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Database initialization failed:", error);
    process.exit(1);
  });

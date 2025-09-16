// server.js (Omni-Querent Hub Server with Voting + Admin Auth + Local MongoDB Fallback)

import dotenv from "dotenv";
dotenv.config();

import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import bodyParser from "body-parser";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
app.use(cors());
app.use(bodyParser.json());

// ───────────────────────────────
// MongoDB Connection with Fallback
// ───────────────────────────────
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/omniquerent";

mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log(`✅ MongoDB connected at ${MONGO_URI}`))
  .catch(async (err) => {
    console.error("❌ MongoDB Atlas connection failed:", err.message);
    console.log("⚡ Falling back to local MongoDB...");

    try {
      await mongoose.connect("mongodb://127.0.0.1:27017/omniquerent", {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
      console.log("✅ Connected to local MongoDB");
    } catch (localErr) {
      console.error("❌ Local MongoDB connection failed:", localErr.message);
      process.exit(1); // Exit if no DB is available
    }
  });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ───────────────────────────────
// Mongoose Schema
// ───────────────────────────────
const voteSchema = new mongoose.Schema({
  title: String,
  description: String,
  yes: { type: Number, default: 0 },
  no: { type: Number, default: 0 },
  totalVotes: { type: Number, default: 0 },
  endsAt: Date,
});

const Vote = mongoose.model("Vote", voteSchema);

// ───────────────────────────────
// Middleware for Admin Authentication
// ───────────────────────────────
function adminAuth(req, res, next) {
  const key = req.headers["x-admin-key"];
  if (!key || key !== process.env.ADMIN_KEY) {
    return res.status(403).json({ success: false, error: "Unauthorized" });
  }
  next();
}

// ───────────────────────────────
// Voting Endpoints
// ───────────────────────────────

// Fetch all active votes
app.get("/api/votes", async (req, res) => {
  try {
    const now = new Date();
    const votes = await Vote.find({ endsAt: { $gte: now } }).sort({
      endsAt: 1,
    });
    res.json(votes);
  } catch (err) {
    console.error("Error fetching votes:", err);
    res.status(500).json({ error: "Failed to fetch votes" });
  }
});

// Submit a vote
app.post("/api/votes/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { choice } = req.body;

    if (!["yes", "no"].includes(choice)) {
      return res.status(400).json({ success: false, error: "Invalid choice" });
    }

    const vote = await Vote.findById(id);
    if (!vote) {
      return res.status(404).json({ success: false, error: "Vote not found" });
    }

    if (new Date() > vote.endsAt) {
      return res
        .status(400)
        .json({ success: false, error: "Voting period has ended" });
    }

    if (choice === "yes") vote.yes += 1;
    if (choice === "no") vote.no += 1;
    vote.totalVotes += 1;

    await vote.save();

    res.json({ success: true, message: "Vote recorded", vote });
  } catch (err) {
    console.error("Error submitting vote:", err);
    res.status(500).json({ success: false, error: "Failed to submit vote" });
  }
});

// ───────────────────────────────
// Admin-Only Endpoint (Protected)
// ───────────────────────────────
app.post("/api/votes/create", adminAuth, async (req, res) => {
  try {
    const { title, description, durationHours } = req.body;
    if (!title || !description || !durationHours) {
      return res
        .status(400)
        .json({ success: false, error: "Missing required fields" });
    }

    const endsAt = new Date();
    endsAt.setHours(endsAt.getHours() + durationHours);

    const newVote = new Vote({
      title,
      description,
      endsAt,
    });

    await newVote.save();
    res.json({ success: true, vote: newVote });
  } catch (err) {
    console.error("Error creating vote:", err);
    res.status(500).json({ success: false, error: "Failed to create vote" });
  }
});

// ───────────────────────────────
// Root Endpoint
// ───────────────────────────────
// Serve static frontend
app.use(express.static(path.join(__dirname, "public")));

// Root endpoint: serve index.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Voting page
app.get("/voting", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "voting.html"));
});
// ───────────────────────────────
// Start Server
// ───────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`🌍 Hub Server running on http://localhost:${PORT}`)
);

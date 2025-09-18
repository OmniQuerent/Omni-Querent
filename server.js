// server.js (Omni-Querent Hub Server with Voting + Admin Auth + MongoDB Atlas)

import dotenv from "dotenv";
dotenv.config();

import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import bodyParser from "body-parser";

const app = express();

// ───────────────────────────────
// CORS: Allow only Netlify frontend
// ───────────────────────────────
const allowedOrigin =
  process.env.FRONTEND_URL || "https://omni-querent.netlify.app";
app.use(cors({ origin: allowedOrigin }));

app.use(bodyParser.json());

// ───────────────────────────────
// MongoDB Connection
// ───────────────────────────────
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error("❌ No MongoDB connection string found. Set MONGO_URI in environment.");
  process.exit(1);
}

mongoose
  .connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ Connected to MongoDB Atlas"))
  .catch((err) => {
    console.error("❌ MongoDB connection failed:", err.message);
    process.exit(1); // Exit if no DB is available
  });

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

// Admin-only endpoint
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
// Root Health Check
// ───────────────────────────────
app.get("/", (req, res) => {
  res.json({
    message: "Omni-Querent API is running 🚀",
    frontend: allowedOrigin,
  });
});

// ───────────────────────────────
// Start Server
// ───────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`🌍 Hub Server running on http://localhost:${PORT}`)
);

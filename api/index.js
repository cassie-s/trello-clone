const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type"],
  })
);
app.use(express.json());

// ─── MongoDB Connection ──────────────────────────────────────────────────────
// In serverless environments (Vercel), the module may be reused across
// invocations. We cache the connection promise on the global object so we
// never open more than one connection per worker instance.
let _connectionPromise = null;

const connectDB = async () => {
  // readyState: 0=disconnected, 1=connected, 2=connecting, 3=disconnecting
  if (mongoose.connection.readyState === 1) return;

  if (!_connectionPromise) {
    _connectionPromise = mongoose
      .connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        // Keep the connection alive between serverless invocations
        maxPoolSize: 10,
        bufferCommands: false,
      })
      .then((m) => {
        console.log("MongoDB connected");
        return m;
      })
      .catch((e) => {
        // Reset so the next request can retry
        _connectionPromise = null;
        throw e;
      });
  }

  await _connectionPromise;
};

// Ensure DB is connected before every API request
app.use("/api", async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (e) {
    console.error("DB connection failed:", e.message);
    res.status(503).json({ error: "Database unavailable: " + e.message });
  }
});

// ─── Schemas ─────────────────────────────────────────────────────────────────

const CardSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, default: "" },
    listId: { type: mongoose.Schema.Types.ObjectId, ref: "List", required: true },
    boardId: { type: mongoose.Schema.Types.ObjectId, ref: "Board", required: true },
    position: { type: Number, default: 0 },
    labels: [{ text: String, color: String }],
    dueDate: { type: Date },
    checklist: [{ text: String, checked: { type: Boolean, default: false } }],
    // Recurring card settings
    recurring: {
      enabled: { type: Boolean, default: false },
      frequency: {
        type: String,
        enum: ["daily", "weekly", "monthly", "custom"],
        default: "weekly",
      },
      interval: { type: Number, default: 1 }, // every N frequency units
      daysOfWeek: [{ type: Number }], // 0=Sun..6=Sat for weekly
      dayOfMonth: { type: Number }, // for monthly
      nextDue: { type: Date },
      lastGenerated: { type: Date },
    },
    isRecurringInstance: { type: Boolean, default: false },
    parentCardId: { type: mongoose.Schema.Types.ObjectId, ref: "Card" },
    archived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const ListSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    boardId: { type: mongoose.Schema.Types.ObjectId, ref: "Board", required: true },
    position: { type: Number, default: 0 },
    color: { type: String, default: null }, // hex color or null
    archived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const BoardSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    background: { type: String, default: "#1a1a2e" },
  },
  { timestamps: true }
);

const Board = mongoose.models.Board || mongoose.model("Board", BoardSchema);
const List = mongoose.models.List || mongoose.model("List", ListSchema);
const Card = mongoose.models.Card || mongoose.model("Card", CardSchema);

// ─── Helper: Compute next due date ───────────────────────────────────────────
function computeNextDue(recurring, fromDate = new Date()) {
  const base = fromDate instanceof Date ? fromDate : new Date(fromDate);
  const next = new Date(base);
  const interval = recurring.interval || 1;

  switch (recurring.frequency) {
    case "daily":
      next.setDate(next.getDate() + interval);
      break;
    case "weekly":
      next.setDate(next.getDate() + 7 * interval);
      break;
    case "monthly":
      next.setMonth(next.getMonth() + interval);
      if (recurring.dayOfMonth) next.setDate(recurring.dayOfMonth);
      break;
    default:
      next.setDate(next.getDate() + interval);
  }
  return next;
}

// ─── Helper: Generate recurring card instances ────────────────────────────────
async function generateRecurringInstances() {
  const now = new Date();
  const recurringCards = await Card.find({
    "recurring.enabled": true,
    archived: false,
    isRecurringInstance: false,
    "recurring.nextDue": { $lte: now },
  });

  for (const card of recurringCards) {
    // Create a new instance
    const instance = new Card({
      title: card.title,
      description: card.description,
      listId: card.listId,
      boardId: card.boardId,
      position: card.position,
      labels: card.labels,
      dueDate: card.recurring.nextDue,
      isRecurringInstance: true,
      parentCardId: card._id,
    });
    await instance.save();

    // Update next due
    card.recurring.lastGenerated = now;
    card.recurring.nextDue = computeNextDue(card.recurring, card.recurring.nextDue);
    await card.save();
  }
}

// ─── Board Routes ─────────────────────────────────────────────────────────────

app.get("/api/boards", async (req, res) => {
  try {
    const boards = await Board.find().sort({ createdAt: -1 });
    res.json(boards);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/boards", async (req, res) => {
  try {
    const board = new Board(req.body);
    await board.save();
    res.status(201).json(board);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.patch("/api/boards/:id", async (req, res) => {
  try {
    const board = await Board.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!board) return res.status(404).json({ error: "Board not found" });
    res.json(board);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.delete("/api/boards/:id", async (req, res) => {
  try {
    await Board.findByIdAndDelete(req.params.id);
    await List.deleteMany({ boardId: req.params.id });
    await Card.deleteMany({ boardId: req.params.id });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── List Routes ──────────────────────────────────────────────────────────────

app.get("/api/boards/:boardId/lists", async (req, res) => {
  try {
    const lists = await List.find({ boardId: req.params.boardId, archived: false }).sort(
      "position"
    );
    res.json(lists);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/boards/:boardId/lists", async (req, res) => {
  try {
    const count = await List.countDocuments({ boardId: req.params.boardId });
    const list = new List({ ...req.body, boardId: req.params.boardId, position: count });
    await list.save();
    res.status(201).json(list);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.patch("/api/lists/:id", async (req, res) => {
  try {
    const list = await List.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!list) return res.status(404).json({ error: "List not found" });
    res.json(list);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.delete("/api/lists/:id", async (req, res) => {
  try {
    await List.findByIdAndDelete(req.params.id);
    await Card.deleteMany({ listId: req.params.id });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Reorder lists
app.post("/api/boards/:boardId/lists/reorder", async (req, res) => {
  try {
    const { order } = req.body; // array of list IDs in new order
    await Promise.all(
      order.map((id, index) => List.findByIdAndUpdate(id, { position: index }))
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Card Routes ──────────────────────────────────────────────────────────────
// Get archived cards for a board
app.get("/api/boards/:boardId/archived-cards", async (req, res) => {
  try {
    const query = { boardId: req.params.boardId, archived: true };
    // Optional label filter
    if (req.query.label) {
      query["labels.text"] = req.query.label;
    }
    // Optional date filters
    if (req.query.from) {
      query.updatedAt = { ...query.updatedAt, $gte: new Date(req.query.from) };
    }
    if (req.query.to) {
      query.updatedAt = { ...query.updatedAt, $lte: new Date(req.query.to) };
    }
    const cards = await Card.find(query).sort({ updatedAt: -1 });
    res.json(cards);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/lists/:listId/cards", async (req, res) => {
  try {
    // Also generate any pending recurring instances
    await generateRecurringInstances();
    const cards = await Card.find({ listId: req.listId, archived: false }).sort("position");
    res.json(cards);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/boards/:boardId/cards", async (req, res) => {
  try {
    await generateRecurringInstances();
    const cards = await Card.find({ boardId: req.params.boardId, archived: false }).sort(
      "position"
    );
    res.json(cards);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/lists/:listId/cards", async (req, res) => {
  try {
    const list = await List.findById(req.params.listId);
    if (!list) return res.status(404).json({ error: "List not found" });

    const count = await Card.countDocuments({ listId: req.params.listId, archived: false });
    const cardData = {
      ...req.body,
      listId: req.params.listId,
      boardId: list.boardId,
      position: count,
    };

    // Set up nextDue for recurring cards
    if (cardData.recurring?.enabled && cardData.recurring?.nextDue === undefined) {
      cardData.recurring.nextDue = computeNextDue(cardData.recurring);
    }

    const card = new Card(cardData);
    await card.save();
    res.status(201).json(card);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.patch("/api/cards/:id", async (req, res) => {
  try {
    const card = await Card.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!card) return res.status(404).json({ error: "Card not found" });
    res.json(card);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.delete("/api/cards/:id", async (req, res) => {
  try {
    await Card.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Move card to different list
app.post("/api/cards/:id/move", async (req, res) => {
  try {
    const { listId, position } = req.body;
    const list = await List.findById(listId);
    if (!list) return res.status(404).json({ error: "List not found" });

    const card = await Card.findByIdAndUpdate(
      req.params.id,
      { listId, boardId: list.boardId, position },
      { new: true }
    );
    res.json(card);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Reorder cards within a list
app.post("/api/lists/:listId/cards/reorder", async (req, res) => {
  try {
    const { order } = req.body;
    await Promise.all(
      order.map((id, index) => Card.findByIdAndUpdate(id, { position: index }))
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Health check ─────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => res.json({ ok: true }));

// ─── 404 & error handlers ─────────────────────────────────────────────────────
app.use("/api", (req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
});

app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: err.message || "Internal server error" });
});

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
if (require.main === module) {
  app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
  connectDB().catch((e) => console.error("Initial DB connect failed:", e.message));
}

module.exports = app;

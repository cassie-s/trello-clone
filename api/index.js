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
      // Set to start of day (midnight) for daily tasks
      next.setHours(0, 0, 0, 0);
      break;
    case "weekly":
      next.setDate(next.getDate() + 7 * interval);
      // Set to start of day for weekly tasks
      next.setHours(0, 0, 0, 0);
      break;
    case "monthly":
      next.setMonth(next.getMonth() + interval);
      if (recurring.dayOfMonth) next.setDate(recurring.dayOfMonth);
      // Set to start of day for monthly tasks
      next.setHours(0, 0, 0, 0);
      break;
    default:
      next.setDate(next.getDate() + interval);
      next.setHours(0, 0, 0, 0);
  }
  return next;
}

// ─── Helper: Generate recurring card instances ────────────────────────────────
async function generateRecurringInstances() {
  const now = new Date();
  // Find all recurring templates (they are archived to hide them from board view)
  const allRecurringCards = await Card.find({
    "recurring.enabled": true,
    isRecurringInstance: false,
    // Templates are archived, so we need to include archived cards
  });
  
  console.log(`[Recurring] Total recurring templates: ${allRecurringCards.length}`);
  allRecurringCards.forEach(c => {
    console.log(`  - "${c.title}": nextDue=${c.recurring.nextDue}, archived=${c.archived}`);
  });
  
  const recurringCards = allRecurringCards.filter(c => 
    c.recurring.nextDue && new Date(c.recurring.nextDue) <= now
  );

  console.log(`[Recurring] Found ${recurringCards.length} ready to generate (nextDue <= now)`);

  for (const card of recurringCards) {
    // Create a new instance (not archived, visible on board)
    const instance = new Card({
      title: card.title,
      description: card.description,
      listId: card.listId,
      boardId: card.boardId,
      position: 0, // Put new instances at the top
      labels: card.labels,
      dueDate: card.recurring.nextDue,
      checklist: card.checklist ? card.checklist.map(item => ({ text: item.text, checked: false })) : [],
      isRecurringInstance: true,
      parentCardId: card._id,
      archived: false, // Instances are visible
    });
    await instance.save();
    console.log(`✅ Created recurring instance for "${card.title}"`);

    // Update template's next due date
    card.recurring.lastGenerated = now;
    card.recurring.nextDue = computeNextDue(card.recurring, card.recurring.nextDue);
    await card.save();
    console.log(`   Next due set to: ${card.recurring.nextDue}`);
  }
  
  return recurringCards.length;
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
    const cards = await Card.find({ listId: req.params.listId, archived: false }).sort("position");
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
    
    // Show all cards including recurring ones - they should always be visible
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

    // If recurring is enabled, this is a template - hide it from the board
    if (cardData.recurring?.enabled) {
      cardData.archived = true; // Hide template cards
      // Set nextDue to midnight tonight (or tomorrow if it's already past midnight logic)
      cardData.recurring.nextDue = cardData.dueDate || new Date();
      // Set dueDate to same as nextDue for consistency
      cardData.dueDate = cardData.recurring.nextDue;
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
    const card = await Card.findById(req.params.id);
    if (!card) return res.status(404).json({ error: "Card not found" });

    // Update the card
    Object.assign(card, req.body);
    
    // If enabling recurring on an existing card, hide it and set it up as a template
    if (req.body.recurring?.enabled && !card.isRecurringInstance) {
      card.archived = true; // Hide template
      if (!card.recurring.nextDue) {
        card.recurring.nextDue = card.dueDate || new Date();
      }
      console.log(`✅ Converted "${card.title}" to recurring template (hidden)`);
    }
    
    await card.save();
    res.json(card);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.delete("/api/cards/:id", async (req, res) => {
  try {
    const card = await Card.findById(req.params.id);
    
    // If this is a recurring instance, delete the parent template too
    if (card && card.isRecurringInstance && card.parentCardId) {
      await Card.findByIdAndDelete(card.parentCardId);
      console.log(`🗑️  Deleted recurring template for "${card.title}"`);
    }
    
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

// ─── Debug endpoint for recurring cards ───────────────────────────────────────
app.get("/api/debug/recurring", async (req, res) => {
  try {
    const now = new Date();
    const recurringCards = await Card.find({
      "recurring.enabled": true,
      isRecurringInstance: false,
    });
    
    const details = recurringCards.map(c => ({
      id: c._id,
      title: c.title,
      boardId: c.boardId,
      listId: c.listId,
      dueDate: c.dueDate,
      recurring: c.recurring,
      archived: c.archived,
      isDue: c.recurring.nextDue && new Date(c.recurring.nextDue) <= now,
      nextDueInMs: c.recurring.nextDue ? new Date(c.recurring.nextDue).getTime() - now.getTime() : null,
    }));
    
    res.json({
      currentTime: now.toISOString(),
      totalRecurringCards: recurringCards.length,
      cards: details,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Repair endpoint to fix existing recurring cards ──────────────────────────
app.post("/api/debug/repair-recurring", async (req, res) => {
  try {
    const brokenCards = await Card.find({
      "recurring.enabled": true,
      isRecurringInstance: false,
    });
    
    console.log(`[Repair] Found ${brokenCards.length} recurring template cards`);
    
    const fixed = [];
    for (const card of brokenCards) {
      let changes = [];
      
      // Fix missing nextDue
      if (!card.recurring.nextDue) {
        card.recurring.nextDue = card.dueDate || new Date();
        changes.push('set nextDue');
      }
      
      // Archive templates (they should be hidden from board)
      if (!card.archived) {
        card.archived = true;
        changes.push('archived template');
      }
      
      if (changes.length > 0) {
        await card.save();
        console.log(`  ✅ Fixed "${card.title}": ${changes.join(', ')}`);
        fixed.push({ id: card._id, title: card.title, changes });
      }
    }
    
    res.json({
      success: true,
      fixed: fixed.length,
      cards: fixed,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Test endpoint to manually trigger recurring card generation ──────────────
app.post("/api/test/generate-recurring", async (req, res) => {
  try {
    const count = await generateRecurringInstances();
    res.json({ success: true, generated: count, message: `Generated ${count} recurring card instances` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Force generate ALL recurring cards (ignoring due dates, for testing) ─────
app.post("/api/test/force-generate-all", async (req, res) => {
  try {
    const recurringCards = await Card.find({
      "recurring.enabled": true,
      isRecurringInstance: false,
      "recurring.nextDue": { $exists: true },
    });
    
    console.log(`[Force] Generating ${recurringCards.length} recurring cards (ignoring due time)`);
    
    for (const card of recurringCards) {
      // Create instance (visible on board)
      const instance = new Card({
        title: card.title,
        description: card.description,
        listId: card.listId,
        boardId: card.boardId,
        position: 0,
        labels: card.labels,
        dueDate: card.recurring.nextDue,
        checklist: card.checklist ? card.checklist.map(item => ({ text: item.text, checked: false })) : [],
        isRecurringInstance: true,
        parentCardId: card._id,
        archived: false,
      });
      await instance.save();
      console.log(`✅ Force-created instance for "${card.title}"`);
      
      // Update next due
      card.recurring.lastGenerated = new Date();
      card.recurring.nextDue = computeNextDue(card.recurring, card.recurring.nextDue);
      await card.save();
    }
    
    res.json({ success: true, generated: recurringCards.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

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

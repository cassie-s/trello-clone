# Kanban Board — Trello Clone

A full-featured Kanban board built with React + Vite (frontend), Express + Node.js (backend), and MongoDB. Deployable to Vercel.

## Features

- 📋 **Multiple boards** — create, delete, and switch between boards
- 📑 **Lists** — add, rename, reorder (drag & drop), delete
- 🎨 **List colors** — pick from 10 accent colors per list
- 🃏 **Cards** — add, edit, delete, drag between lists
- 🏷️ **Labels** — colored tags on cards
- 📅 **Due dates** — with overdue highlighting
- 🔁 **Recurring cards** — daily / weekly (by day) / monthly schedules
- ✋ **Drag & Drop** — full DnD for lists and cards via `@dnd-kit`

---

## Local Development

### Prerequisites

- Node.js 18+
- A MongoDB connection string (free tier on [MongoDB Atlas](https://www.mongodb.com/atlas) works great)

### 1. Clone & install

```bash
git clone <repo-url>
cd trello-clone

# Install root deps (concurrently)
npm install

# Install API deps
cd api && npm install && cd ..

# Install frontend deps
cd frontend && npm install && cd ..
```

### 2. Configure environment

**API** (`api/.env`):
```
MONGODB_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/trello-clone
FRONTEND_URL=http://localhost:5173
PORT=3001
```

**Frontend** (`frontend/.env`) — leave blank for local dev, the Vite proxy handles it:
```
VITE_API_URL=
```

### 3. Run

```bash
# From root — starts both API and frontend
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

---

## Deploy to Vercel

### Option A — Vercel + external API host (recommended for production)

1. Deploy the `api/` folder separately to Railway, Render, or Fly.io
2. Set the API's `MONGODB_URI` and `FRONTEND_URL` env vars there
3. In Vercel, import the root repo and set:
   ```
   VITE_API_URL=https://your-api-host.com/api
   ```

### Option B — Vercel Serverless (single deployment)

The `vercel.json` at the root is already configured for this. Vercel will:
- Serve the built `frontend/dist` as static files
- Route `/api/*` requests to `api/index.js` as a serverless function

**Steps:**
1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project → Import repo
3. Add environment variables in the Vercel dashboard:
   ```
   MONGODB_URI=mongodb+srv://...
   ```
4. Deploy — Vercel auto-detects `vercel.json`

> **Note:** Vercel serverless functions have a 10s timeout. MongoDB Atlas free tier works well. Make sure your Atlas cluster allows connections from `0.0.0.0/0` (or Vercel's IP ranges).

---

## Project Structure

```
trello-clone/
├── vercel.json          # Vercel deployment config
├── package.json         # Root scripts
│
├── api/
│   ├── index.js         # Express app + Mongoose models + all routes
│   ├── package.json
│   └── .env.example
│
└── frontend/
    ├── vite.config.js
    ├── index.html
    └── src/
        ├── App.jsx              # Root component, board routing
        ├── index.css            # Global design system tokens
        ├── lib/
        │   └── api.js           # All API calls
        └── components/
            ├── BoardsPage.jsx   # Board list / landing
            ├── BoardView.jsx    # Main kanban board with DnD
            ├── KanbanList.jsx   # Individual list column
            ├── CardItem.jsx     # Card card (sortable)
            ├── AddCardForm.jsx  # Inline add card
            └── CardModal.jsx    # Full card edit modal
```

---

## Recurring Cards

When you enable recurring on a card:

1. Set the **frequency**: Daily, Weekly, or Monthly
2. For **weekly**: pick which days of the week
3. For **monthly**: pick the day of the month
4. Set an **interval** (e.g. "every 2 weeks")

Each time the board loads, the API checks for recurring cards whose `nextDue` has passed and automatically generates a new card instance in the same list. The original "template" card is kept with its recurring settings and gets its `nextDue` advanced.

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18 + Vite |
| Drag & Drop | @dnd-kit/core + sortable |
| Backend | Express 4 / Node.js |
| Database | MongoDB + Mongoose |
| Deployment | Vercel |
# trello-clone

import { useState } from "react";
import { Plus, Trash2, LayoutDashboard } from "lucide-react";
import styles from "./BoardsPage.module.css";

const BACKGROUNDS = [
  "#1a1a2e", "#16213e", "#0f3460", "#1b1b2f",
  "#2d1b69", "#1a0533", "#0d2137", "#1a2744",
  "#2d0f2d", "#0f2d1a",
];

export default function BoardsPage({ boards, onSelectBoard, onCreateBoard, onDeleteBoard, error }) {
  const [showNew, setShowNew] = useState(false);
  const [title, setTitle] = useState("");
  const [bg, setBg] = useState(BACKGROUNDS[0]);
  const [creating, setCreating] = useState(false);

  async function handleCreate(e) {
    e.preventDefault();
    if (!title.trim()) return;
    setCreating(true);
    try {
      await onCreateBoard(title.trim(), bg);
      setTitle("");
      setShowNew(false);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.logo}>
          <LayoutDashboard size={22} strokeWidth={1.5} />
          <span>Kanban</span>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.titleRow}>
          <h1 className={styles.pageTitle}>Your Boards</h1>
          <button className={styles.newBtn} onClick={() => setShowNew(true)}>
            <Plus size={16} />
            New Board
          </button>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        {showNew && (
          <div className={styles.newBoardCard}>
            <form onSubmit={handleCreate}>
              <h3 className={styles.newBoardTitle}>Create Board</h3>
              <input
                autoFocus
                placeholder="Board title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={styles.input}
              />
              <div className={styles.colorRow}>
                <span className={styles.colorLabel}>Background</span>
                <div className={styles.colorSwatches}>
                  {BACKGROUNDS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`${styles.swatch} ${bg === c ? styles.swatchActive : ""}`}
                      style={{ background: c }}
                      onClick={() => setBg(c)}
                    />
                  ))}
                </div>
              </div>
              <div className={styles.actions}>
                <button type="button" className={styles.cancelBtn} onClick={() => setShowNew(false)}>
                  Cancel
                </button>
                <button type="submit" className={styles.createBtn} disabled={creating || !title.trim()}>
                  {creating ? "Creating…" : "Create"}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className={styles.grid}>
          {boards.map((board) => (
            <div
              key={board._id}
              className={styles.boardCard}
              style={{ background: board.background }}
              onClick={() => onSelectBoard(board)}
            >
              <div className={styles.boardCardInner}>
                <span className={styles.boardName}>{board.title}</span>
                <button
                  className={styles.deleteBtn}
                  onClick={(e) => { e.stopPropagation(); onDeleteBoard(board._id); }}
                  title="Delete board"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
          {boards.length === 0 && !showNew && (
            <div className={styles.empty}>
              <p>No boards yet. Create one to get started.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

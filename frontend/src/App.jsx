import { useState, useEffect } from "react";
import { api } from "./lib/api.js";
import BoardsPage from "./components/BoardsPage.jsx";
import BoardView from "./components/BoardView.jsx";

export default function App() {
  const [boards, setBoards] = useState([]);
  const [activeBoard, setActiveBoard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadBoards();
  }, []);

  async function loadBoards() {
    try {
      const data = await api.getBoards();
      setBoards(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function createBoard(title, background) {
    const board = await api.createBoard({ title, background });
    setBoards((prev) => [board, ...prev]);
    setActiveBoard(board);
  }

  async function deleteBoard(id) {
    await api.deleteBoard(id);
    setBoards((prev) => prev.filter((b) => b._id !== id));
    if (activeBoard?._id === id) setActiveBoard(null);
  }

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
        <div style={{ color: "var(--text-muted)", fontFamily: "var(--font-display)", fontSize: 18 }}>
          Loading…
        </div>
      </div>
    );
  }

  if (activeBoard) {
    return (
      <BoardView
        board={activeBoard}
        onBack={() => setActiveBoard(null)}
        onBoardUpdate={(updated) => {
          setActiveBoard(updated);
          setBoards((prev) => prev.map((b) => (b._id === updated._id ? updated : b)));
        }}
      />
    );
  }

  return (
    <BoardsPage
      boards={boards}
      onSelectBoard={setActiveBoard}
      onCreateBoard={createBoard}
      onDeleteBoard={deleteBoard}
      error={error}
    />
  );
}

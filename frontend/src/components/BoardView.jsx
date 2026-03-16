import { useState, useEffect, useCallback } from "react";
import ArchivedCardsModal from "./ArchivedCardsModal.jsx";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { ArrowLeft, Plus } from "lucide-react";
import { api } from "../lib/api.js";
import KanbanList from "./KanbanList.jsx";
import CardItem from "./CardItem.jsx";
import CardModal from "./CardModal.jsx";
import styles from "./BoardView.module.css";

export default function BoardView({ board, onBack, onBoardUpdate }) {
  const [lists, setLists] = useState([]);
  const [cards, setCards] = useState({}); // { listId: Card[] }
  const [loading, setLoading] = useState(true);
  const [addingList, setAddingList] = useState(false);
  const [newListTitle, setNewListTitle] = useState("");
  const [activeCard, setActiveCard] = useState(null); // for drag overlay
  const [editingCard, setEditingCard] = useState(null); // for modal
  const [draggedCard, setDraggedCard] = useState(null);
  const [showArchivedModal, setShowArchivedModal] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  useEffect(() => {
    loadBoard();
  }, [board._id]);

  async function loadBoard() {
    setLoading(true);
    try {
      const [listsData, cardsData] = await Promise.all([
        api.getLists(board._id),
        api.getBoardCards(board._id),
      ]);
      setLists(listsData);
      const grouped = {};
      listsData.forEach((l) => { grouped[l._id] = []; });
      cardsData.forEach((c) => {
        if (grouped[c.listId]) grouped[c.listId].push(c);
        else grouped[c.listId] = [c];
      });
      // Sort each list's cards by position
      Object.keys(grouped).forEach((lid) => {
        grouped[lid].sort((a, b) => a.position - b.position);
      });
      setCards(grouped);
    } finally {
      setLoading(false);
    }
  }

  // ── List actions ──────────────────────────────────────────────────────────

  async function handleAddList(e) {
    e.preventDefault();
    if (!newListTitle.trim()) return;
    const list = await api.createList(board._id, { title: newListTitle.trim() });
    setLists((prev) => [...prev, list]);
    setCards((prev) => ({ ...prev, [list._id]: [] }));
    setNewListTitle("");
    setAddingList(false);
  }

  async function handleUpdateList(listId, data) {
    const updated = await api.updateList(listId, data);
    setLists((prev) => prev.map((l) => (l._id === listId ? updated : l)));
  }

  async function handleDeleteList(listId) {
    await api.deleteList(listId);
    setLists((prev) => prev.filter((l) => l._id !== listId));
    setCards((prev) => { const n = { ...prev }; delete n[listId]; return n; });
  }

  // ── Card actions ──────────────────────────────────────────────────────────

  async function handleAddCard(listId, data) {
    const card = await api.createCard(listId, data);
    setCards((prev) => ({
      ...prev,
      [listId]: [...(prev[listId] || []), card],
    }));
  }

  async function handleUpdateCard(cardId, data) {
    const updated = await api.updateCard(cardId, data);
    setCards((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((lid) => {
        next[lid] = next[lid].map((c) => (c._id === cardId ? updated : c));
      });
      return next;
    });
    if (editingCard?._id === cardId) setEditingCard(updated);
  }

  async function handleDeleteCard(cardId, listId) {
    await api.deleteCard(cardId);
    setCards((prev) => ({
      ...prev,
      [listId]: (prev[listId] || []).filter((c) => c._id !== cardId),
    }));
    if (editingCard?._id === cardId) setEditingCard(null);
  }

    async function handleArchiveCard(cardId, listId) {
    await api.archiveCard(cardId);
    setCards((prev) => ({
      ...prev,
      [listId]: (prev[listId] || []).filter((c) => c._id !== cardId),
    }));
  }

  // ── Drag & Drop ───────────────────────────────────────────────────────────

  function findListOfCard(cardId) {
    for (const [lid, clist] of Object.entries(cards)) {
      if (clist.find((c) => c._id === cardId)) return lid;
    }
    return null;
  }

  function handleDragStart({ active }) {
    const type = active.data.current?.type;
    if (type === "card") {
      const listId = findListOfCard(active.id);
      const card = (cards[listId] || []).find((c) => c._id === active.id);
      setDraggedCard(card);
    }
    setActiveCard(active);
  }

  function handleDragOver({ active, over }) {
    if (!over) return;
    const activeType = active.data.current?.type;
    const overType = over.data.current?.type;

    if (activeType !== "card") return;

    const fromListId = findListOfCard(active.id);
    let toListId = overType === "list" ? over.id : over.data.current?.listId;
    if (!toListId || fromListId === toListId) return;

    setCards((prev) => {
      const fromList = [...(prev[fromListId] || [])];
      const toList = [...(prev[toListId] || [])];
      const cardIndex = fromList.findIndex((c) => c._id === active.id);
      if (cardIndex === -1) return prev;
      const [card] = fromList.splice(cardIndex, 1);
      toList.push({ ...card, listId: toListId });
      return { ...prev, [fromListId]: fromList, [toListId]: toList };
    });
  }

  async function handleDragEnd({ active, over }) {
    setActiveCard(null);
    setDraggedCard(null);
    if (!over) return;

    const activeType = active.data.current?.type;
    const overType = over.data.current?.type;

    if (activeType === "list") {
      // Reorder lists
      const oldIndex = lists.findIndex((l) => l._id === active.id);
      const newIndex = lists.findIndex((l) => l._id === over.id);
      if (oldIndex === newIndex) return;
      const newLists = arrayMove(lists, oldIndex, newIndex);
      setLists(newLists);
      await api.reorderLists(board._id, newLists.map((l) => l._id));
      return;
    }

    if (activeType === "card") {
      const currentListId = findListOfCard(active.id);
      let targetListId = overType === "list" ? over.id : over.data.current?.listId;
      if (!targetListId) targetListId = currentListId;

      const listCards = [...(cards[targetListId] || [])];
      const oldIndex = listCards.findIndex((c) => c._id === active.id);
      let newIndex = overType === "card"
        ? listCards.findIndex((c) => c._id === over.id)
        : listCards.length - 1;

      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        const reordered = arrayMove(listCards, oldIndex, newIndex);
        setCards((prev) => ({ ...prev, [targetListId]: reordered }));
        await api.reorderCards(targetListId, reordered.map((c) => c._id));
      }

      // If moved to different list (already done in dragOver, now persist)
      if (currentListId !== targetListId) {
        await api.moveCard(active.id, targetListId, newIndex);
      }
    }
  }

  const listIds = lists.map((l) => l._id);

  return (
    <div className={styles.board} style={{ background: board.background }}>
      {/* Noise overlay */}
      <div className={styles.noise} />

      <header className={styles.header}>
        <button className={styles.back} onClick={onBack}>
          <ArrowLeft size={16} />
          <span>Boards</span>
        </button>
        <h1 className={styles.boardTitle}>{board.title}</h1>
        <div style={{ flex: 1 }} />
        <button
          style={{ marginLeft: 12, background: 'var(--surface2)', color: 'var(--text-muted)', borderRadius: 6, padding: '7px 14px', fontSize: 13, fontWeight: 500 }}
          onClick={() => setShowArchivedModal(true)}
        >
          View archived
        </button>
      </header>

      {loading ? (
        <div className={styles.loading}>Loading board…</div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className={styles.listsScroll}>
            <div className={styles.lists}>
              {lists.map((list) => (
                <KanbanList
                  key={list._id}
                  list={list}
                  cards={cards[list._id] || []}
                  onUpdateList={handleUpdateList}
                  onDeleteList={handleDeleteList}
                  onAddCard={handleAddCard}
                  onDeleteCard={handleDeleteCard}
                  onEditCard={setEditingCard}
                  onArchiveCard={handleArchiveCard}
                />
              ))}

              {/* Add list */}
              <div className={styles.addListCol}>
                {addingList ? (
                  <form onSubmit={handleAddList} className={styles.addListForm}>
                    <input
                      autoFocus
                      placeholder="List name"
                      value={newListTitle}
                      onChange={(e) => setNewListTitle(e.target.value)}
                    />
                    <div className={styles.addListActions}>
                      <button type="submit" className={styles.addListConfirm}>
                        Add List
                      </button>
                      <button
                        type="button"
                        className={styles.addListCancel}
                        onClick={() => { setAddingList(false); setNewListTitle(""); }}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <button className={styles.addListBtn} onClick={() => setAddingList(true)}>
                    <Plus size={15} />
                    Add a list
                  </button>
                )}
              </div>
            </div>
          </div>

          <DragOverlay>
            {draggedCard && (
              <div style={{ transform: "rotate(2deg)", opacity: 0.95 }}>
                <CardItem card={draggedCard} isDragging onArchive={() => {}} />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      {editingCard && (
        <CardModal
          card={editingCard}
          lists={lists}
          onClose={() => setEditingCard(null)}
          onUpdate={handleUpdateCard}
          onDelete={(cardId) => handleDeleteCard(cardId, editingCard.listId)}
        />
      )}

      {showArchivedModal && (
        <ArchivedCardsModal
          boardId={board._id}
          lists={lists}
          onClose={() => setShowArchivedModal(false)}
        />
      )}
    </div>
  );
}

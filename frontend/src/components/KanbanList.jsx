import { useState, useRef } from "react";
import { useSortable, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { MoreHorizontal, Plus, Trash2, Palette, GripVertical, X, Check } from "lucide-react";
import CardItem from "./CardItem.jsx";
import AddCardForm from "./AddCardForm.jsx";
import styles from "./KanbanList.module.css";

const LIST_COLORS = [
  null,
  "#7c6aff", "#ff6a9d", "#4ade80", "#fbbf24",
  "#60a5fa", "#f97316", "#a78bfa", "#34d399",
  "#fb7185", "#38bdf8",
];

export default function KanbanList({ list, cards, onUpdateList, onDeleteList, onAddCard, onDeleteCard, onEditCard }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [colorPicker, setColorPicker] = useState(false);
  const [addingCard, setAddingCard] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(list.title);
  const menuRef = useRef(null);

  // Sortable for list reordering
  const {
    attributes,
    listeners,
    setNodeRef: setSortRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: list._id, data: { type: "list" } });

  // Droppable for receiving cards
  const { setNodeRef: setDropRef } = useDroppable({ id: list._id, data: { type: "list" } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const cardIds = cards.map((c) => c._id);

  function combineRefs(...refs) {
    return (el) => refs.forEach((r) => r(el));
  }

  async function handleTitleSave() {
    if (titleValue.trim() && titleValue !== list.title) {
      await onUpdateList(list._id, { title: titleValue.trim() });
    } else {
      setTitleValue(list.title);
    }
    setEditingTitle(false);
  }

  async function handleColorSelect(color) {
    await onUpdateList(list._id, { color });
    setColorPicker(false);
    setMenuOpen(false);
  }

  const accent = list.color || "rgba(255,255,255,0.08)";
  const headerStyle = list.color
    ? { background: list.color, borderColor: list.color }
    : {};

  return (
    <div
      ref={combineRefs(setSortRef, setDropRef)}
      style={style}
      className={styles.list}
    >
      {/* Colored top bar */}
      {list.color && <div className={styles.colorBar} style={{ background: list.color }} />}

      <div className={styles.header}>
        <button className={styles.dragHandle} {...attributes} {...listeners}>
          <GripVertical size={14} />
        </button>

        {editingTitle ? (
          <input
            autoFocus
            className={styles.titleInput}
            value={titleValue}
            onChange={(e) => setTitleValue(e.target.value)}
            onBlur={handleTitleSave}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleTitleSave();
              if (e.key === "Escape") { setTitleValue(list.title); setEditingTitle(false); }
            }}
          />
        ) : (
          <h3 className={styles.title} onClick={() => setEditingTitle(true)}>
            {list.title}
          </h3>
        )}

        <span className={styles.count}>{cards.length}</span>

        <div className={styles.menuWrap} ref={menuRef}>
          <button className={styles.menuBtn} onClick={() => setMenuOpen((p) => !p)}>
            <MoreHorizontal size={15} />
          </button>

          {menuOpen && (
            <div className={styles.menu}>
              <button
                className={styles.menuItem}
                onClick={() => { setColorPicker((p) => !p); }}
              >
                <Palette size={14} />
                List color
              </button>
              {colorPicker && (
                <div className={styles.colorPicker}>
                  {LIST_COLORS.map((c, i) => (
                    <button
                      key={i}
                      className={`${styles.colorDot} ${list.color === c ? styles.colorDotActive : ""}`}
                      style={{ background: c || "transparent", border: c ? undefined : "1px dashed rgba(255,255,255,0.3)" }}
                      onClick={() => handleColorSelect(c)}
                      title={c || "None"}
                    >
                      {!c && <X size={10} />}
                    </button>
                  ))}
                </div>
              )}
              <div className={styles.menuDivider} />
              <button
                className={`${styles.menuItem} ${styles.menuItemDanger}`}
                onClick={() => { onDeleteList(list._id); setMenuOpen(false); }}
              >
                <Trash2 size={14} />
                Delete list
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Cards */}
      <div className={styles.cardsArea}>
        <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
          {cards.map((card) => (
            <CardItem
              key={card._id}
              card={card}
              listId={list._id}
              onDelete={() => onDeleteCard(card._id, list._id)}
              onEdit={() => onEditCard(card)}
            />
          ))}
        </SortableContext>

        {cards.length === 0 && (
          <div className={styles.emptyDrop}>Drop cards here</div>
        )}
      </div>

      {/* Add card */}
      {addingCard ? (
        <AddCardForm
          listId={list._id}
          onAdd={(data) => { onAddCard(list._id, data); setAddingCard(false); }}
          onCancel={() => setAddingCard(false)}
        />
      ) : (
        <button className={styles.addCard} onClick={() => setAddingCard(true)}>
          <Plus size={14} />
          Add a card
        </button>
      )}
    </div>
  );
}

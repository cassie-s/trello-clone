import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Trash2, RefreshCw, Calendar, Tag } from "lucide-react";
import { format } from "date-fns";
import styles from "./CardItem.module.css";

export default function CardItem({ card, listId, onDelete, onEdit, isDragging }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortDragging,
  } = useSortable({
    id: card._id,
    data: { type: "card", listId },
    disabled: isDragging, // overlay card shouldn't be sortable
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortDragging ? 0.3 : 1,
  };

  const isOverdue =
    card.dueDate && new Date(card.dueDate) < new Date() && !card.archived;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${styles.card} ${isSortDragging ? styles.dragging : ""}`}
      {...attributes}
      {...listeners}
      onClick={onEdit}
    >
      {/* Labels */}
      {card.labels?.length > 0 && (
        <div className={styles.labels}>
          {card.labels.map((label, i) => (
            <span
              key={i}
              className={styles.label}
              style={{ background: label.color || "var(--accent)" }}
            >
              {label.text}
            </span>
          ))}
        </div>
      )}

      <div className={styles.body}>
        <span className={styles.title}>{card.title}</span>
        <button
          className={styles.deleteBtn}
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          title="Delete card"
        >
          <Trash2 size={12} />
        </button>
      </div>

      {/* Meta row */}
      {(card.dueDate || card.recurring?.enabled || card.isRecurringInstance) && (
        <div className={styles.meta}>
          {card.dueDate && (
            <span className={`${styles.due} ${isOverdue ? styles.overdue : ""}`}>
              <Calendar size={11} />
              {format(new Date(card.dueDate), "MMM d")}
            </span>
          )}
          {(card.recurring?.enabled || card.isRecurringInstance) && (
            <span className={styles.recurring} title={card.isRecurringInstance ? "Recurring instance" : "Recurring"}>
              <RefreshCw size={11} />
              {card.recurring?.frequency || "recurring"}
            </span>
          )}
        </div>
      )}

      {card.description && (
        <p className={styles.desc}>{card.description.slice(0, 80)}{card.description.length > 80 ? "…" : ""}</p>
      )}
    </div>
  );
}

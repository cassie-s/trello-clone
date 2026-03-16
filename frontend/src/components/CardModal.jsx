import { useState, useEffect } from "react";
import { X, Trash2, RefreshCw, Calendar, Tag, Plus, CheckSquare, Square } from "lucide-react";
import { format } from "date-fns";
import styles from "./CardModal.module.css";

const LABEL_COLORS = [
  "#7c6aff", "#ff6a9d", "#4ade80", "#fbbf24",
  "#60a5fa", "#f97316", "#a78bfa", "#34d399",
  "#fb7185", "#38bdf8",
];

const FREQ_OPTIONS = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function CardModal({ card, lists, existingLabels = [], onClose, onSave, onDelete }) {
  const isNewCard = card._id === null;
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description || "");
  const [dueDate, setDueDate] = useState(
    card.dueDate ? format(new Date(card.dueDate), "yyyy-MM-dd") : ""
  );
  const [checklist, setChecklist] = useState(card.checklist || []);
  const [newChecklistItem, setNewChecklistItem] = useState("");
  const [recurring, setRecurring] = useState({
    enabled: card.recurring?.enabled || false,
    frequency: card.recurring?.frequency || "weekly",
    interval: card.recurring?.interval || 1,
    daysOfWeek: card.recurring?.daysOfWeek || [],
    dayOfMonth: card.recurring?.dayOfMonth || 1,
  });
  const [labels, setLabels] = useState(card.labels || []);
  const [newLabelText, setNewLabelText] = useState("");
  const [newLabelColor, setNewLabelColor] = useState(LABEL_COLORS[0]);
  const [showLabelForm, setShowLabelForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  async function handleSave() {
    if (!title.trim()) {
      return; // Don't save if title is empty
    }
    setSaving(true);
    try {
      await onSave(card._id, {
        title: title.trim(),
        description,
        listId: card.listId,
        dueDate: dueDate || null,
        checklist,
        recurring,
        labels,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await onDelete(card._id);
    } finally {
      setDeleting(false);
    }
  }

  function addChecklistItem() {
    if (!newChecklistItem.trim()) return;
    setChecklist((prev) => [...prev, { text: newChecklistItem.trim(), checked: false }]);
    setNewChecklistItem("");
  }

  function toggleChecklistItem(index) {
    setChecklist((prev) =>
      prev.map((item, i) => (i === index ? { ...item, checked: !item.checked } : item))
    );
  }

  function removeChecklistItem(index) {
    setChecklist((prev) => prev.filter((_, i) => i !== index));
  }

  function addLabel() {
    if (!newLabelText.trim()) return;
    setLabels((prev) => [...prev, { text: newLabelText.trim(), color: newLabelColor }]);
    setNewLabelText("");
    setShowLabelForm(false);
  }

  function addExistingLabel(label) {
    // Check if label already exists on this card
    if (labels.find(l => l.text === label.text && l.color === label.color)) return;
    setLabels((prev) => [...prev, label]);
  }

  function removeLabel(i) {
    setLabels((prev) => prev.filter((_, idx) => idx !== i));
  }

  function toggleDay(day) {
    setRecurring((prev) => ({
      ...prev,
      daysOfWeek: prev.daysOfWeek.includes(day)
        ? prev.daysOfWeek.filter((d) => d !== day)
        : [...prev.daysOfWeek, day],
    }));
  }

  const list = lists.find((l) => l._id === card.listId);

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <div className={styles.headerLeft}>
            {list?.color && (
              <span className={styles.listDot} style={{ background: list.color }} />
            )}
            <span className={styles.listName}>{list?.title}</span>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Recurring badge */}
        {card.isRecurringInstance && (
          <div className={styles.recurringBadge}>
            <RefreshCw size={12} />
            This is a recurring instance
          </div>
        )}

        <div className={styles.body}>
          {/* Title */}
          <div className={styles.field}>
            <label className={styles.label}>Title</label>
            <input
              autoFocus={isNewCard}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={isNewCard ? "Enter card title..." : ""}
              className={styles.titleInput}
            />
          </div>

          {/* Description */}
          <div className={styles.field}>
            <label className={styles.label}>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a description…"
              rows={3}
            />
          </div>

          {/* Checklist */}
          <div className={styles.field}>
            <label className={styles.label}>
              <CheckSquare size={13} />
              Checklist
            </label>
            {checklist.length > 0 && (
              <div className={styles.checklistItems}>
                {checklist.map((item, i) => (
                  <div key={i} className={styles.checklistItem}>
                    <button
                      type="button"
                      className={styles.checkbox}
                      onClick={() => toggleChecklistItem(i)}
                    >
                      {item.checked ? (
                        <CheckSquare size={16} className={styles.checkboxChecked} />
                      ) : (
                        <Square size={16} />
                      )}
                    </button>
                    <span className={item.checked ? styles.checklistTextChecked : styles.checklistText}>
                      {item.text}
                    </span>
                    <button
                      type="button"
                      className={styles.checklistRemove}
                      onClick={() => removeChecklistItem(i)}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className={styles.checklistInput}>
              <input
                placeholder="Add checklist item…"
                value={newChecklistItem}
                onChange={(e) => setNewChecklistItem(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addChecklistItem()}
              />
              <button
                type="button"
                className={styles.checklistAddBtn}
                onClick={addChecklistItem}
                disabled={!newChecklistItem.trim()}
              >
                <Plus size={14} />
              </button>
            </div>
          </div>

          {/* Due Date */}
          <div className={styles.field}>
            <label className={styles.label}>
              <Calendar size={13} />
              Due Date
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          {/* Labels */}
          <div className={styles.field}>
            <label className={styles.label}>
              <Tag size={13} />
              Labels
            </label>
            <div className={styles.labelsList}>
              {labels.map((lbl, i) => (
                <span key={i} className={styles.labelChip} style={{ background: lbl.color }}>
                  {lbl.text}
                  <button onClick={() => removeLabel(i)} className={styles.labelRemove}>
                    <X size={10} />
                  </button>
                </span>
              ))}
              <button
                className={styles.addLabelBtn}
                onClick={() => setShowLabelForm((p) => !p)}
              >
                <Plus size={12} />
              </button>
            </div>

            {showLabelForm && (
              <div className={styles.labelForm}>
                {existingLabels.length > 0 && (
                  <div className={styles.existingLabels}>
                    <span className={styles.existingLabelsTitle}>Existing labels:</span>
                    <div className={styles.existingLabelsList}>
                      {existingLabels
                        .filter(existingLabel => !labels.find(l => l.text === existingLabel.text && l.color === existingLabel.color))
                        .map((label, i) => (
                          <button
                            key={i}
                            type="button"
                            className={styles.existingLabelChip}
                            style={{ background: label.color }}
                            onClick={() => addExistingLabel(label)}
                          >
                            {label.text}
                          </button>
                        ))}
                    </div>
                  </div>
                )}
                <div className={styles.newLabelSection}>
                  <span className={styles.newLabelTitle}>Or create new:</span>
                  <input
                    autoFocus
                    placeholder="Label text"
                    value={newLabelText}
                    onChange={(e) => setNewLabelText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addLabel()}
                    className={styles.labelInput}
                  />
                  <div className={styles.labelColors}>
                    {LABEL_COLORS.map((c) => (
                      <button
                        key={c}
                        className={`${styles.colorDot} ${newLabelColor === c ? styles.colorDotActive : ""}`}
                        style={{ background: c }}
                        onClick={() => setNewLabelColor(c)}
                      />
                    ))}
                  </div>
                  <button className={styles.addLabelConfirm} onClick={addLabel}>
                    Add label
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Recurring */}
          <div className={styles.field}>
            <label className={styles.label}>
              <RefreshCw size={13} />
              Recurring
            </label>

            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={recurring.enabled}
                onChange={(e) => setRecurring((p) => ({ ...p, enabled: e.target.checked }))}
              />
              <span className={styles.toggleTrack}>
                <span className={styles.toggleThumb} />
              </span>
              <span className={styles.toggleLabel}>
                {recurring.enabled ? "Enabled" : "Disabled"}
              </span>
            </label>

            {recurring.enabled && (
              <div className={styles.recurringOptions}>
                <div className={styles.recurringRow}>
                  <span className={styles.recurringRowLabel}>Repeat every</span>
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={recurring.interval}
                    onChange={(e) =>
                      setRecurring((p) => ({ ...p, interval: parseInt(e.target.value) || 1 }))
                    }
                    className={styles.intervalInput}
                  />
                  <select
                    value={recurring.frequency}
                    onChange={(e) => setRecurring((p) => ({ ...p, frequency: e.target.value }))}
                    className={styles.freqSelect}
                  >
                    {FREQ_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>

                {recurring.frequency === "weekly" && (
                  <div className={styles.daysRow}>
                    {DAYS.map((d, i) => (
                      <button
                        key={i}
                        type="button"
                        className={`${styles.dayBtn} ${recurring.daysOfWeek.includes(i) ? styles.dayBtnActive : ""}`}
                        onClick={() => toggleDay(i)}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                )}

                {recurring.frequency === "monthly" && (
                  <div className={styles.recurringRow}>
                    <span className={styles.recurringRowLabel}>Day of month</span>
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={recurring.dayOfMonth}
                      onChange={(e) =>
                        setRecurring((p) => ({ ...p, dayOfMonth: parseInt(e.target.value) || 1 }))
                      }
                      className={styles.intervalInput}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          {!isNewCard && (
            <button
              className={styles.deleteBtn}
              onClick={handleDelete}
              disabled={deleting}
            >
              <Trash2 size={14} />
              {deleting ? "Deleting…" : "Delete"}
            </button>
          )}
          {isNewCard && <div />}
          <div className={styles.footerRight}>
            <button className={styles.cancelBtn} onClick={onClose}>
              Cancel
            </button>
            <button className={styles.saveBtn} onClick={handleSave} disabled={saving || !title.trim()}>
              {saving ? "Saving…" : (isNewCard ? "Create card" : "Save changes")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

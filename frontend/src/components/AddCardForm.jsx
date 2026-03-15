import { useState } from "react";
import styles from "./AddCardForm.module.css";

export default function AddCardForm({ listId, onAdd, onCancel }) {
  const [title, setTitle] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) return;
    onAdd({ title: title.trim() });
    setTitle("");
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <textarea
        autoFocus
        placeholder="Card title…"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        rows={2}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
          }
          if (e.key === "Escape") onCancel();
        }}
        className={styles.input}
      />
      <div className={styles.actions}>
        <button type="submit" className={styles.addBtn} disabled={!title.trim()}>
          Add Card
        </button>
        <button type="button" className={styles.cancelBtn} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

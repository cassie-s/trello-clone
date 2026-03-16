import { useState, useEffect } from "react";
import { X, Trash2, Calendar, Tag } from "lucide-react";
import modalStyles from "./CardModal.module.css";
import styles from "./ArchivedCardsModal.module.css";

export default function ArchivedCardsModal({ boardId, lists, onClose }) {
  const [archivedCards, setArchivedCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [labelFilter, setLabelFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [labels, setLabels] = useState([]);
  const [displayCount, setDisplayCount] = useState(10);

  // Fetch all archived cards once on mount to populate labels
  useEffect(() => {
    async function fetchAllArchivedCards() {
      try {
        const allCards = await window.api.getArchivedCards(boardId, {});
        // Collect all unique labels for dropdown
        const allLabels = Array.from(new Set(allCards.flatMap(c => c.labels?.map(l => l.text) || [])));
        setLabels(allLabels);
      } catch (error) {
        console.error('Failed to fetch labels:', error);
      }
    }
    fetchAllArchivedCards();
  }, [boardId]);

  // Fetch filtered cards when filters change
  useEffect(() => {
    fetchArchivedCards();
    setDisplayCount(10); // Reset display count when filters change
  }, [boardId, labelFilter, dateFrom, dateTo]);

  async function handleDelete(cardId) {
    await window.api.deleteCard(cardId);
    setArchivedCards((prev) => prev.filter((c) => c._id !== cardId));
  }
  async function fetchArchivedCards() {
    setLoading(true);
    try {
      const params = {};
      if (labelFilter) params.label = labelFilter;
      if (dateFrom) params.from = dateFrom;
      if (dateTo) params.to = dateTo;
      const cards = await window.api.getArchivedCards(boardId, params);
      setArchivedCards(cards);
    } finally {
      setLoading(false);
    }
  }

  // Sort by most recent
  const sortedCards = [...archivedCards].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  const displayedCards = sortedCards.slice(0, displayCount);
  const hasMore = sortedCards.length > displayCount;

  function loadMore() {
    setDisplayCount(prev => prev + 10);
  }

  return (
    <div className={modalStyles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={modalStyles.modal} style={{ maxWidth: 600 }}>
        <div className={modalStyles.modalHeader}>
          <span>Archived Cards</span>
          <button className={modalStyles.closeBtn} onClick={onClose}><X size={18} /></button>
        </div>
        <div className={modalStyles.body}>
          <div className={styles.filters}>
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}><Tag size={13} /> Label</label>
              <select value={labelFilter} onChange={e => setLabelFilter(e.target.value)}>
                <option value="">All</option>
                {labels.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}><Calendar size={13} /> From</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            </div>
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}><Calendar size={13} /> To</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>
          </div>
          {loading ? (
            <div className={styles.loading}>Loading…</div>
          ) : sortedCards.length === 0 ? (
            <div className={styles.empty}>No archived cards found.</div>
          ) : (
            <>
              <ul className={styles.cardList}>
                {displayedCards.map(card => (
                <li key={card._id} className={styles.cardListItem}>
                  <div className={styles.archivedCard}>
                    {/* Labels */}
                    {card.labels?.length > 0 && (
                      <div className={styles.labelsRow}>
                        {card.labels.map((label, i) => (
                          <span
                            key={i}
                            className={styles.cardLabel}
                            style={{ background: label.color || 'var(--accent)' }}
                          >{label.text}</span>
                        ))}
                      </div>
                    )}
                    <div className={styles.cardHeader}>
                      <span className={styles.cardTitle}>{card.title}</span>
                      <button
                        className={styles.deleteBtn}
                        title="Delete card"
                        onClick={() => handleDelete(card._id)}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                    {/* Meta row */}
                    {(card.dueDate || card.description) && (
                      <div className={styles.cardMeta}>
                        {card.dueDate && (
                          <span className={styles.dueDate}>
                            Due: {new Date(card.dueDate).toLocaleDateString()}
                          </span>
                        )}
                        {card.description && (
                          <span className={styles.description}>{card.description.slice(0, 80)}{card.description.length > 80 ? '…' : ''}</span>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              ))}
              </ul>
              {hasMore && (
                <div className={styles.loadMoreContainer}>
                  <button className={styles.loadMoreBtn} onClick={loadMore}>
                    Load more ({sortedCards.length - displayCount} remaining)
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

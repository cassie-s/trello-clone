const BASE = import.meta.env.VITE_API_URL || "/api";

async function req(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Request failed");
  }
  return res.json();
}

export const api = {
  // Boards
  getBoards: () => req("GET", "/boards"),
  createBoard: (data) => req("POST", "/boards", data),
  updateBoard: (id, data) => req("PATCH", `/boards/${id}`, data),
  deleteBoard: (id) => req("DELETE", `/boards/${id}`),

  // Lists
  getLists: (boardId) => req("GET", `/boards/${boardId}/lists`),
  createList: (boardId, data) => req("POST", `/boards/${boardId}/lists`, data),
  updateList: (id, data) => req("PATCH", `/lists/${id}`, data),
  deleteList: (id) => req("DELETE", `/lists/${id}`),
  reorderLists: (boardId, order) => req("POST", `/boards/${boardId}/lists/reorder`, { order }),

  // Cards
  getBoardCards: (boardId) => req("GET", `/boards/${boardId}/cards`),
  createCard: (listId, data) => req("POST", `/lists/${listId}/cards`, data),
  updateCard: (id, data) => req("PATCH", `/cards/${id}`, data),
  deleteCard: (id) => req("DELETE", `/cards/${id}`),
  moveCard: (id, listId, position) => req("POST", `/cards/${id}/move`, { listId, position }),
  reorderCards: (listId, order) => req("POST", `/lists/${listId}/cards/reorder`, { order }),
};

const BASE = import.meta.env.VITE_API_URL || "/api";

async function req(method, path, body) {
  try {
    const options = {
      method,
      headers: body ? { "Content-Type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
    };
    
    // Only use cache: 'no-store' for GET requests (some mobile browsers have issues with it on mutations)
    if (method === 'GET') {
      options.cache = 'no-store';
    }
    
    const res = await fetch(`${BASE}${path}`, options);
    
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      console.error(`API Error (${method} ${path}):`, err);
      throw new Error(err.error || "Request failed");
    }
    return res.json();
  } catch (error) {
    console.error(`Request failed (${method} ${path}):`, error);
    throw error;
  }
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
  archiveCard: (id) => req("PATCH", `/cards/${id}`, { archived: true }),
  unarchiveCard: (id) => req("PATCH", `/cards/${id}`, { archived: false }),
  getArchivedCards: (boardId, { label, from, to } = {}) => {
    const params = new URLSearchParams();
    if (label) params.append('label', label);
    if (from) params.append('from', from);
    if (to) params.append('to', to);
    const query = params.toString() ? `?${params}` : '';
    return req("GET", `/boards/${boardId}/archived-cards${query}`);
  },
};

if (typeof window !== "undefined") {
  window.api = api;
}

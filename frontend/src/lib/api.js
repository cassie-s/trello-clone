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

// Debug helper for recurring cards
export async function debugRecurring() {
  try {
    const res = await fetch(`${BASE}/debug/recurring`);
    const data = await res.json();
    console.log('=== RECURRING CARDS DEBUG ===');
    console.log('Current time:', data.currentTime);
    console.log('Total recurring templates:', data.totalRecurringCards);
    console.log('\nTemplates (hidden from board):');
    data.cards.forEach((c, i) => {
      console.log(`\n${i + 1}. "${c.title}"`);
      console.log(`   ID: ${c.id}`);
      console.log(`   Archived (hidden): ${c.archived ? "YES ✅" : "NO ❌ (should be YES)"}`);
      console.log(`   Next Due: ${c.recurring.nextDue}`);
      console.log(`   Frequency: ${c.recurring.frequency} (interval: ${c.recurring.interval})`);
      console.log(`   Is Due?: ${c.isDue ? 'YES ✅ (will generate instance)' : 'NO ❌'}`);
      if (c.nextDueInMs !== null) {
        const hours = Math.floor(Math.abs(c.nextDueInMs) / (1000 * 60 * 60));
        console.log(`   Time until due: ${c.nextDueInMs > 0 ? hours + ' hours' : 'overdue by ' + hours + ' hours'}`);
      }
    });
    console.log('\n=============================');
    return data;
  } catch (error) {
    console.error('Debug failed:', error);
  }
}

// Repair broken recurring cards (missing nextDue field)
export async function repairRecurring() {
  try {
    const res = await fetch(`${BASE}/debug/repair-recurring`, { method: 'POST' });
    const data = await res.json();
    console.log('=== REPAIR RECURRING CARDS ===');
    console.log(`Fixed ${data.fixed} template(s)`);
    if (data.cards.length > 0) {
      console.log('\nRepaired templates:');
      data.cards.forEach((c, i) => {
        console.log(`${i + 1}. "${c.title}" - ${c.changes.join(', ')}`);
      });
    }
    console.log('\n✅ Repair complete! Templates are now hidden (archived).');
    console.log('Run forceGenerateAll() to create instances immediately.');
    console.log('==============================');
    return data;
  } catch (error) {
    console.error('Repair failed:', error);
  }
}

// Force generate ALL recurring cards NOW (ignoring due dates - for testing)
export async function forceGenerateAll() {
  try {
    const res = await fetch(`${BASE}/test/force-generate-all`, { method: 'POST' });
    const data = await res.json();
    console.log('=== FORCE GENERATE ALL ===');
    console.log(`Generated ${data.generated} card instance(s)`);
    console.log('\n✅ Done! Refresh the page to see instances on the board.');
    console.log('Templates remain hidden (archived).');
    console.log('==========================');
    return data;
  } catch (error) {
    console.error('Force generate failed:', error);
  }
}

if (typeof window !== "undefined") {
  window.api = api;
  window.debugRecurring = debugRecurring;
  window.repairRecurring = repairRecurring;
  window.forceGenerateAll = forceGenerateAll;
  console.log('💡 Debug helpers available!');
  console.log('   debugRecurring() - Check recurring card status');
  console.log('   repairRecurring() - Fix broken recurring cards');
  console.log('   forceGenerateAll() - Force generate all recurring cards NOW');
}

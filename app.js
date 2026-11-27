// Вставь сюда свою ссылку Firebase Realtime Database (без / в конце)
const DB_URL = "https://unicorn-school-947ee-default-rtdb.europe-west1.firebasedatabase.app";
const ADMIN_PIN = "unicorn2026";

let isAdmin = false;
let currentFilter = 'all';

// STEP 6: Category Filter Logic (работает и для базовых, и для новых вещей из голосования)
const filterButtons = document.querySelectorAll('.filter-btn');
const catalogGrid = document.getElementById('catalogGrid');
const allFilterBtn = document.getElementById('allFilterBtn');

function applyCatalogFilter() {
  const allCards = document.querySelectorAll('.catalog-card');
  allCards.forEach((card) => {
    const cardCategory = card.getAttribute('data-category');
    if (currentFilter === 'all' || currentFilter === cardCategory) {
      card.style.display = 'block';
    } else {
      card.style.display = 'none';
    }
  });
}

filterButtons.forEach((button) => {
  button.addEventListener('click', () => {
    filterButtons.forEach((btn) => btn.classList.remove('active'));
    button.classList.add('active');
    currentFilter = button.getAttribute('data-filter');
    applyCatalogFilter();
  });
});

// STEP 7: Clothing Detail Modal Popup (через делегирование кликов)
const modal = document.getElementById('itemModal');
const closeModalBtn = document.getElementById('closeModal');
const modalTitle = document.getElementById('modalTitle');
const modalRule = document.getElementById('modalRule');
const modalEco = document.getElementById('modalEco');

catalogGrid.addEventListener('click', (event) => {
  const card = event.target.closest('.catalog-card');
  if (!card) return;

  modalTitle.textContent = card.getAttribute('data-title');
  modalRule.textContent = card.getAttribute('data-rule');
  modalEco.textContent = card.getAttribute('data-eco');
  modal.classList.add('open');
});

closeModalBtn.addEventListener('click', () => modal.classList.remove('open'));
modal.addEventListener('click', (event) => {
  if (event.target === modal) modal.classList.remove('open');
});

// STEP 8: Auto-Moderation, Admin Approval, Catalog Promotion & Voting
const proposalForm = document.getElementById('proposalForm');
const formError = document.getElementById('formError');
const formSuccess = document.getElementById('formSuccess');
const proposalsList = document.getElementById('proposalsList');
const pendingList = document.getElementById('pendingList');
const pendingCount = document.getElementById('pendingCount');
const adminPanel = document.getElementById('adminPanel');

const defaultProposals = [
  {
    id: 'item-1',
    title: 'Plain Zip-Up Fleece Jacket',
    category: 'Hoodies',
    reason: 'Warm for winter classrooms and looks neat over a polo shirt.',
    author: 'Anonymous',
    status: 'approved',
    votes: 14
  },
  {
    id: 'item-2',
    title: 'Relaxed Cargo Trousers',
    category: 'Pants',
    reason: 'Comfortable cotton fabric with useful pockets for school supplies.',
    author: 'Student 9A',
    status: 'pending',
    votes: 1
  }
];

let proposals = [];
let votedIds = JSON.parse(localStorage.getItem('unicorn_voted_ids') || '[]');

async function loadProposals() {
  if (DB_URL) {
    try {
      const res = await fetch(`${DB_URL}/proposals.json`);
      const data = await res.json();
      if (data && !data.error) {
        proposals = Object.values(data);
      } else {
        proposals = defaultProposals;
      }
    } catch (e) {
      proposals = defaultProposals;
    }
  } else {
    const saved = localStorage.getItem('unicorn_proposals');
    proposals = saved ? JSON.parse(saved) : defaultProposals;
  }
  renderBoards();
}

async function syncProposal(item) {
  if (DB_URL) {
    await fetch(`${DB_URL}/proposals/${item.id}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item)
    });
  } else {
    localStorage.setItem('unicorn_proposals', JSON.stringify(proposals));
  }
}

async function removeProposal(id) {
  proposals = proposals.filter((p) => p.id !== id);
  if (DB_URL) {
    await fetch(`${DB_URL}/proposals/${id}.json`, { method: 'DELETE' });
  } else {
    localStorage.setItem('unicorn_proposals', JSON.stringify(proposals));
  }
  renderBoards();
}

function renderBoards() {
  const approved = proposals.filter((p) => p.status === 'approved');
  const pending = proposals.filter((p) => p.status === 'pending');
  const catalogPromoted = proposals.filter((p) => p.status === 'catalog');

  pendingCount.textContent = pending.length;

  // 1. Очередь админа (Pending)
  pendingList.innerHTML = pending.length === 0
    ? '<p>No pending items to review.</p>'
    : pending.map((item) => `
      <div class="proposal-card">
        <div>
          <span class="badge-approved">${item.category} (Pending)</span>
          <h4>${item.title}</h4>
          <p>${item.reason} — <em>${item.author}</em></p>
        </div>
        <div class="admin-actions">
          <button class="btn-approve" onclick="approveItem('${item.id}')">&#10003; Approve</button>
          <button class="btn-reject" onclick="rejectItem('${item.id}')">&#10005; Reject</button>
        </div>
      </div>
    `).join('');

  // 2. Список голосования (Approved)
  proposalsList.innerHTML = approved.length === 0
    ? '<p>All popular proposals have been added to the catalog!</p>'
    : approved.map((item) => {
      const hasVoted = votedIds.includes(item.id);
      // Если вошёл админ — блокировка голосов снимается для демонстрации
      const lockVote = !isAdmin && hasVoted;

      return `
        <div class="proposal-card">
          <div>
            <span class="badge-approved">${item.category}</span>
            ${isAdmin ? '<span class="admin-badge">Admin Unlimited Vote Active</span>' : ''}
            <h4>${item.title}</h4>
            <p>${item.reason} — <em>${item.author}</em></p>
          </div>
          <div class="admin-actions">
            ${isAdmin ? `<button class="btn-promote" onclick="promoteToCatalog('${item.id}')">+ Add to Catalog</button>` : ''}
            <button class="vote-btn ${lockVote ? 'voted' : ''}" 
                    onclick="voteItem('${item.id}')" 
                    ${lockVote ? 'disabled' : ''}>
              ${lockVote ? `&#10003; Voted (${item.votes})` : `&#9650; ${item.votes} Votes`}
            </button>
          </div>
        </div>
      `;
    }).join('');

  // 3. Добавляем вещи, перенесённые админом в основной каталог
  document.querySelectorAll('.dynamic-catalog-card').forEach((el) => el.remove());

  catalogPromoted.forEach((item) => {
    const catLower = item.category.toLowerCase();
    const imgUrl = `https://placehold.co/400x300/E8F5E9/1B4332?text=${encodeURIComponent(item.title)}`;

    const card = document.createElement('div');
    card.className = 'catalog-card dynamic-catalog-card';
    card.setAttribute('data-category', catLower);
    card.setAttribute('data-title', item.title);
    card.setAttribute('data-rule', `Community Approved (${item.votes} student votes): ${item.reason}`);
    card.setAttribute('data-eco', 'Eco Tip: Added by student vote to encourage comfortable, reusable everyday wear.');

    card.innerHTML = `
      <img src="${imgUrl}" alt="${item.title} school approved">
      <div class="card-body">
        <span class="badge-approved">Community Approved</span>
        <h3>${item.title}</h3>
        <p class="card-cat">${item.category}</p>
      </div>
    `;
    catalogGrid.appendChild(card);
  });

  // Обновляем счётчик на кнопке All (10 + новые)
  if (allFilterBtn) {
    allFilterBtn.textContent = `All (${10 + catalogPromoted.length})`;
  }
  applyCatalogFilter();
}

// Отправка формы с авто-модерацией
proposalForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const nameInput = document.getElementById('studentName').value.trim() || 'Anonymous';
  const itemInput = document.getElementById('itemName').value.trim();
  const categoryInput = document.getElementById('itemCategory').value;
  const reasonInput = document.getElementById('itemReason').value.trim();

  const blockedWords = ['spam', 'idiot', 'stupid', 'trash', 'hate', 'xxx', 'qwerty'];
  const combinedText = `${itemInput} ${reasonInput}`.toLowerCase();
  const hasBadWord = blockedWords.some((word) => combinedText.includes(word));

  if (itemInput.length < 3 || reasonInput.length < 10) {
    formSuccess.style.display = 'none';
    formError.textContent = 'Please enter a valid item name and at least 10 characters explaining why.';
    return;
  }

  if (hasBadWord) {
    formSuccess.style.display = 'none';
    formError.textContent = 'Auto-moderation alert: Please keep suggestions respectful and school-appropriate.';
    return;
  }

  formError.textContent = '';

  const newProposal = {
    id: 'item-' + Date.now(),
    title: itemInput,
    category: categoryInput,
    reason: reasonInput,
    author: nameInput,
    status: 'pending',
    votes: 1
  };

  proposals.unshift(newProposal);
  await syncProposal(newProposal);
  renderBoards();

  formSuccess.textContent = `Submitted! "${itemInput}" is now waiting for Admin approval before appearing publicly.`;
  formSuccess.style.display = 'block';
  proposalForm.reset();
});

// Действия админа и голосование
window.approveItem = async function(id) {
  const item = proposals.find((p) => p.id === id);
  if (item) {
    item.status = 'approved';
    await syncProposal(item);
    renderBoards();
  }
};

window.promoteToCatalog = async function(id) {
  const item = proposals.find((p) => p.id === id);
  if (item) {
    item.status = 'catalog';
    await syncProposal(item);
    renderBoards();
    alert(`"${item.title}" has been added to the main Approved Catalog above!`);
  }
};

window.rejectItem = async function(id) {
  await removeProposal(id);
};

window.voteItem = async function(id) {
  // Обычный пользователь может голосовать только 1 раз; админ — бесконечно
  if (!isAdmin && votedIds.includes(id)) return;

  const item = proposals.find((p) => p.id === id);
  if (item) {
    item.votes += 1;
    if (!isAdmin) {
      votedIds.push(id);
      localStorage.setItem('unicorn_voted_ids', JSON.stringify(votedIds));
    }
    await syncProposal(item);
    renderBoards();
  }
};

// Вход и выход из админки
document.getElementById('adminLoginBtn').addEventListener('click', () => {
  const pin = prompt('Enter Admin PIN to moderate submissions:');
  if (pin === ADMIN_PIN) {
    isAdmin = true;
    adminPanel.style.display = 'block';
    renderBoards();
    adminPanel.scrollIntoView({ behavior: 'smooth' });
  } else if (pin !== null) {
    alert('Incorrect Admin PIN.');
  }
});

document.getElementById('logoutAdminBtn').addEventListener('click', () => {
  isAdmin = false;
  adminPanel.style.display = 'none';
  renderBoards();
});

// STEP 9: Mobile Burger Menu Toggle
const burgerBtn = document.getElementById('burgerBtn');
const navLinks = document.getElementById('navLinks');

burgerBtn.addEventListener('click', () => {
  navLinks.classList.toggle('active');
});

loadProposals();
setInterval(loadProposals, 4000);
// STEP 6: Category Filter Logic
const filterButtons = document.querySelectorAll('.filter-btn');
const catalogCards = document.querySelectorAll('.catalog-card');

filterButtons.forEach((button) => {
  button.addEventListener('click', () => {
    // Меняем активную кнопку
    filterButtons.forEach((btn) => btn.classList.remove('active'));
    button.classList.add('active');

    const selectedCategory = button.getAttribute('data-filter');

    // Показываем или скрываем карточки одежды
    catalogCards.forEach((card) => {
      const cardCategory = card.getAttribute('data-category');
      if (selectedCategory === 'all' || selectedCategory === cardCategory) {
        card.style.display = 'block';
      } else {
        card.style.display = 'none';
      }
    });
  });
});

// STEP 7: Clothing Detail Modal Popup
const modal = document.getElementById('itemModal');
const closeModalBtn = document.getElementById('closeModal');
const modalTitle = document.getElementById('modalTitle');
const modalRule = document.getElementById('modalRule');
const modalEco = document.getElementById('modalEco');

catalogCards.forEach((card) => {
  card.addEventListener('click', () => {
    modalTitle.textContent = card.getAttribute('data-title');
    modalRule.textContent = card.getAttribute('data-rule');
    modalEco.textContent = card.getAttribute('data-eco');
    modal.classList.add('open');
  });
});

closeModalBtn.addEventListener('click', () => {
  modal.classList.remove('open');
});

modal.addEventListener('click', (event) => {
  if (event.target === modal) {
    modal.classList.remove('open');
  }
});

// STEP 8 (UPGRADED): Auto-Moderation, Admin Approval Queue & 1-Vote Lock
// Если подключишь бесплатную Firebase Realtime Database, вставь её URL в кавычки ниже (без слэша в конце):
const DB_URL = "https://unicorn-school-947ee-default-rtdb.europe-west1.firebasedatabase.app"; 
const ADMIN_PIN = "unicorn2026";

const proposalForm = document.getElementById('proposalForm');
const formError = document.getElementById('formError');
const formSuccess = document.getElementById('formSuccess');
const proposalsList = document.getElementById('proposalsList');
const pendingList = document.getElementById('pendingList');
const pendingCount = document.getElementById('pendingCount');
const adminPanel = document.getElementById('adminPanel');

// Начальные данные (1 одобренная вещь и 1 на проверке у админа)
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

// Загрузка заявок (из облака Firebase или локально)
async function loadProposals() {
  if (DB_URL) {
    try {
      const res = await fetch(`${DB_URL}/proposals.json`);
      const data = await res.json();
      proposals = data ? Object.values(data) : defaultProposals;
    } catch (e) {
      proposals = defaultProposals;
    }
  } else {
    const saved = localStorage.getItem('unicorn_proposals');
    proposals = saved ? JSON.parse(saved) : defaultProposals;
  }
  renderBoards();
}

// Сохранение заявок
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

// Отрисовка списков (Одобренные + Очередь админа)
function renderBoards() {
  const approved = proposals.filter((p) => p.status === 'approved');
  const pending = proposals.filter((p) => p.status === 'pending');

  pendingCount.textContent = pending.length;

  // 1. Очередь админа
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

  // 2. Публичный список для голосования
  proposalsList.innerHTML = approved.map((item) => {
    const hasVoted = votedIds.includes(item.id);
    return `
      <div class="proposal-card">
        <div>
          <span class="badge-approved">${item.category}</span>
          <h4>${item.title}</h4>
          <p>${item.reason} — <em>${item.author}</em></p>
        </div>
        <button class="vote-btn ${hasVoted ? 'voted' : ''}" 
                onclick="voteItem('${item.id}')" 
                ${hasVoted ? 'disabled' : ''}>
          ${hasVoted ? `&#10003; Voted (${item.votes})` : `&#9650; ${item.votes} Votes`}
        </button>
      </div>
    `;
  }).join('');
}

// Отправка формы с авто-модерацией
proposalForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const nameInput = document.getElementById('studentName').value.trim() || 'Anonymous';
  const itemInput = document.getElementById('itemName').value.trim();
  const categoryInput = document.getElementById('itemCategory').value;
  const reasonInput = document.getElementById('itemReason').value.trim();

  // Авто-модерация: проверка на пустоту, длину и спам-слова
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
    status: 'pending', // Сначала попадает только в очередь админа!
    votes: 1
  };

  proposals.unshift(newProposal);
  await syncProposal(newProposal);
  renderBoards();

  formSuccess.textContent = `Submitted! "${itemInput}" is now waiting for Admin approval before appearing publicly.`;
  formSuccess.style.display = 'block';
  proposalForm.reset();
});

// Функции админа и голосования
window.approveItem = async function(id) {
  const item = proposals.find((p) => p.id === id);
  if (item) {
    item.status = 'approved';
    await syncProposal(item);
    renderBoards();
  }
};

window.rejectItem = async function(id) {
  await removeProposal(id);
};

window.voteItem = async function(id) {
  if (votedIds.includes(id)) return; // Защита: 1 голос на вещь
  const item = proposals.find((p) => p.id === id);
  if (item) {
    item.votes += 1;
    votedIds.push(id);
    localStorage.setItem('unicorn_voted_ids', JSON.stringify(votedIds));
    await syncProposal(item);
    renderBoards();
  }
};

// Вход в админку
document.getElementById('adminLoginBtn').addEventListener('click', () => {
  const pin = prompt('Enter Admin PIN to moderate submissions:');
  if (pin === ADMIN_PIN) {
    adminPanel.style.display = 'block';
    adminPanel.scrollIntoView({ behavior: 'smooth' });
  } else if (pin !== null) {
    alert('Incorrect Admin PIN.');
  }
});

document.getElementById('logoutAdminBtn').addEventListener('click', () => {
  adminPanel.style.display = 'none';
});

loadProposals();
setInterval(loadProposals, 4000);

// STEP 9: Mobile Burger Menu Toggle
const burgerBtn = document.getElementById('burgerBtn');
const navLinks = document.getElementById('navLinks');

burgerBtn.addEventListener('click', () => {
  navLinks.classList.toggle('active');
});
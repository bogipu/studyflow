(() => {
  'use strict';
  const KEY = 'studyflow-persely-v1';
  const form = document.getElementById('goalForm');
  const goalsEl = document.getElementById('goals');
  const errorEl = document.getElementById('formError');
  const format = value => new Intl.NumberFormat('hu-HU', {maximumFractionDigits: 0}).format(value) + ' Ft';
  const validMoney = n => Number.isSafeInteger(n) && n >= 0 && n <= 1000000000;
  let goals = [];
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || '[]');
    if (Array.isArray(parsed)) goals = parsed.filter(g => g && typeof g.id === 'string' && typeof g.name === 'string' && validMoney(g.target) && g.target > 0 && validMoney(g.saved));
  } catch { errorEl.textContent = 'A korábbi adatok nem olvashatók. Nem írtam felül őket.'; }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(goals)); return true; } catch { errorEl.textContent = 'Nem sikerült menteni. Ellenőrizd a böngésző tárhelyét.'; return false; } };
  function render() {
    goalsEl.replaceChildren();
    document.getElementById('totalSaved').textContent = format(goals.reduce((sum, g) => sum + g.saved, 0));
    document.getElementById('goalCount').textContent = goals.length + ' megtakarítási cél';
    if (!goals.length) { const p = document.createElement('p'); p.className = 'savings-empty'; p.textContent = 'Még üres a perselyed. Kezdjük az első álmoddal! 🧸'; goalsEl.append(p); return; }
    goals.forEach(g => {
      const card = document.createElement('article'); card.className = 'savings-goal';
      const heading = document.createElement('h3'); heading.textContent = '🎀 ' + g.name;
      const money = document.createElement('div'); money.className = 'savings-number'; money.textContent = format(g.saved) + ' / ' + format(g.target);
      const track = document.createElement('div'); track.className = 'savings-track'; track.setAttribute('role','progressbar'); track.setAttribute('aria-label', g.name); track.setAttribute('aria-valuemin','0'); track.setAttribute('aria-valuemax','100');
      const percent = Math.min(100, Math.round(g.saved / g.target * 100)); track.setAttribute('aria-valuenow', String(percent));
      const fill = document.createElement('div'); fill.className = 'savings-fill'; fill.style.width = percent + '%'; track.append(fill);
      const caption = document.createElement('p'); caption.className = 'savings-muted'; caption.textContent = g.saved >= g.target ? '✨ Megvan az álmodhoz szükséges összeg!' : percent + '% kész · Még ' + format(g.target - g.saved) + ' hiányzik';
      const amount = document.createElement('input'); amount.className = 'savings-amount'; amount.type = 'number'; amount.min = '1'; amount.max = '1000000000'; amount.step = '1'; amount.inputMode = 'numeric'; amount.placeholder = 'Összeg (Ft)'; amount.setAttribute('aria-label', 'Összeg: ' + g.name);
      const actions = document.createElement('div'); actions.className = 'savings-actions';
      const add = document.createElement('button'); add.type = 'button'; add.textContent = '＋ Félreteszem';
      const take = document.createElement('button'); take.type = 'button'; take.textContent = '− Kiveszem';
      const del = document.createElement('button'); del.type = 'button'; del.textContent = 'Törlés'; del.className = 'danger';
      const change = direction => {
        const n = Number(amount.value);
        if (!validMoney(n) || n === 0 || (direction < 0 && n > g.saved) || (direction > 0 && !validMoney(g.saved + n))) { errorEl.textContent = 'Adj meg érvényes összeget (kivételnél legfeljebb a félretett pénzt).'; return; }
        errorEl.textContent = ''; const before = g.saved; g.saved += direction * n; if (!save()) { g.saved = before; return; } render();
      };
      add.addEventListener('click', () => change(1)); take.addEventListener('click', () => change(-1));
      del.addEventListener('click', () => { if (confirm('Biztosan törlöd ezt a célt: ' + g.name + '?')) { const before = goals; goals = goals.filter(x => x.id !== g.id); if (!save()) goals = before; render(); } });
      actions.append(add, take, del); card.append(heading, money, track, caption, amount, actions); goalsEl.append(card);
    });
  }
  form.addEventListener('submit', e => {
    e.preventDefault(); const data = new FormData(form); const name = String(data.get('name') || '').trim(); const target = Number(data.get('target')); const saved = Number(data.get('saved'));
    if (!name || name.length > 65 || !validMoney(target) || target === 0 || !validMoney(saved)) { errorEl.textContent = 'Írj be egy nevet és érvényes, egész forintösszegeket.'; return; }
    const id = globalThis.crypto?.randomUUID?.() || String(Date.now()) + '-' + Math.random();
    const next = {id, name, target, saved}; goals.push(next); if (!save()) { goals.pop(); return; } errorEl.textContent = ''; form.reset(); render();
  });
  render();
})();

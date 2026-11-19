(() => {
  const card = document.getElementById('v-misterio-em-aberto');
  const buttons = [...card.querySelectorAll('[data-misterio-pistas]')];
  const result = document.getElementById('misterio-pistas-resultado');
  const draws = { caso: [], conspiracao: [] };
  const source = new URL('pistas-misterio.json', document.currentScript.src);
  let bank;

  for (const button of buttons) {
    button.addEventListener('click', async () => {
      if (button.hasAttribute('aria-disabled')) return;
      for (const control of buttons) control.setAttribute('aria-disabled', 'true');
      result.textContent = 'Sorteando pistas…';
      try {
        if (!bank) {
          const response = await fetch(source);
          if (!response.ok) throw new Error('Banco de pistas indisponível');
          bank = await response.json();
        }

        const type = button.dataset.misterioPistas;
        const previous = draws[type];
        const candidates = bank[type].filter(clue => !previous.includes(clue));
        const selected = [];
        for (let i = 0; i < 3; i++) {
          const index = Math.floor(Math.random() * candidates.length);
          selected.push(candidates.splice(index, 1)[0]);
        }
        draws[type] = selected;

        const label = document.createElement('p');
        label.textContent = type === 'caso' ? 'Exemplos de pistas do caso' : 'Exemplos de pistas da conspiração';
        const list = document.createElement('ul');
        for (const clue of selected) {
          const item = document.createElement('li');
          item.textContent = clue;
          list.append(item);
        }
        result.replaceChildren(label, list);
      } catch {
        result.textContent = 'Não foi possível carregar as pistas. Tente de novo.';
      } finally {
        for (const control of buttons) control.removeAttribute('aria-disabled');
      }
    });
  }
})();

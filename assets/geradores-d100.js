const catalogUrl = new URL('./geradores-d100.json', import.meta.url);
const sourceNames = {
  locations: 'Lugar natural', structures: 'Estrutura', monsters: 'Monstro',
  animals: 'Animal', archetypes: 'Arquétipo', professions: 'Profissão',
  careers: 'Carreira', buildings: 'Estabelecimento', '+estalagem': 'Estalagem',
  factions: 'Facção', missions: 'Objetivo de missão', 'miscellaneous-items': 'Objeto',
  treasures: 'Tesouro', tools: 'Ferramenta', clothing: 'Vestuário', weapons: 'Arma',
  powers: 'Poder', potions: 'Efeito de poção', 'male-names': 'Masculino',
  'female-names': 'Feminino', 'wizard-names': 'Mago', qualities: 'Qualidade',
  effects: 'Efeito', elements: 'Elemento', forms: 'Forma'
};
let loading;

function node(tag, className, text) {
  const item = document.createElement(tag);
  if (className) item.className = className;
  if (text) item.textContent = text;
  return item;
}

function button(text, action, primary = false) {
  const item = node('button', primary ? 'btn' : 'btn ghost', text);
  item.type = 'button';
  item.addEventListener('click', action);
  return item;
}

function draw(die) {
  return window.randomInt(die);
}

function resultFrom(data, target, nameSource, secondary = false) {
  if (target.startsWith('+')) {
    const recipe = data.recipes[target.slice(1)];
    const picks = recipe.select ? [nameSource || recipe.select[0], ...recipe.parts] : recipe.parts;
    const results = picks.map(table => resultFrom(data, table, nameSource, secondary));
    const words = results.map(result => result.text);
    let text;
    switch (recipe.join) {
      case 'surname':
        text = words[0].replace(/-$/, '') + words[1].replace(/^-/, '');
        break;
      case 'fullName':
        text = words.join(' ');
        break;
      default:
        text = words.join(' · ');
    }
    return { text, trail: results.flatMap(result => result.trail) };
  }

  const table = data.tables[target];
  const rolled = draw(table.die);
  let index = rolled - 1;
  while (secondary && table.entries[index].ref) index = (index + 1) % table.entries.length;
  const entry = table.entries[index];
  const show = n => n === 100 ? data.rollPolicy.display100 : String(n).padStart(2, '0');
  const numbers = index + 1 === rolled ? show(rolled) : show(rolled) + ' → ' + show(index + 1);
  const trail = [table.label + ' · d' + table.die + ' · ' + numbers];
  if (!entry.ref) return { text: entry.text, trail };
  const next = resultFrom(data, entry.ref.target, nameSource, true);
  const text = entry.ref.template
    ? entry.ref.template.replace('{resultado}', () => next.text)
    : entry.text + ' · ' + next.text;
  return { text, trail: [...trail, ...next.trail] };
}

function makeField(data, cardId, field, onChange) {
  const element = node('div', 'geradores-campo');
  const heading = node('h3', '', field.label);
  const id = 'g-' + cardId + '-' + field.id;
  heading.id = id + '-rotulo';
  element.append(heading);

  if (field.usage === 'manual') {
    const input = node('textarea');
    input.rows = 2;
    input.setAttribute('aria-labelledby', heading.id);
    input.addEventListener('input', onChange);
    element.append(input);
    return { element, label: field.label, input, value: () => input.value.trim() };
  }

  const controls = node('div', 'geradores-campo-acoes');
  const output = node('div');
  output.setAttribute('aria-live', 'polite');
  const options = field.options[0] === '+nome-completo' ? data.recipes['nome-completo'].select : field.options;
  let select;
  let result;
  let fixed = false;

  function renderResult() {
    output.replaceChildren();
    if (!result) return;
    output.append(node('p', 'geradores-resultado', result.text));
    if (result.trail.length === 1) {
      output.append(node('small', 'geradores-trilha', result.trail[0]));
    } else {
      const trace = node('details', 'geradores-trilha');
      trace.append(node('summary', '', 'Ver rolagem'));
      const lines = node('ul');
      result.trail.forEach(step => lines.append(node('li', '', step)));
      trace.append(lines);
      output.append(trace);
    }
  }

  function roll() {
    if (fixed) return;
    const selected = select?.value || options[0];
    result = field.options[0] === '+nome-completo'
      ? resultFrom(data, '+nome-completo', selected)
      : resultFrom(data, selected);
    rollButton.textContent = 'Rolar de novo';
    fix.hidden = false;
    renderResult();
    onChange();
  }

  if (options.length > 1) {
    select = node('select');
    select.setAttribute('aria-label', field.id === 'nome' ? 'Repertório de prenome' : 'Repertório de ' + field.label.toLowerCase());
    options.forEach(option => {
      const item = node('option', '', field.id === 'alvo' && option === 'archetypes' ? 'PNJ' : sourceNames[option] || data.tables[option].label);
      item.value = option;
      select.append(item);
    });
    select.addEventListener('change', () => {
      if (result) roll();
    });
    controls.append(select);
  }

  const rollButton = button('Rolar', roll);
  rollButton.setAttribute('aria-label', 'Rolar ' + field.label.toLowerCase());
  const fix = button('Fixar', () => {
    fixed = !fixed;
    fix.setAttribute('aria-pressed', String(fixed));
    fix.textContent = fixed ? 'Desafixar' : 'Fixar';
    rollButton.disabled = fixed;
    if (select) select.disabled = fixed;
    onChange();
  });
  fix.setAttribute('aria-pressed', 'false');
  fix.hidden = true;
  controls.append(rollButton, fix);
  // Mantém o resultado ao lado dos controles, com o rótulo acima.
  const info = node('div');
  info.append(heading, output);
  element.replaceChildren(info, controls);
  return { element, label: field.label, value: () => result?.text || '', roll, isFixed: () => fixed };
}

function makeCard(data, card) {
  const details = node('details', 'geradores-card');
  details.id = 'gerador-' + card.id;
  const summary = node('summary');
  const description = node('span');
  description.append(node('strong', 'geradores-nome', card.title), node('span', 'geradores-pergunta', card.prompt));
  summary.append(description);
  const body = node('div', 'geradores-corpo');
  const actions = node('div', 'geradores-acoes');
  const main = node('div');
  const extras = node('details', 'geradores-extras');
  extras.append(node('summary', '', 'Campos adicionais'));
  const feedback = node('p', 'geradores-feedback');
  feedback.setAttribute('role', 'status');
  const notes = card.fields.map(field => makeField(data, card.id, field, updateActions));
  const initial = notes.filter((_, i) => card.fields[i].usage === 'initial');
  let components = [];
  let formulaLabel = '';
  const formula = data.formulas[card.formula];
  const formulaBody = node('div');
  const formulaStatus = node('p', 'geradores-formula');
  formulaStatus.setAttribute('aria-live', 'polite');

  function updateActions() {
    if (!copy) return;
    copy.disabled = ![...components, ...notes].some(field => field.value());
    roll.disabled = !formula && initial.every(field => field.isFixed());
    feedback.textContent = '';
    fallback.hidden = true;
  }

  function rollFormula() {
    const chosen = formula.formulas[draw(formula.die) - 1];
    formulaLabel = 'Fórmula d12 · ' + chosen.n + ' · ' + chosen.steps.map(step => sourceNames[step]).join(' → ');
    formulaStatus.textContent = formulaLabel;
    components = chosen.steps.map(step => makeField(data, card.id, {
      id: step, label: sourceNames[step], options: [step], usage: 'initial'
    }, updateActions));
    formulaBody.replaceChildren(...components.map(field => field.element));
    components.forEach(field => field.roll());
    roll.textContent = 'Nova fórmula';
    updateActions();
  }

  const roll = button('Rolar', () => {
    if (formula) rollFormula();
    else {
      initial.forEach(field => field.roll());
      roll.textContent = 'Rolar de novo';
    }
  }, true);
  const fallback = node('textarea', 'geradores-copia');
  fallback.readOnly = true;
  fallback.hidden = true;
  fallback.setAttribute('aria-label', 'Resultado para copiar');
  const copy = button('Copiar', async () => {
    const values = [...components, ...notes].filter(field => field.value());
    const text = [card.title, ...(formulaLabel ? [formulaLabel] : []),
      ...values.map(field => field.label + ': ' + field.value())].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      feedback.textContent = 'Resultado copiado.';
    } catch {
      fallback.value = text;
      fallback.hidden = false;
      fallback.focus();
      fallback.select();
      feedback.textContent = 'Selecione e copie o texto.';
    }
  });
  actions.append(roll, copy);
  body.append(actions, feedback, fallback);
  if (formula) body.append(formulaStatus, formulaBody);
  notes.forEach((field, i) => {
    const usage = card.fields[i].usage;
    if (usage === 'initial' || (formula && usage === 'manual')) main.append(field.element);
    else extras.append(field.element);
  });
  body.append(main);
  if (extras.childElementCount > 1) body.append(extras);
  details.append(summary, body);
  updateActions();
  return details;
}

async function loadCards(root) {
  root.textContent = 'Carregando geradores…';
  const response = await fetch(catalogUrl);
  if (!response.ok) throw new Error('Falha ao carregar as tabelas');
  const data = await response.json();
  const groups = new Map();
  data.cards.forEach(card => {
    if (!groups.has(card.group)) {
      const group = node('section', 'geradores-grupo');
      group.append(node('h2', '', card.group));
      groups.set(card.group, group);
    }
    groups.get(card.group).append(makeCard(data, card));
  });
  root.replaceChildren(...groups.values());
}

export async function abrirGeradores(slug) {
  const root = document.getElementById('geradores-conteudo');
  try {
    loading ||= loadCards(root).catch(error => {
      loading = undefined;
      throw error;
    });
    await loading;
  } catch {
    if (location.hash.split('/')[0] !== '#geradores') return;
    const message = node('p', '', 'Não foi possível carregar os geradores.');
    message.setAttribute('role', 'status');
    root.replaceChildren(message, button('Tentar novamente', () => abrirGeradores(location.hash.split('/')[1])));
    return;
  }
  if (!slug || location.hash !== '#geradores/' + slug) return;
  const card = document.getElementById('gerador-' + slug);
  if (!card) return;
  card.open = true;
  card.querySelector('summary').focus({ preventScroll: true });
  card.scrollIntoView({ block: 'start', behavior: 'instant' });
}

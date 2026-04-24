const form = document.getElementById('formBusca');
const btnBuscar = document.getElementById('btnBuscar');
const btnLimpar = document.getElementById('btnLimpar');
const loading = document.getElementById('loading');
const erroGlobal = document.getElementById('erro-global');
const erroMsg = document.getElementById('erro-msg');
const secResultados = document.getElementById('resultados');
const listaResultados = document.getElementById('lista-resultados');
const totalBadge = document.getElementById('total-badge');
const linksGrid = document.getElementById('links-diretos-grid');

function mostrarErro(msg) {
  erroMsg.textContent = msg;
  erroGlobal.classList.remove('hidden');
}

function limparEstado() {
  erroGlobal.classList.add('hidden');
  secResultados.classList.add('hidden');
  listaResultados.innerHTML = '';
  linksGrid.innerHTML = '';
}

function iconeExterno() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
    <polyline points="15 3 21 3 21 9"/>
    <line x1="10" y1="14" x2="21" y2="3"/>
  </svg>`;
}

function construirURLs(nome, rg) {
  const termoIO = rg ? `${nome} ${rg}` : nome;
  const termoDOE = rg ? `"${nome}" ${rg}` : `"${nome}"`;
  return {
    imprensa: `https://www.imprensaoficial.com.br/DO/BuscaDO2001_11_02.aspx?pesquisa_campo=${encodeURIComponent(termoIO)}`,
    doe: `https://www.doe.sp.gov.br/search?q=${encodeURIComponent(termoDOE)}`,
  };
}

function renderizarResultado(item) {
  const div = document.createElement('div');
  const classeExtra = item.erro ? 'erro' : item.aviso ? 'aviso' : 'sucesso';
  div.className = `result-item ${classeExtra}`;

  const classeFonte = item.fonte === 'Imprensa Oficial' ? 'fonte-io' : 'fonte-doe';

  div.innerHTML = `
    <div class="result-header">
      <span class="fonte-badge ${classeFonte}">${item.fonte}</span>
      ${item.data ? `<span class="result-data">${item.data}</span>` : ''}
    </div>
    <p class="result-trecho">${item.trecho}</p>
    ${item.link ? `
      <div class="result-link">
        <a href="${item.link}" target="_blank" rel="noopener">
          ${iconeExterno()} Ver no site oficial
        </a>
      </div>
    ` : ''}
  `;
  return div;
}

function renderizarLinksDirectos(nome, rg) {
  const urls = construirURLs(nome, rg);
  linksGrid.innerHTML = `
    <a class="link-direto-btn" href="${urls.imprensa}" target="_blank" rel="noopener">
      ${iconeExterno()}
      Imprensa Oficial SP
    </a>
    <a class="link-direto-btn" href="${urls.doe}" target="_blank" rel="noopener">
      ${iconeExterno()}
      DOE SP
    </a>
  `;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  limparEstado();

  const nome = document.getElementById('nome').value.trim();
  const rg = document.getElementById('rg').value.trim();

  if (nome.length < 3) {
    mostrarErro('Informe o nome completo (mínimo 3 caracteres).');
    return;
  }

  btnBuscar.disabled = true;
  loading.classList.remove('hidden');

  try {
    const resp = await fetch('/api/buscar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, rg }),
    });

    const dados = await resp.json();

    if (!resp.ok) {
      mostrarErro(dados.erro || 'Erro na busca. Tente novamente.');
      return;
    }

    const { resultados, total } = dados;

    secResultados.classList.remove('hidden');
    totalBadge.textContent = total > 0 ? `${total} resultado(s) encontrado(s)` : 'Nenhum resultado direto';

    if (!resultados || resultados.length === 0) {
      const p = document.createElement('p');
      p.style.color = 'var(--cinza)';
      p.style.fontSize = '0.9rem';
      p.textContent = 'Nenhum resultado encontrado. Tente buscar diretamente nos links abaixo.';
      listaResultados.appendChild(p);
    } else {
      resultados.forEach(item => listaResultados.appendChild(renderizarResultado(item)));
    }

    renderizarLinksDirectos(nome, rg);
  } catch (err) {
    mostrarErro('Falha de conexão. Verifique sua internet e tente novamente.');
  } finally {
    btnBuscar.disabled = false;
    loading.classList.add('hidden');
  }
});

btnLimpar.addEventListener('click', () => {
  limparEstado();
  document.getElementById('nome').value = '';
  document.getElementById('rg').value = '';
  document.getElementById('nome').focus();
});

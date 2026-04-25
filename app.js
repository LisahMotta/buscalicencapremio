const form = document.getElementById('formBusca');
const btnBuscar = document.getElementById('btnBuscar');
const btnLimpar = document.getElementById('btnLimpar');
const erroGlobal = document.getElementById('erro-global');
const erroMsg = document.getElementById('erro-msg');
const loadingSection = document.getElementById('loading-section');
const secResultadosApi = document.getElementById('resultados-api');
const listaResultados = document.getElementById('lista-resultados');
const tituloResultados = document.getElementById('titulo-resultados');
const secLinksDiretos = document.getElementById('links-diretos');
const listaLinks = document.getElementById('lista-links');

/* ---- helpers ---- */
function esconder(...els) { els.forEach(el => { if (el) el.classList.add('hidden'); }); }
function mostrar(...els) { els.forEach(el => { if (el) el.classList.remove('hidden'); }); }

function limparTudo() {
  esconder(erroGlobal, loadingSection, secResultadosApi, secLinksDiretos);
  if (listaResultados) listaResultados.innerHTML = '';
  if (listaLinks) listaLinks.innerHTML = '';
}

function setLoading(ativo) {
  const label = btnBuscar.querySelector('.btn-label');
  const load = btnBuscar.querySelector('.btn-loading');
  if (ativo) {
    btnBuscar.disabled = true;
    label.classList.add('hidden');
    load.classList.remove('hidden');
    mostrar(loadingSection);
  } else {
    btnBuscar.disabled = false;
    label.classList.remove('hidden');
    load.classList.add('hidden');
    esconder(loadingSection);
  }
}

function mostrarErro(msg) {
  erroMsg.textContent = msg;
  mostrar(erroGlobal);
}

function highlightNome(texto, nome) {
  if (!nome) return texto;
  const regex = new RegExp(`(${nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return texto.replace(regex, '<mark>$1</mark>');
}

/* ---- ícones SVG ---- */
function iconExterno() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" stroke-linecap="round" stroke-linejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
    <polyline points="15 3 21 3 21 9"/>
    <line x1="10" y1="14" x2="21" y2="3"/>
  </svg>`;
}

function iconAlerta() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16" stroke-linecap="round" stroke-linejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/>
    <line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>`;
}

function iconErro() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="15" y1="9" x2="9" y2="15"/>
    <line x1="9" y1="9" x2="15" y2="15"/>
  </svg>`;
}

function iconOk() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16" stroke-linecap="round" stroke-linejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
    <polyline points="22 4 12 14.01 9 11.01"/>
  </svg>`;
}

/* ---- Cartão de resultado da API ---- */
function criarCartaoResultado(item, nomeBuscado) {
  const div = document.createElement('div');
  const isIO = item.fonte === 'Imprensa Oficial';
  const classeFonte = isIO ? 'fonte-io' : 'fonte-doe';

  let statusClass = '';
  let statusIcon = '';
  if (item.erro) {
    statusClass = 'status-erro';
    statusIcon = iconErro();
  } else if (item.aviso) {
    statusClass = 'status-aviso';
    statusIcon = iconAlerta();
  } else {
    statusClass = 'status-ok';
    statusIcon = iconOk();
  }

  div.className = `result-card ${statusClass}`;

  const trechoFormatado = highlightNome(item.trecho || '', nomeBuscado);

  div.innerHTML = `
    <div class="rc-header">
      <span class="fonte-badge ${classeFonte}">${item.fonte}</span>
      ${item.data ? `<span class="rc-data">${item.data}</span>` : ''}
      <span class="rc-status">${statusIcon}</span>
    </div>
    <div class="rc-body">
      <p class="rc-trecho">${trechoFormatado}</p>
    </div>
    <div class="rc-footer">
      <a href="${item.link}" target="_blank" rel="noopener" class="btn-ver">
        ${iconExterno()} Abrir no site oficial
      </a>
    </div>
  `;

  return div;
}

/* ---- Links diretos (fallback manual) ---- */
function gerarLinksDiretos(nome, rg) {
  const termoSimples = rg ? `${nome} ${rg}` : nome;
  const termoExato = rg ? `"${nome}" ${rg}` : `"${nome}"`;
  const termoGoogle = rg
    ? `"${nome}" "${rg}" "licença prêmio"`
    : `"${nome}" "licença prêmio"`;

  return [
    {
      fonte: 'Google (sites oficiais)',
      classeFonte: 'fonte-google',
      descricao: 'Busca Google restrita aos portais do Diário Oficial — costuma ser a mais completa.',
      url: `https://www.google.com/search?q=${encodeURIComponent(`${termoGoogle} site:imprensaoficial.com.br OR site:doe.sp.gov.br`)}`,
      destaque: true,
    },
    {
      fonte: 'Imprensa Oficial SP',
      classeFonte: 'fonte-io',
      descricao: 'Busca direta no acervo completo do Diário Oficial (desde 1891).',
      url: `https://www.imprensaoficial.com.br/DO/BuscaDO2001_11_2.aspx?pesquisa_campo=${encodeURIComponent(termoExato)}&tipoPesquisa=todos&botaoPesquisar=Pesquisar`,
    },
    {
      fonte: 'DOE SP',
      classeFonte: 'fonte-doe',
      descricao: 'Portal eletrônico com publicações recentes.',
      url: `https://www.doe.sp.gov.br/?q=${encodeURIComponent(termoSimples)}`,
    },
  ];
}

function criarCartaoLink({ fonte, classeFonte, descricao, url, destaque }) {
  const div = document.createElement('div');
  div.className = `result-card link-card${destaque ? ' destaque' : ''}`;

  div.innerHTML = `
    <div class="rc-header">
      <span class="fonte-badge ${classeFonte}">${fonte}</span>
      ${destaque ? '<span class="badge-rec">Recomendado</span>' : ''}
    </div>
    <div class="rc-body">
      <p class="rc-trecho">${descricao}</p>
    </div>
    <div class="rc-footer">
      <a href="${url}" target="_blank" rel="noopener" class="btn-ver">
        ${iconExterno()} Abrir busca
      </a>
    </div>
  `;

  return div;
}

/* ---- Submit ---- */
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  limparTudo();

  const nome = document.getElementById('nome').value.trim();
  const rg = document.getElementById('rg').value.trim();

  if (nome.length < 3) {
    mostrarErro('Informe o nome completo (mínimo 3 caracteres).');
    return;
  }

  setLoading(true);

  try {
    const resp = await fetch('/api/buscar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, rg }),
    });

    const data = await resp.json();

    if (!resp.ok) {
      mostrarErro(data.erro || 'Erro ao processar a busca.');
      setLoading(false);
      return;
    }

    const { resultados, total } = data;

    // Exibe resultados da API
    if (resultados && resultados.length > 0) {
      const reais = resultados.filter(r => !r.aviso && !r.erro);
      if (reais.length > 0) {
        tituloResultados.textContent = `${reais.length} resultado${reais.length > 1 ? 's' : ''} encontrado${reais.length > 1 ? 's' : ''}`;
      } else {
        tituloResultados.textContent = 'Nenhum resultado direto';
      }

      resultados.forEach(item => {
        listaResultados.appendChild(criarCartaoResultado(item, nome));
      });
      mostrar(secResultadosApi);
    }

    // Sempre mostra links diretos como fallback
    const links = gerarLinksDiretos(nome, rg);
    links.forEach(l => listaLinks.appendChild(criarCartaoLink(l)));
    mostrar(secLinksDiretos);

  } catch (err) {
    mostrarErro('Não foi possível conectar ao servidor. Tente novamente.');
    // Mostra links diretos mesmo com erro
    const links = gerarLinksDiretos(nome, rg);
    links.forEach(l => listaLinks.appendChild(criarCartaoLink(l)));
    mostrar(secLinksDiretos);
  } finally {
    setLoading(false);
  }
});

/* ---- Limpar ---- */
btnLimpar.addEventListener('click', () => {
  limparTudo();
  document.getElementById('nome').value = '';
  document.getElementById('rg').value = '';
  document.getElementById('nome').focus();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

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
    if (label) label.classList.add('hidden');
    if (load) load.classList.remove('hidden');
    mostrar(loadingSection);
  } else {
    btnBuscar.disabled = false;
    if (label) label.classList.remove('hidden');
    if (load) load.classList.add('hidden');
    esconder(loadingSection);
  }
}

function mostrarErro(msg) {
  if (erroMsg) erroMsg.textContent = msg;
  mostrar(erroGlobal);
}

function highlightNome(texto, nome) {
  if (!nome) return texto;
  const regex = new RegExp(`(${nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return texto.replace(regex, '<mark>$1</mark>');
}

/* ---- Cartão de resultado da API ---- */
function criarCartaoResultado(item, nomeBuscado) {
  const div = document.createElement('div');
  const classeFonte = item.fonte === 'Imprensa Oficial' ? 'fonte-io' : 'fonte-doe';

  let statusClass = 'status-ok';
  if (item.erro) statusClass = 'status-erro';
  else if (item.aviso) statusClass = 'status-aviso';

  div.className = `result-card ${statusClass}`;

  const trechoFormatado = highlightNome(item.trecho || '', nomeBuscado);

  div.innerHTML = `
    <div class="rc-header">
      <span class="fonte-badge ${classeFonte}">${item.fonte}</span>
      ${item.data ? `<span class="rc-data">${item.data}</span>` : ''}
    </div>
    <div class="rc-body">
      <p class="rc-trecho">${trechoFormatado}</p>
    </div>
    <div class="rc-footer">
      <a href="${item.link}" target="_blank" rel="noopener" class="btn-ver">
        Abrir no site oficial
      </a>
    </div>
  `;

  return div;
}

/* ---- Links diretos (fallback) ---- */
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
      descricao: 'Busca Google restrita aos portais do Diário Oficial.',
      url: `https://www.google.com/search?q=${encodeURIComponent(`${termoGoogle} site:imprensaoficial.com.br OR site:doe.sp.gov.br`)}`,
      destaque: true,
    },
    {
      fonte: 'Imprensa Oficial SP',
      classeFonte: 'fonte-io',
      descricao: 'Busca no acervo completo do Diário Oficial (desde 1891).',
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
      <a href="${url}" target="_blank" rel="noopener" class="btn-ver">Abrir busca</a>
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

    const { resultados } = data;

    if (resultados && resultados.length > 0) {
      const reais = resultados.filter(r => !r.aviso && !r.erro);
      if (tituloResultados) {
        tituloResultados.textContent = reais.length > 0
          ? `${reais.length} resultado${reais.length > 1 ? 's' : ''} encontrado${reais.length > 1 ? 's' : ''}`
          : 'Nenhum resultado direto';
      }
      resultados.forEach(item => {
        if (listaResultados) listaResultados.appendChild(criarCartaoResultado(item, nome));
      });
      mostrar(secResultadosApi);
    }

    const links = gerarLinksDiretos(nome, rg);
    links.forEach(l => {
      if (listaLinks) listaLinks.appendChild(criarCartaoLink(l));
    });
    mostrar(secLinksDiretos);

  } catch (err) {
    mostrarErro('Não foi possível conectar ao servidor. Tente novamente.');
    const links = gerarLinksDiretos(nome, rg);
    links.forEach(l => {
      if (listaLinks) listaLinks.appendChild(criarCartaoLink(l));
    });
    mostrar(secLinksDiretos);
  } finally {
    setLoading(false);
  }
});

/* ---- Limpar ---- */
if (btnLimpar) {
  btnLimpar.addEventListener('click', () => {
    limparTudo();
    document.getElementById('nome').value = '';
    document.getElementById('rg').value = '';
    document.getElementById('nome').focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

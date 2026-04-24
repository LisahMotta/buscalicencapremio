const form = document.getElementById('formBusca');
const btnLimpar = document.getElementById('btnLimpar');
const erroGlobal = document.getElementById('erro-global');
const erroMsg = document.getElementById('erro-msg');
const secResultados = document.getElementById('resultados');
const listaLinks = document.getElementById('lista-links');

function limparEstado() {
  erroGlobal.classList.add('hidden');
  secResultados.classList.add('hidden');
  listaLinks.innerHTML = '';
}

function iconeExterno() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
    <polyline points="15 3 21 3 21 9"/>
    <line x1="10" y1="14" x2="21" y2="3"/>
  </svg>`;
}

function gerarURLs(nome, rg) {
  const termoSimples = rg ? `${nome} ${rg}` : nome;
  const termoExato   = rg ? `"${nome}" ${rg}` : `"${nome}"`;
  const termoGoogle  = rg
    ? `"${nome}" "${rg}" "licença prêmio"`
    : `"${nome}" "licença prêmio"`;

  return [
    {
      fonte: 'Imprensa Oficial SP',
      classeFonte: 'fonte-io',
      descricao: 'Busca simples no acervo completo do Diário Oficial do Estado de SP (desde 1891)',
      url: `https://www.imprensaoficial.com.br/DO/BuscaSimplesDO.aspx?pesquisa_campo=${encodeURIComponent(termoSimples)}&botaoPesquisar=Pesquisar`,
      dica: 'Se não carregar automaticamente, cole o nome na caixa de busca do site.',
    },
    {
      fonte: 'Imprensa Oficial – Busca Avançada',
      classeFonte: 'fonte-io',
      descricao: 'Permite filtrar por data, caderno e seção do Diário Oficial',
      url: `https://www.imprensaoficial.com.br/DO/BuscaDO2001_11_2.aspx?pesquisa_campo=${encodeURIComponent(termoExato)}&tipoPesquisa=todos&botaoPesquisar=Pesquisar`,
      dica: 'Use o filtro de caderno "Executivo" para publicações de RH.',
    },
    {
      fonte: 'DOE SP – Diário Oficial Eletrônico',
      classeFonte: 'fonte-doe',
      descricao: 'Portal eletrônico do Diário Oficial com publicações recentes',
      url: `https://www.doe.sp.gov.br/?q=${encodeURIComponent(termoSimples)}`,
      dica: 'Cole o nome na barra de pesquisa caso a busca não abra automaticamente.',
    },
    {
      fonte: 'Google (restrito aos sites oficiais)',
      classeFonte: 'fonte-google',
      descricao: 'Busca via Google indexada nos dois portais — a mais completa e confiável',
      url: `https://www.google.com/search?q=${encodeURIComponent(`${termoGoogle} site:imprensaoficial.com.br OR site:doe.sp.gov.br`)}`,
      dica: 'Recomendado como primeira opção — retorna resultados de ambos os sites.',
      destaque: true,
    },
  ];
}

function criarCartaoLink({ fonte, classeFonte, descricao, url, dica, destaque }) {
  const div = document.createElement('div');
  div.className = `result-item link-card${destaque ? ' destaque' : ''}`;

  div.innerHTML = `
    <div class="result-header">
      <span class="fonte-badge ${classeFonte}">${fonte}</span>
      ${destaque ? '<span class="badge-rec">Recomendado</span>' : ''}
    </div>
    <p class="result-trecho">${descricao}</p>
    ${dica ? `<p class="result-dica">${dica}</p>` : ''}
    <div class="result-link">
      <a href="${url}" target="_blank" rel="noopener">
        ${iconeExterno()} Abrir busca
      </a>
      <button class="btn-copy" data-url="${url}" title="Copiar link">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
        </svg>
        Copiar link
      </button>
    </div>
  `;

  div.querySelector('.btn-copy').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    await navigator.clipboard.writeText(btn.dataset.url).catch(() => {});
    const original = btn.innerHTML;
    btn.textContent = 'Copiado!';
    setTimeout(() => { btn.innerHTML = original; }, 1500);
  });

  return div;
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  limparEstado();

  const nome = document.getElementById('nome').value.trim();
  const rg   = document.getElementById('rg').value.trim();

  if (nome.length < 3) {
    erroMsg.textContent = 'Informe o nome completo (mínimo 3 caracteres).';
    erroGlobal.classList.remove('hidden');
    return;
  }

  const links = gerarURLs(nome, rg);
  links.forEach(l => listaLinks.appendChild(criarCartaoLink(l)));
  secResultados.classList.remove('hidden');
});

btnLimpar.addEventListener('click', () => {
  limparEstado();
  document.getElementById('nome').value = '';
  document.getElementById('rg').value = '';
  document.getElementById('nome').focus();
});

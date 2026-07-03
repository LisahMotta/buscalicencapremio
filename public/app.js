/* ---- PDF.js worker ---- */
if (typeof pdfjsLib !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

/* ---- DOM ---- */
const secUpload      = document.getElementById('sec-upload');
const secLista       = document.getElementById('sec-lista');
const secResultados  = document.getElementById('sec-resultados');
const loadingSection = document.getElementById('loading-section');
const erroGlobal     = document.getElementById('erro-global');
const erroMsg        = document.getElementById('erro-msg');

const dropZone       = document.getElementById('drop-zone');
const fileInput      = document.getElementById('file-input');
const csvManual      = document.getElementById('csv-manual');
const btnParseManual = document.getElementById('btn-parse-manual');

const listaCount     = document.getElementById('lista-count');
const tabelaCorpo    = document.getElementById('tabela-corpo');
const btnAlterar     = document.getElementById('btn-alterar');
const btnBuscarLote  = document.getElementById('btn-buscar-lote');
const dataHojeTxt    = document.getElementById('data-hoje-txt');

const loadingText      = document.getElementById('loading-text');
const loadingSub       = document.getElementById('loading-sub');
const tituloResultados = document.getElementById('titulo-resultados');
const listaResultados  = document.getElementById('lista-resultados');
const resumoResultados = document.getElementById('resumo-resultados');
const btnNovaBusca     = document.getElementById('btn-nova-busca');

/* ---- Estado ---- */
let pessoas = [];

/* ---- Helpers ---- */
const mostrar  = (...els) => els.forEach(el => el && el.classList.remove('hidden'));
const esconder = (...els) => els.forEach(el => el && el.classList.add('hidden'));

function mostrarErro(msg) {
  erroMsg.textContent = msg;
  mostrar(erroGlobal);
}

function dataFormatada(d) {
  return d.toLocaleDateString('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ---- CSV Parser ---- */
function parseCSV(texto) {
  const linhas = texto.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  const resultado = [];
  for (const linha of linhas) {
    if (/^(nome|name)[,;]/i.test(linha)) continue;
    const partes = linha.split(/[,;]/).map(p => p.trim().replace(/^["']|["']$/g, ''));
    if (partes.length >= 2 && partes[0].length >= 3) {
      resultado.push({ nome: partes[0], documento: partes[1] || '' });
    } else if (partes.length === 1 && partes[0].length >= 3) {
      resultado.push({ nome: partes[0], documento: '' });
    }
  }
  return resultado;
}

/* ---- PDF Text Extractor (usa pdf.js no navegador) ---- */
async function extrairTextoPDF(arrayBuffer) {
  if (typeof pdfjsLib === 'undefined') throw new Error('PDF.js não carregado.');
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let texto = '';
  for (let p = 1; p <= pdf.numPages; p++) {
    const page    = await pdf.getPage(p);
    const content = await page.getTextContent();
    texto += content.items.map(i => i.str).join(' ') + '\n';
  }
  return texto;
}

/* ---- Extrai pessoas do texto do PDF ---- */
function extrairPessoasDoPDF(texto) {
  const linhas  = texto.split('\n').map(l => l.trim()).filter(l => l.length > 2);
  const reCPF   = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;
  const reRG    = /\b\d{1,2}\.?\d{3}\.?\d{3}-?\d{1}\b/g;
  const reNome  = /^[A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇÀÈÌÒÙÜ][a-záéíóúâêîôûãõàèìòùüça-z]+(?: [A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇÀÈÌÒÙÜ][a-záéíóúâêîôûãõàèìòùüça-z]+){1,6}$/;
  const resultado = [];

  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i];
    const cpfs  = [...(linha.match(reCPF) || [])];
    const rgs   = [...(linha.match(reRG)  || [])];
    const doc   = cpfs[0] || rgs[0] || '';

    if (doc) {
      let nomeLinha = linha
        .replace(reCPF, '').replace(reRG, '')
        .replace(/CPF:?|RG:?|Doc\.?:?|n[ºo]?:?/gi, '')
        .replace(/[\d\.\-\/\\()\[\]]/g, ' ')
        .replace(/\s+/g, ' ').trim();

      const palavras = nomeLinha.split(' ').filter(
        w => w.length >= 2 && /^[A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇÀÈÌÒÙÜa-záéíóúâêîôûãõàèìòùüç]+$/.test(w)
      );

      if (palavras.length >= 2) {
        resultado.push({ nome: palavras.join(' '), documento: doc });
      } else if (i > 0) {
        const prev = linhas[i - 1].replace(/[\d\.\-\/\\()\[\]]/g, ' ').replace(/\s+/g, ' ').trim();
        if (reNome.test(prev)) resultado.push({ nome: prev, documento: doc });
      }
    } else if (reNome.test(linha) && i + 1 < linhas.length) {
      const next  = linhas[i + 1];
      const cpfsN = [...(next.match(reCPF) || [])];
      const rgsN  = [...(next.match(reRG)  || [])];
      const docN  = cpfsN[0] || rgsN[0];
      if (docN) { resultado.push({ nome: linha, documento: docN }); i++; }
    }
  }

  const seen = new Set();
  return resultado.filter(p => {
    const k = `${p.nome}|${p.documento}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/* ---- Drop zone ---- */
dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') fileInput.click(); });
dropZone.addEventListener('dragover',  e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  if (e.dataTransfer.files[0]) processarArquivo(e.dataTransfer.files[0]);
});

fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) { processarArquivo(fileInput.files[0]); fileInput.value = ''; }
});

async function processarArquivo(file) {
  esconder(erroGlobal);
  if (file.size > 10 * 1024 * 1024) { mostrarErro('Arquivo muito grande. Máximo: 10 MB.'); return; }

  const isCSV = file.name.endsWith('.csv') || file.type.includes('csv') || file.type.includes('text/plain');
  const isPDF = file.name.endsWith('.pdf') || file.type === 'application/pdf';

  if (isCSV) {
    const texto = await file.text();
    const lista = parseCSV(texto);
    if (!lista.length) {
      mostrarErro('Nenhuma pessoa encontrada no CSV. Formato: Nome,Documento (uma por linha).');
    } else {
      carregarPessoas(lista);
    }
    return;
  }

  if (isPDF) {
    mostrar(loadingSection);
    loadingText.textContent = 'Lendo PDF…';
    loadingSub.textContent  = 'Isso pode levar alguns segundos.';
    try {
      const buf   = await file.arrayBuffer();
      const texto = await extrairTextoPDF(buf);
      const lista = extrairPessoasDoPDF(texto);
      if (!lista.length) {
        mostrarErro('Não foi possível extrair nomes do PDF automaticamente. Copie o conteúdo do PDF e cole na área de texto abaixo.');
      } else {
        carregarPessoas(lista);
      }
    } catch (err) {
      mostrarErro('Erro ao ler PDF: ' + err.message + '. Tente colar o conteúdo manualmente.');
    } finally {
      esconder(loadingSection);
    }
    return;
  }

  mostrarErro('Formato não suportado. Envie um arquivo .csv ou .pdf.');
}

/* ---- Input manual ---- */
btnParseManual.addEventListener('click', () => {
  esconder(erroGlobal);
  const texto = csvManual.value.trim();
  if (!texto) { mostrarErro('Cole a lista antes de carregar.'); return; }
  const lista = parseCSV(texto);
  if (!lista.length) {
    mostrarErro('Nenhuma pessoa encontrada. Formato: Nome,Documento (uma por linha).');
    return;
  }
  carregarPessoas(lista);
});

/* ---- Carregar pessoas ---- */
function carregarPessoas(lista) {
  pessoas = lista;
  salvarLocal(lista);
  esconder(secUpload, erroGlobal);
  renderTabela();
  dataHojeTxt.textContent = dataFormatada(new Date());
  mostrar(secLista);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderTabela() {
  tabelaCorpo.innerHTML = '';
  listaCount.textContent = `${pessoas.length} pessoa${pessoas.length !== 1 ? 's' : ''}`;

  pessoas.forEach((p, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="td-num">${i + 1}</td>
      <td class="td-nome">${escapeHtml(p.nome)}</td>
      <td class="td-doc">${escapeHtml(p.documento || '—')}</td>
      <td class="td-rem"><button class="btn-rem" data-i="${i}" title="Remover">✕</button></td>
    `;
    tabelaCorpo.appendChild(tr);
  });

  tabelaCorpo.querySelectorAll('.btn-rem').forEach(btn => {
    btn.addEventListener('click', () => {
      pessoas.splice(parseInt(btn.dataset.i), 1);
      salvarLocal(pessoas);
      renderTabela();
      if (!pessoas.length) { esconder(secLista); mostrar(secUpload); }
    });
  });
}

/* ---- Alterar lista ---- */
btnAlterar.addEventListener('click', () => {
  esconder(secLista, secResultados, erroGlobal);
  mostrar(secUpload);
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

/* ---- LocalStorage ---- */
function salvarLocal(lista) {
  try { localStorage.setItem('doe-lista', JSON.stringify(lista)); } catch {}
}
function carregarLocal() {
  try { const r = localStorage.getItem('doe-lista'); return r ? JSON.parse(r) : null; } catch { return null; }
}

/* ---- Busca em lote (uma pessoa por request, progressivo) ---- */
btnBuscarLote.addEventListener('click', async () => {
  if (!pessoas.length) return;

  esconder(erroGlobal);
  esconder(resumoResultados);
  listaResultados.innerHTML = '';
  tituloResultados.textContent = 'Consultando…';
  setLoadingBtn(true);
  mostrar(loadingSection, secResultados);

  let feitos = 0;
  let encontrados = 0;
  const total = pessoas.length;

  loadingText.textContent = 'Consultando Diário Oficial…';
  loadingSub.textContent  = `0 de ${total} pessoas consultadas`;

  for (const pessoa of pessoas) {
    try {
      const resp = await fetch('/api/buscar-doe', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ nome: pessoa.nome, documento: pessoa.documento }),
      });
      const data = await resp.json();
      if (resp.ok) {
        if (data.encontrado) encontrados++;
        listaResultados.appendChild(criarCartaoPessoa(data));
      } else {
        listaResultados.appendChild(criarCartaoPessoa({
          nome: pessoa.nome, documento: pessoa.documento,
          encontrado: false, publicacoes: [],
          links: gerarLinksFallback(pessoa.nome, pessoa.documento),
          erroMsg: data.erro || 'Erro na consulta',
        }));
      }
    } catch {
      listaResultados.appendChild(criarCartaoPessoa({
        nome: pessoa.nome, documento: pessoa.documento,
        encontrado: false, publicacoes: [],
        links: gerarLinksFallback(pessoa.nome, pessoa.documento),
        erroMsg: 'Sem conexão com o servidor',
      }));
    }

    feitos++;
    loadingSub.textContent = `${feitos} de ${total} pessoas consultadas`;
    tituloResultados.textContent =
      feitos < total
        ? `Buscando… ${feitos}/${total}`
        : `${encontrados} de ${total} com publicações encontradas`;
  }

  esconder(loadingSection);
  setLoadingBtn(false);
  resumoResultados.textContent =
    `✅ Busca concluída em ${dataFormatada(new Date())}: ` +
    `${encontrados} de ${total} pessoa${total !== 1 ? 's' : ''} com publicações nos Cadernos Executivos.`;
  mostrar(resumoResultados);
  window.scrollTo({ top: secResultados.offsetTop - 20, behavior: 'smooth' });
});

function setLoadingBtn(ativo) {
  const label = btnBuscarLote.querySelector('.btn-label');
  const load  = btnBuscarLote.querySelector('.btn-loading');
  btnBuscarLote.disabled = ativo;
  if (ativo) { label.classList.add('hidden'); load.classList.remove('hidden'); }
  else       { label.classList.remove('hidden'); load.classList.add('hidden'); }
}

function gerarLinksFallback(nome, documento) {
  const q   = documento ? `"${nome}" ${documento}` : `"${nome}"`;
  const enc = encodeURIComponent;
  return {
    doeExec1:         `https://www.doe.sp.gov.br/search?q=${enc(q)}&caderno=1`,
    doeExec2:         `https://www.doe.sp.gov.br/search?q=${enc(q)}&caderno=2`,
    doeBusca:         `https://www.doe.sp.gov.br/search?q=${enc(q)}`,
    imprensaOficial:  `https://www.imprensaoficial.com.br/DO/BuscaDO2001_11_2.aspx?pesquisa_campo=${enc(q)}&tipoPesquisa=todos&botaoPesquisar=Pesquisar`,
    google:           `https://www.google.com/search?q=${enc(`"${nome}" site:doe.sp.gov.br OR site:imprensaoficial.com.br`)}`,
  };
}

/* ---- Card de pessoa ---- */
function criarCartaoPessoa(r) {
  const div = document.createElement('div');
  const temErro = !!r.erroMsg;
  const classeStatus = r.encontrado ? 'status-ok' : temErro ? 'status-erro' : 'status-aviso';
  div.className = `result-card pessoa-card ${classeStatus}`;

  const pubsHtml = r.publicacoes && r.publicacoes.length
    ? r.publicacoes.map(p => `
        <div class="pub-item${p.aviso ? ' pub-aviso' : ''}">
          <div class="pub-meta">
            <span class="caderno-badge">${escapeHtml(p.caderno)}</span>
            ${p.data ? `<span class="pub-data">${escapeHtml(p.data)}</span>` : ''}
          </div>
          <p class="pub-titulo">${escapeHtml(p.titulo)}</p>
          ${p.trecho && !p.aviso ? `<p class="pub-trecho">${escapeHtml(p.trecho)}</p>` : ''}
          <a href="${escapeHtml(p.link)}" target="_blank" rel="noopener" class="btn-ver">Abrir publicação ↗</a>
        </div>
      `).join('')
    : `<p class="sem-pub">${temErro ? '⚠ ' + escapeHtml(r.erroMsg) : 'Nenhuma publicação encontrada hoje nos Cadernos Executivos I e II.'}</p>`;

  const L = r.links || gerarLinksFallback(r.nome, r.documento);
  const linksHtml = `
    <div class="links-manuais">
      <span class="links-label">Verificar manualmente:</span>
      <a href="${escapeHtml(L.doeExec1)}"        target="_blank" rel="noopener" class="chip chip-doe">DOE Exec. I</a>
      <a href="${escapeHtml(L.doeExec2)}"        target="_blank" rel="noopener" class="chip chip-doe">DOE Exec. II</a>
      <a href="${escapeHtml(L.imprensaOficial)}" target="_blank" rel="noopener" class="chip chip-io">Imprensa Oficial</a>
      <a href="${escapeHtml(L.google)}"          target="_blank" rel="noopener" class="chip chip-google">Google</a>
    </div>
  `;

  div.innerHTML = `
    <div class="rc-header">
      <div class="pessoa-info">
        <span class="pessoa-nome">${escapeHtml(r.nome)}</span>
        ${r.documento ? `<span class="pessoa-doc">${escapeHtml(r.documento)}</span>` : ''}
      </div>
      <span class="status-badge ${r.encontrado ? 'badge-ok' : temErro ? 'badge-erro' : 'badge-aviso'}">
        ${r.encontrado ? '✓ Encontrado' : temErro ? '⚠ Erro' : '— Não encontrado'}
      </span>
    </div>
    <div class="rc-body">${pubsHtml}</div>
    ${linksHtml}
  `;

  return div;
}

/* ---- Voltar à lista ---- */
btnNovaBusca.addEventListener('click', () => {
  esconder(secResultados, erroGlobal);
  mostrar(secLista);
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

/* ---- Init: restaura lista salva ---- */
(function init() {
  dataHojeTxt.textContent = dataFormatada(new Date());
  const salva = carregarLocal();
  if (salva && salva.length) {
    pessoas = salva;
    renderTabela();
    esconder(secUpload);
    mostrar(secLista);
  }
}());

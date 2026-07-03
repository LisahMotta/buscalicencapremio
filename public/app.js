if (typeof pdfjsLib !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

// --- DOM ---
const secUpload       = document.getElementById('sec-upload');
const secLista        = document.getElementById('sec-lista');
const secResultados   = document.getElementById('sec-resultados');
const loadingSection  = document.getElementById('loading-section');
const erroGlobal      = document.getElementById('erro-global');
const erroMsg         = document.getElementById('erro-msg');
const avisoDb         = document.getElementById('aviso-db');

const dropZone        = document.getElementById('drop-zone');
const fileInput       = document.getElementById('file-input');
const csvManual       = document.getElementById('csv-manual');
const btnParseManual  = document.getElementById('btn-parse-manual');

const listaCount      = document.getElementById('lista-count');
const tabelaCorpo     = document.getElementById('tabela-corpo');
const btnAlterar      = document.getElementById('btn-alterar');
const btnBuscarLote   = document.getElementById('btn-buscar-lote');
const dataHojeTxt     = document.getElementById('data-hoje-txt');
const loadingText     = document.getElementById('loading-text');
const loadingSub      = document.getElementById('loading-sub');
const tituloResultados = document.getElementById('titulo-resultados');
const listaResultados = document.getElementById('lista-resultados');
const resumoResultados = document.getElementById('resumo-resultados');
const btnNovaBusca    = document.getElementById('btn-nova-busca');

const viewBusca       = document.getElementById('view-busca');
const viewHistorico   = document.getElementById('view-historico');
const tabBtnBusca     = document.getElementById('tab-btn-busca');
const tabBtnHistorico = document.getElementById('tab-btn-historico');
const secHistLista    = document.getElementById('sec-hist-lista');
const secHistDetalhe  = document.getElementById('sec-hist-detalhe');
const histLoading     = document.getElementById('hist-loading');
const histDatas       = document.getElementById('hist-datas');
const histDetalheTitulo = document.getElementById('hist-detalhe-titulo');
const histDetalheResumo = document.getElementById('hist-detalhe-resumo');
const histDetalheLista  = document.getElementById('hist-detalhe-lista');
const btnVoltarHist   = document.getElementById('btn-voltar-hist');

// --- Estado ---
let pessoas = [];
let bdDisponivel = true;

// --- Helpers ---
const mostrar  = (...els) => els.forEach(el => el && el.classList.remove('hidden'));
const esconder = (...els) => els.forEach(el => el && el.classList.add('hidden'));

function mostrarErro(msg) { erroMsg.textContent = msg; mostrar(erroGlobal); }

function escapeHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function dataFormatada(d) {
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR',
    { weekday:'long', day:'2-digit', month:'long', year:'numeric' });
}

// --- CSV ---
function parseCSV(texto) {
  const resultado = [];
  for (const linha of texto.split(/\r?\n/)) {
    const l = linha.trim();
    if (!l || /^(nome|name)[,;]/i.test(l)) continue;
    const partes = l.split(/[,;]/).map(p => p.trim().replace(/^["']|["']$/g,''));
    if (partes.length >= 2 && partes[0].length >= 3)
      resultado.push({ nome: partes[0], documento: partes[1] || '' });
    else if (partes.length === 1 && partes[0].length >= 3)
      resultado.push({ nome: partes[0], documento: '' });
  }
  return resultado;
}

// --- PDF ---
async function extrairTextoPDF(buf) {
  if (typeof pdfjsLib === 'undefined') throw new Error('PDF.js não carregado.');
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  let texto = '';
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const ct = await page.getTextContent();
    texto += ct.items.map(i => i.str).join(' ') + '\n';
  }
  return texto;
}

function extrairPessoasDoPDF(texto) {
  const reCPF  = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;
  const reRG   = /\b\d{1,2}\.?\d{3}\.?\d{3}-?\d{1}\b/g;
  const reNome = /^[A-ZÀ-Ü][a-zà-ü]+(?: [A-ZÀ-Ü][a-zà-ü]+){1,6}$/;
  const resultado = [];
  const linhas = texto.split('\n').map(l=>l.trim()).filter(l=>l.length>2);

  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i];
    const cpfs = [...(linha.match(reCPF)||[])], rgs = [...(linha.match(reRG)||[])];
    const doc = cpfs[0] || rgs[0] || '';
    if (doc) {
      let nome = linha.replace(reCPF,'').replace(reRG,'')
        .replace(/CPF:?|RG:?|n[º°]?:?/gi,'')
        .replace(/[\d\.\-\/\\()\[\]]/g,' ').replace(/\s+/g,' ').trim();
      const palavras = nome.split(' ').filter(w => w.length>=2 && /^[A-Za-zÀ-ÿ]+$/.test(w));
      if (palavras.length >= 2) resultado.push({ nome: palavras.join(' '), documento: doc });
      else if (i>0 && reNome.test(linhas[i-1])) resultado.push({ nome: linhas[i-1], documento: doc });
    } else if (reNome.test(linha) && i+1 < linhas.length) {
      const next = linhas[i+1];
      const d = (next.match(reCPF)||[])[0] || (next.match(reRG)||[])[0];
      if (d) { resultado.push({ nome: linha, documento: d }); i++; }
    }
  }
  const seen = new Set();
  return resultado.filter(p => { const k=`${p.nome}|${p.documento}`; if(seen.has(k))return false; seen.add(k); return true; });
}

// --- Drop zone ---
dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('keydown', e => { if(e.key==='Enter'||e.key===' ') fileInput.click(); });
dropZone.addEventListener('dragover',  e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', e => {
  e.preventDefault(); dropZone.classList.remove('drag-over');
  if (e.dataTransfer.files[0]) processarArquivo(e.dataTransfer.files[0]);
});
fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) { processarArquivo(fileInput.files[0]); fileInput.value=''; }
});

async function processarArquivo(file) {
  esconder(erroGlobal);
  if (file.size > 10*1024*1024) { mostrarErro('Arquivo muito grande. Máx. 10 MB.'); return; }
  const isCSV = file.name.endsWith('.csv') || file.type.includes('csv') || file.type.includes('text/plain');
  const isPDF = file.name.endsWith('.pdf') || file.type==='application/pdf';
  if (isCSV) {
    const lista = parseCSV(await file.text());
    if (!lista.length) { mostrarErro('Nenhuma pessoa no CSV. Formato: Nome,Documento por linha.'); return; }
    carregarPessoas(lista); return;
  }
  if (isPDF) {
    mostrar(loadingSection); loadingText.textContent='Lendo PDF…'; loadingSub.textContent='Aguarde…';
    try {
      const lista = extrairPessoasDoPDF(await extrairTextoPDF(await file.arrayBuffer()));
      if (!lista.length) { mostrarErro('Não foi possível extrair nomes do PDF. Cole o conteúdo manualmente.'); }
      else carregarPessoas(lista);
    } catch(e) { mostrarErro('Erro ao ler PDF: '+e.message); }
    finally { esconder(loadingSection); }
    return;
  }
  mostrarErro('Formato não suportado. Envie CSV ou PDF.');
}

btnParseManual.addEventListener('click', () => {
  esconder(erroGlobal);
  const lista = parseCSV(csvManual.value.trim());
  if (!lista.length) { mostrarErro('Nenhuma pessoa encontrada. Formato: Nome,Documento por linha.'); return; }
  carregarPessoas(lista);
});

// --- Carregar pessoas ---
function carregarPessoas(lista) {
  pessoas = lista;
  salvarLocal(lista);
  apiSalvarLista(lista); // async, sem bloquear
  esconder(secUpload, erroGlobal);
  renderTabela();
  dataHojeTxt.textContent = dataFormatada(new Date().toISOString().split('T')[0]);
  mostrar(secLista);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderTabela() {
  tabelaCorpo.innerHTML = '';
  listaCount.textContent = `${pessoas.length} pessoa${pessoas.length!==1?'s':''}`;
  pessoas.forEach((p,i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="td-num">${i+1}</td><td class="td-nome">${escapeHtml(p.nome)}</td><td class="td-doc">${escapeHtml(p.documento||'—')}</td><td class="td-rem"><button class="btn-rem" data-i="${i}" title="Remover">✕</button></td>`;
    tabelaCorpo.appendChild(tr);
  });
  tabelaCorpo.querySelectorAll('.btn-rem').forEach(btn =>
    btn.addEventListener('click', () => {
      pessoas.splice(parseInt(btn.dataset.i),1);
      salvarLocal(pessoas); apiSalvarLista(pessoas);
      renderTabela();
      if (!pessoas.length) { esconder(secLista); mostrar(secUpload); }
    })
  );
}

btnAlterar.addEventListener('click', () => {
  esconder(secLista, secResultados, erroGlobal); mostrar(secUpload);
  window.scrollTo({ top:0, behavior:'smooth' });
});

// --- LocalStorage (fallback) ---
function salvarLocal(l) { try { localStorage.setItem('doe-lista',JSON.stringify(l)); } catch{} }
function carregarLocal() { try { const r=localStorage.getItem('doe-lista'); return r?JSON.parse(r):null; } catch{ return null; } }

// --- API calls ---
async function apiSalvarLista(lista) {
  try {
    const r = await fetch('/api/lista',{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({lista}) });
    const d = await r.json();
    if (d.erro === 'BD_NAO_CONFIGURADO') { bdDisponivel=false; mostrar(avisoDb); }
  } catch{}
}

async function apiSalvarResultado(resultados) {
  try {
    const r = await fetch('/api/salvar-resultado',{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({resultados}) });
    const d = await r.json();
    if (d.erro === 'BD_NAO_CONFIGURADO') { bdDisponivel=false; mostrar(avisoDb); }
  } catch{}
}

async function apiGetHistorico() {
  const r = await fetch('/api/historico');
  return r.json();
}

async function apiGetResultadoData(data) {
  const r = await fetch(`/api/historico?data=${data}`);
  if (!r.ok) throw new Error('Busca não encontrada.');
  return r.json();
}

// --- Tab navigation ---
tabBtnBusca.addEventListener('click', () => {
  mostrar(viewBusca); esconder(viewHistorico);
  tabBtnBusca.classList.add('tab-ativo');
  tabBtnHistorico.classList.remove('tab-ativo');
});

tabBtnHistorico.addEventListener('click', async () => {
  esconder(viewBusca); mostrar(viewHistorico);
  tabBtnHistorico.classList.add('tab-ativo');
  tabBtnBusca.classList.remove('tab-ativo');
  await carregarHistorico();
});

// --- Busca em lote ---
btnBuscarLote.addEventListener('click', async () => {
  if (!pessoas.length) return;
  esconder(erroGlobal, secResultados); esconder(resumoResultados);
  listaResultados.innerHTML = '';
  tituloResultados.textContent = 'Consultando…';
  setLoadingBtn(true); mostrar(loadingSection, secResultados);

  let feitos=0, encontrados=0;
  const total = pessoas.length;
  loadingText.textContent = 'Consultando Diário Oficial…';
  loadingSub.textContent = `0 de ${total}`;

  const todosResultados = [];

  for (const p of pessoas) {
    let resultado;
    try {
      const resp = await fetch('/api/buscar-doe',{
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ nome:p.nome, documento:p.documento })
      });
      resultado = await resp.json();
      if (!resp.ok) resultado = { nome:p.nome, documento:p.documento, encontrado:false, publicacoes:[], links:linksDefault(p.nome,p.documento), erroMsg:resultado.erro||'Erro' };
      else if (resultado.encontrado) encontrados++;
    } catch {
      resultado = { nome:p.nome, documento:p.documento, encontrado:false, publicacoes:[], links:linksDefault(p.nome,p.documento), erroMsg:'Sem conexão' };
    }
    todosResultados.push(resultado);
    listaResultados.appendChild(criarCartaoPessoa(resultado));
    feitos++;
    loadingSub.textContent = `${feitos} de ${total}`;
    tituloResultados.textContent = feitos<total ? `Buscando… ${feitos}/${total}` : `${encontrados} de ${total} com publicações encontradas`;
  }

  esconder(loadingSection); setLoadingBtn(false);
  resumoResultados.textContent = `✅ ${dataFormatada(new Date().toISOString().split('T')[0])}: ${encontrados} de ${total} pessoa${total!==1?'s':''} com publicações no DOE.`;
  mostrar(resumoResultados);
  apiSalvarResultado(todosResultados);
  window.scrollTo({ top: secResultados.offsetTop-20, behavior:'smooth' });
});

function setLoadingBtn(ativo) {
  const label=btnBuscarLote.querySelector('.btn-label'), load=btnBuscarLote.querySelector('.btn-loading');
  btnBuscarLote.disabled=ativo;
  if(ativo){label.classList.add('hidden');load.classList.remove('hidden');}
  else{label.classList.remove('hidden');load.classList.add('hidden');}
}

function linksDefault(nome,doc) {
  const q=doc?`"${nome}" ${doc}`:`"${nome}"`, e=encodeURIComponent;
  return {
    doeExec1: `https://www.doe.sp.gov.br/search?q=${e(q)}&caderno=1`,
    doeExec2: `https://www.doe.sp.gov.br/search?q=${e(q)}&caderno=2`,
    imprensaOficial: `https://www.imprensaoficial.com.br/DO/BuscaDO2001_11_2.aspx?pesquisa_campo=${e(q)}&tipoPesquisa=todos&botaoPesquisar=Pesquisar`,
    google: `https://www.google.com/search?q=${e(`"${nome}" site:doe.sp.gov.br OR site:imprensaoficial.com.br`)}`,
  };
}

// --- Cartao pessoa ---
function criarCartaoPessoa(r) {
  const div = document.createElement('div');
  const temErro = !!r.erroMsg;
  div.className = `result-card pessoa-card ${r.encontrado?'status-ok':temErro?'status-erro':'status-aviso'}`;
  const L = r.links || linksDefault(r.nome, r.documento);
  const pubsHtml = r.publicacoes && r.publicacoes.length
    ? r.publicacoes.map(p=>`
      <div class="pub-item${p.aviso?' pub-aviso':''}"> 
        <div class="pub-meta"><span class="caderno-badge">${escapeHtml(p.caderno)}</span>${p.data?`<span class="pub-data">${escapeHtml(p.data)}</span>`:''}</div>
        <p class="pub-titulo">${escapeHtml(p.titulo)}</p>
        ${p.trecho&&!p.aviso?`<p class="pub-trecho">${escapeHtml(p.trecho)}</p>`:''}
        <a href="${escapeHtml(p.link)}" target="_blank" rel="noopener" class="btn-ver">Abrir publicação ↗</a>
      </div>`).join('')
    : `<p class="sem-pub">${temErro?'⚠ '+escapeHtml(r.erroMsg):'Nenhuma publicação hoje nos Cadernos Executivos I e II.'}</p>`;
  div.innerHTML = `
    <div class="rc-header">
      <div class="pessoa-info">
        <span class="pessoa-nome">${escapeHtml(r.nome)}</span>
        ${r.documento?`<span class="pessoa-doc">${escapeHtml(r.documento)}</span>`:''}
      </div>
      <span class="status-badge ${r.encontrado?'badge-ok':temErro?'badge-erro':'badge-aviso'}">
        ${r.encontrado?'✓ Encontrado':temErro?'⚠ Erro':'— Não encontrado'}
      </span>
    </div>
    <div class="rc-body">${pubsHtml}</div>
    <div class="links-manuais">
      <span class="links-label">Verificar:</span>
      <a href="${escapeHtml(L.doeExec1)}" target="_blank" rel="noopener" class="chip chip-doe">DOE Exec. I</a>
      <a href="${escapeHtml(L.doeExec2)}" target="_blank" rel="noopener" class="chip chip-doe">DOE Exec. II</a>
      <a href="${escapeHtml(L.imprensaOficial)}" target="_blank" rel="noopener" class="chip chip-io">Imprensa Oficial</a>
      <a href="${escapeHtml(L.google)}" target="_blank" rel="noopener" class="chip chip-google">Google</a>
    </div>`;
  return div;
}

btnNovaBusca.addEventListener('click', () => {
  esconder(secResultados,erroGlobal); mostrar(secLista);
  window.scrollTo({top:0,behavior:'smooth'});
});

// --- Histórico ---
async function carregarHistorico() {
  histDatas.innerHTML = '';
  esconder(secHistDetalhe); mostrar(secHistLista, histLoading);
  try {
    const data = await apiGetHistorico();
    esconder(histLoading);
    if (data.erro === 'BD_NAO_CONFIGURADO') {
      mostrar(avisoDb);
      histDatas.innerHTML = '<p class="hist-vazio">Configure o Vercel KV para acessar o histórico de buscas.</p>';
      return;
    }
    if (!data.datas || data.datas.length === 0) {
      histDatas.innerHTML = '<p class="hist-vazio">Nenhuma busca registrada ainda. Execute a primeira busca na aba “Busca”.</p>';
      return;
    }
    data.datas.forEach(item => {
      const card = document.createElement('div');
      card.className = 'hist-card';
      card.innerHTML = `
        <div class="hist-data">${dataFormatada(item.data)}</div>
        <div class="hist-stats">
          <span class="hist-stat">${item.totalPessoas} pessoas consultadas</span>
          <span class="hist-stat ${item.encontrados>0?'stat-ok':'stat-nenhum'}">${item.encontrados} com publicações</span>
        </div>
        <button class="btn-secondary hist-btn-ver" data-data="${item.data}">Ver resultados</button>`;
      card.querySelector('.hist-btn-ver').addEventListener('click', () => verDetalheHistorico(item.data));
      histDatas.appendChild(card);
    });
  } catch(e) {
    esconder(histLoading);
    histDatas.innerHTML = `<p class="hist-vazio">Erro ao carregar histórico: ${escapeHtml(e.message)}</p>`;
  }
}

async function verDetalheHistorico(data) {
  esconder(secHistLista); mostrar(secHistDetalhe);
  histDetalheLista.innerHTML = '<p class="loading-text">Carregando…</p>';
  histDetalheTitulo.textContent = 'Busca de ' + dataFormatada(data);
  try {
    const resultado = await apiGetResultadoData(data);
    histDetalheResumo.textContent = `${resultado.encontrados} de ${resultado.totalPessoas} com publicações encontradas`;
    mostrar(histDetalheResumo);
    histDetalheLista.innerHTML = '';
    resultado.resultados.forEach(r => histDetalheLista.appendChild(criarCartaoPessoa(r)));
  } catch(e) {
    histDetalheLista.innerHTML = `<p class="hist-vazio">${escapeHtml(e.message)}</p>`;
  }
}

btnVoltarHist.addEventListener('click', () => {
  esconder(secHistDetalhe, histDetalheResumo); mostrar(secHistLista);
});

// --- Init ---
(async function init() {
  dataHojeTxt.textContent = dataFormatada(new Date().toISOString().split('T')[0]);
  try {
    const resp = await fetch('/api/lista');
    const data = await resp.json();
    if (data.erro === 'BD_NAO_CONFIGURADO') { bdDisponivel=false; mostrar(avisoDb); throw new Error('sem kv'); }
    if (data.lista && data.lista.length) {
      pessoas = data.lista;
      salvarLocal(pessoas);
      renderTabela(); esconder(secUpload); mostrar(secLista); return;
    }
  } catch(_) {}
  // Fallback localStorage
  const salva = carregarLocal();
  if (salva && salva.length) { pessoas=salva; renderTabela(); esconder(secUpload); mostrar(secLista); }
}());

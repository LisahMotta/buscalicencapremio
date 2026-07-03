const axios = require('axios');
const cheerio = require('cheerio');

const TIMEOUT = 7000;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function gerarLinks(nome, documento) {
  const q = documento ? `"${nome}" ${documento}` : `"${nome}"`;
  const enc = encodeURIComponent;
  return {
    doeExec1: `https://www.doe.sp.gov.br/search?q=${enc(q)}&caderno=1`,
    doeExec2: `https://www.doe.sp.gov.br/search?q=${enc(q)}&caderno=2`,
    doeBusca: `https://www.doe.sp.gov.br/search?q=${enc(q)}`,
    imprensaOficial: `https://www.imprensaoficial.com.br/DO/BuscaDO2001_11_2.aspx?pesquisa_campo=${enc(q)}&tipoPesquisa=todos&botaoPesquisar=Pesquisar`,
    google: `https://www.google.com/search?q=${enc(`"${nome}" site:doe.sp.gov.br OR site:imprensaoficial.com.br`)}`,
  };
}

async function buscaCaderno(termo, caderno) {
  const publicacoes = [];
  try {
    const resp = await axios.get('https://www.doe.sp.gov.br/search', {
      params: { q: termo, caderno },
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
      },
      timeout: TIMEOUT,
    });

    const $ = cheerio.load(resp.data);
    const nomeCaderno = caderno === 1 ? 'Executivo I' : 'Executivo II';

    const SELS = [
      '.search-result-item', '.resultado-busca', '.materia-resultado',
      'article.resultado', '.item-publicacao', 'li.resultado',
      '.doe-resultado', '.edicao-item',
    ];

    let itens = $();
    for (const s of SELS) {
      const found = $(s);
      if (found.length > 0) { itens = found; break; }
    }

    itens.each((_, el) => {
      const titulo = $(el).find('h2,h3,.titulo,strong').first().text().trim();
      const trecho = $(el).find('p,.resumo,.excerpt').first().text().trim();
      const data   = $(el).find('.data,time,.date,.edicao-data').first().text().trim();
      let href     = $(el).find('a').attr('href') || '';
      if (href && !href.startsWith('http')) href = `https://www.doe.sp.gov.br${href}`;

      if (titulo || trecho) {
        publicacoes.push({
          caderno: nomeCaderno,
          data,
          titulo: titulo || 'Publicação encontrada',
          trecho: trecho.substring(0, 350),
          link: href || `https://www.doe.sp.gov.br/search?q=${encodeURIComponent(termo)}&caderno=${caderno}`,
          aviso: false,
        });
      }
    });

    if (itens.length === 0) {
      const bodyTxt = $('body').text().toLowerCase();
      const base = termo.replace(/"/g, '').toLowerCase().split(' ')[0];
      if (base.length > 3 && bodyTxt.includes(base)) {
        publicacoes.push({
          caderno: nomeCaderno,
          data: '',
          titulo: `Possível menção no Caderno ${nomeCaderno}`,
          trecho: 'Verificação manual recomendada no link abaixo.',
          link: `https://www.doe.sp.gov.br/search?q=${encodeURIComponent(termo)}&caderno=${caderno}`,
          aviso: true,
        });
      }
    }
  } catch (_) {}

  return publicacoes;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido.' });

  const { nome, documento } = req.body || {};
  if (!nome || String(nome).trim().length < 3) {
    return res.status(400).json({ erro: 'Nome inválido (mínimo 3 caracteres).' });
  }

  const n = String(nome).trim();
  const d = documento ? String(documento).trim() : '';
  const termo = d ? `"${n}" ${d}` : `"${n}"`;

  try {
    const [r1, r2] = await Promise.allSettled([
      buscaCaderno(termo, 1),
      buscaCaderno(termo, 2),
    ]);

    const publicacoes = [
      ...(r1.status === 'fulfilled' ? r1.value : []),
      ...(r2.status === 'fulfilled' ? r2.value : []),
    ];

    return res.json({
      nome: n,
      documento: d,
      encontrado: publicacoes.some(p => !p.aviso),
      publicacoes,
      links: gerarLinks(n, d),
    });
  } catch (err) {
    return res.status(500).json({ erro: 'Erro interno ao buscar.' });
  }
};

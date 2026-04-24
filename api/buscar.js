const axios = require('axios');
const cheerio = require('cheerio');

const HTTP_TIMEOUT = 15000;
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
};

async function buscaImprensaOficial(nome, rg) {
  const resultados = [];
  const termoBusca = rg ? `"${nome}" ${rg}` : `"${nome}"`;

  try {
    const url = 'https://www.imprensaoficial.com.br/DO/BuscaDO2001_11_02.aspx';
    const params = new URLSearchParams({
      pesquisa_campo: termoBusca,
      tipoPesquisa: 'todos',
      botaoPesquisar: 'Pesquisar',
    });

    const response = await axios.get(`${url}?${params}`, {
      headers: HEADERS,
      timeout: HTTP_TIMEOUT,
    });

    const $ = cheerio.load(response.data);

    $('.resultado-item, .search-result, tr.resultItem, .item-resultado').each((i, el) => {
      const texto = $(el).text().trim();
      const link = $(el).find('a').attr('href') || '';
      const data = $(el).find('.data, .date, td:first-child').text().trim();

      if (texto) {
        resultados.push({
          fonte: 'Imprensa Oficial',
          data: data || 'Data não disponível',
          trecho: texto.substring(0, 300),
          link: link.startsWith('http') ? link : `https://www.imprensaoficial.com.br${link}`,
        });
      }
    });

    if (resultados.length === 0) {
      const encontrou = $('body').text().toLowerCase().includes(nome.toLowerCase());
      resultados.push({
        fonte: 'Imprensa Oficial',
        data: '',
        trecho: encontrou
          ? `Possíveis resultados encontrados para "${nome}". Acesse o site para ver detalhes.`
          : `Nenhum resultado encontrado para "${nome}"${rg ? ` / RG ${rg}` : ''}.`,
        link: `https://www.imprensaoficial.com.br/DO/BuscaDO2001_11_02.aspx?pesquisa_campo=${encodeURIComponent(termoBusca)}`,
        aviso: true,
      });
    }
  } catch (err) {
    resultados.push({
      fonte: 'Imprensa Oficial',
      data: '',
      trecho: `Erro ao acessar Imprensa Oficial: ${err.message}`,
      link: `https://www.imprensaoficial.com.br/DO/BuscaDO2001_11_02.aspx?pesquisa_campo=${encodeURIComponent(termoBusca)}`,
      erro: true,
    });
  }

  return resultados;
}

async function buscaDOE(nome, rg) {
  const resultados = [];
  const termoBusca = rg ? `"${nome}" ${rg}` : `"${nome}"`;

  try {
    const url = 'https://www.doe.sp.gov.br/search';
    const response = await axios.get(url, {
      params: { q: termoBusca },
      headers: HEADERS,
      timeout: HTTP_TIMEOUT,
    });

    const $ = cheerio.load(response.data);

    $('.search-result-item, .resultado, article, .doe-item, .materia').each((i, el) => {
      const titulo = $(el).find('h2, h3, .titulo, .title').text().trim();
      const trecho = $(el).find('p, .resumo, .excerpt, .snippet').text().trim();
      const data = $(el).find('.data, .date, time').text().trim();
      const link = $(el).find('a').attr('href') || '';

      if (titulo || trecho) {
        resultados.push({
          fonte: 'DOE SP',
          data: data || 'Data não disponível',
          trecho: (titulo ? `${titulo}\n` : '') + trecho.substring(0, 300),
          link: link.startsWith('http') ? link : `https://www.doe.sp.gov.br${link}`,
        });
      }
    });

    if (resultados.length === 0) {
      resultados.push({
        fonte: 'DOE SP',
        data: '',
        trecho: `Nenhum resultado estruturado encontrado. Verifique diretamente no site.`,
        link: `https://www.doe.sp.gov.br/search?q=${encodeURIComponent(termoBusca)}`,
        aviso: true,
      });
    }
  } catch (err) {
    resultados.push({
      fonte: 'DOE SP',
      data: '',
      trecho: `Erro ao acessar DOE SP: ${err.message}`,
      link: `https://www.doe.sp.gov.br/search?q=${encodeURIComponent(termoBusca)}`,
      erro: true,
    });
  }

  return resultados;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ erro: 'Método não permitido.' });
  }

  const { nome, rg } = req.body || {};

  if (!nome || nome.trim().length < 3) {
    return res.status(400).json({ erro: 'Informe o nome completo (mínimo 3 caracteres).' });
  }

  const nomeLimpo = nome.trim();
  const rgLimpo = rg ? rg.trim().replace(/\D/g, '') : '';

  try {
    const [resImprensa, resDOE] = await Promise.allSettled([
      buscaImprensaOficial(nomeLimpo, rgLimpo),
      buscaDOE(nomeLimpo, rgLimpo),
    ]);

    const resultados = [
      ...(resImprensa.status === 'fulfilled' ? resImprensa.value : []),
      ...(resDOE.status === 'fulfilled' ? resDOE.value : []),
    ];

    res.json({ resultados, total: resultados.filter(r => !r.aviso && !r.erro).length });
  } catch (err) {
    res.status(500).json({ erro: 'Erro interno ao processar a busca.' });
  }
};

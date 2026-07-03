const { list } = require('@vercel/blob');

const INDICE_PATH = 'doe-busca/indice.json';

async function lerJSON(path) {
  try {
    const { blobs } = await list({ prefix: path, limit: 1 });
    if (!blobs.length) return null;
    const resp = await fetch(blobs[0].url + '?t=' + Date.now());
    return resp.ok ? resp.json() : null;
  } catch { return null; }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ erro: 'Método não permitido.' });

  try {
    const { data } = req.query || {};

    if (data) {
      const resultado = await lerJSON(`doe-busca/resultado-${data}.json`);
      if (!resultado) return res.status(404).json({ erro: 'Busca não encontrada para esta data.' });
      return res.json(resultado);
    }

    const indice = (await lerJSON(INDICE_PATH)) || [];
    return res.json({ datas: indice });
  } catch (err) {
    if (err.message && err.message.includes('BLOB_READ_WRITE_TOKEN'))
      return res.status(503).json({ erro: 'BD_NAO_CONFIGURADO' });
    return res.status(500).json({ erro: 'Erro ao buscar histórico: ' + err.message });
  }
};

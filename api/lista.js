const { put, list, del } = require('@vercel/blob');

const PATH = 'doe-busca/lista-pessoas.json';

async function lerJSON(path) {
  try {
    const { blobs } = await list({ prefix: path, limit: 1 });
    if (!blobs.length) return null;
    const resp = await fetch(blobs[0].url + '?t=' + Date.now());
    return resp.ok ? resp.json() : null;
  } catch { return null; }
}

async function gravarJSON(path, dados) {
  const { blobs } = await list({ prefix: path, limit: 10 });
  if (blobs.length) await del(blobs.map(b => b.url));
  await put(path, JSON.stringify(dados), {
    access: 'public',
    addRandomSuffix: false,
    contentType: 'application/json',
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      const lista = (await lerJSON(PATH)) || [];
      return res.json({ lista });
    }

    if (req.method === 'POST') {
      const { lista } = req.body || {};
      if (!Array.isArray(lista) || !lista.length)
        return res.status(400).json({ erro: 'Lista inválida.' });
      if (lista.length > 500)
        return res.status(400).json({ erro: 'Máximo de 500 pessoas.' });
      const valida = lista.filter(p => p && typeof p.nome === 'string' && p.nome.trim().length >= 3);
      await gravarJSON(PATH, valida);
      return res.json({ ok: true, total: valida.length });
    }

    if (req.method === 'DELETE') {
      const { blobs } = await list({ prefix: PATH });
      if (blobs.length) await del(blobs.map(b => b.url));
      return res.json({ ok: true });
    }

    return res.status(405).json({ erro: 'Método não permitido.' });
  } catch (err) {
    if (err.message && err.message.includes('BLOB_READ_WRITE_TOKEN'))
      return res.status(503).json({ erro: 'BD_NAO_CONFIGURADO' });
    return res.status(500).json({ erro: 'Erro no banco: ' + err.message });
  }
};

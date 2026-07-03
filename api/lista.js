const { kv } = require('@vercel/kv');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      const lista = (await kv.get('lista-pessoas')) || [];
      return res.json({ lista });
    }

    if (req.method === 'POST') {
      const { lista } = req.body || {};
      if (!Array.isArray(lista) || lista.length === 0)
        return res.status(400).json({ erro: 'Lista inválida.' });
      if (lista.length > 500)
        return res.status(400).json({ erro: 'Máximo de 500 pessoas.' });
      const valida = lista.filter(p => p && typeof p.nome === 'string' && p.nome.trim().length >= 3);
      await kv.set('lista-pessoas', valida);
      return res.json({ ok: true, total: valida.length });
    }

    if (req.method === 'DELETE') {
      await kv.del('lista-pessoas');
      return res.json({ ok: true });
    }

    return res.status(405).json({ erro: 'Método não permitido.' });
  } catch (err) {
    const semKV = err.message && (err.message.includes('KV_URL') || err.message.includes('KV_REST_API'));
    if (semKV) return res.status(503).json({ erro: 'BD_NAO_CONFIGURADO' });
    return res.status(500).json({ erro: 'Erro no banco de dados.' });
  }
};

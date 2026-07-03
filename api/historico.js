const { kv } = require('@vercel/kv');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ erro: 'Método não permitido.' });

  try {
    const { data } = req.query || {};

    if (data) {
      const resultado = await kv.get(`resultado:${data}`);
      if (!resultado) return res.status(404).json({ erro: 'Nenhuma busca encontrada para esta data.' });
      return res.json(resultado);
    }

    const datas = (await kv.get('datas-busca')) || [];
    const resumos = await Promise.all(
      datas.slice(0, 30).map(async d => {
        const r = await kv.get(`resultado:${d}`);
        if (!r) return null;
        return { data: d, totalPessoas: r.totalPessoas, encontrados: r.encontrados, timestamp: r.timestamp };
      })
    );
    return res.json({ datas: resumos.filter(Boolean) });
  } catch (err) {
    const semKV = err.message && (err.message.includes('KV_URL') || err.message.includes('KV_REST_API'));
    if (semKV) return res.status(503).json({ erro: 'BD_NAO_CONFIGURADO' });
    return res.status(500).json({ erro: 'Erro ao buscar histórico.' });
  }
};

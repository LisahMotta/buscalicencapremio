const { kv } = require('@vercel/kv');

function dataBrasil() {
  // UTC-3 (Brasil)
  return new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().split('T')[0];
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido.' });

  const { resultados } = req.body || {};
  if (!Array.isArray(resultados) || resultados.length === 0)
    return res.status(400).json({ erro: 'Resultados inválidos.' });

  try {
    const dataKey = dataBrasil();
    const registro = {
      data: dataKey,
      totalPessoas: resultados.length,
      encontrados: resultados.filter(r => r.encontrado).length,
      resultados: resultados.map(r => ({
        nome: r.nome,
        documento: r.documento || '',
        encontrado: !!r.encontrado,
        publicacoes: r.publicacoes || [],
        links: r.links || {},
      })),
      timestamp: new Date().toISOString(),
    };

    await kv.set(`resultado:${dataKey}`, registro);
    await kv.expire(`resultado:${dataKey}`, 60 * 60 * 24 * 180); // 180 dias

    let datas = (await kv.get('datas-busca')) || [];
    datas = datas.filter(d => d !== dataKey);
    datas.unshift(dataKey);
    if (datas.length > 180) datas = datas.slice(0, 180);
    await kv.set('datas-busca', datas);

    return res.json({ ok: true, data: dataKey });
  } catch (err) {
    const semKV = err.message && (err.message.includes('KV_URL') || err.message.includes('KV_REST_API'));
    if (semKV) return res.status(503).json({ erro: 'BD_NAO_CONFIGURADO' });
    return res.status(500).json({ erro: 'Erro ao salvar resultados.' });
  }
};

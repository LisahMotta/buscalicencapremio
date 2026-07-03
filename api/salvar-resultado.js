const { put, list, del } = require('@vercel/blob');

function dataBrasil() {
  return new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().split('T')[0];
}

const INDICE_PATH = 'doe-busca/indice.json';

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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido.' });

  const { resultados } = req.body || {};
  if (!Array.isArray(resultados) || !resultados.length)
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

    // Salva resultado do dia
    await gravarJSON(`doe-busca/resultado-${dataKey}.json`, registro);

    // Atualiza índice
    const indice = (await lerJSON(INDICE_PATH)) || [];
    const semHoje = indice.filter(item => item.data !== dataKey);
    semHoje.unshift({
      data: dataKey,
      totalPessoas: registro.totalPessoas,
      encontrados: registro.encontrados,
      timestamp: registro.timestamp,
    });
    const indiceAtualizado = semHoje.slice(0, 180);
    await gravarJSON(INDICE_PATH, indiceAtualizado);

    return res.json({ ok: true, data: dataKey });
  } catch (err) {
    if (err.message && err.message.includes('BLOB_READ_WRITE_TOKEN'))
      return res.status(503).json({ erro: 'BD_NAO_CONFIGURADO' });
    return res.status(500).json({ erro: 'Erro ao salvar: ' + err.message });
  }
};

const express = require('express');
const path = require('path');

// Importa o handler da serverless function
const buscarHandler = require('./api/buscar');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Rota da API usando o mesmo handler da Vercel
app.post('/api/buscar', (req, res) => buscarHandler(req, res));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Local: http://localhost:${PORT}`));

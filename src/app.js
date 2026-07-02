require('dotenv').config();
const path = require('path');
const express = require('express');
const routes = require('./routes');

const app = express();

app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.json({ limit: '50mb' }));

// Servir arquivos estáticos do frontend (HTML/CSS/JS)
app.use(express.static(path.join(__dirname, 'public')));

// Rotas da API
app.use(routes);

// Middleware para tratamento global de rotas inexistentes na API
app.use((req, res) => {
  return res.status(404).json({ error: 'Endpoint ou recurso não encontrado.' });
});

const port = Number(process.env.PORT || 3001);

app.listen(port, () => {
  console.log(`Sistema de Provedores ASN rodando em http://localhost:${port}`);
});

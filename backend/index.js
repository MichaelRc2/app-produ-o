const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const db = require('./database');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../uploads'));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + file.originalname;
        cb(null, uniqueSuffix);
    }
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Apenas arquivos PDF são permitidos'), false);
        }
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.get('/api/status', (req, res) => {
    res.json({
        status: '✅ Backend ativo',
        message: 'BASE 1 - Estrutura inicial pronta',
        timestamp: new Date().toISOString()
    });
});

app.get('/api/projetos', (req, res) => {
    db.all('SELECT * FROM projetos ORDER BY data_criacao DESC', (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json(rows);
        }
    });
});

app.post('/api/projetos', upload.single('arquivo'), (req, res) => {
    const { nome } = req.body;
    if (!nome) {
        return res.status(400).json({ error: 'Nome é obrigatório' });
    }
    const arquivo_pdf = req.file ? req.file.filename : null;
    db.run(
        'INSERT INTO projetos (nome, arquivo_pdf, etapa_atual) VALUES (?, ?, ?)',
        [nome, arquivo_pdf, 'projetos'],
        function (err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json({
                id: this.lastID,
                nome,
                arquivo_pdf,
                etapa_atual: 'projetos'
            });
        }
    );
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
    console.log(`📌 BASE 1 - Backend funcionando`);
});
const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const db = require('./database');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
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

app.post('/api/projetos', upload.array('arquivo'), (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'Nenhum arquivo PDF enviado' });
    }

    const resultados = [];
    let pendentes = req.files.length;
    let erros = [];

    req.files.forEach((file) => {
        const nome = req.body.nome || file.originalname.replace(/\.pdf$/i, '');
        const arquivo_pdf = file.filename;

        db.run(
            'INSERT INTO projetos (nome, arquivo_pdf, etapa_atual) VALUES (?, ?, ?)',
            [nome, arquivo_pdf, 'Projetos'],
            function (err) {
                if (err) {
                    erros.push(err.message);
                } else {
                    resultados.push({
                        id: this.lastID,
                        nome,
                        arquivo_pdf,
                        etapa_atual: 'Projetos'
                    });
                    io.emit('projeto:criado', {
                        id: this.lastID,
                        nome,
                        arquivo_pdf,
                        etapa_atual: 'Projetos'
                    });
                }
                pendentes--;
                if (pendentes === 0) {
                    if (erros.length > 0) {
                        return res.status(500).json({ error: 'Alguns projetos falharam: ' + erros.join(', '), resultados });
                    }
                    res.json({ resultados, total: resultados.length });
                }
            }
        );
    });
});

const ETAPAS_PERMITIDAS = [
    'Projetos', 'Corte', 'Lapidação', 'Furação',
    'Têmpera', 'Pintura', 'Prontos para instalar'
];

app.put('/api/projetos/:id', (req, res) => {
    console.log('PUT /api/projetos/:id -> motivo:', req.body.motivo, '| observacao:', req.body.observacao, '| etapa_atual:', req.body.etapa_atual);
    const { id } = req.params;
    const { etapa_atual, motivo, observacao } = req.body;

    if (!etapa_atual || !ETAPAS_PERMITIDAS.includes(etapa_atual)) {
        return res.status(400).json({
            error: 'Etapa inválida. Etapas permitidas: ' + ETAPAS_PERMITIDAS.join(', ')
        });
    }

    db.get('SELECT etapa_atual FROM projetos WHERE id = ?', [id], (err, row) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (!row) {
            return res.status(404).json({ error: 'Projeto não encontrado' });
        }

        const etapa_anterior = row.etapa_atual;

        if (etapa_anterior === etapa_atual) {
            return res.json({
                id: parseInt(id),
                etapa_atual,
                atualizado: false,
                mensagem: 'Projeto já está nesta etapa. Nenhuma movimentação registrada.'
            });
        }

        db.run(
            'UPDATE projetos SET etapa_atual = ?, data_atualizacao = CURRENT_TIMESTAMP WHERE id = ?',
            [etapa_atual, id],
            function (err) {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }

                db.run(
                    'INSERT INTO historico_movimentacoes (projeto_id, etapa_anterior, etapa_nova, motivo, observacao) VALUES (?, ?, ?, ?, ?)',
                    [id, etapa_anterior, etapa_atual, motivo || null, observacao || null],
                    (errHist) => {
                        if (errHist) {
                            console.error('Erro ao registrar histórico:', errHist.message);
                        }
                    }
                );

                res.json({
                    id: parseInt(id),
                    etapa_atual,
                    atualizado: true
                });
                io.emit('projeto:atualizado', {
                    id: parseInt(id),
                    etapa_atual
                });
            }
        );
    });
});

const fs = require('fs');

app.get('/api/projetos/:id/historico', (req, res) => {
    const { id } = req.params;
    db.all('SELECT id, projeto_id, etapa_anterior, etapa_nova, motivo, observacao, data_movimentacao FROM historico_movimentacoes WHERE projeto_id = ? ORDER BY data_movimentacao DESC', [id], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

app.delete('/api/projetos/:id', (req, res) => {
    const { id } = req.params;

    db.get('SELECT * FROM projetos WHERE id = ?', [id], (err, projeto) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (!projeto) {
            return res.status(404).json({ error: 'Projeto não encontrado' });
        }
        if (projeto.etapa_atual !== 'Prontos para instalar') {
            return res.status(400).json({
                error: 'Somente projetos finalizados podem ser excluídos. Etapa atual: ' + projeto.etapa_atual
            });
        }

        if (projeto.arquivo_pdf) {
            const arquivoPath = path.join(__dirname, '..', 'uploads', projeto.arquivo_pdf);
            fs.unlink(arquivoPath, (errFs) => {
                if (errFs && errFs.code !== 'ENOENT') {
                    console.error('Erro ao excluir arquivo PDF:', errFs.message);
                }
            });
        }

        db.run('DELETE FROM historico_movimentacoes WHERE projeto_id = ?', [id], (errHist) => {
            if (errHist) {
                console.error('Erro ao excluir histórico:', errHist.message);
            }
        });

        db.run('DELETE FROM projetos WHERE id = ?', [id], function (errDel) {
            if (errDel) {
                return res.status(500).json({ error: errDel.message });
            }
            res.json({
                id: parseInt(id),
                excluido: true,
                mensagem: 'Projeto finalizado excluído com sucesso'
            });
            io.emit('projeto:excluido', { id: parseInt(id) });
        });
    });
});

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE']
    }
});

io.on('connection', (socket) => {
    console.log('Cliente conectado ao Socket.IO:', socket.id);
});

server.listen(PORT, () => {
    console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
    console.log(`📌 BASE 1 - Backend funcionando`);
    console.log(`🔴 Tempo real ativo`);
});
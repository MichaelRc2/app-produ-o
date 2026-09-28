// backend/database.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'database', 'producao.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Erro ao conectar ao banco de dados:', err.message);
    } else {
        console.log('✅ Conectado ao banco de dados SQLite:', dbPath);
    }
});

db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS projetos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            arquivo_pdf TEXT,
            etapa_atual TEXT DEFAULT 'projetos',
            data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP,
            data_atualizacao DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) {
            console.error('❌ Erro ao criar tabela projetos:', err.message);
        } else {
            console.log('✅ Tabela "projetos" pronta');
        }
    });

    db.run(`
        CREATE TABLE IF NOT EXISTS historico_movimentacoes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            projeto_id INTEGER NOT NULL,
            etapa_anterior TEXT,
            etapa_nova TEXT NOT NULL,
            motivo TEXT,
            observacao TEXT,
            data_movimentacao DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (projeto_id) REFERENCES projetos(id)
        )
    `, (err) => {
        if (err) {
            console.error('❌ Erro ao criar tabela historico_movimentacoes:', err.message);
        } else {
            console.log('✅ Tabela "historico_movimentacoes" pronta');
        }
    });

    // Adicionar colunas se a tabela já existir (compatibilidade com bancos antigos)
    db.run(`ALTER TABLE historico_movimentacoes ADD COLUMN motivo TEXT`, (err) => {
        // Ignorar erro se a coluna já existir
    });
    db.run(`ALTER TABLE historico_movimentacoes ADD COLUMN observacao TEXT`, (err) => {
        // Ignorar erro se a coluna já existir
    });
});

module.exports = db;
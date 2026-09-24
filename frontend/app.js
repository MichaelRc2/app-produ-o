document.addEventListener('DOMContentLoaded', () => {
    const statusElement = document.getElementById('connection-status');
    fetch('/api/status')
        .then(response => {
            if (response.ok) {
                statusElement.textContent = '🟢 Backend conectado';
            } else {
                statusElement.textContent = '🔴 Backend desconectado';
            }
        })
        .catch(error => {
            statusElement.textContent = '🔴 Backend desconectado';
            console.error('Erro na comunicação com o backend:', error);
        });

    const lista = document.getElementById('projetos-lista');

    function carregarProjetos() {
        fetch('/api/projetos')
            .then(response => response.json())
            .then(projetos => {
                if (!projetos || projetos.length === 0) {
                    lista.innerHTML = '<p>Nenhum projeto cadastrado.</p>';
                    return;
                }
                lista.innerHTML = projetos.map(p => `
                    <div class="projeto-card">
                        <h4>${p.nome}</h4>
                        <p>Arquivo: <strong>${p.arquivo_pdf || 'Sem PDF'}</strong></p>
                        <p>Etapa: <strong>${p.etapa_atual}</strong></p>
                        ${p.arquivo_pdf ? `<a href="/uploads/${p.arquivo_pdf}" target="_blank">📄 Visualizar PDF</a>` : ''}
                    </div>
                `).join('');
            })
            .catch(error => {
                console.error('Erro ao carregar projetos:', error);
                lista.innerHTML = '<p>Erro ao carregar projetos.</p>';
            });
    }

    carregarProjetos();

    const form = document.getElementById('form-projeto');
    const mensagem = document.getElementById('mensagem-upload');

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        mensagem.textContent = 'Enviando...';

        fetch('/api/projetos', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                mensagem.textContent = '❌ ' + data.error;
            } else {
                mensagem.textContent = '✅ Projeto enviado com sucesso!';
                form.reset();
                carregarProjetos();
            }
        })
        .catch(error => {
            mensagem.textContent = '❌ Erro ao enviar projeto.';
            console.error(error);
        });
    });
});
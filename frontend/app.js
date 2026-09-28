document.addEventListener('DOMContentLoaded', () => {
    const lista = document.getElementById('cards-container');
    const tituloEtapa = document.getElementById('etapa-titulo');
    const contador = document.getElementById('contador-etapa');
    const mensagem = document.getElementById('mensagem-upload');
    let etapaAtual = 'Projetos';

    function carregarProjetos() {
        fetch('/api/projetos')
            .then(response => response.json())
            .then(projetos => {
                const filtrados = projetos.filter(p => p.etapa_atual.toLowerCase() === etapaAtual.toLowerCase());
                contador.textContent = filtrados.length;

                if (filtrados.length === 0) {
                    lista.innerHTML = `
                        <div class="empty-state">
                            <p>Não há projetos nesta etapa.</p>
                            <p>+ Novo projeto</p>
                        </div>`;
                    return;
                }

                lista.innerHTML = filtrados.map(p => {
                    const podeExcluir = p.etapa_atual === 'Prontos para instalar';
                    let avisoVolta = '';
                    fetch(`/api/projetos/${p.id}/historico`)
                        .then(r => r.json())
                        .then(hist => {
                            const mov = hist.find(h => h.etapa_nova === p.etapa_atual && (h.motivo || h.observacao));
                            if (mov) {
                                const card = document.querySelector(`.projeto-card[data-id="${p.id}"]`);
                                if (card) {
                                    const aviso = document.createElement('div');
                                    aviso.className = 'aviso-volta';
                                    aviso.innerHTML = `<strong>🔄 ${mov.motivo || 'Movimentação'}</strong>${mov.observacao ? '<br>' + mov.observacao : ''}`;
                                    card.insertBefore(aviso, card.querySelector('.meta'));
                                }
                            }
                        })
                        .catch(() => {});
                    return `
                        <div class="projeto-card" data-id="${p.id}">
                            <label class="card-check">
                                <input type="checkbox" class="check-projeto" value="${p.id}" />
                            </label>
                            <h4>${p.nome}</h4>
                            <div class="meta">
                                <span>Arquivo: <strong>${p.arquivo_pdf || 'Sem PDF'}</strong></span>
                                <span class="etapa-badge ${p.etapa_atual === 'Prontos para instalar' ? 'prontos' : ''}">${p.etapa_atual}</span>
                            </div>
                            <div class="actions">
                                ${p.arquivo_pdf ? `<a href="/uploads/${p.arquivo_pdf}" target="_blank" class="btn-action btn-visualizar">📄 Ver PDF</a>` : ''}
                                <button class="btn-action btn-avancar" onclick="avancarProjeto(${p.id}, '${p.etapa_atual}')">Avançar</button>
                                <button class="btn-action btn-voltar" onclick="abrirModalVoltar(${p.id}, '${p.etapa_atual}')">Voltar</button>
                                ${podeExcluir ? `<button class="btn-action btn-excluir" onclick="excluirProjeto(${p.id})">Excluir</button>` : ''}
                            </div>
                        </div>`;
                }).join('');
            })
            .catch(error => {
                console.error('Erro ao carregar projetos:', error);
                lista.innerHTML = '<p>Erro ao carregar projetos.</p>';
            });
    }

    // Navegação por etapas
    document.querySelectorAll('.etapa-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.etapa-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            etapaAtual = btn.getAttribute('data-etapa');
            tituloEtapa.textContent = etapaAtual;
            document.getElementById('upload-section').style.display = (etapaAtual === 'Projetos') ? 'block' : 'none';
            carregarProjetos();
        });
    });

    // Estado inicial do upload
    document.getElementById('upload-section').style.display = (etapaAtual === 'Projetos') ? 'block' : 'none';

    // Seleção múltipla
    window.selecionarTodos = () => {
        const checkboxes = document.querySelectorAll('.check-projeto');
        const todosMarcados = Array.from(checkboxes).every(cb => cb.checked);
        checkboxes.forEach(cb => cb.checked = !todosMarcados);
        atualizarContadorSelecionados();
    };

    window.atualizarContadorSelecionados = () => {
        const selecionados = document.querySelectorAll('.check-projeto:checked').length;
        document.getElementById('contador-selecionados').textContent = selecionados;
        document.getElementById('contador-selecionados-excluir').textContent = selecionados;
        const btnExcluir = document.getElementById('btn-excluir-lote');
        if (btnExcluir) {
            btnExcluir.style.display = (selecionados > 0 && etapaAtual === 'Prontos para instalar') ? 'inline-flex' : 'none';
        }
    };

    // Delegação de evento para checkboxes dinâmicos
    document.getElementById('cards-container').addEventListener('change', (e) => {
        if (e.target.classList.contains('check-projeto')) {
            window.atualizarContadorSelecionados();
        }
    });

    window.excluirProjetosSelecionados = () => {
        const selecionados = Array.from(document.querySelectorAll('.check-projeto:checked'));
        if (selecionados.length === 0) {
            alert('❌ Nenhum projeto selecionado.');
            return;
        }
        if (etapaAtual !== 'Prontos para instalar') {
            alert('❌ A exclusão só é permitida na etapa "Prontos para instalar".');
            return;
        }
        if (!confirm('Tem certeza que deseja excluir ' + selecionados.length + ' projeto(s) finalizado(s)?')) return;

        let pendentes = selecionados.length;
        let erros = 0;

        selecionados.forEach(cb => {
            const id = cb.value;
            fetch(`/api/projetos/${id}`, { method: 'DELETE' })
                .then(response => response.json())
                .then(data => {
                    if (data.error) {
                        console.error('Erro ao excluir projeto ' + id + ':', data.error);
                        erros++;
                    }
                })
                .catch(error => {
                    console.error('Erro ao excluir projeto ' + id + ':', error);
                    erros++;
                })
                .finally(() => {
                    pendentes--;
                    if (pendentes === 0) {
                        setTimeout(() => {
                            carregarProjetos();
                            document.querySelectorAll('.check-projeto').forEach(c => c.checked = false);
                            window.atualizarContadorSelecionados();
                            if (erros > 0) {
                                alert('❌ Alguns projetos não puderam ser excluídos.');
                            } else {
                                alert('✅ ' + selecionados.length + ' projeto(s) excluído(s) com sucesso!');
                            }
                        }, 500);
                    }
                });
        });
    };

    window.avancarProjetosSelecionados = () => {
        const selecionados = Array.from(document.querySelectorAll('.check-projeto:checked'));
        if (selecionados.length === 0) {
            alert('❌ Nenhum projeto selecionado.');
            return;
        }
        if (etapaAtual === 'Prontos para instalar') {
            alert('❌ Não é possível avançar a partir de "Prontos para instalar".');
            return;
        }

        const etapas = ['Projetos', 'Corte', 'Lapidação', 'Furação', 'Têmpera', 'Pintura', 'Prontos para instalar'];
        const index = etapas.findIndex(e => e.toLowerCase() === etapaAtual.toLowerCase());
        if (index === -1 || index >= etapas.length - 1) return;
        const novaEtapa = etapas[index + 1];

        let pendentes = selecionados.length;
        let erros = 0;

        selecionados.forEach(cb => {
            const id = cb.value;
            fetch(`/api/projetos/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ etapa_atual: novaEtapa })
            })
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    console.error('Erro ao avançar projeto ' + id + ':', data.error);
                    erros++;
                }
            })
            .catch(error => {
                console.error('Erro ao avançar projeto ' + id + ':', error);
                erros++;
            })
            .finally(() => {
                pendentes--;
                if (pendentes === 0) {
                    setTimeout(() => {
                        carregarProjetos();
                        document.querySelectorAll('.check-projeto').forEach(c => c.checked = false);
                        window.atualizarContadorSelecionados();
                        if (erros > 0) {
                            alert('❌ Alguns projetos não puderam ser avançados.');
                        } else {
                            alert('✅ ' + selecionados.length + ' projeto(s) avançado(s) para: ' + novaEtapa);
                        }
                    }, 500);
                }
            });
        });
    };

    carregarProjetos();

    // Socket.IO tempo real
    const socket = io();
    socket.on('projeto:criado', () => carregarProjetos());
    socket.on('projeto:atualizado', () => carregarProjetos());
    socket.on('projeto:excluido', () => carregarProjetos());

    // Upload
    const arquivoInput = document.getElementById('arquivo');
    const arquivosLista = document.getElementById('arquivos-selecionados');

    arquivoInput.addEventListener('change', () => {
        const files = arquivoInput.files;
        if (!files || files.length === 0) {
            arquivosLista.innerHTML = '';
            return;
        }
        let html = '<p><strong>Arquivos selecionados:</strong></p><ul>';
        for (let i = 0; i < files.length; i++) {
            html += `<li>📄 ${files[i].name}</li>`;
        }
        html += '</ul>';
        arquivosLista.innerHTML = html;
    });

    const form = document.getElementById('form-projeto');
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        mensagem.textContent = 'Enviando...';

        fetch('/api/projetos', { method: 'POST', body: formData })
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

function abrirModalVoltar(id, etapaAtual) {
    const etapas = ['Projetos', 'Corte', 'Lapidação', 'Furação', 'Têmpera', 'Pintura', 'Prontos para instalar'];
    const index = etapas.findIndex(e => e.toLowerCase() === etapaAtual.toLowerCase());
    const select = document.getElementById('etapa-destino');
    select.innerHTML = '<option value="">Selecione uma etapa</option>';
    for (let i = 0; i < index; i++) {
        const opt = document.createElement('option');
        opt.value = etapas[i];
        opt.textContent = etapas[i];
        select.appendChild(opt);
    }
    document.getElementById('motivo').value = '';
    document.getElementById('observacao').value = '';
    document.getElementById('modal-voltar').dataset.projetoId = id;
    document.getElementById('modal-voltar').style.display = 'flex';
}

function fecharModal() {
    document.getElementById('modal-voltar').style.display = 'none';
}

function confirmarVoltar() {
    const id = document.getElementById('modal-voltar').dataset.projetoId;
    const etapaDestino = document.getElementById('etapa-destino').value;
    const motivo = document.getElementById('motivo').value;
    const observacao = document.getElementById('observacao').value;

    if (!etapaDestino) {
        alert('❌ Selecione uma etapa de destino.');
        return;
    }
    if (!motivo) {
        alert('❌ Selecione um motivo.');
        return;
    }

    fetch(`/api/projetos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ etapa_atual: etapaDestino, motivo, observacao })
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            alert('❌ ' + data.error);
        } else {
            alert('✅ Projeto voltado para: ' + etapaDestino);
            fecharModal();
        }
    })
    .catch(error => {
        console.error('Erro ao voltar projeto:', error);
        alert('❌ Erro ao voltar projeto.');
    });
}

function avancarProjeto(id, etapaAtual) {
    const etapas = ['Projetos', 'Corte', 'Lapidação', 'Furação', 'Têmpera', 'Pintura', 'Prontos para instalar'];
    const index = etapas.findIndex(e => e.toLowerCase() === etapaAtual.toLowerCase());
    if (index === -1 || index >= etapas.length - 1) return;
    const novaEtapa = etapas[index + 1];

    fetch(`/api/projetos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ etapa_atual: novaEtapa })
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            alert('❌ ' + data.error);
        } else {
            alert('✅ Etapa atualizada para: ' + novaEtapa);
        }
    })
    .catch(error => {
        console.error('Erro ao avançar projeto:', error);
        alert('❌ Erro ao avançar projeto.');
    });
}

function excluirProjeto(id) {
    if (!confirm('Tem certeza que deseja excluir este projeto finalizado?')) return;

    fetch(`/api/projetos/${id}`, { method: 'DELETE' })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                alert('❌ ' + data.error);
            } else {
                alert('✅ Projeto excluído com sucesso!');
            }
        })
        .catch(error => {
            console.error('Erro ao excluir projeto:', error);
            alert('❌ Erro ao excluir projeto.');
        });
}

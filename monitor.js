const fs = require('fs');
const nodemailer = require('nodemailer');

const EMAIL_DESTINO = process.env.EMAIL_DESTINO;
const EMAIL_REMETENTE = process.env.EMAIL_REMETENTE;
const EMAIL_SENHA = process.env.EMAIL_SENHA;
const ARQUIVO_ESTADO = 'estado.json';

// CSV export — traz ID, tipo, autor e ementa em uma só chamada
// Ordenado por ID decrescente para pegar as mais novas primeiro
const CSV_URL = 'http://sapl.al.al.leg.br/materia/pesquisar-materia?format=csv&ano=2026&orderby=-id';

function carregarEstado() {
  if (fs.existsSync(ARQUIVO_ESTADO)) {
    return JSON.parse(fs.readFileSync(ARQUIVO_ESTADO, 'utf8'));
  }
  return { proposicoes_vistas: [], ultima_execucao: '' };
}

function salvarEstado(estado) {
  fs.writeFileSync(ARQUIVO_ESTADO, JSON.stringify(estado, null, 2));
}

// Parser simples para CSV com separador ";" e campos entre aspas
function parseCSV(texto) {
  const linhas = texto.trim().split('\n');
  if (linhas.length < 2) return [];

  // Cabeçalho: "ID";"Ano";"Número";"Tipo.../Sigla";"Tipo.../Descrição";"Autorias";"Texto Original";"Ementa"
  const resultado = [];

  for (let i = 1; i < linhas.length; i++) {
    const linha = linhas[i].trim();
    if (!linha) continue;

    // Remove aspas externas e divide por ";"
    const campos = linha.split('";"');
    if (campos.length < 8) continue;

    const limpar = (s) => s.replace(/^"|"$/g, '').trim();

    resultado.push({
      id: limpar(campos[0]),
      ano: limpar(campos[1]),
      numero: limpar(campos[2]),
      sigla: limpar(campos[3]),
      tipo: limpar(campos[4]),
      autor: limpar(campos[5]),
      ementa: limpar(campos[7]).substring(0, 200),
    });
  }

  return resultado;
}

async function buscarProposicoes() {
  const ano = new Date().getFullYear();
  const url = `http://sapl.al.al.leg.br/materia/pesquisar-materia?format=csv&ano=${ano}&orderby=-id`;

  console.log(`🔍 Buscando proposições de ${ano} via CSV...`);

  const response = await fetch(url);

  if (!response.ok) {
    console.error(`❌ Erro ao baixar CSV: ${response.status} ${response.statusText}`);
    return [];
  }

  const texto = await response.text();
  console.log(`📦 CSV recebido (${texto.length} bytes)`);

  const proposicoes = parseCSV(texto);
  console.log(`📊 ${proposicoes.length} proposições encontradas`);

  return proposicoes;
}

async function enviarEmail(novas) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: EMAIL_REMETENTE, pass: EMAIL_SENHA },
  });

  // Agrupa por tipo
  const porTipo = {};
  novas.forEach(p => {
    const tipo = p.tipo || 'OUTROS';
    if (!porTipo[tipo]) porTipo[tipo] = [];
    porTipo[tipo].push(p);
  });

  const linhas = Object.keys(porTipo).sort().map(tipo => {
    const header = `<tr><td colspan="5" style="padding:10px 8px 4px;background:#f0f4f8;font-weight:bold;color:#1a3a5c;font-size:13px;border-top:2px solid #1a3a5c">${tipo} — ${porTipo[tipo].length} proposição(ões)</td></tr>`;
    const rows = porTipo[tipo].map(p =>
      `<tr>
        <td style="padding:8px;border-bottom:1px solid #eee;color:#555;font-size:12px">${p.sigla || '-'}</td>
        <td style="padding:8px;border-bottom:1px solid #eee"><strong>${p.numero || '-'}/${p.ano || '-'}</strong></td>
        <td style="padding:8px;border-bottom:1px solid #eee;font-size:12px">${p.autor || '-'}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;font-size:12px">${p.ementa || '-'}</td>
      </tr>`
    ).join('');
    return header + rows;
  }).join('');

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:900px;margin:0 auto">
      <h2 style="color:#1a3a5c;border-bottom:2px solid #1a3a5c;padding-bottom:8px">
        🏛️ ALAL — ${novas.length} nova(s) proposição(ões)
      </h2>
      <p style="color:#666">Monitoramento automático — ${new Date().toLocaleString('pt-BR')}</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <thead>
          <tr style="background:#1a3a5c;color:white">
            <th style="padding:10px;text-align:left">Sigla</th>
            <th style="padding:10px;text-align:left">Número/Ano</th>
            <th style="padding:10px;text-align:left">Autor</th>
            <th style="padding:10px;text-align:left">Ementa</th>
          </tr>
        </thead>
        <tbody>${linhas}</tbody>
      </table>
      <p style="margin-top:20px;font-size:12px;color:#999">
        Acesse: <a href="http://sapl.al.al.leg.br/materia/pesquisar-materia">sapl.al.al.leg.br</a>
      </p>
    </div>
  `;

  await transporter.sendMail({
    from: `"Monitor ALAL" <${EMAIL_REMETENTE}>`,
    to: EMAIL_DESTINO,
    subject: `🏛️ ALAL: ${novas.length} nova(s) proposição(ões) — ${new Date().toLocaleDateString('pt-BR')}`,
    html,
  });

  console.log(`✅ Email enviado com ${novas.length} proposições novas.`);
}

(async () => {
  console.log('🚀 Iniciando monitor ALAL...');
  console.log(`⏰ ${new Date().toLocaleString('pt-BR')}`);

  const estado = carregarEstado();
  const idsVistos = new Set(estado.proposicoes_vistas.map(String));

  const proposicoes = await buscarProposicoes();

  if (proposicoes.length === 0) {
    console.log('⚠️ Nenhuma proposição encontrada.');
    process.exit(0);
  }

  const novas = proposicoes.filter(p => !idsVistos.has(String(p.id)));
  console.log(`🆕 Proposições novas: ${novas.length}`);

  if (novas.length > 0) {
    // Ordena por tipo alfabético, depois por número decrescente
    novas.sort((a, b) => {
      if (a.tipo < b.tipo) return -1;
      if (a.tipo > b.tipo) return 1;
      return (parseInt(b.numero) || 0) - (parseInt(a.numero) || 0);
    });

    await enviarEmail(novas);

    novas.forEach(p => idsVistos.add(String(p.id)));
    estado.proposicoes_vistas = Array.from(idsVistos);
    estado.ultima_execucao = new Date().toISOString();
    salvarEstado(estado);
  } else {
    console.log('✅ Sem novidades. Nada a enviar.');
    estado.ultima_execucao = new Date().toISOString();
    salvarEstado(estado);
  }
})();

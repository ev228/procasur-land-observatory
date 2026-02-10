const express = require('express');
const cors = require('cors');
const { google } = require('googleapis');
const Anthropic = require('@anthropic-ai/sdk');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.static('public'));

const PORT = process.env.PORT || 3000;

// ---------------------------------------------------------------------------
// Google Auth — supports both local file and Render env var
// ---------------------------------------------------------------------------
function getGoogleAuth() {
    if (process.env.GOOGLE_CREDENTIALS_JSON) {
        const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
        return new google.auth.GoogleAuth({
            credentials,
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });
    }
    return new google.auth.GoogleAuth({
        keyFile: './google-credentials.json',
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
}

// ---------------------------------------------------------------------------
// System prompts
// ---------------------------------------------------------------------------
const MANUAL_ANALYSIS_PROMPT = `Eres el motor analítico del PROCASUR Land Projects Observatory, una plataforma de inteligencia que analiza proyectos IFAD para identificar conexiones estratégicas en gobernanza de tierras, desarrollo rural y cooperación sur-sur.

Tu marco analítico examina los proyectos desde tres lentes:
- LAND GOVERNANCE: cómo cada proyecto aborda el acceso, uso, control y transferencia de tierra y recursos naturales. Incluye titulación, registro catastral, reforma agraria, derechos consuetudinarios, gobernanza de tierras comunales, y marcos regulatorios.
- DEVELOPMENT IMPACT: efectividad del proyecto en reducción de pobreza, seguridad alimentaria, empoderamiento de organizaciones de base, fortalecimiento institucional, y transformación productiva.
- KNOWLEDGE EXCHANGE POTENTIAL: viabilidad de intercambio sur-sur entre los proyectos, potencial de Learning Routes, complementariedad de experiencias, y replicabilidad de innovaciones.

REGLAS DE ANALISIS:
1. NUNCA describas los proyectos individualmente. Analiza lo que EMERGE ENTRE ellos.
2. Identifica PATRONES TRANSVERSALES en gobernanza de tierras, no solo coincidencias geográficas.
3. Evalúa el potencial concreto de Learning Routes entre los proyectos: quién enseña qué a quién.
4. Conecta con oportunidades de funding: IFAD replenishments, GEF cycles, Green Climate Fund, bilateral donors.
5. Distingue entre potencial de conocimiento (publications, case studies) y potencial operativo (nuevos proyectos, scaling up).
6. Escribe en español con terminología de desarrollo internacional.

CONTRATO DE SALIDA OBLIGATORIO:
Devuelve exactamente 3 bloques, en este orden:

===TITLE===
(Titulo analitico de 8-12 palabras que capture la conexion central)

===BULLETS===
(6 a 10 bullets ejecutivos, 1-2 lineas cada uno. Centrados en CONEXIONES entre proyectos:
- Al menos 2 bullets sobre patrones de land governance compartidos
- Al menos 2 bullets sobre potencial de Learning Routes
- Al menos 1 bullet sobre oportunidad de funding concreta
Cada bullet comienza con un asterisco: *)

===FULL_REPORT===
(Informe completo con estas 6 secciones numeradas:
1. PATRON DE LAND GOVERNANCE IDENTIFICADO
2. COMPLEMENTARIEDAD ENTRE PROYECTOS
3. POTENCIAL DE LEARNING ROUTES (quien ensenia que a quien, ruta propuesta)
4. OPORTUNIDAD DE ESCALAMIENTO
5. ESTRATEGIA DE FINANCIAMIENTO (fondos especificos: IFAD, GEF, GCF, bilaterales, con detalles)
6. PRODUCTOS DE CONOCIMIENTO POSIBLES (case studies, policy briefs, toolkits))

NO uses markdown (ni #, ni **, ni backticks). Usa texto plano con numeracion y guiones.`;

const NETWORK_ANALYSIS_PROMPT = `Eres el motor de analisis de red del PROCASUR Land Projects Observatory. Tu tarea es analizar un portfolio completo de proyectos IFAD y producir un grafo de red que mapee:

1. La INTENSIDAD del componente tierra/propiedad en cada proyecto (score 1-10)
2. Las CONEXIONES entre proyectos basadas en multiples dimensiones
3. CLUSTERS naturales de proyectos con potencial de cooperacion
4. Potencial de LEARNING ROUTES entre clusters
5. ALINEAMIENTO con oportunidades de donantes

TAXONOMIA DE INTENSIDAD LAND/PROPERTY (landIntensityScore 1-10):
- 8-10 (ALTA): La tierra es el OBJETO CENTRAL del proyecto. Incluye: reforma agraria, titulacion masiva, registro catastral, gobernanza de tierras comunales, resolucion de conflictos de tierra, land use planning como componente principal.
- 4-7 (MEDIA): La tierra es un COMPONENTE INSTRUMENTAL. El proyecto incluye acceso a tierra como medio para otro fin (seguridad alimentaria, reduccion de pobreza), o aborda derechos sobre recursos naturales vinculados a tierra.
- 1-3 (BAJA): La tierra es CONTEXTUAL. El proyecto opera en entornos donde la tierra es relevante pero no la aborda directamente (e.g., proyectos de microfinanzas rural, cadenas de valor sin componente de acceso a tierra).

TIPOS DE CONEXION ENTRE PROYECTOS:
- "thematic": comparten enfoque tematico en land governance (mismo tipo de intervencion)
- "geographic": proximidad geografica o mismo contexto regional que facilita intercambio
- "methodological": usan metodologias similares o complementarias
- "temporal": ventana temporal que permite aprendizaje (uno mas avanzado puede ensenar al otro)
- "institutional": comparten donantes, agencias implementadoras, o socios

DEBES devolver UNICAMENTE un JSON valido (sin backticks, sin texto fuera del JSON).

ESTRUCTURA (sigue EXACTAMENTE este formato):
{"nodes":[{"id":"1","label":"ACRONYM","country":"Country","landIntensityScore":8,"landClassification":"Alta","justification":"max 12 words","status":"Active","sector":"sector"}],"edges":[{"source":"1","target":"2","strength":7,"type":"thematic","description":"max 10 words"}],"clusters":[{"name":"Cluster Name","projects":["1","2"],"description":"max 20 words","learningRoutePotential":"HIGH","proposedRoute":"Country1 -> Country2"}],"crossCuttingFindings":["Finding 1","Finding 2"]}

REGLAS CRITICAS PARA MANTENER JSON COMPACTO:
- Incluye TODOS los proyectos como nodos
- MAXIMO 40 edges totales. Solo conexiones con strength >= 7.
- Justificaciones de nodos: MAXIMO 12 palabras
- Descripciones de edges: MAXIMO 10 palabras
- Descripciones de clusters: MAXIMO 20 palabras
- MAXIMO 6 clusters
- crossCuttingFindings: exactamente 3 hallazgos breves
- NO incluyas donorAlignment (lo omitimos para compacidad)
- learningRoutePotential: "HIGH", "MEDIUM", o "LOW"
- Responde SOLO con el JSON, nada mas
- IDIOMA: Escribe TODOS los textos (justifications, descriptions, findings, cluster names) en el idioma que se te indique en el mensaje del usuario.`;

// ---------------------------------------------------------------------------
// GET /api/projects — fetch from Google Sheets
// ---------------------------------------------------------------------------
app.get('/api/projects', async (req, res) => {
    try {
        const auth = getGoogleAuth();
        const sheets = google.sheets({ version: 'v4', auth });
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
            range: `'${process.env.GOOGLE_SHEET_NAME}'!A:Q`,
        });

        const rows = response.data.values;
        if (!rows || rows.length < 2) {
            return res.json({ projects: [] });
        }

        // Helper: parse European-format numbers (451.000.000 → 451000000, 6,5 → 6.5)
        function parseEuroNum(val) {
            if (!val) return 0;
            const s = String(val).trim();
            // If it has dots as thousands separators and comma as decimal (e.g. 451.000.000 or 6,5)
            if (s.includes(',') && s.includes('.')) {
                // e.g. "1.234.567,89" → remove dots, replace comma with dot
                return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
            }
            if (s.includes(',')) {
                // e.g. "6,5" → "6.5"
                return parseFloat(s.replace(',', '.')) || 0;
            }
            // e.g. "451.000.000" — if multiple dots, they are thousands separators
            const dotCount = (s.match(/\./g) || []).length;
            if (dotCount > 1) {
                return parseFloat(s.replace(/\./g, '')) || 0;
            }
            return parseFloat(s) || 0;
        }

        // Actual columns: A=No, B=País, C=Proyecto, D=Acrónimo, E=IFAD ID,
        // F=Status, G=Año Inicio, H=Año Cierre, I=Monto Total, J=Monto FIDA,
        // K=Cofinanciadores, L=Sector, M=Land Component, N=Land Comp Desc,
        // O=Resumen, P=Latitud, Q=Longitud
        const projects = rows.slice(1).map((row, index) => ({
            id: row[0] || `proj_${index}`,
            pais: row[1] || '',
            proyecto: row[2] || '',
            acronimo: row[3] || '',
            ifadId: row[4] || '',
            status: row[5] || '',
            anioInicio: parseInt(row[6]) || null,
            anioCierre: parseInt(row[7]) || null,
            montoTotal: parseEuroNum(row[8]),
            montoFida: parseEuroNum(row[9]),
            cofinanciadores: row[10] || '',
            sector: row[11] || '',
            landComponent: row[12] || '',
            landDescription: row[13] || '',
            resumen: row[14] || '',
            lat: parseEuroNum(row[15]),
            lng: parseEuroNum(row[16])
        })).filter(p => p.lat && p.lng);

        res.json({ projects });
    } catch (error) {
        console.error('Error fetching projects:', error.message);
        res.status(500).json({ error: 'Failed to fetch projects' });
    }
});

// ---------------------------------------------------------------------------
// POST /api/analyze — manual linkage analysis (2-5 selected projects)
// ---------------------------------------------------------------------------
function parseAnalysis(text) {
    let title = '', bullets = '', fullReport = '';

    if (text.includes('===TITLE===') && text.includes('===BULLETS===')) {
        const parts1 = text.split('===BULLETS===');
        title = parts1[0].replace('===TITLE===', '').trim();
        const parts2 = parts1[1].split('===FULL_REPORT===');
        bullets = parts2[0].trim();
        fullReport = parts2[1] ? parts2[1].trim() : '';
    } else {
        title = 'Analisis de proyectos seleccionados';
        fullReport = text;
    }

    return { title, bullets, fullReport };
}

app.post('/api/analyze', async (req, res) => {
    try {
        const { projects, lang } = req.body;
        if (!projects || projects.length < 2) {
            return res.status(400).json({ error: 'Se requieren al menos 2 proyectos' });
        }

        const langInstruction = lang === 'en' ? 'Write the ENTIRE analysis in English.' : 'Escribe TODO el analisis en Español.';
        const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

        const projectsText = projects.map((p, i) =>
            `PROYECTO ${i + 1}: ${p.proyecto}\nPais: ${p.pais}\nIFAD ID: ${p.ifadId}\nStatus: ${p.status}\nPeriodo: ${p.anioInicio}-${p.anioCierre}\nMonto Total: ${p.montoTotal?.toLocaleString()}\nMonto FIDA: ${p.montoFida?.toLocaleString()}\nCofinanciadores: ${p.cofinanciadores}\nSector: ${p.sector}\nLand Component: ${p.landComponent}\nLand Description: ${p.landDescription}\nResumen: ${p.resumen}`
        ).join('\n\n---\n\n');

        const message = await anthropic.messages.create({
            model: 'claude-sonnet-4-5-20250929',
            max_tokens: 8000,
            system: MANUAL_ANALYSIS_PROMPT,
            messages: [{
                role: 'user',
                content: `PROYECTOS SELECCIONADOS:\n\n${projectsText}\n\nGenera el analisis completo en los 3 bloques obligatorios. ${langInstruction}`
            }]
        });

        const text = message.content[0].text;
        const result = parseAnalysis(text);
        res.json(result);
    } catch (error) {
        console.error('Analysis error:', error.message);
        res.status(500).json({ error: 'El analisis fallo. Verifica tu API key.' });
    }
});

// ---------------------------------------------------------------------------
// POST /api/network — AI-powered network analysis (full portfolio)
// ---------------------------------------------------------------------------
app.post('/api/network', async (req, res) => {
    try {
        const { projects, lang } = req.body;
        if (!projects || projects.length < 3) {
            return res.status(400).json({ error: 'Se requieren al menos 3 proyectos' });
        }

        const langLabel = lang === 'en' ? 'English' : 'Español';
        const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

        const projectsSummary = projects.map(p =>
            `[${p.id}] ${p.proyecto} | ${p.pais} | ${p.status} | ${p.anioInicio}-${p.anioCierre} | Land: ${p.landComponent} | Sector: ${p.sector} | ${p.landDescription} | ${p.resumen}`
        ).join('\n');

        const message = await anthropic.messages.create({
            model: 'claude-sonnet-4-5-20250929',
            max_tokens: 16000,
            system: NETWORK_ANALYSIS_PROMPT,
            messages: [{
                role: 'user',
                content: `PORTFOLIO COMPLETO DE PROYECTOS IFAD:\n\n${projectsSummary}\n\nGenera el analisis de red completo en formato JSON. IMPORTANTE: mantén descripciones breves para que el JSON sea compacto. IDIOMA DE TODOS LOS TEXTOS: ${langLabel}.`
            }]
        });

        const text = message.content[0].text;
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            return res.status(500).json({ error: 'No se pudo parsear el analisis de red' });
        }

        let jsonStr = jsonMatch[0];
        // Attempt to repair truncated JSON
        try {
            const networkData = JSON.parse(jsonStr);
            res.json(networkData);
        } catch (parseErr) {
            console.error('JSON parse error, attempting repair...');
            // Try closing open arrays/objects
            let repaired = jsonStr;
            const openBraces = (repaired.match(/\{/g) || []).length;
            const closeBraces = (repaired.match(/\}/g) || []).length;
            const openBrackets = (repaired.match(/\[/g) || []).length;
            const closeBrackets = (repaired.match(/\]/g) || []).length;
            // Remove trailing comma if any
            repaired = repaired.replace(/,\s*$/, '');
            // Remove incomplete last entry (after last complete comma)
            const lastComplete = repaired.lastIndexOf('},');
            if (lastComplete > 0 && repaired.length - lastComplete < 500) {
                repaired = repaired.substring(0, lastComplete + 1);
            }
            // Close brackets/braces
            for (let i = 0; i < openBrackets - closeBrackets; i++) repaired += ']';
            for (let i = 0; i < openBraces - closeBraces; i++) repaired += '}';
            try {
                const networkData = JSON.parse(repaired);
                res.json(networkData);
            } catch (e2) {
                res.status(500).json({ error: 'El JSON del analisis esta incompleto. Intenta de nuevo.' });
            }
        }
    } catch (error) {
        console.error('Network analysis error:', error.message);
        res.status(500).json({ error: 'El analisis de red fallo. Verifica tu API key.' });
    }
});

// ---------------------------------------------------------------------------
// SPA fallback
// ---------------------------------------------------------------------------
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
    console.log(`PROCASUR Land Projects Observatory running on port ${PORT}`);
    console.log(`Open http://localhost:${PORT}`);
});

/* ==========================================================================
   analysis.js — Manual linkage analysis (API call + modal display)
   Modal shows ONLY title + bullets. Full report goes to PDF download.
   ========================================================================== */

const Analysis = {
    lastResult: null,

    async run(projects) {
        if (projects.length < 2) return;

        const modal = document.getElementById('analysis-modal');
        const body = document.getElementById('analysis-body');
        const footer = document.getElementById('analysis-footer');

        modal.classList.add('open');
        footer.style.display = 'none';
        body.innerHTML = `
            <div class="loading">
                <div class="spinner"></div>
                <div class="loading-text">Analizando conexiones entre ${projects.length} proyectos...</div>
            </div>
        `;

        try {
            const res = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projects })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Error en el analisis');
            }

            const result = await res.json();
            this.lastResult = {
                ...result,
                projects: projects.map(p => ({ id: p.id, proyecto: p.proyecto, pais: p.pais, acronimo: p.acronimo })),
                date: new Date().toISOString()
            };

            this.displayResult(result);

            if (typeof ReportsView !== 'undefined') {
                ReportsView.save(this.lastResult);
            }
        } catch (err) {
            body.innerHTML = `
                <div class="empty-state">
                    <h3>Error en el analisis</h3>
                    <p>${err.message}</p>
                </div>
            `;
            footer.style.display = 'flex';
        }
    },

    displayResult(result) {
        const body = document.getElementById('analysis-body');
        const footer = document.getElementById('analysis-footer');

        // Only show title + bullets in modal (brief view)
        let bulletsHtml = '';
        if (result.bullets) {
            const bulletLines = result.bullets.split('\n').filter(l => l.trim());
            bulletsHtml = `
                <div class="modal-bullets">
                    <ul>
                        ${bulletLines.map(b => `<li>${b.replace(/^\*\s*/, '').trim()}</li>`).join('')}
                    </ul>
                </div>
            `;
        }

        body.innerHTML = `
            <div class="modal-title">${result.title || 'Analisis de Proyectos'}</div>
            ${bulletsHtml}
            <p style="text-align:center;color:#6B7280;font-size:15px;margin-top:16px;">
                El informe completo se incluye en el PDF descargable.
            </p>
        `;

        footer.style.display = 'flex';
    },

    showReport(report) {
        const modal = document.getElementById('analysis-modal');
        modal.classList.add('open');
        document.getElementById('analysis-footer').style.display = 'flex';
        this.lastResult = report;
        this.displayResult(report);
    }
};

// Modal event bindings
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-close-modal').addEventListener('click', () => {
        document.getElementById('analysis-modal').classList.remove('open');
    });

    document.getElementById('analysis-modal').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) {
            e.currentTarget.classList.remove('open');
        }
    });

    document.getElementById('btn-download-pdf').addEventListener('click', () => {
        if (Analysis.lastResult && typeof PDF !== 'undefined') {
            PDF.generate(Analysis.lastResult);
        }
    });
});

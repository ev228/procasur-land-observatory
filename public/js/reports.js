/* ==========================================================================
   reports.js — Report history in localStorage
   ========================================================================== */

const ReportsView = {
    STORAGE_KEY: 'procasur_reports',

    getAll() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch {
            return [];
        }
    },

    save(report) {
        const reports = this.getAll();
        reports.unshift({
            id: Date.now().toString(),
            title: report.title || 'Analisis sin titulo',
            bullets: report.bullets || '',
            fullReport: report.fullReport || '',
            projects: report.projects || [],
            date: report.date || new Date().toISOString()
        });
        // Keep max 20 reports
        if (reports.length > 20) reports.length = 20;
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(reports));
    },

    remove(id) {
        const reports = this.getAll().filter(r => r.id !== id);
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(reports));
        this.render();
    },

    render() {
        const container = document.getElementById('reports-list');
        const reports = this.getAll();

        if (reports.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>Sin reportes</h3>
                    <p>Los reportes generados desde el Map Explorer o Network Analysis apareceran aqui.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = reports.map(r => {
            const date = new Date(r.date).toLocaleDateString('es-ES', {
                year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
            });
            const projectNames = (r.projects || []).map(p => p.proyecto || p).join(', ');
            return `
                <div class="report-card">
                    <div>
                        <div class="report-title">${r.title}</div>
                        <div class="report-meta">${date} | ${(r.projects || []).length} proyectos: ${projectNames}</div>
                    </div>
                    <div class="report-actions">
                        <button class="btn btn-primary btn-small" onclick="ReportsView.view('${r.id}')">Ver</button>
                        <button class="btn btn-secondary btn-small" onclick="ReportsView.downloadPdf('${r.id}')">PDF</button>
                        <button class="btn btn-danger btn-small" onclick="ReportsView.remove('${r.id}')">Eliminar</button>
                    </div>
                </div>
            `;
        }).join('');
    },

    view(id) {
        const report = this.getAll().find(r => r.id === id);
        if (report && typeof Analysis !== 'undefined') {
            Analysis.showReport(report);
        }
    },

    downloadPdf(id) {
        const report = this.getAll().find(r => r.id === id);
        if (report && typeof PDF !== 'undefined') {
            PDF.generate(report);
        }
    }
};

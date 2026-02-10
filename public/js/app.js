/* ==========================================================================
   app.js — Main application: data loading, navigation, shared state, i18n
   ========================================================================== */

// --- i18n translations ---
const i18n = {
    es: {
        // Nav
        dashboard: 'Dashboard', map: 'Map Explorer', network: 'Network Analysis', reports: 'Reportes',
        // KPIs
        totalProjects: 'Total Proyectos', activeProjects: 'Proyectos Activos', countries: 'Paises',
        totalFunding: 'Valor Total (USD)', highLand: 'Alta Intensidad Tierra',
        // Charts
        chartCountries: 'Proyectos por Pais', chartStatus: 'Proyectos por Estado',
        chartLand: 'Componente Tierra', chartTimeline: 'Timeline de Financiamiento',
        chartSectors: 'Principales Sectores', chartCofin: 'Principales Cofinanciadores',
        // Map
        filterCountry: 'Pais', filterStatus: 'Estado', filterSector: 'Sector',
        filterLand: 'Componente Tierra', filterPeriod: 'Periodo', all: 'Todos',
        apply: 'Aplicar', reset: 'Reset', refreshData: 'Actualizar Datos',
        analyzeConnections: 'Analizar Conexiones', clearSelection: 'Limpiar Seleccion',
        selected: 'Seleccionados', select: 'Seleccionar', deselect: 'Deseleccionar',
        period: 'Periodo', totalBudget: 'Presupuesto Total',
        landComponent: 'Componente Tierra',
        // Map legend
        legendTitle: 'Componente Tierra', legendHigh: 'Alta - Objeto central',
        legendMed: 'Media - Componente instrumental', legendLow: 'Baja - Contextual',
        legendNone: 'Sin clasificar', legendSelected: 'Seleccionado',
        // Network
        generateNetwork: 'Generar Analisis de Red', filterIntensity: 'Filtrar por Intensidad',
        networkTitle: 'Red de Proyectos IFAD',
        networkDesc: 'Haz clic en "Generar Analisis de Red" para que la IA analice las conexiones entre todos los proyectos del portfolio.',
        networkLoading: 'Generando analisis de red con IA... Esto puede tomar 30-60 segundos.',
        projectDetail: 'Detalle del Proyecto', selectNode: 'Selecciona un nodo en el grafo para ver sus detalles y conexiones.',
        crossFindings: 'Hallazgos Transversales', clusters: 'Clusters Identificados',
        connections: 'Conexiones', justification: 'Justificacion', intensity: 'Intensidad Tierra',
        showAll: 'Mostrar todos', saveReport: 'Guardar en Reportes',
        // Analysis modal
        analyzing: 'Analizando conexiones entre',
        projects: 'proyectos', downloadPdf: 'Descargar PDF', close: 'Cerrar',
        pdfNote: 'El informe completo se incluye en el PDF descargable.',
        analysisError: 'Error en el analisis',
        // Reports
        reportHistory: 'Historial de Reportes', noReports: 'Sin reportes',
        noReportsDesc: 'Los reportes generados desde el Map Explorer o Network Analysis apareceran aqui.',
        view: 'Ver', delete: 'Eliminar', networkReport: 'Analisis de Red',
    },
    en: {
        dashboard: 'Dashboard', map: 'Map Explorer', network: 'Network Analysis', reports: 'Reports',
        totalProjects: 'Total Projects', activeProjects: 'Active Projects', countries: 'Countries',
        totalFunding: 'Total Value (USD)', highLand: 'High Land Intensity',
        chartCountries: 'Projects by Country', chartStatus: 'Projects by Status',
        chartLand: 'Land Component', chartTimeline: 'Funding Timeline',
        chartSectors: 'Top Sectors', chartCofin: 'Top Co-financiers',
        filterCountry: 'Country', filterStatus: 'Status', filterSector: 'Sector',
        filterLand: 'Land Component', filterPeriod: 'Period', all: 'All',
        apply: 'Apply', reset: 'Reset', refreshData: 'Refresh Data',
        analyzeConnections: 'Analyze Connections', clearSelection: 'Clear Selection',
        selected: 'Selected', select: 'Select', deselect: 'Deselect',
        period: 'Period', totalBudget: 'Total Budget',
        landComponent: 'Land Component',
        legendTitle: 'Land Component', legendHigh: 'High - Central object',
        legendMed: 'Medium - Instrumental component', legendLow: 'Low - Contextual',
        legendNone: 'Unclassified', legendSelected: 'Selected',
        generateNetwork: 'Generate Network Analysis', filterIntensity: 'Filter by Intensity',
        networkTitle: 'IFAD Projects Network',
        networkDesc: 'Click "Generate Network Analysis" for AI to analyze connections across the entire project portfolio.',
        networkLoading: 'Generating network analysis with AI... This may take 30-60 seconds.',
        projectDetail: 'Project Detail', selectNode: 'Select a node in the graph to see its details and connections.',
        crossFindings: 'Cross-Cutting Findings', clusters: 'Identified Clusters',
        connections: 'Connections', justification: 'Justification', intensity: 'Land Intensity',
        showAll: 'Show all', saveReport: 'Save to Reports',
        analyzing: 'Analyzing connections between',
        projects: 'projects', downloadPdf: 'Download PDF', close: 'Close',
        pdfNote: 'The full report is included in the downloadable PDF.',
        analysisError: 'Analysis error',
        reportHistory: 'Report History', noReports: 'No reports',
        noReportsDesc: 'Reports generated from Map Explorer or Network Analysis will appear here.',
        view: 'View', delete: 'Delete', networkReport: 'Network Analysis',
    }
};

const App = {
    projects: [],
    selectedProjects: [],
    currentView: 'dashboard',
    lang: 'es',

    t(key) {
        return (i18n[this.lang] && i18n[this.lang][key]) || key;
    },

    async init() {
        this.setupNavigation();
        this.setupLangSelector();
        await this.loadProjects();
    },

    // --- Language ---
    setupLangSelector() {
        const sel = document.getElementById('lang-selector');
        if (!sel) return;
        sel.addEventListener('change', (e) => {
            this.lang = e.target.value;
            this.applyTranslations();
            // Re-render dashboard
            if (typeof Dashboard !== 'undefined') Dashboard.render(this.projects);
            // Re-render reports
            if (typeof ReportsView !== 'undefined' && this.currentView === 'reports') ReportsView.render();
        });
    },

    applyTranslations() {
        const t = (k) => this.t(k);
        // Nav tabs
        document.querySelectorAll('.nav-tab').forEach(tab => {
            const view = tab.dataset.view;
            if (view && t(view)) tab.textContent = t(view);
        });
        // KPI labels
        const kpiMap = { 'kpi-total': 'totalProjects', 'kpi-active': 'activeProjects', 'kpi-countries': 'countries', 'kpi-funding': 'totalFunding', 'kpi-highland': 'highLand' };
        Object.entries(kpiMap).forEach(([id, key]) => {
            const el = document.getElementById(id);
            if (el) { const label = el.parentElement.querySelector('.kpi-label'); if (label) label.textContent = t(key); }
        });
        // Chart titles
        const chartMap = { 'chart-countries': 'chartCountries', 'chart-status': 'chartStatus', 'chart-land': 'chartLand', 'chart-timeline': 'chartTimeline', 'chart-sectors': 'chartSectors', 'chart-cofin': 'chartCofin' };
        Object.entries(chartMap).forEach(([id, key]) => {
            const canvas = document.getElementById(id);
            if (canvas) { const h3 = canvas.parentElement.querySelector('h3'); if (h3) h3.textContent = t(key); }
        });
        // Map controls labels
        const filterLabelMap = { 'filter-country': 'filterCountry', 'filter-status': 'filterStatus', 'filter-sector': 'filterSector', 'filter-land': 'filterLand' };
        Object.entries(filterLabelMap).forEach(([id, key]) => {
            const sel = document.getElementById(id);
            if (sel) { const label = sel.parentElement.querySelector('label'); if (label) label.textContent = t(key); }
        });
        // Buttons
        const btnMap = { 'btn-apply-filters': 'apply', 'btn-reset-filters': 'reset', 'btn-refresh-data': 'refreshData', 'btn-analyze': 'analyzeConnections', 'btn-clear-selection': 'clearSelection', 'btn-generate-network': 'generateNetwork', 'btn-download-pdf': 'downloadPdf', 'btn-close-modal': 'close' };
        Object.entries(btnMap).forEach(([id, key]) => {
            const btn = document.getElementById(id);
            if (btn) btn.textContent = t(key);
        });
        // Network view texts
        const networkEmpty = document.getElementById('network-empty');
        if (networkEmpty) networkEmpty.innerHTML = `<h3>${t('networkTitle')}</h3><p>${t('networkDesc')}</p>`;
        // Reports title
        const reportsTitle = document.querySelector('#view-reports > h2');
        if (reportsTitle) reportsTitle.textContent = t('reportHistory');
        // Selection counter
        const selCounter = document.getElementById('selection-counter');
        if (selCounter) {
            const count = document.getElementById('selection-count');
            selCounter.childNodes[0].textContent = t('selected') + ': ';
        }
    },

    // --- Navigation ---
    setupNavigation() {
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const view = tab.dataset.view;
                this.switchView(view);
            });
        });
    },

    switchView(view) {
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));

        const tab = document.querySelector(`.nav-tab[data-view="${view}"]`);
        const panel = document.getElementById(`view-${view}`);
        if (tab) tab.classList.add('active');
        if (panel) panel.classList.add('active');

        this.currentView = view;

        if (view === 'map' && typeof MapView !== 'undefined' && !MapView.initialized) {
            MapView.init();
        }
        if (view === 'reports' && typeof ReportsView !== 'undefined') {
            ReportsView.render();
        }
    },

    // --- Data loading ---
    async loadProjects() {
        try {
            const res = await fetch('/api/projects');
            const data = await res.json();
            this.projects = data.projects || [];
            if (typeof Dashboard !== 'undefined') {
                Dashboard.render(this.projects);
            }
        } catch (err) {
            console.error('Error loading projects:', err);
        }
    },

    // --- Selection ---
    toggleSelection(project) {
        const idx = this.selectedProjects.findIndex(p => p.id === project.id);
        if (idx >= 0) {
            this.selectedProjects.splice(idx, 1);
        } else {
            if (this.selectedProjects.length >= 5) return false;
            this.selectedProjects.push(project);
        }
        this.updateSelectionUI();
        return true;
    },

    isSelected(projectId) {
        return this.selectedProjects.some(p => p.id === projectId);
    },

    clearSelection() {
        this.selectedProjects = [];
        this.updateSelectionUI();
        if (typeof MapView !== 'undefined') {
            MapView.updateMarkers();
        }
    },

    updateSelectionUI() {
        const count = this.selectedProjects.length;
        const counter = document.getElementById('selection-counter');
        const countEl = document.getElementById('selection-count');
        const analyzeBtn = document.getElementById('btn-analyze');
        const clearBtn = document.getElementById('btn-clear-selection');

        if (counter) counter.style.display = count > 0 ? 'block' : 'none';
        if (countEl) countEl.textContent = count;
        if (analyzeBtn) analyzeBtn.disabled = count < 2;
        if (clearBtn) clearBtn.style.display = count > 0 ? 'inline-flex' : 'none';
    },

    // --- Utilities ---
    formatUSD(amount) {
        if (amount >= 1e9) return '$' + (amount / 1e9).toFixed(1) + 'B';
        if (amount >= 1e6) return '$' + (amount / 1e6).toFixed(0) + 'M';
        if (amount >= 1e3) return '$' + (amount / 1e3).toFixed(0) + 'K';
        return '$' + amount;
    },

    getStatusBadgeClass(status) {
        const s = (status || '').toLowerCase();
        if (s.includes('active') || s.includes('activ')) return 'badge-active';
        if (s.includes('closed') || s.includes('cerrad')) return 'badge-closed';
        if (s.includes('pipeline') || s.includes('design')) return 'badge-pipeline';
        return 'badge-default';
    },

    getLandColor(landComponent) {
        const lc = (landComponent || '').toLowerCase();
        if (lc.includes('high') || lc.includes('alta') || lc.includes('significant')) return '#E74C3C';
        if (lc.includes('medi') || lc.includes('moderate') || lc.includes('relevant')) return '#F39C12';
        if (lc.includes('low') || lc.includes('baja') || lc.includes('minor') || lc.includes('context')) return '#2078B4';
        return '#95A5A6';
    },

    getLandCategory(landComponent) {
        const lc = (landComponent || '').toLowerCase();
        if (lc.includes('high') || lc.includes('alta') || lc.includes('significant')) return 'Alta';
        if (lc.includes('medi') || lc.includes('moderate') || lc.includes('relevant')) return 'Media';
        if (lc.includes('low') || lc.includes('baja') || lc.includes('minor') || lc.includes('context')) return 'Baja';
        return 'Sin clasificar';
    },

    parseSemicolonList(text) {
        if (!text) return [];
        return text.split(/[;,]/).map(s => s.trim()).filter(s => s.length > 0);
    }
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => App.init());

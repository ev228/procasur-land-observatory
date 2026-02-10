/* ==========================================================================
   app.js — Main application: data loading, navigation, shared state
   ========================================================================== */

const App = {
    projects: [],
    selectedProjects: [],
    currentView: 'dashboard',

    async init() {
        this.setupNavigation();
        await this.loadProjects();
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

        // Initialize views on first visit
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
            console.log(`Loaded ${this.projects.length} projects`);

            // Initialize dashboard with data
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

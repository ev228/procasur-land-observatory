/* ==========================================================================
   dashboard.js — KPIs and Chart.js charts
   ========================================================================== */

const Dashboard = {
    charts: {},

    render(projects) {
        this.renderKPIs(projects);
        this.renderCharts(projects);
    },

    renderKPIs(projects) {
        const total = projects.length;
        const active = projects.filter(p => {
            const s = (p.status || '').toLowerCase();
            return s.includes('active') || s.includes('activ') || s.includes('ongoing');
        }).length;
        const countries = new Set(projects.map(p => p.pais)).size;
        const funding = projects.reduce((sum, p) => sum + (p.montoTotal || 0), 0);
        const highLand = projects.filter(p => App.getLandCategory(p.landComponent) === 'Alta').length;

        document.getElementById('kpi-total').textContent = total;
        document.getElementById('kpi-active').textContent = active;
        document.getElementById('kpi-countries').textContent = countries;
        document.getElementById('kpi-funding').textContent = App.formatUSD(funding);
        document.getElementById('kpi-highland').textContent = highLand;
    },

    renderCharts(projects) {
        // Destroy existing charts
        Object.values(this.charts).forEach(c => c.destroy());
        this.charts = {};

        this.chartCountries(projects);
        this.chartStatus(projects);
        this.chartLand(projects);
        this.chartTimeline(projects);
        this.chartSectors(projects);
        this.chartCofin(projects);
    },

    // --- Projects by Country ---
    chartCountries(projects) {
        const counts = {};
        projects.forEach(p => { counts[p.pais] = (counts[p.pais] || 0) + 1; });
        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);

        this.charts.countries = new Chart(document.getElementById('chart-countries'), {
            type: 'bar',
            data: {
                labels: sorted.map(e => e[0]),
                datasets: [{
                    data: sorted.map(e => e[1]),
                    backgroundColor: '#2078B4',
                    borderRadius: 4,
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                plugins: { legend: { display: false } },
                scales: {
                    x: { beginAtZero: true, ticks: { stepSize: 1 } },
                    y: { ticks: { font: { size: 11 } } }
                }
            }
        });
    },

    // --- Projects by Status ---
    chartStatus(projects) {
        const counts = {};
        projects.forEach(p => {
            const s = p.status || 'Unknown';
            counts[s] = (counts[s] || 0) + 1;
        });
        const labels = Object.keys(counts);
        const colors = labels.map(l => {
            const s = l.toLowerCase();
            if (s.includes('active') || s.includes('activ')) return '#27AE60';
            if (s.includes('closed') || s.includes('cerrad')) return '#E74C3C';
            if (s.includes('pipeline') || s.includes('design')) return '#F39C12';
            return '#95A5A6';
        });

        this.charts.status = new Chart(document.getElementById('chart-status'), {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{
                    data: labels.map(l => counts[l]),
                    backgroundColor: colors,
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { position: 'right', labels: { font: { size: 11 } } }
                }
            }
        });
    },

    // --- Land Component Distribution ---
    chartLand(projects) {
        const cats = { 'Alta': 0, 'Media': 0, 'Baja': 0, 'Sin clasificar': 0 };
        projects.forEach(p => {
            const cat = App.getLandCategory(p.landComponent);
            cats[cat]++;
        });

        this.charts.land = new Chart(document.getElementById('chart-land'), {
            type: 'bar',
            data: {
                labels: Object.keys(cats),
                datasets: [{
                    data: Object.values(cats),
                    backgroundColor: ['#E74C3C', '#F39C12', '#2078B4', '#95A5A6'],
                    borderRadius: 4,
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, ticks: { stepSize: 1 } }
                }
            }
        });
    },

    // --- Funding Timeline ---
    chartTimeline(projects) {
        const years = {};
        projects.forEach(p => {
            if (p.anioInicio) {
                years[p.anioInicio] = (years[p.anioInicio] || 0) + 1;
            }
        });
        const sorted = Object.keys(years).sort();

        this.charts.timeline = new Chart(document.getElementById('chart-timeline'), {
            type: 'line',
            data: {
                labels: sorted,
                datasets: [{
                    label: 'Proyectos iniciados',
                    data: sorted.map(y => years[y]),
                    borderColor: '#2078B4',
                    backgroundColor: 'rgba(32,120,180,0.1)',
                    fill: true,
                    tension: 0.3,
                    pointRadius: 4,
                    pointBackgroundColor: '#2078B4',
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, ticks: { stepSize: 1 } }
                }
            }
        });
    },

    // --- Top Sectors ---
    chartSectors(projects) {
        const counts = {};
        projects.forEach(p => {
            App.parseSemicolonList(p.sector).forEach(s => {
                counts[s] = (counts[s] || 0) + 1;
            });
        });
        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 12);

        this.charts.sectors = new Chart(document.getElementById('chart-sectors'), {
            type: 'bar',
            data: {
                labels: sorted.map(e => e[0]),
                datasets: [{
                    data: sorted.map(e => e[1]),
                    backgroundColor: '#2078B4',
                    borderRadius: 4,
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                plugins: { legend: { display: false } },
                scales: {
                    x: { beginAtZero: true, ticks: { stepSize: 1 } },
                    y: { ticks: { font: { size: 11 } } }
                }
            }
        });
    },

    // --- Top Co-financiers ---
    chartCofin(projects) {
        const counts = {};
        projects.forEach(p => {
            App.parseSemicolonList(p.cofinanciadores).forEach(c => {
                // Clean up amounts in parentheses
                const clean = c.replace(/\(.*?\)/g, '').trim();
                if (clean) counts[clean] = (counts[clean] || 0) + 1;
            });
        });
        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 12);

        this.charts.cofin = new Chart(document.getElementById('chart-cofin'), {
            type: 'bar',
            data: {
                labels: sorted.map(e => e[0]),
                datasets: [{
                    data: sorted.map(e => e[1]),
                    backgroundColor: '#F39C12',
                    borderRadius: 4,
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                plugins: { legend: { display: false } },
                scales: {
                    x: { beginAtZero: true, ticks: { stepSize: 1 } },
                    y: { ticks: { font: { size: 10 } } }
                }
            }
        });
    }
};

/* ==========================================================================
   map.js — Leaflet map, markers, selection, filters
   ========================================================================== */

const MapView = {
    map: null,
    markers: [],
    connectionLines: [],
    initialized: false,

    init() {
        if (this.initialized) return;
        this.initialized = true;

        // Create map centered on Africa/South America midpoint
        this.map = L.map('map-container').setView([5, 20], 3);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors',
            maxZoom: 18
        }).addTo(this.map);

        this.populateFilters();
        this.renderMarkers(App.projects);
        this.addLegend();
        this.bindEvents();

        // Fix Leaflet sizing issue when map is initially hidden
        setTimeout(() => this.map.invalidateSize(), 200);
    },

    addLegend() {
        const legend = L.control({ position: 'bottomleft' });
        legend.onAdd = function () {
            const div = L.DomUtil.create('div', 'map-legend');
            div.style.cssText = 'background:white;padding:12px 16px;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.15);font-family:Inter,sans-serif;font-size:13px;line-height:2;';
            div.innerHTML = `
                <div style="font-weight:700;margin-bottom:4px;font-size:14px;">Componente Tierra</div>
                <div><span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:#E74C3C;vertical-align:middle;margin-right:6px;"></span> Alta - Objeto central</div>
                <div><span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:#F39C12;vertical-align:middle;margin-right:6px;"></span> Media - Componente instrumental</div>
                <div><span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:#2078B4;vertical-align:middle;margin-right:6px;"></span> Baja - Contextual</div>
                <div><span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:#95A5A6;vertical-align:middle;margin-right:6px;"></span> Sin clasificar</div>
                <div style="margin-top:6px;border-top:1px solid #eee;padding-top:6px;"><span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:#27AE60;vertical-align:middle;margin-right:6px;border:2px solid #1a8a4a;"></span> Seleccionado</div>
            `;
            return div;
        };
        legend.addTo(this.map);
    },

    // --- Filters ---
    populateFilters() {
        const projects = App.projects;

        // Countries
        const countries = [...new Set(projects.map(p => p.pais))].sort();
        const countrySelect = document.getElementById('filter-country');
        countries.forEach(c => {
            countrySelect.appendChild(new Option(c, c));
        });

        // Status
        const statuses = [...new Set(projects.map(p => p.status))].sort();
        const statusSelect = document.getElementById('filter-status');
        statuses.forEach(s => {
            statusSelect.appendChild(new Option(s, s));
        });

        // Sectors
        const sectors = new Set();
        projects.forEach(p => App.parseSemicolonList(p.sector).forEach(s => sectors.add(s)));
        const sectorSelect = document.getElementById('filter-sector');
        [...sectors].sort().forEach(s => {
            sectorSelect.appendChild(new Option(s, s));
        });

        // Land Component
        const lands = [...new Set(projects.map(p => p.landComponent).filter(Boolean))].sort();
        const landSelect = document.getElementById('filter-land');
        lands.forEach(l => {
            landSelect.appendChild(new Option(l, l));
        });

        // Year range
        const years = projects.map(p => p.anioInicio).filter(Boolean);
        if (years.length) {
            const min = Math.min(...years);
            const max = Math.max(...years) + 5;
            document.getElementById('filter-year-min').min = min;
            document.getElementById('filter-year-min').max = max;
            document.getElementById('filter-year-min').value = min;
            document.getElementById('filter-year-max').min = min;
            document.getElementById('filter-year-max').max = max;
            document.getElementById('filter-year-max').value = max;
            document.getElementById('year-display').textContent = `${min} - ${max}`;
        }
    },

    getFilteredProjects() {
        const country = document.getElementById('filter-country').value;
        const status = document.getElementById('filter-status').value;
        const sector = document.getElementById('filter-sector').value;
        const land = document.getElementById('filter-land').value;
        const yearMin = parseInt(document.getElementById('filter-year-min').value);
        const yearMax = parseInt(document.getElementById('filter-year-max').value);

        return App.projects.filter(p => {
            if (country && p.pais !== country) return false;
            if (status && p.status !== status) return false;
            if (sector && !p.sector.includes(sector)) return false;
            if (land && p.landComponent !== land) return false;
            if (p.anioInicio && (p.anioInicio < yearMin || p.anioInicio > yearMax)) return false;
            return true;
        });
    },

    // --- Markers ---
    renderMarkers(projects) {
        // Clear existing markers
        this.markers.forEach(m => this.map.removeLayer(m));
        this.markers = [];

        projects.forEach(p => {
            const isSelected = App.isSelected(p.id);
            const color = isSelected ? '#27AE60' : App.getLandColor(p.landComponent);
            const radius = isSelected ? 15 : 11;

            const marker = L.circleMarker([p.lat, p.lng], {
                radius,
                fillColor: color,
                color: isSelected ? '#1a8a4a' : '#fff',
                weight: 2,
                opacity: 1,
                fillOpacity: 0.85,
                className: isSelected ? 'selected-marker' : ''
            });

            marker.projectData = p;

            marker.bindPopup(this.createPopupContent(p), {
                maxWidth: 340,
                minWidth: 280
            });

            marker.on('click', () => {
                // Popup opens automatically
            });

            marker.addTo(this.map);
            this.markers.push(marker);
        });

        this.drawConnectionLines();
    },

    createPopupContent(p) {
        const isSelected = App.isSelected(p.id);
        const badgeClass = App.getStatusBadgeClass(p.status);
        const landCat = App.getLandCategory(p.landComponent);
        const sectors = App.parseSemicolonList(p.sector);
        const summary = p.resumen ? p.resumen.split('.').slice(0, 3).join('.') + '.' : '';
        const landDesc = p.landDescription ? p.landDescription.substring(0, 150) + (p.landDescription.length > 150 ? '...' : '') : '';
        const displayName = p.acronimo ? `${p.proyecto} (${p.acronimo})` : p.proyecto;

        return `
            <div class="popup-title">${displayName}</div>
            <div class="popup-country">${p.pais} | ${p.ifadId}</div>
            <span class="popup-badge ${badgeClass}">${p.status}</span>
            <div class="popup-detail"><strong>Periodo:</strong> ${p.anioInicio || '?'} - ${p.anioCierre || '?'}</div>
            <div class="popup-detail"><strong>Presupuesto Total:</strong> ${App.formatUSD(p.montoTotal)} | <strong>FIDA:</strong> ${App.formatUSD(p.montoFida)}</div>
            <div class="popup-sector-tags">${sectors.map(s => `<span class="sector-tag">${s}</span>`).join('')}</div>
            <div class="popup-detail"><strong>Componente Tierra:</strong> ${p.landComponent} (${landCat})</div>
            ${landDesc ? `<div class="popup-detail" style="font-size:10px;font-style:italic;">${landDesc}</div>` : ''}
            ${summary ? `<div class="popup-summary">${summary}</div>` : ''}
            <button class="popup-btn-select ${isSelected ? 'deselect' : 'select'}"
                    onclick="MapView.handleSelect('${p.id}')">
                ${isSelected ? 'Deseleccionar' : 'Seleccionar'}
            </button>
        `;
    },

    handleSelect(projectId) {
        const project = App.projects.find(p => p.id === projectId);
        if (!project) return;
        App.toggleSelection(project);
        this.updateMarkers();
        this.map.closePopup();
    },

    updateMarkers() {
        const filtered = this.getFilteredProjects();
        this.renderMarkers(filtered);
    },

    drawConnectionLines() {
        // Clear existing lines
        this.connectionLines.forEach(l => this.map.removeLayer(l));
        this.connectionLines = [];

        if (App.selectedProjects.length < 2) return;

        // Draw dashed lines between selected projects
        for (let i = 0; i < App.selectedProjects.length; i++) {
            for (let j = i + 1; j < App.selectedProjects.length; j++) {
                const a = App.selectedProjects[i];
                const b = App.selectedProjects[j];
                const line = L.polyline(
                    [[a.lat, a.lng], [b.lat, b.lng]],
                    { color: '#2078B4', weight: 2, dashArray: '8 6', opacity: 0.6 }
                );
                line.addTo(this.map);
                this.connectionLines.push(line);
            }
        }
    },

    // --- Events ---
    bindEvents() {
        document.getElementById('btn-apply-filters').addEventListener('click', () => {
            this.updateMarkers();
        });

        document.getElementById('btn-reset-filters').addEventListener('click', () => {
            document.getElementById('filter-country').value = '';
            document.getElementById('filter-status').value = '';
            document.getElementById('filter-sector').value = '';
            document.getElementById('filter-land').value = '';
            const minInput = document.getElementById('filter-year-min');
            const maxInput = document.getElementById('filter-year-max');
            minInput.value = minInput.min;
            maxInput.value = maxInput.max;
            document.getElementById('year-display').textContent = `${minInput.min} - ${maxInput.max}`;
            this.updateMarkers();
        });

        document.getElementById('filter-year-min').addEventListener('input', (e) => {
            const max = document.getElementById('filter-year-max').value;
            document.getElementById('year-display').textContent = `${e.target.value} - ${max}`;
        });

        document.getElementById('filter-year-max').addEventListener('input', (e) => {
            const min = document.getElementById('filter-year-min').value;
            document.getElementById('year-display').textContent = `${min} - ${e.target.value}`;
        });

        document.getElementById('btn-refresh-data').addEventListener('click', async () => {
            await App.loadProjects();
            this.updateMarkers();
        });

        document.getElementById('btn-clear-selection').addEventListener('click', () => {
            App.clearSelection();
        });

        document.getElementById('btn-analyze').addEventListener('click', () => {
            if (typeof Analysis !== 'undefined') {
                Analysis.run(App.selectedProjects);
            }
        });
    }
};

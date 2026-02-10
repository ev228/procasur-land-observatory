/* ==========================================================================
   network.js — D3.js force-directed network graph
   ========================================================================== */

const NetworkView = {
    simulation: null,
    networkData: null,
    svg: null,

    async generate() {
        const graphEl = document.getElementById('network-graph');
        const detailEl = document.getElementById('network-detail');

        // Show loading state
        graphEl.innerHTML = `
            <div class="loading">
                <div class="spinner"></div>
                <div class="loading-text">Generando analisis de red con IA... Esto puede tomar 30-60 segundos.</div>
            </div>
        `;

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 180000); // 3 min timeout
            const res = await fetch('/api/network', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projects: App.projects }),
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Error en el analisis de red');
            }

            const data = await res.json();
            this.networkData = data;
            this.renderGraph(data);
            this.renderClusters(data.clusters);

            document.getElementById('network-legend').style.display = 'flex';

            // Show cross-cutting findings in detail panel
            if (data.crossCuttingFindings) {
                detailEl.innerHTML = `
                    <h3>Hallazgos Transversales</h3>
                    ${data.crossCuttingFindings.map(f => `
                        <div class="detail-section">
                            <div class="detail-value">${f}</div>
                        </div>
                    `).join('')}
                    ${data.clusters ? `
                        <h3 style="margin-top:20px;">Clusters Identificados</h3>
                        ${data.clusters.map(c => `
                            <div class="detail-section">
                                <div class="detail-label">${c.name}</div>
                                <div class="connection-item">
                                    ${c.description || ''}<br>
                                    <strong>Learning Route:</strong> ${c.learningRoutePotential || '-'}
                                    ${c.proposedRoute ? `<br><span style="color:#2078B4;font-weight:600;">${c.proposedRoute}</span>` : ''}
                                </div>
                            </div>
                        `).join('')}
                    ` : ''}
                `;
            }
        } catch (err) {
            graphEl.innerHTML = `
                <div class="empty-state">
                    <h3>Error</h3>
                    <p>${err.message}</p>
                </div>
            `;
        }
    },

    renderGraph(data) {
        const graphEl = document.getElementById('network-graph');
        graphEl.innerHTML = '';

        const width = graphEl.clientWidth;
        const height = graphEl.clientHeight || 700;

        const svg = d3.select(graphEl)
            .append('svg')
            .attr('width', width)
            .attr('height', height);

        this.svg = svg;

        // Zoom behaviour
        const g = svg.append('g');
        svg.call(d3.zoom()
            .scaleExtent([0.3, 4])
            .on('zoom', (event) => g.attr('transform', event.transform))
        );

        // Tooltip
        const tooltip = d3.select('body').append('div')
            .attr('class', 'd3-tooltip')
            .style('display', 'none');

        // Edge colour map
        const edgeColours = {
            thematic: '#2078B4',
            geographic: '#27AE60',
            methodological: '#F39C12',
            temporal: '#8E44AD',
            institutional: '#E74C3C'
        };

        // Prepare data — validate edges reference existing nodes
        const nodeIds = new Set(data.nodes.map(n => n.id));
        const validEdges = (data.edges || []).filter(e =>
            nodeIds.has(typeof e.source === 'object' ? e.source.id : e.source) &&
            nodeIds.has(typeof e.target === 'object' ? e.target.id : e.target)
        );

        // Create simulation
        const simulation = d3.forceSimulation(data.nodes)
            .force('link', d3.forceLink(validEdges).id(d => d.id).distance(d => 200 - (d.strength || 5) * 15))
            .force('charge', d3.forceManyBody().strength(-300))
            .force('center', d3.forceCenter(width / 2, height / 2))
            .force('collision', d3.forceCollide().radius(d => nodeRadius(d) + 5));

        this.simulation = simulation;

        function nodeRadius(d) {
            return 8 + (d.landIntensityScore || 3) * 3;
        }

        function nodeColour(d) {
            const score = d.landIntensityScore || 3;
            if (score >= 8) return '#E74C3C';
            if (score >= 4) return '#F39C12';
            return '#2078B4';
        }

        // Edges
        const link = g.append('g')
            .selectAll('line')
            .data(validEdges)
            .join('line')
            .attr('stroke', d => edgeColours[d.type] || '#999')
            .attr('stroke-width', d => 0.5 + (d.strength || 5) * 0.4)
            .attr('stroke-dasharray', d => {
                const s = d.strength || 5;
                if (s >= 7) return null;  // solid
                if (s >= 4) return '6 4'; // dashed
                return '3 3';             // dotted
            })
            .attr('stroke-opacity', 0.6);

        // Nodes
        const node = g.append('g')
            .selectAll('circle')
            .data(data.nodes)
            .join('circle')
            .attr('r', d => nodeRadius(d))
            .attr('fill', d => nodeColour(d))
            .attr('stroke', '#fff')
            .attr('stroke-width', 2)
            .style('cursor', 'pointer')
            .call(d3.drag()
                .on('start', (event, d) => {
                    if (!event.active) simulation.alphaTarget(0.3).restart();
                    d.fx = d.x;
                    d.fy = d.y;
                })
                .on('drag', (event, d) => {
                    d.fx = event.x;
                    d.fy = event.y;
                })
                .on('end', (event, d) => {
                    if (!event.active) simulation.alphaTarget(0);
                    d.fx = null;
                    d.fy = null;
                })
            );

        // Labels
        const label = g.append('g')
            .selectAll('text')
            .data(data.nodes)
            .join('text')
            .text(d => d.label || d.id)
            .attr('font-size', 10)
            .attr('font-family', 'Inter, sans-serif')
            .attr('font-weight', 600)
            .attr('text-anchor', 'middle')
            .attr('dy', d => nodeRadius(d) + 14)
            .attr('fill', '#1a1a1a')
            .style('pointer-events', 'none');

        // Hover
        node.on('mouseover', (event, d) => {
            tooltip
                .style('display', 'block')
                .html(`
                    <div class="tt-title">${d.label || d.id}</div>
                    <div class="tt-country">${d.country}</div>
                    <div class="tt-score">Land Intensity: ${d.landIntensityScore}/10 (${d.landClassification})</div>
                `)
                .style('left', (event.pageX + 15) + 'px')
                .style('top', (event.pageY - 10) + 'px');
        })
        .on('mousemove', (event) => {
            tooltip
                .style('left', (event.pageX + 15) + 'px')
                .style('top', (event.pageY - 10) + 'px');
        })
        .on('mouseout', () => {
            tooltip.style('display', 'none');
        });

        // Click — show detail panel
        node.on('click', (event, d) => {
            this.showNodeDetail(d, data);
        });

        // Tick
        simulation.on('tick', () => {
            link
                .attr('x1', d => d.source.x)
                .attr('y1', d => d.source.y)
                .attr('x2', d => d.target.x)
                .attr('y2', d => d.target.y);

            node
                .attr('cx', d => d.x)
                .attr('cy', d => d.y);

            label
                .attr('x', d => d.x)
                .attr('y', d => d.y);
        });
    },

    showNodeDetail(nodeData, fullData) {
        const detailEl = document.getElementById('network-detail');

        // Find connections for this node
        const connections = (fullData.edges || []).filter(e => {
            const srcId = typeof e.source === 'object' ? e.source.id : e.source;
            const tgtId = typeof e.target === 'object' ? e.target.id : e.target;
            return srcId === nodeData.id || tgtId === nodeData.id;
        });

        // Find clusters containing this node
        const clusters = (fullData.clusters || []).filter(c =>
            c.projects && c.projects.includes(nodeData.id)
        );

        detailEl.innerHTML = `
            <h3>${nodeData.label || nodeData.id}</h3>

            <div class="detail-section">
                <div class="detail-label">Pais</div>
                <div class="detail-value">${nodeData.country}</div>
            </div>

            <div class="detail-section">
                <div class="detail-label">Intensidad Tierra</div>
                <div class="detail-value" style="font-size:18px;font-weight:700;color:${nodeData.landIntensityScore >= 8 ? '#E74C3C' : nodeData.landIntensityScore >= 4 ? '#F39C12' : '#2078B4'}">
                    ${nodeData.landIntensityScore}/10 (${nodeData.landClassification})
                </div>
            </div>

            <div class="detail-section">
                <div class="detail-label">Justificacion</div>
                <div class="detail-value" style="font-size:12px;">${nodeData.justification || '-'}</div>
            </div>

            <div class="detail-section">
                <div class="detail-label">Estado</div>
                <div class="detail-value">${nodeData.status || '-'}</div>
            </div>

            <div class="detail-section">
                <div class="detail-label">Sector</div>
                <div class="detail-value">${nodeData.sector || '-'}</div>
            </div>

            <div class="detail-section">
                <div class="detail-label">Conexiones (${connections.length})</div>
                ${connections.length > 0 ? connections.map(c => {
                    const srcId = typeof c.source === 'object' ? c.source.id : c.source;
                    const tgtId = typeof c.target === 'object' ? c.target.id : c.target;
                    const otherId = srcId === nodeData.id ? tgtId : srcId;
                    const otherNode = fullData.nodes.find(n => n.id === otherId);
                    const otherLabel = otherNode ? (otherNode.label || otherNode.id) : otherId;
                    return `
                        <div class="connection-item">
                            <span class="connection-type type-${c.type}">${c.type}</span>
                            <strong>${otherLabel}</strong> (${c.strength}/10)
                            <br><span style="font-size:11px;color:#6B7280;">${c.description || ''}</span>
                        </div>
                    `;
                }).join('') : '<div style="color:#6B7280;font-size:12px;">Sin conexiones directas</div>'}
            </div>

            ${clusters.length > 0 ? `
                <div class="detail-section">
                    <div class="detail-label">Clusters</div>
                    ${clusters.map(c => `
                        <div class="connection-item">
                            <strong>${c.name}</strong><br>
                            <span style="font-size:11px;color:#6B7280;">${c.description || ''}</span>
                            ${c.learningRoutePotential ? `<br><span style="font-weight:600;">Learning Route: ${c.learningRoutePotential}</span>` : ''}
                            ${c.proposedRoute ? `<br><span style="font-size:11px;color:#2078B4;">${c.proposedRoute}</span>` : ''}
                        </div>
                    `).join('')}
                </div>
            ` : ''}
        `;
    },

    renderClusters(clusters) {
        if (!clusters || clusters.length === 0) return;

        const bar = document.getElementById('network-clusters-bar');
        bar.style.display = 'flex';

        const colors = ['#2078B4', '#27AE60', '#F39C12', '#8E44AD', '#E74C3C', '#3498DB', '#E67E22', '#1ABC9C'];
        bar.innerHTML = clusters.map((c, i) => `
            <span class="cluster-badge" style="background:${colors[i % colors.length]}22;color:${colors[i % colors.length]};border:1px solid ${colors[i % colors.length]}44;"
                  data-cluster-idx="${i}">
                ${c.name} (${c.projects ? c.projects.length : 0})
            </span>
        `).join('');

        // Click to highlight cluster nodes
        bar.querySelectorAll('.cluster-badge').forEach(badge => {
            badge.addEventListener('click', () => {
                const idx = parseInt(badge.dataset.clusterIdx);
                const cluster = clusters[idx];
                if (!cluster || !cluster.projects) return;

                // Highlight matching nodes in SVG
                const ids = new Set(cluster.projects);
                if (this.svg) {
                    this.svg.selectAll('circle')
                        .attr('stroke', d => ids.has(d.id) ? '#1a1a1a' : '#fff')
                        .attr('stroke-width', d => ids.has(d.id) ? 3 : 2)
                        .attr('opacity', d => ids.has(d.id) ? 1 : 0.3);

                    this.svg.selectAll('line')
                        .attr('opacity', d => {
                            const srcId = typeof d.source === 'object' ? d.source.id : d.source;
                            const tgtId = typeof d.target === 'object' ? d.target.id : d.target;
                            return ids.has(srcId) && ids.has(tgtId) ? 0.8 : 0.1;
                        });

                    this.svg.selectAll('text')
                        .attr('opacity', d => ids.has(d.id) ? 1 : 0.2);
                }

                // Show cluster detail
                const detailEl = document.getElementById('network-detail');
                detailEl.innerHTML = `
                    <h3>${cluster.name}</h3>
                    <div class="detail-section">
                        <div class="detail-label">Descripcion</div>
                        <div class="detail-value">${cluster.description || '-'}</div>
                    </div>
                    <div class="detail-section">
                        <div class="detail-label">Learning Route</div>
                        <div class="detail-value" style="font-weight:600;color:${cluster.learningRoutePotential === 'HIGH' ? '#27AE60' : cluster.learningRoutePotential === 'MEDIUM' ? '#F39C12' : '#E74C3C'};">
                            ${cluster.learningRoutePotential || '-'}
                        </div>
                        ${cluster.learningRouteDescription ? `<div class="detail-value" style="margin-top:6px;font-size:12px;">${cluster.learningRouteDescription}</div>` : ''}
                        ${cluster.proposedRoute ? `<div class="detail-value" style="margin-top:6px;font-weight:600;color:#2078B4;">${cluster.proposedRoute}</div>` : ''}
                    </div>
                    <div class="detail-section">
                        <div class="detail-label">Proyectos (${cluster.projects.length})</div>
                        ${cluster.projects.map(pid => {
                            const node = this.networkData.nodes.find(n => n.id === pid);
                            return `<div class="connection-item">${node ? `${node.label} (${node.country})` : pid}</div>`;
                        }).join('')}
                    </div>
                    <button class="btn btn-secondary btn-small" style="margin-top:12px;" onclick="NetworkView.resetHighlight()">Mostrar todos</button>
                `;
            });
        });
    },

    resetHighlight() {
        if (!this.svg) return;
        this.svg.selectAll('circle').attr('stroke', '#fff').attr('stroke-width', 2).attr('opacity', 1);
        this.svg.selectAll('line').attr('opacity', 0.6);
        this.svg.selectAll('text').attr('opacity', 1);
    }
};

// Event bindings
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-generate-network').addEventListener('click', () => {
        NetworkView.generate();
    });

    document.getElementById('network-filter-land').addEventListener('change', (e) => {
        if (!NetworkView.svg || !NetworkView.networkData) return;
        const val = e.target.value;
        if (!val) {
            NetworkView.resetHighlight();
            return;
        }
        // Match by classification text OR by score range
        function matchesFilter(d) {
            const cls = (d.landClassification || '').toLowerCase();
            const score = d.landIntensityScore || 0;
            if (val === 'Alta') return cls.includes('alta') || cls.includes('high') || score >= 8;
            if (val === 'Media') return cls.includes('media') || cls.includes('med') || (score >= 4 && score <= 7);
            if (val === 'Baja') return cls.includes('baja') || cls.includes('low') || score <= 3;
            return false;
        }
        NetworkView.svg.selectAll('circle')
            .attr('opacity', d => matchesFilter(d) ? 1 : 0.12);
        NetworkView.svg.selectAll('text')
            .attr('opacity', d => matchesFilter(d) ? 1 : 0.08);
        NetworkView.svg.selectAll('line')
            .attr('opacity', d => {
                const src = typeof d.source === 'object' ? d.source : NetworkView.networkData.nodes.find(n => n.id === d.source);
                const tgt = typeof d.target === 'object' ? d.target : NetworkView.networkData.nodes.find(n => n.id === d.target);
                return (src && matchesFilter(src)) && (tgt && matchesFilter(tgt)) ? 0.6 : 0.05;
            });
    });
});

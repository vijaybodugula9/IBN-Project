/**
 * IBN Campus LAN - Main Application Logic
 * Handles UI interactions, API calls, and real-time updates
 */

class IBNApp {
    constructor() {
        this.apiBaseUrl = 'http://localhost:5000/api';
        this.token = localStorage.getItem('ibn_token');
        this.currentUser = localStorage.getItem('ibn_user');
        this.charts = {};
        
        this.init();
    }
    
    init() {
        // Check if already logged in
        if (this.token) {
            this.showDashboard();
            this.loadDashboardData();
        } else {
            this.showLogin();
        }
        
        this.attachEventListeners();
    }
    
    // ========== SCREEN MANAGEMENT ==========
    
    showLogin() {
        document.getElementById('loginScreen').classList.add('active');
        document.getElementById('dashboardScreen').classList.remove('active');
    }
    
    showDashboard() {
        console.log('[IBN] Switching to dashboard...');
        document.getElementById('loginScreen').classList.remove('active');
        document.getElementById('dashboardScreen').classList.add('active');
        if (this.currentUser) {
            document.getElementById('currentUser').textContent = this.currentUser;
        }
        console.log('[IBN] Dashboard shown for user:', this.currentUser);
    }
    
    // ========== EVENT LISTENERS ==========
    
    attachEventListeners() {
        // Login form
        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });
        
        // Logout button
        document.getElementById('logoutBtn').addEventListener('click', () => {
            this.handleLogout();
        });
        
        // Sidebar menu navigation
        document.querySelectorAll('.menu-item').forEach(item => {
            item.addEventListener('click', () => {
                this.switchTab(item.dataset.tab);
            });
        });
        
        // Intent submission
        document.getElementById('submitIntentBtn').addEventListener('click', () => {
            this.submitIntent();
        });
        
        // Example chips
        document.querySelectorAll('.example-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                document.getElementById('intentInput').value = chip.dataset.intent;
            });
        });
        
        // Initialize intent dropdown
        this.initializeIntentDropdown();
    }
    
    initializeIntentDropdown() {
        const intentSection = document.querySelector('.intent-input-box');
        if (!intentSection) return;
        
        // Common intent templates organized by category
        const intentTemplates = {
            'Access Control': [
                'Block social media for students',
                'Allow teachers to access server VLAN',
                'Deny guest WiFi access to internal servers',
                'Block YouTube for student VLAN',
                'Allow VoIP traffic priority'
            ],
            'QoS & Bandwidth': [
                'Prioritize VoIP traffic',
                'Limit bandwidth for guest WiFi',
                'Enable guest WiFi with bandwidth limit',
                'Apply Gold QoS policy to servers',
                'Prioritize video traffic'
            ],
            'VLAN Management': [
                'Create VLAN 100 name SALES',
                'Create student VLAN',
                'Create teacher VLAN',
                'Configure admin VLAN',
                'Setup guest VLAN'
            ],
            'Network Config': [
                'Configure port as trunk',
                'Set access port to VLAN 10',
                'Enable MPLS on core routers',
                'Configure RSVP for QoS',
                'Setup VPN tunnel'
            ],
            'Security': [
                'Apply security policy to admin network',
                'Enable DLP on file servers',
                'Enforce SSL/TLS on all traffic',
                'Configure WPA3 on access points',
                'Setup intrusion detection'
            ]
        };
        
        // Create dropdown container
        const dropdownContainer = document.createElement('div');
        dropdownContainer.style.marginBottom = '15px';
        dropdownContainer.style.display = 'flex';
        dropdownContainer.style.gap = '10px';
        dropdownContainer.style.alignItems = 'center';
        
        // Create label
        const label = document.createElement('label');
        label.textContent = 'Quick Templates:';
        label.style.fontWeight = 'bold';
        label.style.color = '#b8c5d6';
        
        // Create dropdown select
        const select = document.createElement('select');
        select.id = 'intentTemplateSelect';
        select.style.flex = '1';
        select.style.padding = '10px 15px';
        select.style.backgroundColor = 'rgba(102, 126, 234, 0.1)';
        select.style.color = '#fff';
        select.style.border = '2px solid #667eea';
        select.style.borderRadius = '8px';
        select.style.fontFamily = 'inherit';
        select.style.fontSize = '14px';
        select.style.cursor = 'pointer';
        
        // Add default option
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = '📝 Select an intent template...';
        defaultOption.disabled = true;
        defaultOption.selected = true;
        select.appendChild(defaultOption);
        
        // Add grouped options
        Object.entries(intentTemplates).forEach(([category, intents]) => {
            const optgroup = document.createElement('optgroup');
            optgroup.label = category;
            
            intents.forEach(intent => {
                const option = document.createElement('option');
                option.value = intent;
                option.textContent = intent;
                optgroup.appendChild(option);
            });
            
            select.appendChild(optgroup);
        });
        
        // Add change event listener
        select.addEventListener('change', (e) => {
            if (e.target.value) {
                document.getElementById('intentInput').value = e.target.value;
                document.getElementById('intentInput').focus();
                e.target.value = ''; // Reset dropdown after selection
            }
        });
        
        // Insert before the textarea
        const textarea = intentSection.querySelector('textarea');
        if (textarea) {
            dropdownContainer.appendChild(label);
            dropdownContainer.appendChild(select);
            textarea.parentNode.insertBefore(dropdownContainer, textarea);
        }
    }
    
    switchTab(tabName) {
        // Update menu items
        document.querySelectorAll('.menu-item').forEach(item => {
            item.classList.remove('active');
        });
        event.currentTarget.classList.add('active');
        
        // Update content tabs
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });
        document.getElementById(`${tabName}Tab`).classList.add('active');
        
        // Load tab-specific data
        this.loadTabData(tabName);
    }
    
    loadTabData(tabName) {
        switch(tabName) {
            case 'intent':
                this.loadIntentHistory();
                break;
            case 'topology':
                this.loadNetworkTopology();
                break;
            case 'policies':
                this.loadPolicies();
                break;
            case 'monitoring':
                this.loadMonitoring();
                this.startMetricsUpdate();
                break;
            case 'compliance':
                this.loadCompliance();
                break;
            case 'vlans':
                this.loadVLANs();
                break;
            case 'changes':
                this.loadChanges();
                break;
            case 'diagnostics':
                this.loadDiagnostics();
                break;
        }
    }
    
    // ========== AUTHENTICATION ==========
    
    async handleLogin() {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        
        // Validate input
        if (!username || !password) {
            this.showToast('Please enter username and password', 'error');
            return;
        }
        
        console.log('[IBN] Attempting login with username:', username);
        
        try {
            const response = await fetch(`${this.apiBaseUrl}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            
            console.log('[IBN] Login response status:', response.status);
            
            const data = await response.json();
            console.log('[IBN] Login response data:', data);
            
            if (response.ok && data.success) {
                this.token = data.token;
                this.currentUser = data.username;
                localStorage.setItem('ibn_token', data.token);
                localStorage.setItem('ibn_user', data.username);
                
                // Clear form
                document.getElementById('loginForm').reset();
                
                console.log('[IBN] Login successful! Token:', this.token.substring(0, 20) + '...');
                this.showToast('Login successful!', 'success');
                this.showDashboard();
                this.loadDashboardData();
            } else {
                this.showToast(data.message || 'Login failed. Check credentials.', 'error');
                console.warn('Login failed:', data);
            }
        } catch (error) {
            this.showToast('Connection error. Is the server running on http://localhost:5000?', 'error');
            console.error('Login error:', error);
        }
    }
    
    handleLogout() {
        this.token = null;
        this.currentUser = null;
        localStorage.removeItem('ibn_token');
        localStorage.removeItem('ibn_user');
        this.showLogin();
        this.showToast('Logged out successfully', 'info');
    }
    
    // ========== INTENT SUBMISSION ==========
    
    async submitIntent() {
        const intentText = document.getElementById('intentInput').value.trim();
        
        if (!intentText) {
            this.showToast('Please enter an intent', 'error');
            return;
        }
        
        // Show processing animation
        document.getElementById('intentProcessing').style.display = 'block';
        
        try {
            const response = await fetch(`${this.apiBaseUrl}/intent/submit`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ intent: intentText })
            });
            
            const data = await response.json();
            
            if (data.success) {
                // Update processing steps
                document.getElementById('parsedDetails').textContent = 
                    `Action: ${data.parsed.action}, Subject: ${data.parsed.subject}, Target: ${data.parsed.target}`;
                document.getElementById('yangDetails').textContent = 
                    `ACL: ${data.config.acl.acl_name}, VLAN: ${data.parsed.vlan_id}`;
                document.getElementById('deployDetails').textContent = 
                    `Configuration deployed successfully to network devices`;
                
                setTimeout(() => {
                    this.showToast('Intent deployed successfully!', 'success');
                    document.getElementById('intentInput').value = '';
                    document.getElementById('intentProcessing').style.display = 'none';
                    this.loadIntentHistory();
                }, 2000);
            } else {
                this.showToast(data.message || 'Failed to deploy intent', 'error');
                document.getElementById('intentProcessing').style.display = 'none';
            }
        } catch (error) {
            this.showToast('Error deploying intent', 'error');
            document.getElementById('intentProcessing').style.display = 'none';
            console.error('Intent submission error:', error);
        }
    }
    
    // ========== INTENT HISTORY ==========
    
    async loadIntentHistory() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/intent/history`);
            const data = await response.json();
            
            if (response.ok && data.success) {
                this.renderIntentHistory(data.data);
            } else {
                console.warn('Failed to load intent history:', data);
                this.renderIntentHistory([]);
            }
        } catch (error) {
            console.error('Error loading intent history:', error);
            this.renderIntentHistory([]);
        }
    }
    
    renderIntentHistory(intents) {
        const container = document.getElementById('intentHistory');
        
        if (intents.length === 0) {
            container.innerHTML = '<p style="color: var(--text-secondary);">No intents deployed yet. Try submitting one above!</p>';
            return;
        }
        
        container.innerHTML = intents.reverse().map(intent => `
            <div class="history-card">
                <div class="history-header">
                    <span class="history-id">#${intent.id}</span>
                    <span class="status-badge deployed">${intent.status}</span>
                </div>
                <div class="history-intent">${intent.intent}</div>
                <div class="history-details">
                    <span class="detail-chip"><i class="fas fa-bolt"></i> ${intent.parsed.action}</span>
                    <span class="detail-chip"><i class="fas fa-users"></i> ${intent.parsed.subject}</span>
                    <span class="detail-chip"><i class="fas fa-bullseye"></i> ${intent.parsed.target}</span>
                    ${intent.parsed.vlan_id ? `<span class="detail-chip"><i class="fas fa-network-wired"></i> VLAN ${intent.parsed.vlan_id}</span>` : ''}
                </div>
            </div>
        `).join('');
    }
    
    // ========== NETWORK TOPOLOGY ==========
    
    async loadNetworkTopology() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/network/topology`);
            const data = await response.json();
            
            if (response.ok && data.success) {
                this.renderTopology(data.nodes, data.links);
            } else {
                console.warn('Failed to load topology:', data);
                document.getElementById('networkTopology').innerHTML = '<p style="color: var(--text-secondary); padding: 20px;">Failed to load network topology</p>';
            }
        } catch (error) {
            console.error('Error loading topology:', error);
            document.getElementById('networkTopology').innerHTML = '<p style="color: var(--text-secondary); padding: 20px;">Error loading network topology</p>';
        }
    }
    
    renderTopology(nodes, links) {
        const container = document.getElementById('networkTopology');
        container.innerHTML = '';
        
        const width = container.clientWidth;
        const height = 600;
        
        const svg = d3.select('#networkTopology')
            .append('svg')
            .attr('width', width)
            .attr('height', height);
        
        // Create force simulation
        const simulation = d3.forceSimulation(nodes)
            .force('link', d3.forceLink(links).id(d => d.id).distance(150))
            .force('charge', d3.forceManyBody().strength(-500))
            .force('center', d3.forceCenter(width / 2, height / 2));
        
        // Draw links
        const link = svg.append('g')
            .selectAll('line')
            .data(links)
            .enter().append('line')
            .attr('stroke', 'url(#linkGradient)')
            .attr('stroke-width', 2);
        
        // Add gradient for links
        const defs = svg.append('defs');
        const gradient = defs.append('linearGradient')
            .attr('id', 'linkGradient');
        gradient.append('stop')
            .attr('offset', '0%')
            .attr('stop-color', '#667eea');
        gradient.append('stop')
            .attr('offset', '100%')
            .attr('stop-color', '#764ba2');
        
        // Draw nodes
        const node = svg.append('g')
            .selectAll('g')
            .data(nodes)
            .enter().append('g')
            .call(d3.drag()
                .on('start', dragstarted)
                .on('drag', dragged)
                .on('end', dragended));
        
        // Node circles
        node.append('circle')
            .attr('r', 25)
            .attr('fill', d => d.type === 'router' ? 'url(#nodeGradient1)' : 'url(#nodeGradient2)')
            .attr('stroke', 'rgba(255, 255, 255, 0.3)')
            .attr('stroke-width', 2);
        
        // Node gradients
        const nodeGrad1 = defs.append('linearGradient').attr('id', 'nodeGradient1');
        nodeGrad1.append('stop').attr('offset', '0%').attr('stop-color', '#667eea');
        nodeGrad1.append('stop').attr('offset', '100%').attr('stop-color', '#764ba2');
        
        const nodeGrad2 = defs.append('linearGradient').attr('id', 'nodeGradient2');
        nodeGrad2.append('stop').attr('offset', '0%').attr('stop-color', '#00ff88');
        nodeGrad2.append('stop').attr('offset', '100%').attr('stop-color', '#00d4ff');
        
        // Node labels
        node.append('text')
            .attr('dy', 40)
            .attr('text-anchor', 'middle')
            .attr('fill', '#fff')
            .attr('font-size', '12px')
            .text(d => d.name);
        
        // Update positions
        simulation.on('tick', () => {
            link
                .attr('x1', d => d.source.x)
                .attr('y1', d => d.source.y)
                .attr('x2', d => d.target.x)
                .attr('y2', d => d.target.y);
            
            node.attr('transform', d => `translate(${d.x},${d.y})`);
        });
        
        function dragstarted(event, d) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
        }
        
        function dragged(event, d) {
            d.fx = event.x;
            d.fy = event.y;
        }
        
        function dragended(event, d) {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
        }
    }
    
    // ========== POLICIES ==========
    
    async loadPolicies() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/policies/summary`);
            const data = await response.json();
            
            if (response.ok && data.success) {
                this.renderPoliciesSummary(data.summary);
            } else {
                console.warn('Failed to load policies:', data);
                document.getElementById('policiesGrid').innerHTML = '<p style="color: var(--text-secondary);">Failed to load policies</p>';
            }
        } catch (error) {
            console.error('Error loading policies:', error);
            document.getElementById('policiesGrid').innerHTML = '<p style="color: var(--text-secondary);">Error loading policies</p>';
        }
    }
    
    renderPoliciesSummary(policies) {
        const container = document.getElementById('policiesGrid');
        
        if (policies.length === 0) {
            container.innerHTML = '<p style="color: var(--text-secondary);">No policies deployed yet.</p>';
            return;
        }
        
        container.innerHTML = policies.map(policy => {
            const categoryIcon = this.getCategoryIcon(policy.category);
            return `
                <div class="policy-card glass-card">
                    <div class="policy-header">
                        <div class="policy-icon"><i class="fas ${categoryIcon}"></i></div>
                        <div class="policy-title">
                            <h4>${policy.category.replace(/_/g, ' ')}</h4>
                            <p>Intent-Based Policy</p>
                        </div>
                    </div>
                    <div class="policy-details">
                        <div class="policy-row">
                            <span>Policies Deployed:</span>
                            <strong>${policy.policies_deployed}</strong>
                        </div>
                        <div class="policy-row">
                            <span>Affected Devices:</span>
                            <strong>${policy.affected_devices}</strong>
                        </div>
                        <div class="policy-row">
                            <span>Last Update:</span>
                            <strong>${new Date(policy.recent_deployment).toLocaleString()}</strong>
                        </div>
                    </div>
                    <div class="policy-footer">
                        <span class="policy-status"><i class="fas fa-circle" style="color: #00ff88;"></i> Active</span>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    getCategoryIcon(category) {
        const icons = {
            'L1_Physical': 'fa-ethernet',
            'L2_VLANs': 'fa-layer-group',
            'L2_STP': 'fa-sitemap',
            'L2_MAC': 'fa-tag',
            'L3_Routing': 'fa-route',
            'L3_IP': 'fa-network-wired',
            'L3_ACL': 'fa-shield-alt',
            'L4_Transport': 'fa-send',
            'L5_Application': 'fa-cube',
            'QoS': 'fa-tachometer-alt',
            'MPLS': 'fa-project-diagram',
            'VPLS': 'fa-globe',
            'AccessPoints': 'fa-wifi',
            'WLC': 'fa-broadcast-tower',
            'WAN': 'fa-globe-europe',
            'StudentPCs': 'fa-graduation-cap',
            'TeachersAdmins': 'fa-user-tie',
            'Guest': 'fa-user-friends',
            'Servers': 'fa-server',
            'Security': 'fa-lock',
            'Monitoring': 'fa-chart-line',
            'Compliance': 'fa-check-circle',
            'CoreSwitches': 'fa-sitemap',
            'DistributionSwitches': 'fa-project-diagram',
            'AccessSwitches': 'fa-share-alt',
            'Routers': 'fa-arrow-right'
        };
        return icons[category] || 'fa-cog';
    }
    
    // ========== MONITORING ==========
    
    async loadMonitoring() {
        this.renderMonitoringDashboard();
        this.updateMonitoringData();
    }
    
    renderMonitoringDashboard() {
        const container = document.getElementById('monitoringTab');
        if (!container) return;
        
        container.innerHTML = `
            <div class="section-header">
                <h2><i class="fas fa-chart-line"></i> Network Monitoring Dashboard</h2>
                <p>Real-time network performance metrics and device health status</p>
            </div>

            <!-- KPI Summary Cards (Compact) -->
            <div class="monitoring-kpi-grid">
                <div class="kpi-card glass-card">
                    <div class="kpi-label">Total Bandwidth</div>
                    <div class="kpi-value" id="monKpiBandwidth">0 Mbps</div>
                    <div class="kpi-spark" id="sparkBandwidth" style="height: 30px;"></div>
                </div>
                <div class="kpi-card glass-card">
                    <div class="kpi-label">Active Flows</div>
                    <div class="kpi-value" id="monKpiFlows">0</div>
                    <div class="kpi-status-badge green">↑ Active</div>
                </div>
                <div class="kpi-card glass-card">
                    <div class="kpi-label">Packet Loss</div>
                    <div class="kpi-value" id="monKpiLoss">0%</div>
                    <div class="kpi-spark" id="sparkLoss" style="height: 30px;"></div>
                </div>
                <div class="kpi-card glass-card">
                    <div class="kpi-label">Avg Latency</div>
                    <div class="kpi-value" id="monKpiLatency">0 ms</div>
                    <div class="kpi-status-badge green">Optimal</div>
                </div>
            </div>

            <!-- Expandable Sections -->
            <div class="monitoring-sections">
                <!-- Device Health -->
                <div class="monitoring-section glass-card">
                    <div class="section-header-compact" onclick="this.parentElement.classList.toggle('collapsed')">
                        <h3><i class="fas fa-server"></i> Device Health Status</h3>
                        <span class="expand-icon">▼</span>
                    </div>
                    <div class="section-content">
                        <div id="deviceHealthGrid" class="device-health-grid"></div>
                    </div>
                </div>

                <!-- Link Utilization -->
                <div class="monitoring-section glass-card">
                    <div class="section-header-compact" onclick="this.parentElement.classList.toggle('collapsed')">
                        <h3><i class="fas fa-share-alt"></i> Top Link Utilization</h3>
                        <span class="expand-icon">▼</span>
                    </div>
                    <div class="section-content">
                        <div id="linkUtilizationTable" class="link-table"></div>
                    </div>
                </div>

                <!-- Traffic Breakdown -->
                <div class="monitoring-section glass-card">
                    <div class="section-header-compact" onclick="this.parentElement.classList.toggle('collapsed')">
                        <h3><i class="fas fa-project-diagram"></i> Traffic Breakdown by Protocol</h3>
                        <span class="expand-icon">▼</span>
                    </div>
                    <div class="section-content">
                        <canvas id="trafficChart" style="max-height: 250px;"></canvas>
                    </div>
                </div>

                <!-- Top Talkers -->
                <div class="monitoring-section glass-card">
                    <div class="section-header-compact" onclick="this.parentElement.classList.toggle('collapsed')">
                        <h3><i class="fas fa-arrow-up"></i> Top Talkers (Source IPs)</h3>
                        <span class="expand-icon">▼</span>
                    </div>
                    <div class="section-content">
                        <div id="topTalkersTable" class="talkers-table"></div>
                    </div>
                </div>

                <!-- Real-time Alerts -->
                <div class="monitoring-section glass-card">
                    <div class="section-header-compact" onclick="this.parentElement.classList.toggle('collapsed')">
                        <h3><i class="fas fa-exclamation-triangle"></i> Active Alerts & Warnings</h3>
                        <span class="expand-icon">▼</span>
                    </div>
                    <div class="section-content">
                        <div id="alertsPanel" class="alerts-list"></div>
                    </div>
                </div>
            </div>

            <!-- Monitoring Settings -->
            <div class="monitoring-settings glass-card" style="margin-top: 20px;">
                <label><input type="checkbox" id="autoRefreshToggle" checked> Auto-refresh every 3 seconds</label>
                <button onclick="window.ibnApp.forceMonitoringRefresh()" class="btn-primary" style="margin-left: 10px;">
                    <i class="fas fa-sync-alt"></i> Refresh Now
                </button>
            </div>

            <style>
                .monitoring-kpi-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 15px;
                    margin-bottom: 20px;
                }
                .kpi-card {
                    padding: 15px;
                    text-align: center;
                }
                .kpi-label {
                    font-size: 12px;
                    color: #b8c5d6;
                    text-transform: uppercase;
                    margin-bottom: 5px;
                }
                .kpi-value {
                    font-size: 24px;
                    font-weight: bold;
                    color: #00ff88;
                    margin-bottom: 8px;
                }
                .kpi-status-badge {
                    display: inline-block;
                    padding: 4px 10px;
                    border-radius: 4px;
                    font-size: 11px;
                    font-weight: bold;
                }
                .kpi-status-badge.green {
                    background: rgba(0, 255, 136, 0.2);
                    color: #00ff88;
                }
                .kpi-status-badge.red {
                    background: rgba(255, 107, 107, 0.2);
                    color: #ff6b6b;
                }
                .monitoring-sections {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
                    gap: 15px;
                }
                .monitoring-section {
                    padding: 0;
                    overflow: hidden;
                }
                .monitoring-section.collapsed .section-content {
                    display: none;
                }
                .section-header-compact {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 15px;
                    cursor: pointer;
                    user-select: none;
                    border-bottom: 1px solid rgba(255,255,255,0.1);
                }
                .section-header-compact h3 {
                    margin: 0;
                    font-size: 14px;
                }
                .expand-icon {
                    transition: transform 0.3s ease;
                }
                .monitoring-section.collapsed .expand-icon {
                    transform: rotate(-90deg);
                }
                .section-content {
                    padding: 15px;
                    max-height: 400px;
                    overflow-y: auto;
                }
                .device-health-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 10px;
                    font-size: 12px;
                }
                .device-health-item {
                    padding: 10px;
                    background: rgba(102,126,234,0.1);
                    border-radius: 6px;
                    border-left: 3px solid #00ff88;
                }
                .device-health-item.warning { border-left-color: #ffd89b; }
                .device-health-item.error { border-left-color: #ff6b6b; }
                .device-name { font-weight: bold; color: #fff; }
                .device-metric { color: #b8c5d6; margin-top: 3px; }
                .link-table, .talkers-table, .alerts-list {
                    font-size: 12px;
                }
                .link-row, .talker-row, .alert-row {
                    display: grid;
                    grid-template-columns: 2fr 1fr 1fr;
                    gap: 10px;
                    padding: 8px;
                    border-bottom: 1px solid rgba(255,255,255,0.05);
                    align-items: center;
                }
                .alert-row {
                    grid-template-columns: 20px 1fr auto;
                    padding: 10px;
                    border-left: 3px solid;
                    margin-bottom: 5px;
                    border-radius: 4px;
                }
                .alert-row.warning { border-left-color: #ffd89b; background: rgba(255,216,155,0.1); }
                .alert-row.error { border-left-color: #ff6b6b; background: rgba(255,107,107,0.1); }
                .alert-row.info { border-left-color: #667eea; background: rgba(102,126,234,0.1); }
                .progress-bar {
                    height: 6px;
                    background: rgba(255,255,255,0.1);
                    border-radius: 3px;
                    overflow: hidden;
                }
                .progress-fill {
                    height: 100%;
                    background: linear-gradient(90deg, #667eea, #764ba2);
                    width: 0%;
                }
                .monitoring-settings {
                    padding: 15px;
                }
                .monitoring-settings label {
                    margin-right: 20px;
                }
            </style>
        `;
    }
    
    async updateMonitoringData() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/metrics/realtime`);
            const data = await response.json();
            
            if (response.ok && data.success) {
                this.renderMonitoringMetrics(data.data);
            }
        } catch (error) {
            console.error('Error updating monitoring data:', error);
        }
    }
    
    renderMonitoringMetrics(metrics) {
        // Update KPI cards
        document.getElementById('monKpiBandwidth').textContent = metrics.total_bandwidth + ' Mbps';
        document.getElementById('monKpiFlows').textContent = metrics.active_flows.toLocaleString();
        document.getElementById('monKpiLoss').textContent = metrics.packet_loss + '%';
        document.getElementById('monKpiLatency').textContent = metrics.avg_latency + ' ms';
        
        // Update device health
        this.renderDeviceHealth(metrics.device_status);
        
        // Update link utilization
        this.renderLinkUtilization(metrics.link_utilization);
        
        // Update traffic breakdown
        this.renderTrafficChart(metrics.traffic_breakdown);
        
        // Update top talkers
        this.renderTopTalkers(metrics.top_talkers);
        
        // Update alerts
        this.renderAlerts(metrics.alerts);
    }
    
    renderDeviceHealth(devices) {
        const container = document.getElementById('deviceHealthGrid');
        if (!container) return;
        
        container.innerHTML = devices.map(device => {
            const status = device.cpu > 80 ? 'error' : device.cpu > 60 ? 'warning' : '';
            return `
                <div class="device-health-item ${status}">
                    <div class="device-name">${device.name}</div>
                    <div class="device-metric">CPU: ${device.cpu}% | Mem: ${device.memory}%</div>
                    <div class="device-metric">Status: ${device.status === 'active' ? '✓ Up' : '✗ Down'}</div>
                </div>
            `;
        }).join('');
    }
    
    renderLinkUtilization(links) {
        const container = document.getElementById('linkUtilizationTable');
        if (!container) return;
        
        container.innerHTML = links.map(link => {
            const statusColor = link.utilization > 80 ? '#ff6b6b' : link.utilization > 60 ? '#ffd89b' : '#00ff88';
            return `
                <div class="link-row">
                    <div>${link.source} → ${link.target}</div>
                    <div style="text-align: center;">${link.utilization}%</div>
                    <div style="flex: 1;">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${link.utilization}%; background: ${statusColor};"></div>
                        </div>
                    </div>
                </div>
            `;
        }).slice(0, 5).join('');
    }
    
    renderTrafficChart(trafficData) {
        const ctx = document.getElementById('trafficChart');
        if (!ctx) return;
        
        // Destroy existing chart if any
        if (this.charts.traffic) this.charts.traffic.destroy();
        
        this.charts.traffic = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(trafficData),
                datasets: [{
                    data: Object.values(trafficData),
                    backgroundColor: ['#667eea', '#764ba2', '#f093fb', '#00ff88', '#ffd89b'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: '#b8c5d6', padding: 10, font: { size: 11 } }
                    }
                }
            }
        });
    }
    
    renderTopTalkers(talkers) {
        const container = document.getElementById('topTalkersTable');
        if (!container) return;
        
        container.innerHTML = talkers.slice(0, 5).map(talker => `
            <div class="talker-row">
                <div>${talker.source_ip}</div>
                <div style="text-align: center;">${talker.packets.toLocaleString()}</div>
                <div style="text-align: right; color: #00ff88;">${talker.bytes_mb} MB</div>
            </div>
        `).join('');
    }
    
    renderAlerts(alerts) {
        const container = document.getElementById('alertsPanel');
        if (!container) return;
        
        if (!alerts || alerts.length === 0) {
            container.innerHTML = '<div style="color: #00ff88; padding: 20px; text-align: center;"><i class="fas fa-check-circle"></i> All systems operating normally</div>';
            return;
        }
        
        container.innerHTML = alerts.map(alert => `
            <div class="alert-row ${alert.severity}">
                <div><i class="fas fa-${alert.severity === 'error' ? 'exclamation-circle' : 'info-circle'}"></i></div>
                <div>
                    <strong>${alert.title}</strong>
                    <div style="color: #b8c5d6; font-size: 11px;">${alert.message}</div>
                </div>
                <div style="font-size: 10px; color: #b8c5d6;">${new Date(alert.timestamp).toLocaleTimeString()}</div>
            </div>
        `).join('');
    }
    
    forceMonitoringRefresh() {
        this.updateMonitoringData();
        document.querySelectorAll('.kpi-value').forEach(el => {
            el.style.animation = 'pulse 0.5s ease';
        });
    }
    
    startMetricsUpdate() {
        if (this.metricsInterval) clearInterval(this.metricsInterval);
        this.metricsInterval = setInterval(() => {
            if (document.getElementById('autoRefreshToggle')?.checked) {
                this.updateMonitoringData();
            }
        }, 3000);
    }
    
    // ========== COMPLIANCE ==========
    
    async loadCompliance() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/compliance/by-intent`);
            const data = await response.json();
            
            if (response.ok && data.success) {
                this.renderComplianceByIntent(data);
            } else {
                console.warn('Failed to load compliance:', data);
                document.getElementById('complianceScore').textContent = '--';
                document.getElementById('totalPolicies').textContent = '0';
                document.getElementById('compliantPolicies').textContent = '0';
                document.getElementById('violations').textContent = '0';
            }
        } catch (error) {
            console.error('Error loading compliance:', error);
            document.getElementById('complianceScore').textContent = '--';
        }
    }
    
    renderComplianceByIntent(compliance) {
        // Update overall compliance score
        document.getElementById('complianceScore').textContent = Math.round(compliance.overall_compliance_rate);
        document.getElementById('totalPolicies').textContent = compliance.total_intents_deployed;
        document.getElementById('compliantPolicies').textContent = compliance.total_intents_deployed;
        document.getElementById('violations').textContent = '0';
        document.getElementById('lastCheck').textContent = new Date().toLocaleString();
        
        // Animate circle
        const circle = document.getElementById('complianceCircle');
        const circumference = 2 * Math.PI * 80;
        const offset = circumference - (compliance.overall_compliance_rate / 100) * circumference;
        circle.style.strokeDashoffset = offset;
        
        // Display compliance by category
        const categoryCompliance = compliance.compliance_by_category;
        if (categoryCompliance && categoryCompliance.length > 0) {
            this.displayCategoryCompliance(categoryCompliance);
        }
    }
    
    displayCategoryCompliance(categories) {
        const container = document.getElementById('complianceDetails') || 
                         document.createElement('div');
        container.id = 'complianceDetails';
        container.className = 'compliance-details-list glass-card';
        
        if (document.getElementById('complianceDetails') === null) {
            const complianceTab = document.getElementById('complianceTab');
            if (complianceTab) {
                const existingDetails = complianceTab.querySelector('.compliance-details');
                if (existingDetails) {
                    existingDetails.parentNode.insertBefore(container, existingDetails.nextSibling);
                }
            }
        }
        
        container.innerHTML = '<div><h3 style="margin-bottom: 20px;">Compliance by Intent Category</h3>' + 
            categories.map(cat => `<div class="compliance-category-card">
                    <div class="category-header">
                        <h4>${cat.category.replace(/_/g, ' ')}</h4>
                        <span class="compliance-badge" style="background: ${cat.violations === 0 ? 'rgba(0, 255, 136, 0.2)' : 'rgba(255, 107, 107, 0.2)'}; color: ${cat.violations === 0 ? '#00ff88' : '#ff6b6b'};">
                            ${cat.violations === 0 ? 'Compliant' : 'Violations'}
                        </span>
                    </div>
                    <div class="category-stats">
                        <div class="stat-mini">
                            <span>Intents:</span>
                            <strong>${cat.total}</strong>
                        </div>
                        <div class="stat-mini">
                            <span>Compliant:</span>
                            <strong style="color: #00ff88;">${cat.compliant}</strong>
                        </div>
                        <div class="stat-mini">
                            <span>Rate:</span>
                            <strong>${Math.round((cat.compliant / cat.total) * 100)}%</strong>
                        </div>
                    </div>
                </div>`).join('') + '</div>';
    }
    
    // ========== VLANs ==========
    
    async loadVLANs() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/network/vlans`);
            const data = await response.json();
            
            if (response.ok && data.success) {
                this.renderVLANs(data.data);
            } else {
                console.warn('Failed to load VLANs:', data);
                document.getElementById('vlansGrid').innerHTML = '<p style="color: var(--text-secondary); padding: 20px;">Failed to load VLANs</p>';
            }
        } catch (error) {
            console.error('Error loading VLANs:', error);
            document.getElementById('vlansGrid').innerHTML = '<p style="color: var(--text-secondary); padding: 20px;">Error loading VLANs</p>';
        }
    }
    
    renderVLANs(vlans) {
        const container = document.getElementById('vlansGrid');
        
        container.innerHTML = vlans.map(vlan => `
            <div class="vlan-card">
                <div class="vlan-header">
                    <div class="vlan-id">VLAN ${vlan.id}</div>
                    <div class="vlan-name">${vlan.name}</div>
                </div>
                <div class="vlan-info">
                    <div class="vlan-info-row">
                        <span>Subnet:</span>
                        <strong>${vlan.subnet}</strong>
                    </div>
                    <div class="vlan-info-row">
                        <span>Connected Devices:</span>
                        <strong>${vlan.devices}</strong>
                    </div>
                </div>
            </div>
        `).join('');
    }
    
    // ========== REAL-TIME CONFIGURATION CHANGES ==========
    
    loadChanges() {
        if (!window.changesPanel) {
            window.changesPanel = new ChangesPanel();
        }
        window.changesPanel.initialize();
    }
    
    // ========== NETWORK DIAGNOSTICS ==========
    
    loadDiagnostics() {
        const container = document.getElementById('diagnosticsContainer');
        if (!container) return;
        
        container.innerHTML = `
            <div class="diagnostics-grid">
                <!-- Ping Tool -->
                <div class="diagnostic-card glass-card">
                    <h3><i class="fas fa-heart-pulse"></i> Ping Host</h3>
                    <p style="color: #b8c5d6; font-size: 12px;">Check host availability and response time</p>
                    <div style="margin-top: 15px;">
                        <input type="text" id="pingTarget" placeholder="Enter IP or hostname (e.g., 10.0.0.254)" 
                               style="width: 100%; padding: 10px; background: rgba(102,126,234,0.1); border: 1px solid #667eea; border-radius: 6px; color: #fff; margin-bottom: 10px;">
                        <button onclick="window.ibnApp.performPing()" class="btn-primary" style="width: 100%;">
                            <i class="fas fa-heart-pulse"></i> Ping
                        </button>
                    </div>
                    <div id="pingResults" style="margin-top: 15px; font-size: 12px;"></div>
                </div>

                <!-- ARP Lookup -->
                <div class="diagnostic-card glass-card">
                    <h3><i class="fas fa-magnifying-glass"></i> ARP Lookup</h3>
                    <p style="color: #b8c5d6; font-size: 12px;">Find hostname and MAC from IP address</p>
                    <div style="margin-top: 15px;">
                        <input type="text" id="arpTarget" placeholder="Enter IP address (e.g., 10.0.1.5)" 
                               style="width: 100%; padding: 10px; background: rgba(102,126,234,0.1); border: 1px solid #667eea; border-radius: 6px; color: #fff; margin-bottom: 10px;">
                        <button onclick="window.ibnApp.performArpLookup()" class="btn-primary" style="width: 100%;">
                            <i class="fas fa-magnifying-glass"></i> Lookup
                        </button>
                    </div>
                    <div id="arpResults" style="margin-top: 15px; font-size: 12px;"></div>
                </div>

                <!-- Network Scan -->
                <div class="diagnostic-card glass-card">
                    <h3><i class="fas fa-network-wired"></i> Network Scan</h3>
                    <p style="color: #b8c5d6; font-size: 12px;">Scan network for active hosts</p>
                    <div style="margin-top: 15px;">
                        <button onclick="window.ibnApp.scanNetwork()" class="btn-primary" style="width: 100%;">
                            <i class="fas fa-broadcast-tower"></i> Start Scan
                        </button>
                    </div>
                    <div id="scanResults" style="margin-top: 15px; font-size: 12px; max-height: 300px; overflow-y: auto;"></div>
                </div>

                <!-- LLDP Neighbors -->
                <div class="diagnostic-card glass-card">
                    <h3><i class="fas fa-project-diagram"></i> LLDP Neighbors</h3>
                    <p style="color: #b8c5d6; font-size: 12px;">Discover connected devices (Link Layer Discovery Protocol)</p>
                    <div style="margin-top: 15px;">
                        <input type="text" id="lldpDevice" placeholder="Device name or leave empty (e.g., core-switch-01)" 
                               style="width: 100%; padding: 10px; background: rgba(102,126,234,0.1); border: 1px solid #667eea; border-radius: 6px; color: #fff; margin-bottom: 10px;">
                        <button onclick="window.ibnApp.discoverLLDPNeighbors()" class="btn-primary" style="width: 100%;">
                            <i class="fas fa-project-diagram"></i> Discover Neighbors
                        </button>
                    </div>
                    <div id="lldpResults" style="margin-top: 15px; font-size: 12px; max-height: 400px; overflow-y: auto;"></div>
                </div>
            </div>

            <style>
                .diagnostics-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
                    gap: 20px;
                }
                .diagnostic-card {
                    padding: 20px;
                }
                .diagnostic-card h3 {
                    margin: 0 0 10px 0;
                    font-size: 16px;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .result-box {
                    background: rgba(0, 255, 136, 0.1);
                    border-left: 3px solid #00ff88;
                    padding: 10px;
                    border-radius: 4px;
                    margin-top: 10px;
                }
                .result-box.error {
                    background: rgba(255, 107, 107, 0.1);
                    border-left-color: #ff6b6b;
                }
                .result-box.warning {
                    background: rgba(255, 216, 155, 0.1);
                    border-left-color: #ffd89b;
                }
                .result-item {
                    display: grid;
                    grid-template-columns: 120px 1fr;
                    gap: 10px;
                    padding: 8px;
                    border-bottom: 1px solid rgba(255,255,255,0.05);
                }
                .result-label {
                    font-weight: bold;
                    color: #667eea;
                }
                .result-value {
                    color: #b8c5d6;
                    word-break: break-all;
                }
                .loading-spinner {
                    display: inline-block;
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            </style>
        `;
    }
    
    async performPing() {
        const target = document.getElementById('pingTarget').value.trim();
        if (!target) {
            this.showToast('Please enter a target IP or hostname', 'error');
            return;
        }
        
        const resultsDiv = document.getElementById('pingResults');
        resultsDiv.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner"></i></div> Pinging...';
        
        try {
            const response = await fetch(`${this.apiBaseUrl}/diagnostics/ping`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ target })
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                const className = data.reachable ? '' : 'error';
                resultsDiv.innerHTML = `
                    <div class="result-box ${className}">
                        <div class="result-item">
                            <div class="result-label">Status:</div>
                            <div class="result-value">${data.reachable ? '✓ Reachable' : '✗ Unreachable'}</div>
                        </div>
                        ${data.response_time_ms ? `
                        <div class="result-item">
                            <div class="result-label">Response:</div>
                            <div class="result-value">${data.response_time_ms.toFixed(2)} ms</div>
                        </div>
                        ` : ''}
                        <div class="result-item">
                            <div class="result-label">Timestamp:</div>
                            <div class="result-value">${new Date(data.timestamp).toLocaleString()}</div>
                        </div>
                    </div>
                `;
                this.showToast(`Ping ${data.reachable ? 'successful' : 'failed'} for ${target}`, data.reachable ? 'success' : 'error');
            } else {
                resultsDiv.innerHTML = `<div class="result-box error"><strong>Error:</strong> ${data.message}</div>`;
            }
        } catch (error) {
            resultsDiv.innerHTML = `<div class="result-box error"><strong>Error:</strong> ${error.message}</div>`;
            this.showToast('Ping failed: ' + error.message, 'error');
        }
    }
    
    async performArpLookup() {
        const ip = document.getElementById('arpTarget').value.trim();
        if (!ip) {
            this.showToast('Please enter an IP address', 'error');
            return;
        }
        
        const resultsDiv = document.getElementById('arpResults');
        resultsDiv.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner"></i></div> Looking up...';
        
        try {
            const response = await fetch(`${this.apiBaseUrl}/diagnostics/arp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ip })
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                let html = '<div class="result-box">';
                if (data.hostname) {
                    html += `<div class="result-item">
                        <div class="result-label">Hostname:</div>
                        <div class="result-value">${data.hostname}</div>
                    </div>`;
                }
                html += `<div class="result-item">
                    <div class="result-label">IP:</div>
                    <div class="result-value">${data.ip}</div>
                </div>`;
                
                if (data.arp_entries && data.arp_entries.length > 0) {
                    data.arp_entries.forEach(entry => {
                        html += `
                            <div class="result-item">
                                <div class="result-label">MAC:</div>
                                <div class="result-value">${entry.mac || 'N/A'}</div>
                            </div>
                            <div class="result-item">
                                <div class="result-label">Type:</div>
                                <div class="result-value">${entry.type || 'unknown'}</div>
                            </div>
                        `;
                    });
                }
                html += '</div>';
                resultsDiv.innerHTML = html;
                this.showToast('ARP lookup successful', 'success');
            } else {
                resultsDiv.innerHTML = `<div class="result-box error"><strong>Error:</strong> ${data.message}</div>`;
            }
        } catch (error) {
            resultsDiv.innerHTML = `<div class="result-box error"><strong>Error:</strong> ${error.message}</div>`;
            this.showToast('ARP lookup failed', 'error');
        }
    }
    
    async scanNetwork() {
        const resultsDiv = document.getElementById('scanResults');
        resultsDiv.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner"></i></div> Scanning network...';
        
        try {
            const response = await fetch(`${this.apiBaseUrl}/diagnostics/scan-network`);
            const data = await response.json();
            
            if (response.ok && data.success) {
                if (data.active_hosts.length === 0) {
                    resultsDiv.innerHTML = '<div style="color: #b8c5d6; padding: 20px; text-align: center;">No active hosts found</div>';
                    return;
                }
                
                let html = `<div style="color: #00ff88; margin-bottom: 10px;"><strong>Found ${data.total_hosts} active hosts</strong></div>`;
                data.active_hosts.slice(0, 20).forEach((host, idx) => {
                    html += `
                        <div class="result-box" style="margin-bottom: 8px;">
                            <div class="result-item">
                                <div class="result-label">IP:</div>
                                <div class="result-value">${host.ip}</div>
                            </div>
                            <div class="result-item">
                                <div class="result-label">MAC:</div>
                                <div class="result-value">${host.mac}</div>
                            </div>
                            ${host.hostname ? `<div class="result-item">
                                <div class="result-label">Hostname:</div>
                                <div class="result-value">${host.hostname}</div>
                            </div>` : ''}
                        </div>
                    `;
                });
                
                if (data.total_hosts > 20) {
                    html += `<div style="color: #ffd89b; margin-top: 10px;">... and ${data.total_hosts - 20} more hosts</div>`;
                }
                
                resultsDiv.innerHTML = html;
                this.showToast(`Network scan complete: ${data.total_hosts} hosts found`, 'success');
            } else {
                resultsDiv.innerHTML = `<div class="result-box error"><strong>Error:</strong> ${data.message}</div>`;
            }
        } catch (error) {
            resultsDiv.innerHTML = `<div class="result-box error"><strong>Error:</strong> ${error.message}</div>`;
            this.showToast('Network scan failed', 'error');
        }
    }
    
    async discoverLLDPNeighbors() {
        const resultsDiv = document.getElementById('lldpResults');
        const deviceInput = document.getElementById('lldpDevice').value.trim();
        
        resultsDiv.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner"></i></div> Discovering neighbors...';
        
        try {
            let url = `${this.apiBaseUrl}/diagnostics/lldp`;
            let options = { method: 'GET' };
            
            // If a specific device is specified, use POST
            if (deviceInput) {
                options.method = 'POST';
                options.headers = { 'Content-Type': 'application/json' };
                options.body = JSON.stringify({ device: deviceInput });
            }
            
            const response = await fetch(url, options);
            const data = await response.json();
            
            if (response.ok && data.success) {
                // If querying specific device
                if (deviceInput) {
                    if (data.lldp_neighbors.length === 0) {
                        resultsDiv.innerHTML = `<div style="color: #b8c5d6; padding: 20px; text-align: center;">No neighbors found for ${deviceInput}</div>`;
                        return;
                    }
                    
                    let html = `<div style="color: #00ff88; margin-bottom: 15px;"><strong>✓ ${data.device}</strong> has ${data.neighbor_count} neighbor(s)</div>`;
                    data.lldp_neighbors.forEach((neighbor) => {
                        html += `
                            <div class="result-box" style="margin-bottom: 12px;">
                                <div class="result-item">
                                    <div class="result-label">Local Port:</div>
                                    <div class="result-value" style="color: #667eea; font-weight: bold;">${neighbor.local_port}</div>
                                </div>
                                <div class="result-item">
                                    <div class="result-label">↓ Connected to ↓</div>
                                    <div class="result-value"></div>
                                </div>
                                <div class="result-item">
                                    <div class="result-label">Neighbor:</div>
                                    <div class="result-value" style="color: #00ff88; font-weight: bold;">${neighbor.neighbor}</div>
                                </div>
                                <div class="result-item">
                                    <div class="result-label">Port:</div>
                                    <div class="result-value">${neighbor.neighbor_port}</div>
                                </div>
                                <div class="result-item">
                                    <div class="result-label">IP:</div>
                                    <div class="result-value">${neighbor.neighbor_ip}</div>
                                </div>
                            </div>
                        `;
                    });
                    resultsDiv.innerHTML = html;
                    this.showToast(`Found ${data.neighbor_count} LLDP neighbors for ${deviceInput}`, 'success');
                } else {
                    // Showing all LLDP links
                    if (data.lldp_neighbors.length === 0) {
                        resultsDiv.innerHTML = '<div style="color: #b8c5d6; padding: 20px; text-align: center;">No LLDP neighbors found</div>';
                        return;
                    }
                    
                    // Group by source device
                    const grouped = {};
                    data.lldp_neighbors.forEach(link => {
                        if (!grouped[link.device]) {
                            grouped[link.device] = [];
                        }
                        grouped[link.device].push(link);
                    });
                    
                    let html = `<div style="color: #00ff88; margin-bottom: 15px;"><strong>Network Topology: ${data.devices_with_neighbors} devices, ${data.total_links} links</strong></div>`;
                    
                    Object.entries(grouped).forEach(([device, neighbors]) => {
                        html += `<div style="background: rgba(102,126,234,0.1); padding: 10px; border-radius: 6px; margin-bottom: 12px;">
                            <div style="color: #667eea; font-weight: bold; margin-bottom: 8px;">📍 ${device}</div>`;
                        
                        neighbors.forEach((neighbor) => {
                            html += `
                                <div style="margin-left: 15px; padding: 8px; background: rgba(0,255,136,0.05); border-left: 2px solid #00ff88; margin-bottom: 6px;">
                                    <div style="color: #b8c5d6; font-size: 11px;">
                                        <span style="color: #667eea;">${neighbor.local_port}</span> 
                                        <span style="color: #999;">→</span> 
                                        <span style="color: #00ff88; font-weight: bold;">${neighbor.neighbor}</span> 
                                        <span style="color: #667eea;">${neighbor.neighbor_port}</span>
                                    </div>
                                </div>
                            `;
                        });
                        
                        html += `</div>`;
                    });
                    
                    resultsDiv.innerHTML = html;
                    this.showToast(`Found ${data.total_links} LLDP links across ${data.devices_with_neighbors} devices`, 'success');
                }
            } else {
                resultsDiv.innerHTML = `<div class="result-box error"><strong>Error:</strong> ${data.message}</div>`;
            }
        } catch (error) {
            resultsDiv.innerHTML = `<div class="result-box error"><strong>Error:</strong> ${error.message}</div>`;
            this.showToast('LLDP discovery failed', 'error');
        }
    }
    
    // ========== DASHBOARD DATA ==========
    
    loadDashboardData() {
        try {
            console.log('[IBN] Loading dashboard data...');
            this.loadIntentHistory();
            this.loadVLANs();
            console.log('[IBN] Dashboard data load initiated');
        } catch (error) {
            console.error('[IBN] Error loading dashboard data:', error);
            this.showToast('Some dashboard data failed to load, but the dashboard is still available', 'info');
        }
    }
    
    // ========== TOAST NOTIFICATIONS ==========
    
    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icon = type === 'success' ? 'check-circle' : 
                     type === 'error' ? 'exclamation-circle' : 
                     'info-circle';
        
        toast.innerHTML = `
            <i class="fas fa-${icon}"></i>
            <span>${message}</span>
        `;
        
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideInRight 0.3s ease reverse';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.ibnApp = new IBNApp();
    });
} else {
    window.ibnApp = new IBNApp();
}
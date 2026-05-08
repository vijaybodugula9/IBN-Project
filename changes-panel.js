/**
 * Real-Time Changes & Configuration Panel
 * Monitors all network configuration changes and node status
 */

class ChangesPanel {
    constructor() {
        this.changes = [];
        this.nodeConfigs = [];
        this.updateInterval = 2000; // Update every 2 seconds
        this.isInitialized = false;
    }

    async initialize() {
        if (this.isInitialized) return;
        this.isInitialized = true;
        console.log('🔄 Initializing Changes Panel...');
        await this.loadChangesPanel();
        this.startRealtimeUpdates();
    }

    async loadChangesPanel() {
        try {
            const response = await fetch('/api/changes/panel', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('ibn_token')}` }
            });
            const result = await response.json();
            
            if (response.ok && result.success) {
                this.renderChangesPanel(result.data);
            } else {
                console.warn('Failed to load changes panel:', result);
            }
        } catch (error) {
            console.error('❌ Failed to load changes panel:', error);
        }
    }

    async loadNodeConfigurations() {
        try {
            const response = await fetch('/api/nodes/config', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('ibn_token')}` }
            });
            const result = await response.json();
            
            if (response.ok && result.success) {
                this.renderNodeConfigurations(result.data);
            } else {
                console.warn('Failed to load node configurations:', result);
            }
        } catch (error) {
            console.error('❌ Failed to load node configurations:', error);
        }
    }

    renderChangesPanel(panelData) {
        const container = document.getElementById('changesPanelContainer');
        if (!container) return;

        const html = `
            <div class="changes-panel">
                <!-- Summary Cards -->
                <div class="changes-summary">
                    <div class="summary-card total">
                        <div class="summary-icon">📊</div>
                        <div class="summary-content">
                            <div class="summary-value">${panelData.total_changes}</div>
                            <div class="summary-label">Total Changes</div>
                        </div>
                    </div>
                    
                    <div class="summary-card deploying">
                        <div class="summary-icon">⚙️</div>
                        <div class="summary-content">
                            <div class="summary-value">${panelData.changes_by_status.deploying}</div>
                            <div class="summary-label">Deploying</div>
                        </div>
                    </div>
                    
                    <div class="summary-card deployed">
                        <div class="summary-icon">✅</div>
                        <div class="summary-content">
                            <div class="summary-value">${panelData.changes_by_status.deployed}</div>
                            <div class="summary-label">Deployed</div>
                        </div>
                    </div>
                    
                    <div class="summary-card devices">
                        <div class="summary-icon">🖥️</div>
                        <div class="summary-content">
                            <div class="summary-value">${panelData.affected_devices}</div>
                            <div class="summary-label">Affected Devices</div>
                        </div>
                    </div>
                </div>

                <!-- Changes by Type Chart -->
                <div class="changes-grid">
                    <div class="changes-type-chart glass-card">
                        <h3>Changes by Type</h3>
                        <div class="type-bars">
                            ${this.renderTypeChart(panelData.changes_by_type)}
                        </div>
                    </div>

                    <!-- Recent Changes Timeline -->
                    <div class="recent-changes glass-card">
                        <h3>Recent Changes (Live)</h3>
                        <div class="changes-timeline">
                            ${this.renderChangesTimeline(panelData.recent_changes)}
                        </div>
                    </div>
                </div>

                <!-- Device Configuration Status -->
                <div class="device-config-status glass-card">
                    <h3>Configuration Status by Device</h3>
                    <div class="device-status-grid" id="deviceStatusGrid">
                        <div class="loading">Loading device configurations...</div>
                    </div>
                </div>
            </div>
        `;

        container.innerHTML = html;
        this.loadNodeConfigurations();
    }

    renderTypeChart(typeData) {
        const maxCount = Math.max(...Object.values(typeData), 1);
        return Object.entries(typeData).map(([type, count]) => {
            const percentage = (count / maxCount) * 100;
            const colors = {
                'vlan': '#667eea',
                'qos': '#f093fb',
                'mpls': '#00ff88',
                'vpls': '#ffd89b',
                'access_point': '#ff6b6b',
                'general': '#45b7d1'
            };
            const color = colors[type] || '#667eea';

            return `
                <div class="type-bar-item">
                    <div class="type-label">${type.toUpperCase()}</div>
                    <div class="type-bar-background">
                        <div class="type-bar-fill" style="width: ${percentage}%; background: ${color}; box-shadow: 0 0 10px ${color}60;"></div>
                    </div>
                    <div class="type-count">${count}</div>
                </div>
            `;
        }).join('');
    }

    renderChangesTimeline(changes) {
        if (!changes || changes.length === 0) {
            return '<div class="no-changes">No changes yet</div>';
        }

        return changes.map(change => {
            const time = new Date(change.timestamp).toLocaleTimeString();
            const statusIcon = {
                'deploying': '⚙️',
                'deployed': '✅',
                'failed': '❌'
            }[change.status] || '📋';

            const typeIcon = {
                'vlan': '🔗',
                'qos': '📊',
                'mpls': '🔀',
                'vpls': '🌐',
                'access_point': '📡',
                'general': '⚙️'
            }[change.change_type] || '📋';

            return `
                <div class="timeline-item" data-config-id="${change.config_id}">
                    <div class="timeline-time">${time}</div>
                    <div class="timeline-marker">
                        <span class="timeline-status">${statusIcon}</span>
                    </div>
                    <div class="timeline-content">
                        <div class="timeline-type">
                            <span class="type-badge">${typeIcon} ${change.change_type.toUpperCase()}</span>
                        </div>
                        <div class="timeline-description">${change.description}</div>
                        <div class="timeline-device">${change.device_id}</div>
                    </div>
                    <button class="view-details-btn" onclick="changesPanel.showConfigDetails(${change.config_id})">
                        View Details →
                    </button>
                </div>
            `;
        }).join('');
    }

    renderNodeConfigurations(data) {
        const container = document.getElementById('deviceStatusGrid');
        if (!container) return;

        const html = data.nodes.map(node => {
            const configCount = node.configs.length;
            const lastUpdate = new Date(node.last_update).toLocaleTimeString();
            
            return `
                <div class="device-status-card glass-card" onclick="changesPanel.expandNodeConfig('${node.device_id}')">
                    <div class="device-header">
                        <div class="device-name">${node.device_name}</div>
                        <div class="device-id">${node.device_id}</div>
                    </div>
                    <div class="device-stats">
                        <div class="stat">
                            <div class="stat-value">${configCount}</div>
                            <div class="stat-label">Configs</div>
                        </div>
                        <div class="stat">
                            <div class="stat-value">${node.config_status}</div>
                            <div class="stat-label">Status</div>
                        </div>
                    </div>
                    <div class="device-last-update">Updated: ${lastUpdate}</div>
                    <div class="expand-indicator">⏵</div>
                </div>
            `;
        }).join('');

        container.innerHTML = html;
    }

    async expandNodeConfig(deviceId) {
        try {
            const response = await fetch(`/api/node/${deviceId}/config`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('ibn_token')}` }
            });
            const result = await response.json();
            
            if (response.ok && result.success) {
                this.showNodeConfigModal(result.data);
            } else {
                console.warn('Failed to load node config:', result);
            }
        } catch (error) {
            console.error('❌ Failed to load node config:', error);
        }
    }

    showNodeConfigModal(nodeData) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.id = 'nodeConfigModal';

        const configsList = nodeData.configs.map(cfg => `
            <div class="config-item">
                <div class="config-type">${cfg.type.toUpperCase()}</div>
                <div class="config-description">${cfg.description}</div>
                <div class="config-time">${new Date(cfg.timestamp).toLocaleString()}</div>
                <div class="config-status">✅ Deployed</div>
            </div>
        `).join('');

        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>${nodeData.device_name} Configuration</h2>
                    <button onclick="document.getElementById('nodeConfigModal').remove()">✕</button>
                </div>
                <div class="modal-body">
                    <div class="node-info">
                        <p><strong>Device:</strong> ${nodeData.device_id}</p>
                        <p><strong>Total Configs:</strong> ${nodeData.configs.length}</p>
                        <p><strong>Last Updated:</strong> ${new Date(nodeData.last_update).toLocaleString()}</p>
                    </div>
                    <h3>Configuration History</h3>
                    <div class="configs-list">
                        ${configsList || '<p>No configurations deployed yet</p>'}
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    }

    async showConfigDetails(configId) {
        try {
            const response = await fetch(`/api/config/${configId}/details`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('ibn_token')}` }
            });
            const result = await response.json();
            
            if (response.ok && result.success) {
                this.displayConfigDetailsModal(result.data);
            } else {
                console.warn('Failed to load config details:', result);
            }
        } catch (error) {
            console.error('❌ Failed to load config details:', error);
        }
    }

    displayConfigDetailsModal(configData) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.id = 'configDetailsModal';

        const changesList = configData.changes.map(change => `
            <div class="change-detail-item">
                <div class="change-device">${change.device_id}</div>
                <div class="change-type">${change.change_type}</div>
                <div class="change-status" data-status="${change.status}">${change.status}</div>
                <div class="change-time">${new Date(change.timestamp).toLocaleString()}</div>
            </div>
        `).join('');

        const configJson = JSON.stringify(configData.config, null, 2);

        modal.innerHTML = `
            <div class="modal-content large">
                <div class="modal-header">
                    <h2>Configuration Details</h2>
                    <button onclick="document.getElementById('configDetailsModal').remove()">✕</button>
                </div>
                <div class="modal-body">
                    <div class="config-tabs">
                        <div class="tab-buttons">
                            <button class="tab-btn active" onclick="this.parentElement.parentElement.querySelector('.config-intent').style.display='block'; this.parentElement.parentElement.querySelector('.config-changes').style.display='none'; this.classList.add('active'); this.nextElementSibling.classList.remove('active');">Intent</button>
                            <button class="tab-btn" onclick="this.parentElement.parentElement.querySelector('.config-changes').style.display='block'; this.parentElement.parentElement.querySelector('.config-intent').style.display='none'; this.classList.add('active'); this.previousElementSibling.classList.remove('active');">Deployment</button>
                        </div>
                        
                        <div class="config-intent">
                            <h3>Original Intent</h3>
                            <p class="intent-text">${configData.intent}</p>
                            
                            <h3>Generated Configuration</h3>
                            <pre class="config-json">${configJson}</pre>
                        </div>
                        
                        <div class="config-changes" style="display: none;">
                            <h3>Deployment Details</h3>
                            <div class="changes-detail-list">
                                ${changesList}
                            </div>
                            <p class="affected-devices">Deployed to <strong>${configData.affected_devices}</strong> devices</p>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    }

    async startRealtimeUpdates() {
        setInterval(async () => {
            await this.loadChangesPanel();
        }, this.updateInterval);
    }

    async loadIntentTemplates() {
        try {
            const response = await fetch('/api/intents/templates', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('ibn_token')}` }
            });
            const result = await response.json();
            
            if (response.ok && result.success) {
                this.displayTemplates(result.data.templates);
            } else {
                console.warn('Failed to load templates:', result);
            }
        } catch (error) {
            console.error('❌ Failed to load templates:', error);
        }
    }

    displayTemplates(templates) {
        const container = document.getElementById('templatePanel');
        if (!container) return;

        const html = `
            <div class="templates-container">
                <h2>Intent Templates</h2>
                <div class="templates-grid">
                    ${Object.entries(templates).map(([category, intents]) => `
                        <div class="template-category glass-card">
                            <h3>${category.toUpperCase().replace(/_/g, ' ')}</h3>
                            <div class="template-list">
                                ${intents.map(intent => `
                                    <div class="template-item" onclick="document.getElementById('intentInput').value = '${intent.replace(/'/g, "\\'")}'; document.getElementById('intentInput').focus();">
                                        <span>${intent}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        container.innerHTML = html;
    }
}

// Create global instance (deferred initialization until DOM is ready)
let changesPanel;
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        changesPanel = new ChangesPanel();
    });
} else {
    changesPanel = new ChangesPanel();
}

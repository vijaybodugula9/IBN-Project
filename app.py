"""
Intent-Based Networking (IBN) Backend Server
Handles intent parsing, YANG translation, and NETCONF/RESTCONF deployment
"""

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from datetime import datetime, timedelta
import jwt
import json
import os

app = Flask(__name__, static_folder='../frontend', static_url_path='')
CORS(app)

# Configuration
SECRET_KEY = 'ibn-campus-lan-secret-key-2025'
app.config['SECRET_KEY'] = SECRET_KEY

# ============================================================================
# DATA STORES (In production, use a database)
# ============================================================================

# User authentication
USERS = {
    'admin': {'password': 'admin123', 'role': 'admin'},
    'operator': {'password': 'operator123', 'role': 'operator'},
    'viewer': {'password': 'viewer123', 'role': 'viewer'}
}

# Network topology
NETWORK_DEVICES = [
    # ── ISP Uplinks ────────────────────────────────────────────────────────────
    {
        'id': 'isp-airtel', 'name': 'Airtel ISP', 'type': 'isp',
        'ip': '203.0.113.1', 'status': 'active', 'cpu': 0, 'memory': 0,
        'layer': 'isp', 'vendor': 'Airtel', 'bandwidth': '1G',
        'description': 'Primary ISP uplink via Airtel leased line'
    },
    {
        'id': 'isp-tata', 'name': 'Tata ISP', 'type': 'isp',
        'ip': '198.51.100.1', 'status': 'active', 'cpu': 0, 'memory': 0,
        'layer': 'isp', 'vendor': 'Tata Communications', 'bandwidth': '1G',
        'description': 'Secondary ISP uplink via Tata Communications'
    },

    # ── Edge / Border Layer ────────────────────────────────────────────────────
    {
        'id': 'router-01', 'name': 'Border Router', 'type': 'router',
        'ip': '10.0.0.254', 'status': 'active', 'cpu': 55, 'memory': 75,
        'layer': 'edge', 'vendor': 'Cisco', 'model': 'ASR 1001-X',
        'description': 'Dual-homed border router with BGP to Airtel and Tata'
    },

    # ── Core Layer ─────────────────────────────────────────────────────────────
    {
        'id': 'core-sw-01', 'name': 'Core Switch 1', 'type': 'switch',
        'ip': '10.0.0.1', 'status': 'active', 'cpu': 45, 'memory': 62,
        'layer': 'core', 'vendor': 'Cisco', 'model': 'Catalyst 9500',
        'description': 'Primary core switch – VSS pair with Core SW 2'
    },
    {
        'id': 'core-sw-02', 'name': 'Core Switch 2', 'type': 'switch',
        'ip': '10.0.0.2', 'status': 'active', 'cpu': 38, 'memory': 55,
        'layer': 'core', 'vendor': 'Cisco', 'model': 'Catalyst 9500',
        'description': 'Secondary core switch – VSS pair with Core SW 1'
    },

    # ── Distribution Layer ─────────────────────────────────────────────────────
    {
        'id': 'dist-sw-01', 'name': 'Distribution Switch 1', 'type': 'switch',
        'ip': '10.0.1.1', 'status': 'active', 'cpu': 52, 'memory': 70,
        'layer': 'distribution', 'vendor': 'Cisco', 'model': 'Catalyst 9300',
        'description': 'Distribution switch – Block A (Academic)'
    },
    {
        'id': 'dist-sw-02', 'name': 'Distribution Switch 2', 'type': 'switch',
        'ip': '10.0.1.2', 'status': 'active', 'cpu': 48, 'memory': 65,
        'layer': 'distribution', 'vendor': 'Cisco', 'model': 'Catalyst 9300',
        'description': 'Distribution switch – Block B (Admin & Labs)'
    },

    # ── Wireless LAN Controllers ───────────────────────────────────────────────
    {
        'id': 'wlc-01', 'name': 'WLC Primary', 'type': 'wlc',
        'ip': '10.0.1.10', 'status': 'active', 'cpu': 40, 'memory': 58,
        'layer': 'distribution', 'vendor': 'Cisco', 'model': 'Catalyst 9800-L',
        'description': 'Primary Wireless LAN Controller – manages APs in Block A'
    },
    {
        'id': 'wlc-02', 'name': 'WLC Secondary', 'type': 'wlc',
        'ip': '10.0.1.11', 'status': 'active', 'cpu': 35, 'memory': 52,
        'layer': 'distribution', 'vendor': 'Cisco', 'model': 'Catalyst 9800-L',
        'description': 'Secondary WLC – HA standby, manages APs in Block B'
    },

    # ── Access Layer ───────────────────────────────────────────────────────────
    {
        'id': 'access-sw-01', 'name': 'Access Switch 1', 'type': 'switch',
        'ip': '10.0.2.1', 'status': 'active', 'cpu': 30, 'memory': 45,
        'layer': 'access', 'vendor': 'Cisco', 'model': 'Catalyst 9200',
        'description': 'Access switch – Floor 1, Block A (Student Labs)'
    },
    {
        'id': 'access-sw-02', 'name': 'Access Switch 2', 'type': 'switch',
        'ip': '10.0.2.2', 'status': 'active', 'cpu': 35, 'memory': 50,
        'layer': 'access', 'vendor': 'Cisco', 'model': 'Catalyst 9200',
        'description': 'Access switch – Floor 2, Block A (Classrooms)'
    },
    {
        'id': 'access-sw-03', 'name': 'Access Switch 3', 'type': 'switch',
        'ip': '10.0.2.3', 'status': 'active', 'cpu': 28, 'memory': 42,
        'layer': 'access', 'vendor': 'Cisco', 'model': 'Catalyst 9200',
        'description': 'Access switch – Block B (Admin offices)'
    },
    {
        'id': 'access-sw-04', 'name': 'Access Switch 4', 'type': 'switch',
        'ip': '10.0.2.4', 'status': 'active', 'cpu': 32, 'memory': 48,
        'layer': 'access', 'vendor': 'Cisco', 'model': 'Catalyst 9200',
        'description': 'Access switch – Server room & Data Center'
    },

    # ── Access Points ──────────────────────────────────────────────────────────
    {
        'id': 'ap-01', 'name': 'AP-Floor1-A', 'type': 'access_point',
        'ip': '10.0.2.101', 'status': 'active', 'cpu': 15, 'memory': 30,
        'layer': 'access', 'vendor': 'Cisco', 'model': 'Catalyst 9130AX',
        'ssid': ['CorpWiFi', 'GuestNet'], 'clients': 42,
        'description': 'Wi-Fi 6 AP – Floor 1, Block A'
    },
    {
        'id': 'ap-02', 'name': 'AP-Floor2-A', 'type': 'access_point',
        'ip': '10.0.2.102', 'status': 'active', 'cpu': 18, 'memory': 32,
        'layer': 'access', 'vendor': 'Cisco', 'model': 'Catalyst 9130AX',
        'ssid': ['CorpWiFi', 'GuestNet'], 'clients': 38,
        'description': 'Wi-Fi 6 AP – Floor 2, Block A'
    },
    {
        'id': 'ap-03', 'name': 'AP-BlockB-1', 'type': 'access_point',
        'ip': '10.0.2.103', 'status': 'active', 'cpu': 12, 'memory': 28,
        'layer': 'access', 'vendor': 'Cisco', 'model': 'Catalyst 9120AX',
        'ssid': ['CorpWiFi', 'TeacherNet'], 'clients': 25,
        'description': 'Wi-Fi 6 AP – Block B Admin Wing'
    },
    {
        'id': 'ap-04', 'name': 'AP-Auditorium', 'type': 'access_point',
        'ip': '10.0.2.104', 'status': 'active', 'cpu': 20, 'memory': 35,
        'layer': 'access', 'vendor': 'Cisco', 'model': 'Catalyst 9136AX',
        'ssid': ['CorpWiFi', 'GuestNet', 'EventNet'], 'clients': 110,
        'description': 'High-density Wi-Fi 6E AP – Auditorium'
    },

    # ── x86 Servers ───────────────────────────────────────────────────────────
    {
        'id': 'srv-web-01', 'name': 'Web Server', 'type': 'server',
        'ip': '10.40.0.10', 'status': 'active', 'cpu': 65, 'memory': 72,
        'layer': 'server', 'vendor': 'Dell', 'model': 'PowerEdge R750',
        'vlan': 40, 'role': 'web',
        'description': 'Campus web portal and LMS – Dell PowerEdge R750, 2×Xeon Gold'
    },
    {
        'id': 'srv-db-01', 'name': 'Database Server', 'type': 'server',
        'ip': '10.40.0.11', 'status': 'active', 'cpu': 78, 'memory': 85,
        'layer': 'server', 'vendor': 'HPE', 'model': 'ProLiant DL380 Gen10',
        'vlan': 40, 'role': 'database',
        'description': 'Oracle DB – HPE ProLiant DL380, 512 GB RAM, SSD RAID'
    },
    {
        'id': 'srv-file-01', 'name': 'File Server', 'type': 'server',
        'ip': '10.40.0.12', 'status': 'active', 'cpu': 42, 'memory': 60,
        'layer': 'server', 'vendor': 'Dell', 'model': 'PowerEdge R540',
        'vlan': 40, 'role': 'file',
        'description': 'NAS / file share – Dell PowerEdge R540, 96 TB raw storage'
    },
    {
        'id': 'srv-dns-01', 'name': 'DNS / DHCP Server', 'type': 'server',
        'ip': '10.40.0.13', 'status': 'active', 'cpu': 25, 'memory': 38,
        'layer': 'server', 'vendor': 'HP', 'model': 'ProLiant DL160 Gen9',
        'vlan': 40, 'role': 'dns_dhcp',
        'description': 'Campus DNS, DHCP, and NTP services'
    },
    {
        'id': 'srv-security-01', 'name': 'Security / SIEM Server', 'type': 'server',
        'ip': '10.40.0.14', 'status': 'active', 'cpu': 55, 'memory': 68,
        'layer': 'server', 'vendor': 'Dell', 'model': 'PowerEdge R650',
        'vlan': 40, 'role': 'security',
        'description': 'Splunk SIEM, IDS/IPS sensor aggregation'
    },

    # ── End Devices ────────────────────────────────────────────────────────────
    {
        'id': 'end-student-01', 'name': 'Student PC Cluster', 'type': 'end_device',
        'ip': '10.30.0.0/24', 'status': 'active', 'cpu': 0, 'memory': 0,
        'layer': 'end', 'vlan': 30, 'device_count': 320,
        'description': 'Student workstations and laptops (VLAN 30)'
    },
    {
        'id': 'end-teacher-01', 'name': 'Teacher Devices', 'type': 'end_device',
        'ip': '10.20.0.0/24', 'status': 'active', 'cpu': 0, 'memory': 0,
        'layer': 'end', 'vlan': 20, 'device_count': 95,
        'description': 'Faculty laptops, desktops and IP phones (VLAN 20)'
    },
    {
        'id': 'end-admin-01', 'name': 'Admin Workstations', 'type': 'end_device',
        'ip': '10.10.0.0/24', 'status': 'active', 'cpu': 0, 'memory': 0,
        'layer': 'end', 'vlan': 10, 'device_count': 25,
        'description': 'Administrative PCs and management terminals (VLAN 10)'
    },
    {
        'id': 'end-guest-01', 'name': 'Guest Devices', 'type': 'end_device',
        'ip': '10.50.0.0/24', 'status': 'active', 'cpu': 0, 'memory': 0,
        'layer': 'end', 'vlan': 50, 'device_count': 80,
        'description': 'BYOD / guest Wi-Fi devices, internet-only (VLAN 50)'
    }
]

# Network links
NETWORK_LINKS = [
    # ── ISP → Border Router ────────────────────────────────────────────────────
    {'source': 'isp-airtel',   'target': 'router-01',      'bandwidth': '1G',  'utilization': 38, 'link_type': 'wan',        'description': 'Airtel primary leased line uplink'},
    {'source': 'isp-tata',     'target': 'router-01',      'bandwidth': '1G',  'utilization': 22, 'link_type': 'wan',        'description': 'Tata secondary leased line uplink'},

    # ── Border Router → Core ───────────────────────────────────────────────────
    {'source': 'router-01',    'target': 'core-sw-01',     'bandwidth': '10G', 'utilization': 45, 'link_type': 'uplink'},
    {'source': 'router-01',    'target': 'core-sw-02',     'bandwidth': '10G', 'utilization': 42, 'link_type': 'uplink'},

    # ── Core ↔ Core (VSS inter-chassis) ───────────────────────────────────────
    {'source': 'core-sw-01',   'target': 'core-sw-02',     'bandwidth': '40G', 'utilization': 30, 'link_type': 'vss',        'description': 'VSS inter-chassis link'},

    # ── Core → Distribution ────────────────────────────────────────────────────
    {'source': 'core-sw-01',   'target': 'dist-sw-01',     'bandwidth': '10G', 'utilization': 55, 'link_type': 'uplink'},
    {'source': 'core-sw-02',   'target': 'dist-sw-01',     'bandwidth': '10G', 'utilization': 40, 'link_type': 'uplink',     'description': 'Redundant uplink'},
    {'source': 'core-sw-01',   'target': 'dist-sw-02',     'bandwidth': '10G', 'utilization': 38, 'link_type': 'uplink',     'description': 'Redundant uplink'},
    {'source': 'core-sw-02',   'target': 'dist-sw-02',     'bandwidth': '10G', 'utilization': 50, 'link_type': 'uplink'},

    # ── Distribution → WLCs ───────────────────────────────────────────────────
    {'source': 'dist-sw-01',   'target': 'wlc-01',         'bandwidth': '10G', 'utilization': 35, 'link_type': 'uplink'},
    {'source': 'dist-sw-02',   'target': 'wlc-02',         'bandwidth': '10G', 'utilization': 28, 'link_type': 'uplink'},
    {'source': 'wlc-01',       'target': 'wlc-02',         'bandwidth': '1G',  'utilization': 10, 'link_type': 'ha',         'description': 'WLC HA / SSO link'},

    # ── Distribution → Access Switches ────────────────────────────────────────
    {'source': 'dist-sw-01',   'target': 'access-sw-01',   'bandwidth': '1G',  'utilization': 60, 'link_type': 'downlink'},
    {'source': 'dist-sw-01',   'target': 'access-sw-02',   'bandwidth': '1G',  'utilization': 55, 'link_type': 'downlink'},
    {'source': 'dist-sw-02',   'target': 'access-sw-03',   'bandwidth': '1G',  'utilization': 48, 'link_type': 'downlink'},
    {'source': 'dist-sw-02',   'target': 'access-sw-04',   'bandwidth': '10G', 'utilization': 65, 'link_type': 'downlink',   'description': 'High-speed server farm uplink'},

    # ── WLC → Access Points (CAPWAP tunnels) ──────────────────────────────────
    {'source': 'wlc-01',       'target': 'ap-01',          'bandwidth': '1G',  'utilization': 42, 'link_type': 'capwap'},
    {'source': 'wlc-01',       'target': 'ap-02',          'bandwidth': '1G',  'utilization': 38, 'link_type': 'capwap'},
    {'source': 'wlc-02',       'target': 'ap-03',          'bandwidth': '1G',  'utilization': 25, 'link_type': 'capwap'},
    {'source': 'wlc-02',       'target': 'ap-04',          'bandwidth': '1G',  'utilization': 70, 'link_type': 'capwap'},

    # ── Access Switch → x86 Servers ───────────────────────────────────────────
    {'source': 'access-sw-04', 'target': 'srv-web-01',     'bandwidth': '10G', 'utilization': 62, 'link_type': 'server'},
    {'source': 'access-sw-04', 'target': 'srv-db-01',      'bandwidth': '10G', 'utilization': 75, 'link_type': 'server'},
    {'source': 'access-sw-04', 'target': 'srv-file-01',    'bandwidth': '10G', 'utilization': 40, 'link_type': 'server'},
    {'source': 'access-sw-04', 'target': 'srv-dns-01',     'bandwidth': '1G',  'utilization': 20, 'link_type': 'server'},
    {'source': 'access-sw-04', 'target': 'srv-security-01','bandwidth': '10G', 'utilization': 50, 'link_type': 'server'},

    # ── Access Switches → End Devices (wired) ─────────────────────────────────
    {'source': 'access-sw-01', 'target': 'end-student-01', 'bandwidth': '1G',  'utilization': 68, 'link_type': 'end_device'},
    {'source': 'access-sw-02', 'target': 'end-teacher-01', 'bandwidth': '1G',  'utilization': 55, 'link_type': 'end_device'},
    {'source': 'access-sw-03', 'target': 'end-admin-01',   'bandwidth': '1G',  'utilization': 30, 'link_type': 'end_device'},

    # ── APs → End Devices (wireless) ──────────────────────────────────────────
    {'source': 'ap-01',        'target': 'end-student-01', 'bandwidth': '1G',  'utilization': 72, 'link_type': 'wireless'},
    {'source': 'ap-03',        'target': 'end-teacher-01', 'bandwidth': '1G',  'utilization': 45, 'link_type': 'wireless'},
    {'source': 'ap-02',        'target': 'end-guest-01',   'bandwidth': '1G',  'utilization': 35, 'link_type': 'wireless'},
    {'source': 'ap-04',        'target': 'end-guest-01',   'bandwidth': '1G',  'utilization': 60, 'link_type': 'wireless'},
]

# Intent history
INTENT_HISTORY = []

# Deployed policies
DEPLOYED_POLICIES = []

# Configuration tracking per node
NODE_CONFIGURATIONS = {}
for device in NETWORK_DEVICES:
    NODE_CONFIGURATIONS[device['id']] = {
        'device_id': device['id'],
        'device_name': device['name'],
        'configs': [],
        'last_update': datetime.utcnow().isoformat(),
        'config_status': 'idle'
    }

# Real-time changes log
CHANGES_LOG = []

# VLANs (expanded)
VLANS = [
    {'id': 10, 'name': 'Admin', 'subnet': '10.10.0.0/24', 'devices': 25, 'status': 'active'},
    {'id': 20, 'name': 'Teachers', 'subnet': '10.20.0.0/24', 'devices': 150, 'status': 'active'},
    {'id': 30, 'name': 'Students', 'subnet': '10.30.0.0/24', 'devices': 1200, 'status': 'active'},
    {'id': 40, 'name': 'Servers', 'subnet': '10.40.0.0/24', 'devices': 15, 'status': 'active'},
    {'id': 50, 'name': 'Guest', 'subnet': '10.50.0.0/24', 'devices': 80, 'status': 'active'}
]

# QoS Policies
QOS_POLICIES = []

# MPLS Configurations
MPLS_CONFIG = {
    'enabled': False,
    'ldp_enabled': False,
    'ldp_router_id': None,
    'label_range': {'start': 16, 'end': 1048575},
    'tunnels': []
}

# VPLS Instances
VPLS_INSTANCES = []

# Access Points
ACCESS_POINTS = []

# Network Interfaces
NETWORK_INTERFACES = {}

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def generate_token(username, role):
    """Generate JWT token"""
    payload = {
        'username': username,
        'role': role,
        'exp': datetime.utcnow() + timedelta(hours=24)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm='HS256')

def verify_token(token):
    """Verify JWT token"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
        return payload
    except:
        return None

# ============================================================================
# INTENT PARSER
# ============================================================================

class IntentParser:
    """Parse natural language intents into structured policies"""
    
    KEYWORDS = {
        'actions': ['create', 'delete', 'allow', 'remove', 'convert', 'enable', 'disable', 'block', 'deny', 
                   'permit', 'prioritize', 'limit', 'configure', 'set', 'apply', 'show', 'mark', 'trust',
                   'add', 'bind', 'assign', 'shutdown', 'install'],
        'subjects': ['student', 'students', 'teacher', 'teachers', 'admin', 'admins', 'guest', 'guests',
                    'vlan', 'vlans', 'interface', 'interfaces', 'port', 'ports', 'ssid', 'site', 'dscp',
                    'bandwidth', 'queue', 'tunnel', 'label', 'ldp', 'rsvp', 'lsp', 'mpls', 'vpls'],
        'targets': ['social media', 'facebook', 'instagram', 'youtube', 'voip', 'video', 'server', 
                   'internet', 'wifi', 'network', 'eth0', 'eth1', 'eth2', 'trunk', 'access', 'voice',
                   'egress', 'ingress', 'ef', 'gold', 'policy', 'ssid', 'corpwifi', 'guest'],
        'vlans': {'student': 30, 'students': 30, 'teacher': 20, 'teachers': 20, 
                 'admin': 10, 'admins': 10, 'guest': 50, 'guests': 50, 'server': 40}
    }
    
    INTENT_CATEGORIES = {
        'vlan': ['create vlan', 'delete vlan', 'allow vlan', 'remove vlan', 'convert port', 'enable voice', 
                'set native', 'enable vlan tagging', 'disable vlan', 'show vlan'],
        'qos': ['apply qos', 'limit bandwidth', 'mark dscp', 'enable priority', 'configure shaping', 
               'apply policing', 'map cos', 'enable wred', 'trust dscp', 'remove qos'],
        'mpls': ['enable mpls', 'configure ldp', 'set ldp', 'enable mpls forwarding', 'configure label', 
                'enable mpls ttl', 'configure mpls te', 'enable rsvp', 'disable mpls', 'show mpls'],
        'vpls': ['create vpls', 'add site', 'bind interface', 'remove site', 'show vpls'],
        'access_point': ['add ssid', 'set wpa2', 'assign vlan', 'limit users', 'enable guest'],
        'general': ['configure ip', 'enable interface', 'shutdown interface', 'configure static', 
                   'remove route', 'enable snmp', 'configure syslog', 'set hostname', 'configure ntp', 'show']
    }
    
    @staticmethod
    def determine_category(intent_text):
        """Determine intent category"""
        intent_lower = intent_text.lower()
        for category, keywords in IntentParser.INTENT_CATEGORIES.items():
            for keyword in keywords:
                if keyword in intent_lower:
                    return category
        return 'general'
    
    @staticmethod
    def parse(intent_text):
        """Parse intent text and extract structured information"""
        intent_lower = intent_text.lower()
        category = IntentParser.determine_category(intent_text)
        
        # Extract action
        action = None
        for keyword in IntentParser.KEYWORDS['actions']:
            if keyword in intent_lower:
                action = keyword
                break
        
        # Extract subject
        subject = None
        vlan_id = None
        for keyword in IntentParser.KEYWORDS['subjects']:
            if keyword in intent_lower:
                subject = keyword
                vlan_id = IntentParser.KEYWORDS['vlans'].get(keyword)
                break
        
        # Extract target
        target = None
        for keyword in IntentParser.KEYWORDS['targets']:
            if keyword in intent_lower:
                target = keyword
                break
        
        return {
            'original_intent': intent_text,
            'action': action,
            'subject': subject,
            'target': target,
            'vlan_id': vlan_id,
            'category': category,
            'parsed_successfully': action is not None
        }

# ============================================================================
# POLICY TRANSLATOR
# ============================================================================

class PolicyTranslator:
    """Translate parsed intents into YANG-compatible configurations"""
    
    @staticmethod
    def generate_acl(intent_data):
        """Generate ACL configuration"""
        acl_name = f"ACL_{intent_data['action'].upper()}_{intent_data['target'].replace(' ', '_').upper() if intent_data['target'] else 'POLICY'}"
        
        acl_config = {
            'acl_name': acl_name,
            'acl_type': 'ipv4-acl',
            'rules': [
                {
                    'sequence': 10,
                    'action': 'deny' if intent_data['action'] in ['block', 'deny'] else 'permit',
                    'protocol': 'ip',
                    'source': f"10.{intent_data['vlan_id']}.0.0/24" if intent_data['vlan_id'] else 'any',
                    'destination': 'any'
                }
            ]
        }
        return acl_config
    
    @staticmethod
    def generate_vlan_config(intent_data):
        """Generate VLAN configuration"""
        import re
        vlan_match = re.search(r'\d+', intent_data['original_intent'])
        vlan_id = int(vlan_match.group()) if vlan_match else 100
        vlan_name = intent_data.get('target', f'VLAN_{vlan_id}')
        
        return {
            'type': 'vlan',
            'vlan_id': vlan_id,
            'vlan_name': vlan_name,
            'action': intent_data['action'],
            'subnet': f'10.{vlan_id}.0.0/24'
        }
    
    @staticmethod
    def generate_qos_config(intent_data):
        """Generate QoS configuration"""
        import re
        bandwidth_match = re.search(r'(\d+)\s*(mbps|gbps)', intent_data['original_intent'].lower())
        bandwidth = f"{bandwidth_match.group(1)}{bandwidth_match.group(2).upper()}" if bandwidth_match else "100Mbps"
        
        return {
            'type': 'qos',
            'policy_name': f"QOS_{intent_data['action'].upper()}",
            'bandwidth_limit': bandwidth,
            'priority': 'high' if 'prioritize' in intent_data['action'] else 'normal',
            'dscp_marking': 'EF' if 'voice' in intent_data['original_intent'].lower() else 'CS0'
        }
    
    @staticmethod
    def generate_mpls_config(intent_data):
        """Generate MPLS configuration"""
        return {
            'type': 'mpls',
            'action': intent_data['action'],
            'mpls_enabled': intent_data['action'] == 'enable',
            'ldp_enabled': 'ldp' in intent_data['original_intent'].lower(),
            'rsvp_enabled': 'rsvp' in intent_data['original_intent'].lower()
        }
    
    @staticmethod
    def generate_vpls_config(intent_data):
        """Generate VPLS configuration"""
        return {
            'type': 'vpls',
            'action': intent_data['action'],
            'instance_name': f"VPLS_INST_{intent_data['action'].upper()}"
        }
    
    @staticmethod
    def generate_ap_config(intent_data):
        """Generate Access Point configuration"""
        return {
            'type': 'access_point',
            'ssid': intent_data.get('target', 'CorpWiFi'),
            'security': 'WPA2' if 'wpa2' in intent_data['original_intent'].lower() else 'WPA3',
            'vlan_assigned': intent_data.get('vlan_id', 20)
        }
    
    @staticmethod
    def generate_interface_config(intent_data):
        """Generate Interface configuration"""
        import re
        iface_match = re.search(r'(eth|gi|fa|po)(\d+)', intent_data['original_intent'].lower())
        interface = f"{iface_match.group(1).upper()}{iface_match.group(2)}" if iface_match else "GigabitEthernet0/1"
        
        return {
            'type': 'interface',
            'interface': interface,
            'action': intent_data['action'],
            'status': 'up' if 'enable' in intent_data['action'] else 'down'
        }
    
    @staticmethod
    def generate_yang_config(intent_data):
        """Generate full YANG configuration based on category"""
        category = intent_data.get('category', 'general')
        
        config = {
            'intent_id': len(INTENT_HISTORY) + 1,
            'timestamp': datetime.utcnow().isoformat(),
            'category': category,
            'vlan_id': intent_data.get('vlan_id'),
            'target_devices': [device['id'] for device in NETWORK_DEVICES[:3]]  # Apply to first 3 devices
        }
        
        if category == 'vlan':
            config['vlan'] = PolicyTranslator.generate_vlan_config(intent_data)
        elif category == 'qos':
            config['qos'] = PolicyTranslator.generate_qos_config(intent_data)
        elif category == 'mpls':
            config['mpls'] = PolicyTranslator.generate_mpls_config(intent_data)
        elif category == 'vpls':
            config['vpls'] = PolicyTranslator.generate_vpls_config(intent_data)
        elif category == 'access_point':
            config['access_point'] = PolicyTranslator.generate_ap_config(intent_data)
        else:
            config['interface'] = PolicyTranslator.generate_interface_config(intent_data)
            config['acl'] = PolicyTranslator.generate_acl(intent_data)
        
        return config

# ============================================================================
# API ROUTES
# ============================================================================

@app.route('/')
def index():
    """Serve the main UI"""
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/api/login', methods=['POST'])
def login():
    """User authentication"""
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    
    user = USERS.get(username)
    if user and user['password'] == password:
        token = generate_token(username, user['role'])
        return jsonify({
            'success': True,
            'token': token,
            'role': user['role'],
            'username': username
        })
    
    return jsonify({'success': False, 'message': 'Invalid credentials'}), 401

@app.route('/api/intent/submit', methods=['POST'])
def submit_intent():
    """Submit and process a new intent"""
    data = request.get_json()
    intent_text = data.get('intent')
    
    if not intent_text:
        return jsonify({'success': False, 'message': 'Intent text is required'}), 400
    
    # Parse intent
    parsed = IntentParser.parse(intent_text)
    
    if not parsed['parsed_successfully']:
        return jsonify({
            'success': False,
            'message': 'Could not parse intent. Try: "Create VLAN 100 name SALES" or "Apply QoS policy GOLD"'
        }), 400
    
    # Translate to YANG config
    yang_config = PolicyTranslator.generate_yang_config(parsed)
    
    # Store intent
    intent_record = {
        'id': len(INTENT_HISTORY) + 1,
        'intent': intent_text,
        'parsed': parsed,
        'config': yang_config,
        'status': 'deployed',
        'timestamp': datetime.utcnow().isoformat()
    }
    
    INTENT_HISTORY.append(intent_record)
    DEPLOYED_POLICIES.append(yang_config)
    
    # Record changes per device
    import random
    changes = []
    for device_id in yang_config.get('target_devices', []):
        change = {
            'device_id': device_id,
            'change_type': parsed['category'],
            'description': intent_text,
            'status': 'deploying',
            'timestamp': datetime.utcnow().isoformat(),
            'config_id': intent_record['id']
        }
        changes.append(change)
        CHANGES_LOG.append(change)
        
        # Add to device configuration
        if device_id in NODE_CONFIGURATIONS:
            NODE_CONFIGURATIONS[device_id]['configs'].append({
                'config_id': intent_record['id'],
                'type': parsed['category'],
                'description': intent_text,
                'deployed': True,
                'timestamp': datetime.utcnow().isoformat()
            })
            NODE_CONFIGURATIONS[device_id]['last_update'] = datetime.utcnow().isoformat()
            NODE_CONFIGURATIONS[device_id]['config_status'] = 'applying'
    
    return jsonify({
        'success': True,
        'intent_id': intent_record['id'],
        'parsed': parsed,
        'config': yang_config,
        'changes': changes,
        'message': f'Intent deployed successfully to {len(changes)} devices!'
    })

@app.route('/api/intent/history', methods=['GET'])
def get_intent_history():
    """Get all intent history"""
    return jsonify({'success': True, 'data': INTENT_HISTORY})

@app.route('/api/network/topology', methods=['GET'])
def get_topology():
    """Get network topology"""
    # Build layer summary for the frontend
    layer_summary = {}
    for device in NETWORK_DEVICES:
        layer = device.get('layer', 'unknown')
        layer_summary[layer] = layer_summary.get(layer, 0) + 1

    # Build link-type summary
    link_type_summary = {}
    for link in NETWORK_LINKS:
        lt = link.get('link_type', 'unknown')
        link_type_summary[lt] = link_type_summary.get(lt, 0) + 1

    return jsonify({
        'success': True,
        'nodes': NETWORK_DEVICES,
        'links': NETWORK_LINKS,
        'summary': {
            'total_nodes': len(NETWORK_DEVICES),
            'total_links': len(NETWORK_LINKS),
            'by_layer': layer_summary,
            'by_link_type': link_type_summary
        }
    })

@app.route('/api/network/devices', methods=['GET'])
def get_devices():
    """Get all network devices, optionally filtered by type or layer"""
    device_type = request.args.get('type', None)
    layer = request.args.get('layer', None)

    devices = NETWORK_DEVICES
    if device_type:
        devices = [d for d in devices if d['type'] == device_type]
    if layer:
        devices = [d for d in devices if d.get('layer') == layer]

    return jsonify({'success': True, 'data': devices, 'total': len(devices)})

@app.route('/api/network/vlans', methods=['GET'])
def get_vlans():
    """Get VLAN information"""
    return jsonify({'success': True, 'data': VLANS})

@app.route('/api/policies/deployed', methods=['GET'])
def get_deployed_policies():
    """Get all deployed policies"""
    return jsonify({'success': True, 'data': DEPLOYED_POLICIES})

@app.route('/api/metrics/realtime', methods=['GET'])
def get_realtime_metrics():
    """Get real-time network metrics"""
    import random
    metrics = {
        'timestamp': datetime.utcnow().isoformat(),
        'total_bandwidth': random.randint(7500, 9500),
        'active_flows': random.randint(1500, 2500),
        'packet_loss': round(random.uniform(0.1, 0.5), 2),
        'avg_latency': random.randint(10, 30),
        'policies_active': len(DEPLOYED_POLICIES),
        'wireless_clients': sum(d.get('clients', 0) for d in NETWORK_DEVICES if d['type'] == 'access_point'),
        'isp_utilization': {
            'airtel': next((l['utilization'] for l in NETWORK_LINKS if l['source'] == 'isp-airtel'), 0),
            'tata': next((l['utilization'] for l in NETWORK_LINKS if l['source'] == 'isp-tata'), 0)
        }
    }
    return jsonify({'success': True, 'data': metrics})

@app.route('/api/compliance/check', methods=['GET'])
def compliance_check():
    """Check policy compliance"""
    compliance_data = {
        'total_policies': len(DEPLOYED_POLICIES),
        'compliant': len(DEPLOYED_POLICIES),
        'violations': 0,
        'compliance_rate': 100.0,
        'last_check': datetime.utcnow().isoformat()
    }
    return jsonify({'success': True, 'data': compliance_data})

# ============================================================================
# NEW ENDPOINTS - REAL-TIME CHANGES & NODE CONFIGURATION
# ============================================================================

@app.route('/api/changes/realtime', methods=['GET'])
def get_realtime_changes():
    """Get real-time changes log with filtering"""
    limit = request.args.get('limit', 50, type=int)
    device_id = request.args.get('device_id', None)
    
    changes = CHANGES_LOG
    if device_id:
        changes = [c for c in changes if c['device_id'] == device_id]
    
    # Sort by timestamp descending and limit
    changes = sorted(changes, key=lambda x: x['timestamp'], reverse=True)[:limit]
    
    return jsonify({
        'success': True,
        'data': changes,
        'total_changes': len(CHANGES_LOG),
        'recent_changes': len(changes)
    })

@app.route('/api/node/<device_id>/config', methods=['GET'])
def get_node_configuration(device_id):
    """Get configuration deployed on specific node"""
    if device_id not in NODE_CONFIGURATIONS:
        return jsonify({'success': False, 'message': 'Device not found'}), 404
    
    node_config = NODE_CONFIGURATIONS[device_id]
    return jsonify({
        'success': True,
        'data': node_config
    })

@app.route('/api/nodes/config', methods=['GET'])
def get_all_nodes_config():
    """Get configuration for all nodes"""
    configs = list(NODE_CONFIGURATIONS.values())
    
    # Add statistics
    total_configs = sum(len(node['configs']) for node in configs)
    avg_configs = total_configs / len(configs) if configs else 0
    
    return jsonify({
        'success': True,
        'nodes': configs,
        'statistics': {
            'total_nodes': len(configs),
            'total_configs_deployed': total_configs,
            'avg_configs_per_node': round(avg_configs, 2)
        }
    })

@app.route('/api/changes/panel', methods=['GET'])
def get_changes_panel():
    """Get complete changes panel data"""
    import random
    
    # Group changes by status
    changes_by_status = {
        'deploying': len([c for c in CHANGES_LOG if c['status'] == 'deploying']),
        'deployed': len([c for c in CHANGES_LOG if c['status'] == 'deployed']),
        'failed': len([c for c in CHANGES_LOG if c['status'] == 'failed'])
    }
    
    # Group changes by type
    changes_by_type = {}
    for change in CHANGES_LOG:
        change_type = change['change_type']
        if change_type not in changes_by_type:
            changes_by_type[change_type] = 0
        changes_by_type[change_type] += 1
    
    # Get recent changes with more details
    recent = sorted(CHANGES_LOG, key=lambda x: x['timestamp'], reverse=True)[:20]
    
    panel_data = {
        'total_changes': len(CHANGES_LOG),
        'changes_by_status': changes_by_status,
        'changes_by_type': changes_by_type,
        'recent_changes': recent,
        'active_devices': len([d for d in NETWORK_DEVICES if d['status'] == 'active']),
        'affected_devices': len(set(c['device_id'] for c in CHANGES_LOG))
    }
    
    return jsonify({
        'success': True,
        'data': panel_data
    })

@app.route('/api/config/<int:config_id>/details', methods=['GET'])
def get_config_details(config_id):
    """Get detailed configuration for a specific config ID"""
    # Find the intent with this config_id
    intent_record = next((i for i in INTENT_HISTORY if i['id'] == config_id), None)
    
    if not intent_record:
        return jsonify({'success': False, 'message': 'Configuration not found'}), 404
    
    # Get changes related to this config
    related_changes = [c for c in CHANGES_LOG if c['config_id'] == config_id]
    
    return jsonify({
        'success': True,
        'data': {
            'intent': intent_record['intent'],
            'config': intent_record['config'],
            'changes': related_changes,
            'affected_devices': len(related_changes)
        }
    })

@app.route('/api/intents/templates', methods=['GET'])
def get_intent_templates():
    """Get pre-built intent templates organized by category"""
    templates = {
        'vlan': [
            'Create VLAN 100 name SALES',
            'Delete VLAN 200',
            'Allow VLAN 300 on interface eth0',
            'Remove VLAN 400 from trunk',
            'Convert port to access VLAN 10',
            'Enable voice VLAN 20',
            'Set native VLAN 99',
            'Enable VLAN tagging',
            'Disable VLAN 50',
            'Show VLAN config'
        ],
        'qos': [
            'Apply QoS policy GOLD',
            'Limit bandwidth to 100Mbps',
            'Mark DSCP EF for voice',
            'Enable priority queue',
            'Configure shaping',
            'Apply policing',
            'Map CoS to queue',
            'Enable WRED',
            'Trust DSCP on interface',
            'Remove QoS policy'
        ],
        'mpls': [
            'Enable MPLS on interface',
            'Configure LDP',
            'Set LDP router-id',
            'Enable MPLS forwarding',
            'Configure label range',
            'Enable MPLS TTL propagation',
            'Configure MPLS TE tunnel',
            'Enable RSVP',
            'Disable MPLS',
            'Show MPLS neighbors'
        ],
        'vpls': [
            'Create VPLS instance',
            'Add site to VPLS',
            'Bind interface to VPLS',
            'Remove site from VPLS',
            'Show VPLS status'
        ],
        'access_point': [
            'Add SSID CorpWiFi',
            'Set WPA2 security',
            'Assign VLAN to SSID',
            'Limit users per AP',
            'Enable guest network'
        ],
        'general': [
            'Configure IP on interface',
            'Enable interface',
            'Shutdown interface',
            'Configure static route',
            'Remove route',
            'Enable SNMP',
            'Configure syslog',
            'Set hostname',
            'Configure NTP',
            'Show network interfaces'
        ]
    }
    
    return jsonify({
        'success': True,
        'templates': templates,
        'total_templates': sum(len(v) for v in templates.values())
    })

@app.route('/api/policies/by-category/<category>', methods=['GET'])
def get_policies_by_category(category):
    """Get policies deployed for a specific category"""
    category_policies = [p for p in DEPLOYED_POLICIES if p.get('category') == category]
    
    policy_details = []
    for policy in category_policies:
        policy_details.append({
            'id': policy.get('intent_id'),
            'category': category,
            'description': next((i['intent'] for i in INTENT_HISTORY if i['id'] == policy.get('intent_id')), 'Unknown'),
            'affected_devices': len(policy.get('target_devices', [])),
            'status': 'active',
            'timestamp': policy.get('timestamp')
        })
    
    return jsonify({
        'success': True,
        'category': category,
        'policies': policy_details,
        'total_policies': len(policy_details)
    })

@app.route('/api/compliance/by-intent', methods=['GET'])
def get_compliance_by_intent():
    """Get compliance status organized by intent category"""
    compliance_by_category = {}
    
    for intent in INTENT_HISTORY:
        category = intent.get('category', 'general')
        if category not in compliance_by_category:
            compliance_by_category[category] = {
                'category': category,
                'total': 0,
                'compliant': 0,
                'violations': 0,
                'intents': []
            }
        
        compliance_by_category[category]['total'] += 1
        compliance_by_category[category]['compliant'] += 1  # All deployed intents are compliant
        compliance_by_category[category]['intents'].append({
            'id': intent['id'],
            'intent': intent['intent'],
            'status': 'compliant',
            'timestamp': intent['timestamp']
        })
    
    # Calculate overall compliance
    total_intents = len(INTENT_HISTORY)
    total_compliant = sum(cat['compliant'] for cat in compliance_by_category.values())
    overall_compliance = (total_compliant / total_intents * 100) if total_intents > 0 else 100
    
    return jsonify({
        'success': True,
        'overall_compliance_rate': round(overall_compliance, 2),
        'total_intents_deployed': total_intents,
        'compliance_by_category': list(compliance_by_category.values())
    })

@app.route('/api/policies/summary', methods=['GET'])
def get_policies_summary():
    """Get summary of all deployed policies organized by category"""
    summary = {}
    
    for policy in DEPLOYED_POLICIES:
        category = policy.get('category', 'general')
        if category not in summary:
            summary[category] = {
                'category': category,
                'count': 0,
                'affected_devices': set(),
                'recent_deployment': None
            }
        
        summary[category]['count'] += 1
        summary[category]['affected_devices'].update(policy.get('target_devices', []))
        summary[category]['recent_deployment'] = policy.get('timestamp')
    
    # Convert sets to counts and format response
    formatted_summary = []
    for category, data in summary.items():
        formatted_summary.append({
            'category': category,
            'policies_deployed': data['count'],
            'affected_devices': len(data['affected_devices']),
            'recent_deployment': data['recent_deployment']
        })
    
    return jsonify({
        'success': True,
        'total_categories': len(formatted_summary),
        'total_policies': len(DEPLOYED_POLICIES),
        'summary': formatted_summary
    })

# ============================================================================
# NETWORK DIAGNOSTICS - PING & ARP LOOKUP
# ============================================================================

import subprocess
import platform
import re

@app.route('/api/diagnostics/ping', methods=['POST'])
def ping_host():
    """Ping a host to check availability"""
    data = request.get_json()
    target = data.get('target')
    
    if not target:
        return jsonify({'success': False, 'message': 'Target IP/hostname required'}), 400
    
    try:
        # Sanitize target to prevent injection
        if not re.match(r'^[\w\.\-]+$', target):
            return jsonify({'success': False, 'message': 'Invalid target format'}), 400
        
        # Determine ping command based on OS
        param = '-n' if platform.system().lower() == 'windows' else '-c'
        command = ['ping', param, '4', target]
        
        result = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=10)
        output = result.stdout.decode('utf-8', errors='ignore')
        
        # Check if ping was successful
        is_reachable = result.returncode == 0
        
        # Parse response time from output
        response_time = None
        if 'time=' in output:
            match = re.search(r'time[=<]\s*([\d.]+)\s*ms', output)
            if match:
                response_time = float(match.group(1))
        
        return jsonify({
            'success': True,
            'target': target,
            'reachable': is_reachable,
            'response_time_ms': response_time,
            'output': output,
            'timestamp': datetime.utcnow().isoformat()
        })
    
    except subprocess.TimeoutExpired:
        return jsonify({
            'success': True,
            'target': target,
            'reachable': False,
            'message': 'Ping timeout - host unreachable',
            'timestamp': datetime.utcnow().isoformat()
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/diagnostics/arp', methods=['POST'])
def arp_lookup():
    """Lookup hostname from IP address using ARP table"""
    data = request.get_json()
    ip_address = data.get('ip')
    
    if not ip_address:
        return jsonify({'success': False, 'message': 'IP address required'}), 400
    
    try:
        # Sanitize IP
        if not re.match(r'^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$', ip_address):
            return jsonify({'success': False, 'message': 'Invalid IP address format'}), 400
        
        arp_entries = []
        
        if platform.system().lower() == 'windows':
            # Windows ARP command
            result = subprocess.run(['arp', '-a'], stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=10)
            output = result.stdout.decode('utf-8', errors='ignore')
            
            # Parse Windows ARP output
            for line in output.split('\n'):
                if ip_address in line:
                    parts = line.split()
                    if len(parts) >= 3:
                        arp_entries.append({
                            'ip': parts[0],
                            'mac': parts[1],
                            'type': parts[2] if len(parts) > 2 else 'unknown'
                        })
        else:
            # Linux/Mac ARP command
            result = subprocess.run(['arp', '-a'], stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=10)
            output = result.stdout.decode('utf-8', errors='ignore')
            
            # Parse Linux/Mac ARP output
            for line in output.split('\n'):
                if ip_address in line or not ip_address:
                    parts = line.split()
                    if len(parts) >= 3:
                        hostname = parts[0].strip('()')
                        mac = parts[3]
                        arp_entries.append({
                            'hostname': hostname,
                            'ip': parts[1].strip('()'),
                            'mac': mac,
                            'type': parts[5] if len(parts) > 5 else 'unknown'
                        })
        
        # Try to resolve hostname via reverse DNS
        hostname = None
        try:
            import socket
            hostname = socket.gethostbyaddr(ip_address)[0]
        except:
            pass
        
        return jsonify({
            'success': True,
            'ip': ip_address,
            'hostname': hostname,
            'arp_entries': arp_entries,
            'timestamp': datetime.utcnow().isoformat()
        })
    
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/diagnostics/scan-network', methods=['GET'])
def scan_network():
    """Scan network and return all active hosts"""
    try:
        active_hosts = []
        
        if platform.system().lower() == 'windows':
            result = subprocess.run(['arp', '-a'], stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=10)
            output = result.stdout.decode('utf-8', errors='ignore')
            
            for line in output.split('\n'):
                parts = line.split()
                if len(parts) >= 3 and re.match(r'^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$', parts[0]):
                    active_hosts.append({
                        'ip': parts[0],
                        'mac': parts[1],
                        'type': parts[2] if len(parts) > 2 else 'dynamic'
                    })
        else:
            result = subprocess.run(['arp', '-a'], stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=10)
            output = result.stdout.decode('utf-8', errors='ignore')
            
            for line in output.split('\n'):
                parts = line.split()
                if len(parts) >= 4:
                    try:
                        hostname = parts[0].strip('()')
                        ip = parts[1].strip('()')
                        mac = parts[3]
                        if re.match(r'^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$', ip):
                            active_hosts.append({
                                'hostname': hostname,
                                'ip': ip,
                                'mac': mac,
                                'type': parts[5] if len(parts) > 5 else 'dynamic'
                            })
                    except:
                        pass
        
        return jsonify({
            'success': True,
            'active_hosts': active_hosts,
            'total_hosts': len(active_hosts),
            'timestamp': datetime.utcnow().isoformat()
        })
    
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/diagnostics/lldp', methods=['GET', 'POST'])
def lldp_neighbors():
    """Get LLDP neighbors for network devices"""
    try:
        # Predefined LLDP neighbor mappings (simulated from topology)
        lldp_data = {
            'router-01': [
                {'local_port': 'eth0', 'neighbor': 'core-switch-01', 'neighbor_port': '48', 'neighbor_ip': '10.1.0.1'},
                {'local_port': 'eth1', 'neighbor': 'core-switch-02', 'neighbor_port': '48', 'neighbor_ip': '10.1.0.2'}
            ],
            'core-switch-01': [
                {'local_port': '48', 'neighbor': 'router-01', 'neighbor_port': 'eth0', 'neighbor_ip': '10.0.0.254'},
                {'local_port': '47', 'neighbor': 'core-switch-02', 'neighbor_port': '47', 'neighbor_ip': '10.1.0.2'},
                {'local_port': '46', 'neighbor': 'dist-switch-01', 'neighbor_port': '48', 'neighbor_ip': '10.2.0.1'}
            ],
            'core-switch-02': [
                {'local_port': '48', 'neighbor': 'router-01', 'neighbor_port': 'eth1', 'neighbor_ip': '10.0.0.254'},
                {'local_port': '47', 'neighbor': 'core-switch-01', 'neighbor_port': '47', 'neighbor_ip': '10.1.0.1'},
                {'local_port': '46', 'neighbor': 'dist-switch-02', 'neighbor_port': '48', 'neighbor_ip': '10.2.1.1'}
            ],
            'dist-switch-01': [
                {'local_port': '48', 'neighbor': 'core-switch-01', 'neighbor_port': '46', 'neighbor_ip': '10.1.0.1'},
                {'local_port': '47', 'neighbor': 'acc-switch-01', 'neighbor_port': '48', 'neighbor_ip': '10.3.0.1'},
                {'local_port': '46', 'neighbor': 'acc-switch-02', 'neighbor_port': '48', 'neighbor_ip': '10.3.1.1'}
            ],
            'dist-switch-02': [
                {'local_port': '48', 'neighbor': 'core-switch-02', 'neighbor_port': '46', 'neighbor_ip': '10.1.0.2'},
                {'local_port': '47', 'neighbor': 'acc-switch-03', 'neighbor_port': '48', 'neighbor_ip': '10.3.2.1'},
                {'local_port': '46', 'neighbor': 'acc-switch-04', 'neighbor_port': '48', 'neighbor_ip': '10.3.3.1'}
            ],
            'acc-switch-01': [
                {'local_port': '48', 'neighbor': 'dist-switch-01', 'neighbor_port': '47', 'neighbor_ip': '10.2.0.1'}
            ],
            'acc-switch-02': [
                {'local_port': '48', 'neighbor': 'dist-switch-01', 'neighbor_port': '46', 'neighbor_ip': '10.2.0.1'}
            ],
            'acc-switch-03': [
                {'local_port': '48', 'neighbor': 'dist-switch-02', 'neighbor_port': '47', 'neighbor_ip': '10.2.1.1'}
            ],
            'acc-switch-04': [
                {'local_port': '48', 'neighbor': 'dist-switch-02', 'neighbor_port': '46', 'neighbor_ip': '10.2.1.1'}
            ],
            'wlc-01': [
                {'local_port': 'eth0', 'neighbor': 'core-switch-01', 'neighbor_port': '45', 'neighbor_ip': '10.1.0.1'}
            ],
            'firewall-01': [
                {'local_port': 'eth0', 'neighbor': 'router-01', 'neighbor_port': 'eth2', 'neighbor_ip': '10.0.0.254'}
            ]
        }
        
        # Get all devices if no specific device requested
        if request.method == 'GET':
            # Return all LLDP data
            all_neighbors = []
            for device, neighbors in lldp_data.items():
                for neighbor in neighbors:
                    all_neighbors.append({
                        'device': device,
                        **neighbor
                    })
            
            return jsonify({
                'success': True,
                'lldp_neighbors': all_neighbors,
                'total_links': len(all_neighbors),
                'devices_with_neighbors': len(lldp_data),
                'timestamp': datetime.utcnow().isoformat()
            })
        else:
            # POST: Get neighbors for specific device
            data = request.get_json()
            device = data.get('device', '').lower()
            
            if not device:
                return jsonify({'success': False, 'message': 'Device name required'}), 400
            
            # Sanitize device name
            if not re.match(r'^[\w\-]+$', device):
                return jsonify({'success': False, 'message': 'Invalid device name format'}), 400
            
            neighbors = lldp_data.get(device, [])
            
            if not neighbors:
                return jsonify({
                    'success': True,
                    'device': device,
                    'lldp_neighbors': [],
                    'message': f'No LLDP neighbors found for {device}'
                })
            
            return jsonify({
                'success': True,
                'device': device,
                'lldp_neighbors': neighbors,
                'neighbor_count': len(neighbors),
                'timestamp': datetime.utcnow().isoformat()
            })
    
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

# ============================================================================
# MAIN
# ============================================================================

if __name__ == '__main__':
    print("\n" + "="*60)
    print("🚀 Intent-Based Networking (IBN) Server Starting...")
    print("="*60)
    print(f"\n📡 Server running on: http://localhost:5000")
    print(f"🔐 Login credentials:")
    print(f"   Admin    → admin / admin123")
    print(f"   Operator → operator / operator123")
    print(f"   Viewer   → viewer / viewer123")
    print(f"\n🌐 Topology: {len(NETWORK_DEVICES)} devices, {len(NETWORK_LINKS)} links")
    print("\n" + "="*60 + "\n")
    
    app.run(host='0.0.0.0', port=5000, debug=True)

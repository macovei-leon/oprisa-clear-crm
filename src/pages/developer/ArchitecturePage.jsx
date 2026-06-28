import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import { Sidebar } from '../../components/layout/Sidebar';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { X, ZoomIn, ZoomOut, Maximize } from 'lucide-react';

// Data Dictionary for Deep Dives
const NODE_DATA = {
  ViteApp: {
    title: 'React Admin Panel (Vite)',
    type: 'Frontend Application',
    description: 'The core CRM application built with React and Vite. Handles routing, modern authentication (Supabase Auth), and renders legacy micro-apps via iframes to preserve older Vanilla JS tools.',
    tables: ['profiles', 'departments'],
    logic: 'Uses React Router for navigation and Context API for global state. Directly connects to Supabase for reading/writing core CRM tables (angajati, campaigns, tasks) bypassing the Express backend entirely for most CRUD operations.'
  },
  DriverDashboard: {
    title: 'Driver Dashboard UI',
    type: 'Frontend Micro-App (iframe)',
    description: 'A static HTML/JS dashboard specifically built for HR managers to process massive JSON timeline files and configure automated warning emails (e.g., for missing shifts or unverified timelines).',
    tables: ['driver_email_settings', 'driver_dashboard_data', 'dashboard_settings'],
    columns: {
      'driver_email_settings': 'id, is_enabled (bool), send_time (time), allowed_categories (jsonb), cron_schedule (text)',
      'dashboard_settings': 'id, timeline_file_path (text), raw_timeline_data (jsonb)'
    },
    logic: 'It uploads heavy JSON files to the Backend Data Processor. It fetches logs and queue statuses from the Express API (routes: /api/admin/*) to display automation health.'
  },
  FleetCap: {
    title: 'FleetCap Optimization UI',
    type: 'Frontend Micro-App (iframe)',
    description: 'A specialized tool used to calculate fleet capacity and driver metrics per city. It analyzes hourly costs, TPH (Trips Per Hour), KPH, and recommends eliminating specific Minijob/Car contracts if costs exceed limits.',
    tables: ['fleetcap_app_data', 'driver_activity', 'driver_daily_actions'],
    columns: {
      'fleetcap_app_data': 'id, data (jsonb - holds the city logic and shift schedules)',
      'driver_daily_actions': 'id, driver_pn, status (text - tracks medical/inactive states), created_at'
    },
    logic: 'Makes requests to the Express API (/api/drivers, /api/driver/action, /api/assignments) to fetch parsed driver timelines and cross-reference them with daily actions. Allows HR to override driver statuses directly.'
  },
  ApiWorkspace: {
    title: 'API Workspace UI',
    type: 'Frontend Micro-App (iframe)',
    description: 'A developer sandbox used for securely testing 3rd party integrations and external webhooks without dealing with CORS issues.',
    tables: ['None (Stateless)'],
    logic: 'Sends requests to the Backend Proxy Service (/api/proxy/*, /api/state). The backend performs the actual HTTP requests to external services on behalf of this UI.'
  },
  ExpressRouter: {
    title: 'Express Routing Engine',
    type: 'Backend Module',
    description: 'The central traffic controller of the Node.js server (running on Port 3001). It catches all incoming HTTP requests from the iframes.',
    logic: 'Exposes specialized route groups:\n- /api/admin/* (for Driver Dashboard settings)\n- /api/driver/* (for FleetCap status updates)\n- /api/proxy/* (for API Workspace external requests)'
  },
  LegacyAuth: {
    title: 'Legacy Auth Service',
    type: 'Backend Module',
    description: 'Handles authentication specifically for the old standalone HTML files (login.html, dashboard.html).',
    tables: ['users (legacy)'],
    logic: 'Manages /api/login and /api/logout routes. Issues JWT cookies for the static apps. (Note: The main React app uses Supabase Auth instead, making this a secondary auth system).'
  },
  DataProcessor: {
    title: 'Timeline Data Processor',
    type: 'Backend Module',
    description: 'A heavy-duty JSON parser (timeline_processor.cjs) that ingests massive timeline exports from HR.',
    tables: ['driver_timeline_data'],
    columns: {
      'driver_timeline_data': 'id, data (jsonb - stores the massive parsed arrays)'
    },
    logic: 'Extracts exact shift starts, stops, and missing periods. Formats the data into digestible chunks for the Email Service to use as dynamic variables.'
  },
  NodeCron: {
    title: 'Node-Cron Scheduler',
    type: 'Backend Background Worker',
    description: 'An independent timer engine that runs forever on the VPS, regardless of whether any browser is open.',
    tables: ['driver_email_settings', 'driver_email_queue', 'driver_email_batches'],
    columns: {
      'driver_email_batches': 'id, name, total_emails, sent_count, failed_count, status, created_at',
      'driver_email_queue': 'id, batch_id, driver_pn, email, category, status, scheduled_for'
    },
    logic: '1. Queue Processor runs every 5 minutes (timezone locked to Europe/Berlin).\n2. Daily Job runs at the HR-configured send_time.\n3. Pushes target drivers into the database queue.'
  },
  EmailService: {
    title: 'Nodemailer & PDF-lib',
    type: 'Backend Service',
    description: 'The dispatch center for outgoing automated warnings.',
    tables: ['driver_email_logs', 'driver_email_templates'],
    columns: {
      'driver_email_logs': 'id, driver_pn, email, category, status, details (captures exact error messages or email subjects), sent_at',
      'driver_email_templates': 'category, subject, body'
    },
    logic: 'Pulls raw templates, injects personalized driver variables (like missing shift dates), optionally uses pdf-lib to attach formal warning PDFs, and blasts them via SMTP.'
  },
  DB_CRM: {
    title: 'CRM Database Layer',
    type: 'Supabase PostgreSQL',
    description: 'Core tables for managing the internal company hierarchy, tasks, and employees. Handled mostly by the React frontend directly.',
    tables: ['angajati', 'crm_tasks', 'crm_campaigns', 'departments', 'profiles'],
    columns: {
      'angajati': 'id, uuid, nume, email, telefon, companie, iban, tip_contract, inactiv',
      'crm_campaigns': 'id, name, description, trigger_type, target_role, steps (jsonb)',
      'crm_tasks': 'id, category, assigned_to, row_data, completed, active_step_idx'
    }
  },
  DB_Driver: {
    title: 'Automation & Log Data',
    type: 'Supabase PostgreSQL',
    description: 'Stores all rules, templates, and history of automated emails. Handled entirely by the Express Backend.',
    tables: ['driver_email_settings', 'driver_email_templates', 'driver_email_queue', 'driver_email_logs', 'driver_email_batches']
  },
  DB_Fleet: {
    title: 'Fleet Optimization Data',
    type: 'Supabase PostgreSQL',
    description: 'Stores raw JSON city plans and individual driver daily actions (medical leave, inactive).',
    tables: ['fleetcap_app_data', 'driver_activity', 'driver_daily_actions']
  },
  DB_Timeline: {
    title: 'Raw Timeline Exports',
    type: 'Supabase PostgreSQL',
    description: 'Stores the gigabytes of raw tracking JSON uploaded by HR.',
    tables: ['dashboard_settings', 'driver_timeline_data']
  }
};

export function ArchitecturePage() {
  const chartRef = useRef(null);
  const [selectedNode, setSelectedNode] = useState(null);

  // Setup global click handler for Mermaid
  useEffect(() => {
    window.handleMermaidClick = (nodeId) => {
      console.log('Clicked node:', nodeId);
      if (NODE_DATA[nodeId]) {
        setSelectedNode(NODE_DATA[nodeId]);
      }
    };

    return () => {
      delete window.handleMermaidClick;
    };
  }, []);

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: true,
      theme: 'base',
      securityLevel: 'loose',
      themeVariables: {
        primaryColor: '#f1f5f9',
        primaryTextColor: '#1e293b',
        primaryBorderColor: '#cbd5e1',
        lineColor: '#64748b',
        secondaryColor: '#e0e7ff',
        tertiaryColor: '#fff',
        fontFamily: 'sans-serif'
      }
    });
    
    if (chartRef.current) {
        chartRef.current.removeAttribute('data-processed');
        mermaid.run({
            nodes: [chartRef.current]
        });
    }
  }, []);

  const chart = `
graph TD
    classDef frontend fill:#dbeafe,stroke:#3b82f6,stroke-width:2px,rx:5px,ry:5px,cursor:pointer;
    classDef backend fill:#fef3c7,stroke:#d97706,stroke-width:2px,rx:5px,ry:5px,cursor:pointer;
    classDef database fill:#dcfce3,stroke:#22c55e,stroke-width:2px,rx:5px,ry:5px,cursor:pointer;
    classDef external fill:#f3e8ff,stroke:#a855f7,stroke-width:2px,rx:5px,ry:5px;
    classDef default cursor:pointer;

    subgraph Coolify["☁️ Coolify VPS Host (Docker Compose)"]
        
        subgraph FrontendContainer["💻 Frontend Container (Vite, Port 3050)"]
            ViteApp["⚛️ Vite React Admin Panel"]:::frontend
            DriverDashboard["🚘 Driver Dashboard UI"]:::frontend
            FleetCap["🚛 FleetCap UI"]:::frontend
            ApiWorkspace["🛠️ API Workspace"]:::frontend
            
            ViteApp --- DriverDashboard
            ViteApp --- FleetCap
            ViteApp --- ApiWorkspace
        end
        
        subgraph BackendContainer["⚙️ Backend Container (Express, Port 3001)"]
            ExpressRouter["🌐 Express Routing Engine"]:::backend
            LegacyAuth["🔑 Legacy Auth (/api/login)"]:::backend
            DataProcessor["🧮 Timeline Data Processor"]:::backend
            NodeCron["🕒 Node-Cron Scheduler"]:::backend
            EmailService["📧 Email & PDF Service"]:::backend
            
            ExpressRouter -.-> LegacyAuth
            ExpressRouter -.-> DataProcessor
            ExpressRouter -.-> NodeCron
            ExpressRouter -.-> EmailService
            NodeCron -.-> EmailService
        end
    end
    
    subgraph Database["🗄️ Supabase PostgreSQL (External)"]
        DB_CRM[("CRM Data<br>(angajati, tasks, campaigns)")]:::database
        DB_Driver[("Automation Data<br>(email_settings, logs)")]:::database
        DB_Fleet[("Fleet Optimization<br>(fleetcap_data)")]:::database
        DB_Timeline[("Timeline Data<br>(raw exports)")]:::database
    end
    
    SMTP["✉️ SMTP Server (Gmail)"]:::external
    ClientBrowser["🧑‍💻 Client Browser"]:::external
    
    ClientBrowser == "HTTP 80/443" ==> FrontendContainer
    ClientBrowser -. "Direct Supabase Calls" .-> Database
    FrontendContainer <== "API Calls (REST)" ==> ExpressRouter
    FrontendContainer <== "Direct Database Access" ==> DB_CRM
    BackendContainer <== "Service Key Access" ==> DB_Driver
    BackendContainer <== "Service Key Access" ==> DB_Timeline
    EmailService == "SMTP Protocol" ==> SMTP

    click ViteApp call handleMermaidClick()
    click DriverDashboard call handleMermaidClick()
    click FleetCap call handleMermaidClick()
    click ApiWorkspace call handleMermaidClick()
    
    click ExpressRouter call handleMermaidClick()
    click LegacyAuth call handleMermaidClick()
    click DataProcessor call handleMermaidClick()
    click NodeCron call handleMermaidClick()
    click EmailService call handleMermaidClick()
    
    click DB_CRM call handleMermaidClick()
    click DB_Driver call handleMermaidClick()
    click DB_Fleet call handleMermaidClick()
    click DB_Timeline call handleMermaidClick()
  `;

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden relative">
      <Sidebar />
      <main className="flex-1 flex flex-col h-screen relative">
        {/* Header */}
        <div className="bg-white px-8 py-6 shadow-sm border-b border-slate-200 z-10">
            <h1 className="text-2xl font-bold text-slate-800">Deep-Dive Architecture Graph</h1>
            <p className="text-sm text-slate-500 mt-1">
                Drag to pan, scroll to zoom. <b>Click on any node</b> to see its exact database schema and backend logic.
            </p>
        </div>

        {/* Interactive Canvas */}
        <div className="flex-1 overflow-hidden relative bg-slate-50/50 cursor-grab active:cursor-grabbing">
            <TransformWrapper
              initialScale={1}
              minScale={0.1}
              maxScale={15}
              centerOnInit={true}
              wheel={{ step: 0.15 }}
            >
              {({ zoomIn, zoomOut, resetTransform }) => (
                <>
                  <div className="absolute top-4 left-4 z-10 flex gap-2 bg-white p-2 rounded-lg shadow-sm border border-slate-200">
                    <button onClick={() => zoomIn()} className="p-2 hover:bg-slate-100 rounded text-slate-600"><ZoomIn size={18} /></button>
                    <button onClick={() => zoomOut()} className="p-2 hover:bg-slate-100 rounded text-slate-600"><ZoomOut size={18} /></button>
                    <button onClick={() => resetTransform()} className="p-2 hover:bg-slate-100 rounded text-slate-600"><Maximize size={18} /></button>
                  </div>
                  <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }}>
                    <div className="p-20 flex justify-center items-center min-w-[1200px] min-h-[800px]">
                      <div className="mermaid" ref={chartRef} style={{ pointerEvents: 'auto' }}>
                          {chart}
                      </div>
                    </div>
                  </TransformComponent>
                </>
              )}
            </TransformWrapper>
        </div>

        {/* Slide-over Deep Dive Panel */}
        {selectedNode && (
          <div className="absolute top-0 right-0 h-full w-96 bg-white shadow-2xl border-l border-slate-200 transform transition-transform duration-300 ease-in-out z-50 flex flex-col">
            <div className="p-6 border-b border-slate-100 flex justify-between items-start bg-slate-50">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 mb-1 block">{selectedNode.type}</span>
                <h2 className="text-xl font-bold text-slate-800">{selectedNode.title}</h2>
              </div>
              <button 
                onClick={() => setSelectedNode(null)}
                className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 flex-1 overflow-y-auto space-y-6">
              <div>
                <h3 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-2 mb-3">Core Functionality</h3>
                <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{selectedNode.logic}</p>
              </div>

              {selectedNode.description && (
                <div>
                  <h3 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-2 mb-3">Description</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{selectedNode.description}</p>
                </div>
              )}

              {selectedNode.tables && (
                <div>
                  <h3 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-2 mb-3">Affected Tables</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedNode.tables.map(t => (
                      <span key={t} className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-mono rounded border border-emerald-200">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedNode.columns && (
                <div>
                  <h3 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-2 mb-3">Database Schema (Deep Dive)</h3>
                  <div className="space-y-3">
                    {Object.entries(selectedNode.columns).map(([table, cols]) => (
                      <div key={table} className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                        <div className="text-xs font-bold text-slate-700 mb-2 font-mono">{table}</div>
                        <div className="text-xs text-slate-600 font-mono leading-relaxed break-words">
                          {cols.split(', ').map(c => (
                            <div key={c} className="ml-2 border-l-2 border-slate-300 pl-2 mb-1">{c}</div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

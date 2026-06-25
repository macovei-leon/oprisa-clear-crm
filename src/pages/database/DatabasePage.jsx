import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '../../components/layout/MainLayout';
import { supabase } from '../../lib/supabase';
import { Database, Plus, Table, AlertCircle, CheckCircle2, ChevronRight, X, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';

// Only custom tables will be used now


export const DatabasePage = () => {
  const navigate = useNavigate();
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState(1); // 1 = Details, 2 = Analysis
  const [uploading, setUploading] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    tableName: '',
    titleRo: '',
    titleEn: '',
    descRo: '',
    descEn: ''
  });
  
  // Excel data state
  const [excelFile, setExcelFile] = useState(null);
  const [detectedColumns, setDetectedColumns] = useState([]);
  const [parsedRows, setParsedRows] = useState([]);

  useEffect(() => {
    fetchCustomTables();
  }, []);

  const fetchCustomTables = async () => {
    try {
      const { data, error } = await supabase.from('custom_tables').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      
      const customMapped = (data || []).map(t => ({
        id: t.table_name,
        title_ro: t.title_ro,
        title_en: t.title_en,
        icon: t.icon,
        color: t.color,
        isCustom: true
      }));
      
      setTables(customMapped);
    } catch (err) {
      console.error('Error fetching custom tables:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) setExcelFile(file);
  };

  const analyzeFile = async (e) => {
    e.preventDefault();
    if (!excelFile) return alert("Vă rugăm să selectați un fișier Excel / CSV.");
    
    // Auto-generate sanitized table name if empty
    if (!formData.tableName) {
      const suggested = formData.titleRo.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/^_+|_+$/g, '');
      setFormData(prev => ({ ...prev, tableName: suggested }));
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        if (workbook.SheetNames.length === 0) throw new Error("Excel is empty");
        
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet);
        
        if (rows.length === 0) throw new Error("Worksheet has no rows");
        
        const headers = Object.keys(rows[0]);
        const cols = headers.map(h => {
          let sanitized = h.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/^_+|_+$/g, '');
          if (/^[0-9]/.test(sanitized)) sanitized = 'col_' + sanitized;
          return { original: h, sanitized, selected: true };
        });
        
        setDetectedColumns(cols);
        setParsedRows(rows);
        setModalStep(2);
      } catch (err) {
        alert("Eroare la procesarea fișierului: " + err.message);
      }
    };
    reader.readAsArrayBuffer(excelFile);
  };

  const toggleColumn = (index) => {
    const newCols = [...detectedColumns];
    newCols[index].selected = !newCols[index].selected;
    setDetectedColumns(newCols);
  };

  const executeTableCreation = async () => {
    setUploading(true);
    try {
      const selectedCols = detectedColumns.filter(c => c.selected);
      if (selectedCols.length === 0) throw new Error("Selectați cel puțin o coloană.");
      if (!formData.tableName) throw new Error("Numele tabelului este obligatoriu.");

      // Check if exists in DB
      const { data: existing } = await supabase.rpc('get_table_columns', { p_table_name: formData.tableName });
      const tableExists = existing && existing.length > 0;

      // 1. Build & Execute DDL
      if (!tableExists) {
        const createSql = `
          CREATE TABLE IF NOT EXISTS public."${formData.tableName}" (
              id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
              ${selectedCols.map(c => `"${c.sanitized}" text`).join(',\n')}
          );
          ALTER TABLE public."${formData.tableName}" ENABLE ROW LEVEL SECURITY;
          DROP POLICY IF EXISTS "Allow all access to authenticated users" ON public."${formData.tableName}";
          CREATE POLICY "Allow all access to authenticated users" ON public."${formData.tableName}" FOR ALL TO authenticated USING (true) WITH CHECK (true);
          NOTIFY pgrst, 'reload schema';
        `;
        
        const { error: ddlError } = await supabase.rpc('execute_ddl', { query_text: createSql });
        if (ddlError) throw ddlError;
      } else {
        // Table exists. Add any missing columns.
        const newCols = selectedCols.filter(c => !existing.some(e => e.column_name === c.sanitized));
        if (newCols.length > 0) {
          const ddlSql = newCols.map(c => `ALTER TABLE public."${formData.tableName}" ADD COLUMN IF NOT EXISTS "${c.sanitized}" text;`).join('\n') + `\nNOTIFY pgrst, 'reload schema';`;
          const { error: ddlError } = await supabase.rpc('execute_ddl', { query_text: ddlSql });
          if (ddlError) throw ddlError;
        }
        
        // Clear old data so we can overwrite
        await supabase.from(formData.tableName).delete().neq('id', '00000000-0000-0000-0000-000000000000');
      }

      // Wait 1s for PostgREST schema cache reload
      await new Promise(r => setTimeout(r, 1000));

      // 2. Register in custom_tables (if not already registered)
      const { data: existingRegistry } = await supabase.from('custom_tables').select('table_name').eq('table_name', formData.tableName);
      if (!existingRegistry || existingRegistry.length === 0) {
        const { error: regError } = await supabase.from('custom_tables').insert({
          table_name: formData.tableName,
          title_ro: formData.titleRo,
          title_en: formData.titleEn || formData.titleRo,
          description_ro: formData.descRo,
          description_en: formData.descEn,
          icon: 'table',
          color: '#8b5cf6'
        });
        if (regError) throw regError;
      }

      // 3. Map & Insert Data
      const mappedRows = parsedRows.map(row => {
        const newRow = {};
        selectedCols.forEach(col => {
          let val = row[col.original];
          if (val instanceof Date) val = val.toISOString();
          newRow[col.sanitized] = val !== undefined && val !== null ? String(val) : null;
        });
        return newRow;
      });

      // Insert in batches of 500
      for (let i = 0; i < mappedRows.length; i += 500) {
        const batch = mappedRows.slice(i, i + 500);
        const { error: insertError } = await supabase.from(formData.tableName).insert(batch);
        if (insertError) throw insertError;
      }

      alert('Tabel creat/actualizat și date importate cu succes!');
      setIsModalOpen(false);
      resetModal();
      fetchCustomTables();
    } catch (err) {
      console.error(err);
      alert('Eroare: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const resetModal = () => {
    setModalStep(1);
    setExcelFile(null);
    setDetectedColumns([]);
    setParsedRows([]);
    setFormData({ tableName: '', titleRo: '', titleEn: '', descRo: '', descEn: '' });
  };

  return (
    <MainLayout title="Bază de Date" subtitle="Gestionare date și tabele dinamice din Excel/CSV">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        
        {/* Create Table Card */}
        <div 
          onClick={() => setIsModalOpen(true)}
          className="bg-white border-2 border-dashed border-indigo-300 rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-indigo-50 hover:border-indigo-500 transition-all min-h-[160px] group shadow-sm"
        >
          <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
            <Plus size={24} />
          </div>
          <h3 className="font-bold text-slate-800">Creare Tabel Nou</h3>
          <p className="text-sm text-slate-500 mt-1">Importă din Excel sau CSV</p>
        </div>

        {/* Render Existing Tables */}
        {tables.map(t => (
          <div 
            key={t.id}
            onClick={() => navigate(`/database/${t.id}`)}
            className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between cursor-pointer hover:shadow-md hover:border-indigo-300 transition-all min-h-[160px] relative overflow-hidden group shadow-sm"
          >
            <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: t.color || '#cbd5e1' }}></div>
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${t.color || '#64748b'}15`, color: t.color || '#64748b' }}>
                <Table size={20} />
              </div>
              <ChevronRight className="text-slate-400 group-hover:text-indigo-600 transition-colors" size={20} />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-lg leading-tight">{t.title_ro}</h3>
              {t.isCustom && <span className="inline-block mt-2 px-2 py-1 bg-purple-100 text-purple-700 text-xs font-bold rounded-md uppercase tracking-wider">Custom Table</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h2 className="text-xl font-bold text-slate-800">
                {modalStep === 1 ? 'Adaugă Tabel Nou din Excel' : 'Analiză și Validare Date'}
              </h2>
              <button onClick={() => { setIsModalOpen(false); resetModal(); }} className="text-slate-400 hover:text-slate-700">
                <X size={24} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              {modalStep === 1 ? (
                <form onSubmit={analyzeFile} className="flex flex-col gap-5">
                  <div className="p-4 bg-blue-50 text-blue-800 rounded-lg flex gap-3 text-sm">
                    <AlertCircle className="shrink-0" size={20} />
                    <p>Incarcă un fișier Excel (.xlsx, .csv). Sistemul va crea automat structura bazei de date pe baza coloanelor detectate.</p>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Titlu Tabel (Vizibil în meniu)</label>
                    <input type="text" required value={formData.titleRo} onChange={e => setFormData({...formData, titleRo: e.target.value})} className="w-full p-3 border border-slate-300 rounded-lg" placeholder="ex: Activitate HR" />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">ID Tabel (Sistem Bază de Date)</label>
                    <input type="text" value={formData.tableName} onChange={e => setFormData({...formData, tableName: e.target.value})} className="w-full p-3 border border-slate-300 rounded-lg" placeholder="Se generează automat dacă e gol..." />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Fișier Excel / CSV</label>
                    <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:bg-slate-50 transition-colors">
                      <input type="file" id="file-upload" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileChange} />
                      <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center justify-center">
                        <Upload size={32} className="text-indigo-500 mb-3" />
                        <span className="font-semibold text-slate-700">{excelFile ? excelFile.name : 'Apasă pentru a încărca fișierul'}</span>
                        <span className="text-sm text-slate-500 mt-1">.xlsx, .csv suportat</span>
                      </label>
                    </div>
                  </div>

                  <button type="submit" className="w-full py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 mt-2">
                    Analizează Fișierul
                  </button>
                </form>
              ) : (
                <div className="flex flex-col gap-6">
                  <div className="bg-emerald-50 text-emerald-800 p-4 rounded-lg flex items-start gap-3">
                    <CheckCircle2 className="shrink-0 mt-0.5" size={20} />
                    <div>
                      <h4 className="font-bold">Analiză Completă</h4>
                      <p className="text-sm mt-1">Am detectat <strong>{parsedRows.length} rânduri</strong> și <strong>{detectedColumns.length} coloane</strong> în fișier. Bifați coloanele pe care doriți să le importați în baza de date.</p>
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 font-bold text-sm text-slate-700 flex justify-between">
                      <span>Coloane Detectate</span>
                      <span>{detectedColumns.filter(c => c.selected).length} / {detectedColumns.length} selectate</span>
                    </div>
                    <div className="max-h-64 overflow-y-auto p-2">
                      {detectedColumns.map((col, idx) => (
                        <div key={idx} onClick={() => toggleColumn(idx)} className="flex items-center gap-3 p-3 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors border-b border-transparent hover:border-slate-100">
                          <input type="checkbox" className="w-5 h-5 text-indigo-600 rounded" checked={col.selected} readOnly />
                          <div className="flex flex-col">
                            <span className={`font-semibold ${col.selected ? 'text-slate-800' : 'text-slate-400 line-through'}`}>{col.original}</span>
                            <span className="text-xs text-slate-500 font-mono">db: {col.sanitized}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <button onClick={() => setModalStep(1)} disabled={uploading} className="flex-1 py-3 border border-slate-300 text-slate-700 font-bold rounded-lg hover:bg-slate-50">
                      Înapoi
                    </button>
                    <button onClick={executeTableCreation} disabled={uploading} className="flex-[2] py-3 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 flex justify-center items-center">
                      {uploading ? 'Se procesează & se creează tabelul...' : 'Confirmă & Creează Tabel'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
};

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MainLayout } from '../../components/layout/MainLayout';
import { supabase } from '../../lib/supabase';
import { ArrowLeft, Upload, Search, Filter, Trash2, CheckCircle2, AlertCircle, X, ChevronDown, Eye } from 'lucide-react';
import * as XLSX from 'xlsx';
import { CampaignBuilderModal } from '../../components/campaigns/CampaignBuilderModal';
import { AppendToCampaignModal } from '../../components/campaigns/AppendToCampaignModal';

export const TableViewer = () => {
  const { tableName } = useParams();
  const navigate = useNavigate();
  
  const [data, setData] = useState([]);
  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filtering & Columns state
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({});
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [showColumnsPanel, setShowColumnsPanel] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState([]);
  const [showOnlyUnassigned, setShowOnlyUnassigned] = useState(false);
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 100;

  // Row Selection State
  const [selectedRowIds, setSelectedRowIds] = useState(new Set());
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [showRepetitiveModal, setShowRepetitiveModal] = useState(false);
  
  // Append to Existing Modals
  const [showAppendCampaignModal, setShowAppendCampaignModal] = useState(false);
  const [showAppendRepetitiveModal, setShowAppendRepetitiveModal] = useState(false);
  
  // Replace/Append Data Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState(1);
  const [matchColumn, setMatchColumn] = useState('');
  const [uploading, setUploading] = useState(false);
  const [excelFile, setExcelFile] = useState(null);
  const [detectedColumns, setDetectedColumns] = useState([]);
  const [parsedRows, setParsedRows] = useState([]);
  const [newlySyncedRowIds, setNewlySyncedRowIds] = useState([]);

  useEffect(() => {
    fetchTableData();
  }, [tableName]);

  const fetchTableData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Schema to get true columns
      const { data: schemaCols, error: schemaErr } = await supabase.rpc('get_table_columns', { p_table_name: tableName });
      if (schemaErr) throw schemaErr;
      
      const cols = schemaCols ? schemaCols.map(c => c.column_name).filter(c => c !== 'id' && c !== 'crm_processed') : [];
      setColumns(cols);
      
      // Initialize visible columns if empty
      if (visibleColumns.length === 0) {
        setVisibleColumns(cols);
      }

      // 2. Fetch Data (Fetch all in chunks to allow client-side filtering)
      let allData = [];
      let from = 0;
      const step = 1000;
      
      while (true) {
        const { data: tableData, error: dataErr } = await supabase.from(tableName).select('*').order('id').range(from, from + step - 1);
        if (dataErr) {
          if (dataErr.code === '42P01') {
            // Table does not exist (maybe newly created frontend card without DB backend)
            alert("Tabelul nu există încă în baza de date / Table does not exist yet.");
            break;
          } else {
            throw dataErr;
          }
        }
        
        if (!tableData || tableData.length === 0) break;
        
        allData = [...allData, ...tableData];
        if (tableData.length < step) break;
        from += step;
      }
      
      setData(allData);
      
      // Auto-extract column names if schema RPC failed but we have data
      if (cols.length === 0 && allData.length > 0) {
        const fallbackCols = Object.keys(allData[0]).filter(k => k !== 'id' && k !== 'crm_processed');
        setColumns(fallbackCols);
        if (visibleColumns.length === 0) setVisibleColumns(fallbackCols);
      }
      
      // Auto-add crm_processed if missing
      if (schemaCols && !schemaCols.some(c => c.column_name === 'crm_processed')) {
         const ddlSql = `ALTER TABLE public."${tableName}" ADD COLUMN IF NOT EXISTS crm_processed boolean DEFAULT false;\nNOTIFY pgrst, 'reload schema';`;
         await supabase.rpc('execute_ddl', { query_text: ddlSql });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Extract unique values for text filters or min/max for numbers
  const columnStats = useMemo(() => {
    const stats = {};
    columns.forEach(col => {
      const values = data.map(row => row[col]).filter(v => v !== null && v !== undefined && v !== '');
      const isNumeric = values.every(v => !isNaN(parseFloat(v)));
      
      if (isNumeric && values.length > 0) {
        const nums = values.map(v => parseFloat(v));
        stats[col] = { type: 'number', min: Math.min(...nums), max: Math.max(...nums) };
      } else {
        const unique = [...new Set(values)];
        stats[col] = { type: 'text', unique: unique.length < 50 ? unique : [] }; // Only provide dropdown if < 50 unique values
      }
    });
    return stats;
  }, [data, columns]);

  const handleFilterChange = (col, value) => {
    setFilters(prev => ({
      ...prev,
      [col]: value
    }));
    setCurrentPage(1);
  };

  const filteredData = useMemo(() => {
    return data.filter(row => {
      // 0. Unassigned filter
      if (showOnlyUnassigned && row.crm_processed !== false) return false;

      // 1. Global Search (matches any column)
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesSearch = columns.some(col => String(row[col] || '').toLowerCase().includes(q));
        if (!matchesSearch) return false;
      }

      // 2. Column-specific filters
      for (const col in filters) {
        const filterVal = filters[col];
        if (!filterVal || filterVal === '') continue;

        const stat = columnStats[col];
        const rowVal = row[col];

        if (stat?.type === 'number') {
           // Handle min/max range object
           if (filterVal.min !== undefined && parseFloat(rowVal) < filterVal.min) return false;
           if (filterVal.max !== undefined && parseFloat(rowVal) > filterVal.max) return false;
        } else {
           // Exact match for dropdown
           if (String(rowVal) !== String(filterVal)) return false;
        }
      }

      return true;
    });
  }, [data, searchQuery, filters, columns, columnStats]);

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(start, start + itemsPerPage);
  }, [filteredData, currentPage]);

  const toggleRowSelection = (rowId) => {
    setSelectedRowIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(rowId)) newSet.delete(rowId);
      else newSet.add(rowId);
      return newSet;
    });
  };

  const toggleAllPageSelection = () => {
    const pageIds = paginatedData.map(row => row.id);
    const allSelected = pageIds.every(id => selectedRowIds.has(id));
    
    setSelectedRowIds(prev => {
      const newSet = new Set(prev);
      pageIds.forEach(id => {
        if (allSelected) newSet.delete(id);
        else newSet.add(id);
      });
      return newSet;
    });
  };

  const selectedRowsData = useMemo(() => {
    return data.filter(row => selectedRowIds.has(row.id));
  }, [selectedRowIds, data]);

  // ---- OVERWRITE LOGIC ----
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        alert("Fișierul este prea mare! Dimensiunea maximă admisă este de 10 MB pentru a preveni blocarea aplicației.");
        e.target.value = null; // reset input
        return;
      }
      setExcelFile(file);
    }
  };

  const analyzeFile = async (e) => {
    e.preventDefault();
    if (!excelFile) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet);
        
        if (rows.length === 0) throw new Error("Foaie de lucru goală");
        
        const fileHeaders = Object.keys(rows[0]);
        // Map file headers to existing DB columns
        const cols = fileHeaders.map(fh => {
          let sanitized = fh.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/^_+|_+$/g, '');
          if (/^[0-9]/.test(sanitized)) sanitized = 'col_' + sanitized;
          
          // Does it match an existing column?
          const matchesExisting = columns.includes(sanitized);
          
          return { original: fh, sanitized, selected: true, matchesExisting };
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

  const executeImport = async () => {
    const isSmartSync = data.length > 0;
    
    if (isSmartSync) {
       if (!confirm("Ești sigur? Sincronizarea inteligentă va modifica tabelul existent.")) return;
    }
    
    setUploading(true);
    try {
      const selectedCols = detectedColumns.filter(c => c.selected);
      
      // 1. DDL if we need to add new columns to the table
      const newCols = selectedCols.filter(c => !c.matchesExisting);
      if (newCols.length > 0 || columns.length === 0) {
        const ddlSql = `
          CREATE TABLE IF NOT EXISTS public."${tableName}" (
            id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
            crm_processed boolean DEFAULT false
          );
          ${selectedCols.map(c => `ALTER TABLE public."${tableName}" ADD COLUMN IF NOT EXISTS "${c.sanitized}" text;`).join('\n')}
          ALTER TABLE public."${tableName}" ENABLE ROW LEVEL SECURITY;
          DROP POLICY IF EXISTS "Allow all access to authenticated users" ON public."${tableName}";
          CREATE POLICY "Allow all access to authenticated users" ON public."${tableName}" FOR ALL TO authenticated USING (true) WITH CHECK (true);
          NOTIFY pgrst, 'reload schema';
        `;
        await supabase.rpc('execute_ddl', { query_text: ddlSql });
        await new Promise(r => setTimeout(r, 1000));
      }

      // Map new rows
      const mappedRows = parsedRows.map(row => {
        const newRow = { crm_processed: false };
        selectedCols.forEach(col => {
          let val = row[col.original];
          if (val instanceof Date) val = val.toISOString();
          newRow[col.sanitized] = val !== undefined && val !== null ? String(val) : null;
        });
        return newRow;
      });

      let insertedIds = [];

      if (isSmartSync && matchColumn) {
        // Smart Sync logic
        const newCol = detectedColumns.find(c => c.sanitized === matchColumn)?.original;
        
        const newRowsToInsert = [];
        const rowsToUpdate = [];
        
        // Find updates and inserts
        mappedRows.forEach((row, idx) => {
          const matchValue = String(parsedRows[idx][newCol]);
          const existingRow = data.find(d => String(d[matchColumn]) === matchValue);
          
          if (existingRow) {
            // Found it, add ID so we can update
            rowsToUpdate.push({ ...row, id: existingRow.id, crm_processed: existingRow.crm_processed });
          } else {
            // New row
            newRowsToInsert.push(row);
          }
        });

        // Find missing rows (deleted)
        const newKeys = new Set(parsedRows.map(r => String(r[newCol])));
        const missingIds = [];
        data.forEach(d => {
          if (!newKeys.has(String(d[matchColumn]))) {
            missingIds.push(d.id);
          }
        });

        // Execute DELETES
        if (missingIds.length > 0) {
          for (let i = 0; i < missingIds.length; i += 500) {
            const batch = missingIds.slice(i, i + 500);
            await supabase.from(tableName).delete().in('id', batch);
          }
          
          // Badge tasks as missing
          try {
            // Update crm_tasks
            for (let i = 0; i < missingIds.length; i += 500) {
              const batch = missingIds.slice(i, i + 500);
              const batchSql = batch.map(id => `'${id}'`).join(',');
              
              const updateSql = `
                UPDATE public.crm_tasks 
                SET row_data = jsonb_set(row_data, '{is_missing}', 'true'::jsonb) 
                WHERE row_data->>'id' IN (${batchSql});

                UPDATE public.crm_repetitive_tasks 
                SET row_data = jsonb_set(row_data, '{is_missing}', 'true'::jsonb) 
                WHERE row_data->>'id' IN (${batchSql});
              `;
              
              await supabase.rpc('execute_ddl', { query_text: updateSql });
            }
          } catch (badgeErr) {
            console.error("Eroare la marcarea badge-urilor:", badgeErr);
          }
        }

        // Execute UPDATES
        if (rowsToUpdate.length > 0) {
          for (let i = 0; i < rowsToUpdate.length; i += 500) {
            const batch = rowsToUpdate.slice(i, i + 500);
            const { error: updateError } = await supabase.from(tableName).upsert(batch);
            if (updateError) throw updateError;
          }
        }

        // Execute INSERTS
        if (newRowsToInsert.length > 0) {
          for (let i = 0; i < newRowsToInsert.length; i += 500) {
            const batch = newRowsToInsert.slice(i, i + 500);
            const { data: inserted, error } = await supabase.from(tableName).insert(batch).select('id');
            if (error) throw error;
            if (inserted) insertedIds.push(...inserted.map(r => r.id));
          }
        }

        alert('Sincronizare completă!');
      } else {
        // Normal Append
        for (let i = 0; i < mappedRows.length; i += 500) {
          const batch = mappedRows.slice(i, i + 500);
          const { data: inserted, error: insertError } = await supabase.from(tableName).insert(batch).select('id');
          if (insertError) throw insertError;
          if (inserted) insertedIds.push(...inserted.map(r => r.id));
        }
        alert('Date adăugate cu succes!');
      }

      setIsModalOpen(false);
      resetModal();
      setNewlySyncedRowIds(insertedIds);
      fetchTableData(); // refresh UI
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
    setMatchColumn('');
  };

  const deleteTable = async () => {
    if (!window.confirm(`Ești sigur că vrei să ștergi definitiv tabelul "${tableName}" și toate datele din el? Această acțiune este ireversibilă!`)) return;
    try {
      // 1. Delete from custom_tables registry
      const { error: regErr } = await supabase.from('custom_tables').delete().eq('table_name', tableName);
      if (regErr) throw regErr;
      
      // 2. Drop table using DDL
      const dropSql = `DROP TABLE IF EXISTS public."${tableName}" CASCADE;\nNOTIFY pgrst, 'reload schema';`;
      const { error: dropErr } = await supabase.rpc('execute_ddl', { query_text: dropSql });
      if (dropErr) throw dropErr;
      
      alert('Tabelul a fost șters cu succes!');
      navigate('/database');
    } catch (err) {
      console.error("Eroare la stergerea tabelului:", err);
      alert("Eroare: " + err.message);
    }
  };

  const unassignedCount = useMemo(() => {
    return data.filter(r => r.crm_processed === false).length;
  }, [data]);

  return (
    <MainLayout title={`Bază Date / ${tableName}`} subtitle="Vizualizare și administrare date">
      
      {/* Header Actions */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/database')} className="p-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors">
            <ArrowLeft size={20} />
          </button>
          
          <div className="relative">
            <Search className="absolute left-3 top-[10px] text-slate-400" size={20} />
            <input 
              type="text" 
              placeholder="Căutare generală..." 
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg w-full md:w-80 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="relative">
            <button 
              onClick={() => { setShowColumnsPanel(!showColumnsPanel); setShowFilterPanel(false); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold border transition-colors ${showColumnsPanel ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}
            >
              <Eye size={18} /> Coloane Vizibile
            </button>
            {showColumnsPanel && (
              <div className="absolute top-full left-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-4 min-w-[240px] flex flex-col gap-2 max-h-96 overflow-y-auto">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Alege coloanele afișate</h4>
                {columns.map(col => (
                  <label key={col} className="flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer p-2 hover:bg-slate-50 rounded border border-transparent hover:border-slate-200">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 text-indigo-600 rounded"
                      checked={visibleColumns.includes(col)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setVisibleColumns([...visibleColumns, col]);
                        } else {
                          setVisibleColumns(visibleColumns.filter(c => c !== col));
                        }
                      }}
                    />
                    {col}
                  </label>
                ))}
              </div>
            )}
          </div>

          <button 
            onClick={() => { setShowFilterPanel(!showFilterPanel); setShowColumnsPanel(false); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold border transition-colors ${showFilterPanel ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}
          >
            <Filter size={18} /> Filtre Smart
          </button>

          {/* REMOVED UNASSIGNED BANNER AND BUTTON */}
          
          {showOnlyUnassigned && (
            <button 
              onClick={() => { setShowOnlyUnassigned(false); setSelectedRowIds(new Set()); }}
              className="flex items-center gap-2 px-4 py-2 bg-amber-100 text-amber-700 font-bold border border-amber-300 rounded-lg hover:bg-amber-200 transition-colors"
            >
              <X size={18} /> Anulează Filtru Nealocate
            </button>
          )}
        </div>

        <div className="flex gap-2">
          <button 
            onClick={deleteTable}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-rose-100 text-rose-700 font-bold border border-rose-200 rounded-lg hover:bg-rose-200 transition-colors shadow-sm"
          >
            <Trash2 size={18} /> Șterge Tabel
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Upload size={18} /> Încărcare Date
          </button>
        </div>
      </div>

      {newlySyncedRowIds.length > 0 && (
        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl shadow-sm flex items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4 relative">
          <div className="flex items-center gap-3 text-emerald-800">
            <CheckCircle2 size={24} className="shrink-0" />
            <div>
              <p className="font-bold">Sincronizare completă! Au fost adăugați {newlySyncedRowIds.length} angajați noi.</p>
              <p className="text-sm">Aceste rânduri au fost identificate ca fiind complet noi în urma importului.</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={() => {
                setSelectedRowIds(new Set(newlySyncedRowIds));
              }}
              className="shrink-0 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-sm transition-colors"
            >
              Afișează și Selectează Rândurile Noi
            </button>
            <button 
              onClick={() => setNewlySyncedRowIds([])}
              className="shrink-0 px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-lg shadow-sm transition-colors"
            >
              Am înțeles, Continuă
            </button>
          </div>
        </div>
      )}

      {/* Filter Panel */}
      {showFilterPanel && (
        <div className="bg-white border border-slate-200 p-5 rounded-xl mb-6 shadow-sm flex flex-wrap gap-4">
          {columns.map(col => {
            const stat = columnStats[col];
            if (!stat) return null;

            if (stat.type === 'number') {
              return (
                <div key={col} className="w-full sm:w-auto min-w-[200px]">
                  <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">{col} (Interval)</label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="number" 
                      placeholder={`Min (${stat.min})`}
                      onChange={e => handleFilterChange(col, { ...filters[col], min: e.target.value ? parseFloat(e.target.value) : undefined })}
                      className="w-24 p-2 border border-slate-300 rounded-lg text-sm"
                    />
                    <span className="text-slate-400">-</span>
                    <input 
                      type="number" 
                      placeholder={`Max (${stat.max})`}
                      onChange={e => handleFilterChange(col, { ...filters[col], max: e.target.value ? parseFloat(e.target.value) : undefined })}
                      className="w-24 p-2 border border-slate-300 rounded-lg text-sm"
                    />
                  </div>
                </div>
              );
            }

            if (stat.type === 'text' && stat.unique.length > 0) {
              return (
                <div key={col} className="w-full sm:w-auto min-w-[200px]">
                  <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">{col}</label>
                  <select 
                    onChange={e => handleFilterChange(col, e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white"
                  >
                    <option value="">Toate</option>
                    {stat.unique.map((v, i) => <option key={i} value={v}>{v}</option>)}
                  </select>
                </div>
              );
            }
            
            return null;
          })}
        </div>
      )}

      {/* Data Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex-1">
        {loading ? (
          <div className="p-12 text-center text-slate-500">Se încarcă datele...</div>
        ) : filteredData.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center">
             <AlertCircle size={48} className="text-slate-300 mb-4" />
             <h3 className="text-lg font-bold text-slate-700">Nu am găsit date</h3>
             <p className="text-slate-500 mt-1">Acest tabel este gol sau nu există înregistrări pentru filtrele aplicate.</p>
          </div>
        ) : (
          <div className="overflow-x-auto h-[600px] relative">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-4 text-left font-bold text-slate-700 bg-slate-50 w-12 sticky left-0 z-10 border-r border-slate-200">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                      checked={paginatedData.length > 0 && paginatedData.every(row => selectedRowIds.has(row.id))}
                      onChange={toggleAllPageSelection}
                    />
                  </th>
                  {columns.filter(c => visibleColumns.includes(c)).map(col => (
                    <th key={col} className="px-6 py-4 border-b border-slate-200 font-bold text-slate-700 text-sm whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedData.map((row, idx) => {
                  return (
                    <tr 
                      key={row.id || idx} 
                      className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${selectedRowIds.has(row.id) ? 'bg-indigo-50/50' : ''}`}
                    >
                      <td className="px-4 py-3 sticky left-0 bg-white group-hover:bg-slate-50 border-r border-slate-200">
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                          checked={selectedRowIds.has(row.id)}
                          onChange={() => toggleRowSelection(row.id)}
                        />
                      </td>
                      {columns.filter(c => visibleColumns.includes(c)).map(col => (
                        <td key={col} className="px-6 py-3 text-sm text-slate-600 truncate max-w-xs" title={row[col] !== null && row[col] !== undefined ? String(row[col]) : ''}>
                          {row[col] !== null && row[col] !== undefined ? String(row[col]) : '-'}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!loading && filteredData.length > 0 && (
          <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
            <span className="text-sm text-slate-600 font-medium">
              Se afișează / Showing {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredData.length)} din / of {filteredData.length} rânduri / rows.
            </span>
            <div className="flex gap-2">
              <button 
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className="px-3 py-1 bg-white border border-slate-300 rounded text-sm disabled:opacity-50 hover:bg-slate-50"
              >
                Anterior / Prev
              </button>
              <button 
                disabled={currentPage * itemsPerPage >= filteredData.length}
                onClick={() => setCurrentPage(p => p + 1)}
                className="px-3 py-1 bg-white border border-slate-300 rounded text-sm disabled:opacity-50 hover:bg-slate-50"
              >
                Următor / Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Floating Action Bar for Selected Rows */}
      {selectedRowIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-6 z-40 border border-slate-700 animate-in slide-in-from-bottom-10 fade-in duration-300">
          <div className="flex items-center gap-3 border-r border-slate-700 pr-6">
            <div className="bg-indigo-500 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">{selectedRowIds.size}</div>
            <span className="font-semibold text-sm">rânduri selectate</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setSelectedRowIds(new Set())} className="text-slate-300 hover:text-white text-sm font-semibold transition-colors">Deselectează</button>
            
            <div className="flex flex-col gap-2">
              <div className="flex gap-2 justify-end">
                <button 
                  onClick={() => setShowAppendCampaignModal(true)}
                  className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-1.5 rounded-full text-xs font-bold shadow-lg transition-colors flex items-center gap-2"
                >
                  + Campanie Existentă
                </button>
                <button 
                  onClick={() => setShowAppendRepetitiveModal(true)}
                  className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-1.5 rounded-full text-xs font-bold shadow-lg transition-colors flex items-center gap-2"
                >
                  + Flux Existent
                </button>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => setShowCampaignModal(true)}
                  className="bg-indigo-500 hover:bg-indigo-400 text-white px-5 py-2 rounded-full text-sm font-bold shadow-lg transition-colors flex items-center gap-2"
                >
                  Campanie Nouă
                </button>
                <button 
                  onClick={() => setShowRepetitiveModal(true)}
                  className="bg-emerald-500 hover:bg-emerald-400 text-white px-5 py-2 rounded-full text-sm font-bold shadow-lg transition-colors flex items-center gap-2"
                >
                  Flux Repetitiv Nou
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <AppendToCampaignModal 
        isOpen={showAppendCampaignModal} 
        onClose={() => setShowAppendCampaignModal(false)}
        onSuccess={() => { setShowAppendCampaignModal(false); setSelectedRowIds(new Set()); fetchTableData(); }}
        selectedRowsData={selectedRowsData}
        tableName={tableName}
        isRepetitive={false}
      />
      <AppendToCampaignModal 
        isOpen={showAppendRepetitiveModal} 
        onClose={() => setShowAppendRepetitiveModal(false)}
        onSuccess={() => { setShowAppendRepetitiveModal(false); setSelectedRowIds(new Set()); fetchTableData(); }}
        selectedRowsData={selectedRowsData}
        tableName={tableName}
        isRepetitive={true}
      />

      <CampaignBuilderModal 
        isOpen={showCampaignModal} 
        onClose={() => setShowCampaignModal(false)}
        onSuccess={() => { setShowCampaignModal(false); setSelectedRowIds(new Set()); fetchTableData(); }}
        selectedRowsData={selectedRowsData}
        tableName={tableName}
        visibleColumns={visibleColumns}
      />
      <CampaignBuilderModal 
        isOpen={showRepetitiveModal} 
        onClose={() => { setShowRepetitiveModal(false); setSelectedRowIds(new Set()); }}
        selectedRowsData={selectedRowsData}
        tableName={tableName}
        visibleColumns={visibleColumns}
        isRepetitive={true}
      />

      {/* Overwrite Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h2 className="text-xl font-bold text-slate-800">Încărcare Date / Upload Data</h2>
              <button onClick={() => { setIsModalOpen(false); resetModal(); }} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              {modalStep === 1 ? (
                <form onSubmit={analyzeFile} className="flex flex-col gap-5">
                  {data.length > 0 ? (
                    <div className="p-4 bg-indigo-50 text-indigo-800 rounded-lg flex gap-3 text-sm border border-indigo-200">
                      <AlertCircle className="shrink-0" size={20} />
                      <div>
                        <p><strong>SINCRONIZARE INTELIGENTĂ:</strong></p>
                        <ul className="list-disc ml-5 mt-1">
                          <li>Tabelul conține deja date. Importul va rula în modul de sincronizare inteligentă.</li>
                          <li>Rândurile care nu se mai găsesc în noul fișier vor fi marcate ca "Exclus/Lipsă" în campanii.</li>
                          <li>Rândurile existente vor fi actualizate cu noile date.</li>
                          <li>Rândurile noi vor fi adăugate la final.</li>
                        </ul>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-emerald-50 text-emerald-800 rounded-lg flex gap-3 text-sm border border-emerald-200">
                      <AlertCircle className="shrink-0" size={20} />
                      <p><strong>INFORMAȚIE:</strong> Tabelul este gol. Toate rândurile din fișier vor fi inserate.</p>
                    </div>
                  )}

                  <div>
                    <label htmlFor="file-upload-overwrite" className="border-2 border-dashed border-indigo-300 rounded-xl p-6 text-center hover:bg-indigo-50 transition-colors bg-indigo-50/30 cursor-pointer flex flex-col items-center justify-center w-full">
                      <input type="file" id="file-upload-overwrite" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileChange} />
                      <Upload size={32} className="text-indigo-600 mb-3" />
                      <span className="font-semibold text-slate-800">{excelFile ? excelFile.name : 'Selectează fișierul / Select file (Excel / CSV)'}</span>
                    </label>
                  </div>
                  <button type="submit" className="w-full py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 mt-2">
                    Analizează Datele / Analyze Data
                  </button>
                </form>
              ) : (
                <div className="flex flex-col gap-6">
                  {data.length === 0 ? (
                    <div className="bg-emerald-50 text-emerald-800 p-4 rounded-lg flex items-start gap-3">
                      <CheckCircle2 className="shrink-0 mt-0.5" size={20} />
                      <div>
                        <p className="text-sm">Se vor insera / Will insert <strong>{parsedRows.length} rânduri noi / new rows</strong>. Analizați corespondența coloanelor mai jos. Dacă o coloană nouă apare în Excel, aceasta va fi adăugată automat la structura tabelului curent.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-indigo-50 border border-indigo-200 p-5 rounded-xl flex flex-col gap-4">
                      <div className="flex items-center gap-3 text-indigo-800">
                        <AlertCircle className="shrink-0" size={20} />
                        <h3 className="font-bold">Sincronizare Inteligentă</h3>
                      </div>
                      
                      <div className="flex flex-col gap-2">
                        <label className="text-sm font-bold text-slate-700">Alege coloana unică pentru a potrivi rândurile (ex: Email, Nume):</label>
                        <select 
                          value={matchColumn} 
                          onChange={e => setMatchColumn(e.target.value)}
                          className="p-3 border border-slate-300 rounded-lg text-sm bg-white"
                        >
                          <option value="">-- Selectează o coloană --</option>
                          {detectedColumns.filter(c => c.matchesExisting).map(c => (
                            <option key={c.sanitized} value={c.sanitized}>{c.original} (→ {c.sanitized})</option>
                          ))}
                        </select>
                      </div>

                      {matchColumn && (
                        <div className="mt-2 grid grid-cols-3 gap-3">
                          <div className="bg-white p-3 rounded-lg border text-center shadow-sm">
                            <div className="text-2xl font-black text-emerald-600">
                              {parsedRows.filter(r => {
                                const newCol = detectedColumns.find(c => c.sanitized === matchColumn)?.original;
                                return !data.some(d => String(d[matchColumn]) === String(r[newCol]));
                              }).length}
                            </div>
                            <div className="text-xs font-bold text-slate-500 uppercase">Rânduri Noi</div>
                          </div>
                          <div className="bg-white p-3 rounded-lg border text-center shadow-sm">
                            <div className="text-2xl font-black text-indigo-600">
                              {parsedRows.filter(r => {
                                const newCol = detectedColumns.find(c => c.sanitized === matchColumn)?.original;
                                return data.some(d => String(d[matchColumn]) === String(r[newCol]));
                              }).length}
                            </div>
                            <div className="text-xs font-bold text-slate-500 uppercase">Actualizate</div>
                          </div>
                          <div className="bg-white p-3 rounded-lg border border-red-200 text-center shadow-sm">
                            <div className="text-2xl font-black text-red-600">
                              {data.filter(d => {
                                const newCol = detectedColumns.find(c => c.sanitized === matchColumn)?.original;
                                return !parsedRows.some(r => String(r[newCol]) === String(d[matchColumn]));
                              }).length}
                            </div>
                            <div className="text-xs font-bold text-red-500 uppercase">Lipsă / Excluse</div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 font-bold text-sm text-slate-700">Mapare Coloane</div>
                    <div className="max-h-64 overflow-y-auto p-2">
                      {detectedColumns.map((col, idx) => (
                        <div key={idx} className="flex items-center gap-3 p-3 hover:bg-slate-50 rounded-lg cursor-pointer">
                          <input type="checkbox" className="w-5 h-5 text-amber-600 rounded" checked={col.selected} 
                            onChange={() => {
                              const newCols = [...detectedColumns];
                              newCols[idx].selected = !newCols[idx].selected;
                              setDetectedColumns(newCols);
                            }} 
                          />
                          <div className="flex flex-col">
                            <span className="font-semibold text-slate-800">{col.original}</span>
                            <span className="text-xs text-slate-500 font-mono">
                              {col.matchesExisting ? `Se suprapune cu DB: ${col.sanitized}` : `Coloană NOUĂ: ${col.sanitized}`}
                            </span>
                          </div>
                          {col.matchesExisting && <span className="ml-auto bg-green-100 text-green-700 text-[10px] font-bold px-2 py-1 rounded">MATCH</span>}
                          {!col.matchesExisting && <span className="ml-auto bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-1 rounded">ADD</span>}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <button onClick={() => setModalStep(1)} disabled={uploading} className="flex-1 py-3 border border-slate-300 text-slate-700 font-bold rounded-lg hover:bg-slate-50">Înapoi / Back</button>
                    <button onClick={executeImport} disabled={uploading || (data.length > 0 && !matchColumn)} className={`flex-[2] py-3 text-white font-bold rounded-lg flex justify-center items-center ${(data.length > 0 && !matchColumn) ? 'bg-slate-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
                      {uploading ? 'Se procesează / Processing...' : (data.length > 0 ? 'Sincronizează Datele / Sync Data' : 'Adaugă Datele Noi / Append')}
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

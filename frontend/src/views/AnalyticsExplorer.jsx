import React, { useState, useEffect } from 'react';
import { 
  Database, 
  Table as TableIcon, 
  ChevronRight, 
  Plus, 
  Trash2, 
  Play, 
  BarChart3, 
  PieChart as PieIcon,
  Download, 
  Grid, 
  TrendingUp, 
  Hash, 
  Filter, 
  RefreshCw, 
  AlertCircle,
  X,
  Search,
  ArrowRight,
  Link2
} from 'lucide-react';
import axios from 'axios';
import { API_URL } from '../config';

const AnalyticsExplorer = () => {
  // Helper for case-insensitive column key mapping
  const getRowVal = (row, key) => {
    if (!row) return null;
    if (row[key] !== undefined) return row[key];
    
    // Check case-insensitive exact key
    const lowerKey = key.toLowerCase();
    let foundKey = Object.keys(row).find(k => k.toLowerCase() === lowerKey);
    if (foundKey !== undefined) return row[foundKey];

    // If key has a dot (e.g. 'table.column'), try matching only the column name part
    if (key.includes('.')) {
      const parts = key.split('.');
      const colPart = parts[parts.length - 1].toLowerCase();
      foundKey = Object.keys(row).find(k => k.toLowerCase() === colPart);
      if (foundKey !== undefined) return row[foundKey];
    }

    return null;
  };

  // DB & Table Selectors
  const [engine, setEngine] = useState('maria');
  const [db, setDb] = useState(import.meta.env.VITE_MARIA_DB_NAME || 'recaudacion2');
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState('');
  const [baseColumns, setBaseColumns] = useState([]);
  const [joinedColumns, setJoinedColumns] = useState([]);
  const [potentialRelations, setPotentialRelations] = useState([]);
  const [activeJoins, setActiveJoins] = useState([]);
  const [relationsLoading, setRelationsLoading] = useState(false);
  const [selectedRelationDb, setSelectedRelationDb] = useState('all');
  const [selectedJoinColumn, setSelectedJoinColumn] = useState('all');

  const toggleJoinColumn = (colName) => {
    if (selectedJoinColumn === 'all') {
      setSelectedJoinColumn([colName]);
    } else {
      const isAlreadySelected = selectedJoinColumn.includes(colName);
      let updated;
      if (isAlreadySelected) {
        updated = selectedJoinColumn.filter(c => c !== colName);
      } else {
        updated = [...selectedJoinColumn, colName];
      }
      if (updated.length === 0) {
        setSelectedJoinColumn('all');
      } else {
        setSelectedJoinColumn(updated);
      }
    }
  };

  const columns = [
    ...(activeJoins.length > 0 ? baseColumns.map(c => ({ ...c, name: `${selectedTable}.${c.name}` })) : baseColumns),
    ...joinedColumns
  ];
  
  // Pivot & Query Configuration
  const [columnSearch, setColumnSearch] = useState('');
  const [groupByCols, setGroupByCols] = useState([]);
  const [measures, setMeasures] = useState([]);
  const [filters, setFilters] = useState([]);
  const [limit, setLimit] = useState(100);
  
  // Results & UI State
  const [loading, setLoading] = useState(false);
  const [tablesLoading, setTablesLoading] = useState(false);
  const [error, setError] = useState(null);
  const [queryResult, setQueryResult] = useState(null);
  const [executedConfig, setExecutedConfig] = useState({
    groupByCols: [],
    measures: []
  });
  const [activeTab, setActiveTab] = useState('chart'); // 'chart' | 'grid'
  const [chartType, setChartType] = useState('bar'); // 'bar' | 'donut'
  const [hoveredBarIndex, setHoveredBarIndex] = useState(null);
  const [searchTableQuery, setSearchTableQuery] = useState('');
  const [relationSearch, setRelationSearch] = useState('');

  // Drill Down detailed records state
  const [drillDownData, setDrillDownData] = useState(null);
  const [drillDownLoading, setDrillDownLoading] = useState(false);
  const [drillDownColumns, setDrillDownColumns] = useState([]);
  const [selectedGroupInfo, setSelectedGroupInfo] = useState(null);
  const [isDrillDownOpen, setIsDrillDownOpen] = useState(false);
  const [drillDownError, setDrillDownError] = useState(null);
  const [drillDownSearchQuery, setDrillDownSearchQuery] = useState('');
  const [drillDownPage, setDrillDownPage] = useState(0);
  const drillDownPageSize = 8;

  const availableDbs = engine === 'maria' ? [
    { id: 'infogov', name: 'InfoGov', color: '#3b82f6' },
    { id: 'contpres', name: 'ContPres', color: '#f59e0b' },
    { id: 'municipiov1', name: 'MunicipioV1', color: '#10b981' },
    { id: 'recahisto', name: 'RecaHisto', color: '#8b5cf6' },
    { id: import.meta.env.VITE_MARIA_DB_NAME || 'recaudacion2', name: 'Recaudación', color: '#6366f1' }
  ] : [
    { id: 'public', name: 'PostgreSQL', color: '#4f46e5' }
  ];

  const getAuthHeaders = () => {
    const token = localStorage.getItem('nomade_token');
    return { Authorization: `Bearer ${token}` };
  };

  // Fetch Tables
  useEffect(() => {
    const fetchTables = async () => {
      setTablesLoading(true);
      setError(null);
      try {
        const res = await axios.get(`${API_URL}/explorer/${engine}/${db}/tables`, { headers: getAuthHeaders() });
        setTables(Array.isArray(res.data) ? res.data.sort((a, b) => (b.rows || 0) - (a.rows || 0)) : []);
      } catch (err) {
        setError('Error al cargar tablas: ' + err.message);
      } finally {
        setTablesLoading(false);
      }
    };
    fetchTables();
    setSelectedTable('');
    setBaseColumns([]);
    setJoinedColumns([]);
    setActiveJoins([]);
    setPotentialRelations([]);
    setSelectedRelationDb('all');
    setSelectedJoinColumn('all');
    setRelationSearch('');
    setQueryResult(null);
    setGroupByCols([]);
    setMeasures([]);
    setFilters([]);
  }, [engine, db]);

  // Fetch Columns when table selected
  useEffect(() => {
    if (!selectedTable) return;
    const fetchColumns = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${API_URL}/explorer/${engine}/${db}/columns/${selectedTable}`, { headers: getAuthHeaders() });
        setBaseColumns(res.data || []);
        
        // Auto-configure a default measure (COUNT of records) and a default dimension if available
        const defaultMeasures = [{ col: '*', op: 'COUNT', alias: 'Cantidad_Registros' }];
        setMeasures(defaultMeasures);
        
        // Find a promising grouping column
        const promisingDim = res.data.find(c => 
          ['PeriCtct', 'BimeCtct', 'CodiOfic', 'EstaCtct', 'CodiConc', 'Source', 'engine'].includes(c.name)
        ) || res.data[0];
        
        if (promisingDim) {
          setGroupByCols([promisingDim.name]);
        } else {
          setGroupByCols([]);
        }
      } catch (err) {
        setError('Error al cargar columnas: ' + err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchColumns();
  }, [selectedTable]);

  // Fetch potential relations when selectedTable changes
  useEffect(() => {
    if (!selectedTable) {
      setPotentialRelations([]);
      setActiveJoins([]);
      setSelectedRelationDb('all');
      setSelectedJoinColumn('all');
      return;
    }
    const fetchRelations = async () => {
      setRelationsLoading(true);
      try {
        const res = await axios.get(`${API_URL}/explorer/${engine}/${db}/relations/${selectedTable}`, { headers: getAuthHeaders() });
        setPotentialRelations(res.data || []);
      } catch (err) {
        console.error('Error fetching relations:', err);
      } finally {
        setRelationsLoading(false);
      }
    };
    fetchRelations();
    setActiveJoins([]);
    setSelectedRelationDb('all');
    setSelectedJoinColumn('all');
    setRelationSearch('');
  }, [selectedTable, engine, db]);

  // Fetch columns of all joined tables dynamically
  useEffect(() => {
    if (!selectedTable) return;
    
    const fetchJoinedColumns = async () => {
      if (activeJoins.length === 0) {
        setJoinedColumns([]);
        return;
      }
      
      const newJoinedColumns = [];
      for (const join of activeJoins) {
        try {
          let joinDb = db;
          let joinTable = join.table;
          if (join.table.includes('.')) {
            const parts = join.table.split('.');
            joinDb = parts[0];
            joinTable = parts[1];
          }
          const res = await axios.get(`${API_URL}/explorer/${engine}/${joinDb}/columns/${joinTable}`, { headers: getAuthHeaders() });
          
          if (Array.isArray(res.data)) {
            const qualified = res.data.map(c => ({
              name: `${join.table}.${c.name}`,
              type: c.type,
              nullable: c.nullable,
              originTable: join.table
            }));
            newJoinedColumns.push(...qualified);
          }
        } catch (err) {
          console.error(`Error fetching columns for joined table ${join.table}:`, err);
        }
      }
      setJoinedColumns(newJoinedColumns);
    };
    
    fetchJoinedColumns();
  }, [activeJoins, selectedTable, engine, db]);

  const addJoin = (type, rel) => {
    const leftCols = rel.matches.map(m => m.leftCol);
    const rightCols = rel.matches.map(m => m.rightCol);
    
    const newJoin = {
      type,
      table: rel.table,
      leftCol: leftCols.length === 1 ? leftCols[0] : leftCols,
      rightCol: rightCols.length === 1 ? rightCols[0] : rightCols
    };
    setActiveJoins([...activeJoins, newJoin]);
  };

  const removeJoin = (index) => {
    setActiveJoins(activeJoins.filter((_, i) => i !== index));
  };

  // Reset selected dimensions, measures, filters on join change to prevent syntax errors
  useEffect(() => {
    if (!selectedTable) return;
    
    // Clear dimensions, filters, and results
    setGroupByCols([]);
    setFilters([]);
    setQueryResult(null);
    setExecutedConfig({ groupByCols: [], measures: [] });
    
    // Reset measures to default Count
    const defaultMeasures = [{ col: '*', op: 'COUNT', alias: 'Cantidad_Registros' }];
    setMeasures(defaultMeasures);
    
    // Select the first base column fully qualified
    if (baseColumns.length > 0) {
      const prefix = activeJoins.length > 0 ? `${selectedTable}.` : '';
      const promisingDim = baseColumns.find(c => 
        ['PeriCtct', 'BimeCtct', 'CodiOfic', 'EstaCtct', 'CodiConc', 'Source', 'engine'].includes(c.name)
      ) || baseColumns[0];
      if (promisingDim) {
        setGroupByCols([`${prefix}${promisingDim.name}`]);
      }
    }
  }, [activeJoins.length, selectedTable]);

  // Generate real-time copyable SQL query matching backend query builder algorithm
  const generateSQLPreview = () => {
    if (!selectedTable) return '-- Selecciona una tabla para construir la consulta...';

    const sanitize = (val) => val.replace(/[^a-zA-Z0-9_*.]/g, '');
    const cleanSelect = groupByCols.map(sanitize);
    const cleanGroupBy = groupByCols.map(sanitize);
    
    let projections = [];
    if (cleanSelect.length > 0) {
      if (engine === 'pg') {
        projections.push(...cleanSelect.map(col => {
          if (col === '*') return '*';
          return col.split('.').map(p => p === '*' ? '*' : `"${p}"`).join('.');
        }));
      } else {
        projections.push(...cleanSelect);
      }
    }
    
    measures.forEach(agg => {
      const op = agg.op.toUpperCase();
      const targetCol = agg.col === '*' ? '*' : sanitize(agg.col);
      const alias = sanitize(agg.alias || `${op}_${targetCol.replace('.', '_')}`);
      if (engine === 'pg') {
        const pgCol = targetCol === '*' ? '*' : targetCol.split('.').map(p => p === '*' ? '*' : `"${p}"`).join('.');
        projections.push(`${op}(${pgCol}) as "${alias}"`);
      } else {
        projections.push(`${op}(${targetCol}) as \`${alias}\``);
      }
    });

    if (projections.length === 0) {
      projections.push('*');
    }

    let fromClause = '';
    if (engine === 'pg') {
      fromClause = `FROM "${selectedTable}"`;
      activeJoins.forEach(j => {
        const type = j.type || 'INNER JOIN';
        const rightTable = sanitize(j.table);
        
        let onConditions = [];
        if (Array.isArray(j.leftCol) && Array.isArray(j.rightCol)) {
          j.leftCol.forEach((lc, idx) => {
            const rc = j.rightCol[idx];
            if (lc && rc) {
              onConditions.push(`"${selectedTable}"."${sanitize(lc)}" = "${rightTable}"."${sanitize(rc)}"`);
            }
          });
        } else {
          const leftCol = sanitize(j.leftCol);
          const rightCol = sanitize(j.rightCol);
          onConditions.push(`"${selectedTable}"."${leftCol}" = "${rightTable}"."${rightCol}"`);
        }
        
        fromClause += `\n${type} "${rightTable}" ON ${onConditions.join(' AND ')}`;
      });
    } else {
      fromClause = `FROM ${db}.${selectedTable}`;
      activeJoins.forEach(j => {
        const type = j.type || 'INNER JOIN';
        const rightTable = sanitize(j.table);
        const rightTableQualified = rightTable.includes('.') ? rightTable : `${db}.${rightTable}`;
        
        let onConditions = [];
        if (Array.isArray(j.leftCol) && Array.isArray(j.rightCol)) {
          j.leftCol.forEach((lc, idx) => {
            const rc = j.rightCol[idx];
            if (lc && rc) {
              onConditions.push(`${db}.${selectedTable}.${sanitize(lc)} = ${rightTableQualified}.${sanitize(rc)}`);
            }
          });
        } else {
          const leftCol = sanitize(j.leftCol);
          const rightCol = sanitize(j.rightCol);
          onConditions.push(`${db}.${selectedTable}.${leftCol} = ${rightTableQualified}.${rightCol}`);
        }
        
        fromClause += `\n${type} ${rightTableQualified} ON ${onConditions.join(' AND ')}`;
      });
    }

    let sql = `SELECT ${projections.join(', ')}\n${fromClause}`;

    let whereClauses = [];
    filters.forEach(filter => {
      const col = sanitize(filter.col);
      const op = filter.op;
      const val = filter.val;
      if (!col || !op) return;

      if (['=', '>', '<', '<=', '>=', '!=', 'LIKE'].includes(op)) {
        let valueStr = op === 'LIKE' ? `'%${val}%'` : `'${val}'`;
        if (val && !isNaN(val)) {
          valueStr = val;
        }
        if (engine === 'pg') {
          const pgCol = col.split('.').map(p => p === '*' ? '*' : `"${p}"`).join('.');
          whereClauses.push(`${pgCol}::text ${op} ${valueStr}`);
        } else {
          whereClauses.push(`${col} ${op} ${valueStr}`);
        }
      }
    });

    if (whereClauses.length > 0) {
      sql += `\nWHERE ${whereClauses.join(' AND ')}`;
    }

    if (cleanGroupBy.length > 0) {
      if (engine === 'pg') {
        sql += `\nGROUP BY ${cleanGroupBy.map(col => col.split('.').map(p => p === '*' ? '*' : `"${p}"`).join('.')).join(', ')}`;
      } else {
        sql += `\nGROUP BY ${cleanGroupBy.join(', ')}`;
      }
    }

    sql += `\nLIMIT ${limit};`;
    return sql;
  };

  // Run dynamic analysis query
  const executeAnalysis = async () => {
    if (!selectedTable) return;
    setLoading(true);
    setError(null);
    try {
      const payload = {
        engine,
        db,
        table: selectedTable,
        selectColumns: groupByCols,
        aggregates: measures,
        groupBy: groupByCols,
        filters: filters,
        joins: activeJoins,
        limit
      };

      const res = await axios.post(`${API_URL}/explorer/query`, payload, { headers: getAuthHeaders() });
      setQueryResult(res.data);
      setExecutedConfig({
        groupByCols: [...groupByCols],
        measures: [...measures]
      });
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  // Trigger Drill Down Detailed Records Modal
  const triggerDrillDown = async (groupRow) => {
    setDrillDownLoading(true);
    setDrillDownError(null);
    setIsDrillDownOpen(true);
    setDrillDownPage(0);
    setDrillDownSearchQuery('');

    const groupDesc = executedConfig.groupByCols.map(col => {
      const val = getRowVal(groupRow, col);
      return `${col}: ${val === null ? 'N/A' : val}`;
    }).join(', ') || 'Todo';
    setSelectedGroupInfo({
      desc: groupDesc,
      values: groupRow
    });

    try {
      const groupFilters = [...filters];
      executedConfig.groupByCols.forEach(col => {
        const val = getRowVal(groupRow, col);
        if (val !== undefined && val !== null) {
          groupFilters.push({
            col: col,
            op: '=',
            val: String(val)
          });
        }
      });

      const payload = {
        engine,
        db,
        table: selectedTable,
        selectColumns: [], // Returns all raw fields
        aggregates: [],
        groupBy: [],
        filters: groupFilters,
        limit: 300 // Maximum raw detailed rows to load
      };

      const res = await axios.post(`${API_URL}/explorer/query`, payload, { headers: getAuthHeaders() });
      if (res.data && res.data.success) {
        setDrillDownData(res.data.data);
        if (res.data.data.length > 0) {
          setDrillDownColumns(Object.keys(res.data.data[0]));
        } else {
          setDrillDownColumns([]);
        }
      } else {
        throw new Error('Respuesta de datos inválida del servidor.');
      }
    } catch (err) {
      setDrillDownError('Error al cargar registros individuales: ' + (err.response?.data?.error || err.message));
    } finally {
      setDrillDownLoading(false);
    }
  };

  // Export drill-down detailed subset to CSV
  const exportDrillDownCSV = () => {
    if (!drillDownData || !drillDownData.length) return;
    const headers = Object.keys(drillDownData[0]);
    const csvContent = [
      headers.join(','),
      ...drillDownData.map(row => 
        headers.map(h => {
          const val = row[h] === null ? '' : String(row[h]);
          return `"${val.replace(/"/g, '""')}"`;
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `detalle_${selectedTable}_${selectedGroupInfo?.desc.replace(/[: ,]/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Add Dynamic Measure
  const addMeasure = () => {
    const numericCols = columns.filter(c => c.type.toLowerCase().includes('int') || c.type.toLowerCase().includes('decimal') || c.type.toLowerCase().includes('double'));
    const defaultCol = numericCols.length > 0 ? numericCols[0].name : '*';
    setMeasures([...measures, { col: defaultCol, op: 'SUM', alias: `Total_${defaultCol.replace('*', 'Regs')}` }]);
  };

  // Remove Measure
  const removeMeasure = (index) => {
    setMeasures(measures.filter((_, i) => i !== index));
  };

  // Add Dynamic Filter
  const addFilter = () => {
    if (columns.length === 0) return;
    setFilters([...filters, { col: columns[0].name, op: '=', val: '' }]);
  };

  // Remove Filter
  const removeFilter = (index) => {
    setFilters(filters.filter((_, i) => i !== index));
  };

  // Toggle Group By Column
  const toggleGroupBy = (colName) => {
    if (groupByCols.includes(colName)) {
      setGroupByCols(groupByCols.filter(c => c !== colName));
    } else {
      setGroupByCols([...groupByCols, colName]);
    }
  };

  // Helper to format currency
  const formatVal = (val, isPercentage = false) => {
    const num = parseFloat(val);
    if (isNaN(num)) return val;
    if (num > 1000) {
      return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(num);
    }
    return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(num) + (isPercentage ? '%' : '');
  };

  // Export results to CSV
  const exportToCSV = () => {
    if (!queryResult || !queryResult.data.length) return;
    const headers = Object.keys(queryResult.data[0]);
    const csvContent = [
      headers.join(','),
      ...queryResult.data.map(row => 
        headers.map(h => {
          const val = row[h] === null ? '' : String(row[h]);
          return `"${val.replace(/"/g, '""')}"`;
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `analisis_${selectedTable}_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // SVG Chart Computations
  const getChartData = () => {
    if (!queryResult || !queryResult.data || queryResult.data.length === 0) return [];
    
    // X axis label comes from grouping columns
    // Y value comes from the first measure
    const xKey = executedConfig.groupByCols.join(' - ') || 'Fila';
    const yKey = executedConfig.measures.length > 0 ? executedConfig.measures[0].alias || `${executedConfig.measures[0].op}_${executedConfig.measures[0].col}` : '';
    
    if (!yKey) return [];

    return queryResult.data.map((row, idx) => {
      // Build an X label by concatenating the group columns
      const label = executedConfig.groupByCols.map(c => String(getRowVal(row, c) === null ? 'N/A' : getRowVal(row, c))).join(' / ') || `Fila ${idx+1}`;
      const value = parseFloat(row[yKey]) || 0;
      return { label, value, row };
    });
  };

  const chartData = getChartData();
  const maxChartVal = chartData.length > 0 ? Math.max(...chartData.map(d => d.value), 1) : 1;

  // Filtered Tables
  const filteredTables = tables.filter(t => 
    t.name.toLowerCase().includes(searchTableQuery.toLowerCase())
  );

  const selectedTableObj = tables.find(t => t.name === selectedTable);
  const isLargeTable = selectedTableObj && selectedTableObj.rows > 50000;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', height: '100%', background: '#0a0a0f', color: '#f3f4f6', gap: '1.5rem', padding: '1rem 2rem', overflow: 'hidden' }}>
      
      {/* 1. Sidebar - Data Source & Tables */}
      <div style={{ background: 'rgba(13, 13, 20, 0.7)', backdropFilter: 'blur(12px)', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        
        {/* Connection Switcher */}
        <div style={{ padding: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(255,255,255,0.02)', padding: '0.25rem', borderRadius: '12px', marginBottom: '1rem' }}>
            <button 
              style={{ flex: 1, padding: '0.5rem', borderRadius: '8px', border: 'none', background: engine === 'maria' ? '#6366f1' : 'transparent', color: 'white', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', transition: 'all 0.2s' }}
              onClick={() => { setEngine('maria'); setDb(import.meta.env.VITE_MARIA_DB_NAME || 'recaudacion2'); }}
            >
              MariaDB
            </button>
            <button 
              style={{ flex: 1, padding: '0.5rem', borderRadius: '8px', border: 'none', background: engine === 'pg' ? '#4f46e5' : 'transparent', color: 'white', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', transition: 'all 0.2s' }}
              onClick={() => { setEngine('pg'); setDb('public'); }}
            >
              PostgreSQL
            </button>
          </div>

          <div style={{ display: 'flex', gap: '0.35rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
            {availableDbs.map(dItem => (
              <button
                key={dItem.id}
                style={{
                  padding: '0.4rem 0.75rem',
                  borderRadius: '8px',
                  border: 'none',
                  fontSize: '0.75rem',
                  background: db === dItem.id ? dItem.color : 'rgba(255,255,255,0.02)',
                  color: 'white',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s'
                }}
                onClick={() => setDb(dItem.id)}
              >
                {dItem.name}
              </button>
            ))}
          </div>
        </div>

        {/* Tables Search */}
        <div style={{ padding: '0.75rem 1.25rem', position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: '2rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
          <input 
            type="text" 
            placeholder="Buscar tabla..." 
            value={searchTableQuery}
            onChange={(e) => setSearchTableQuery(e.target.value)}
            style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '0.5rem 0.5rem 0.5rem 2.25rem', color: 'white', fontSize: '0.8rem' }}
          />
        </div>

        {/* Tables List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem 1.25rem' }}>
          {tablesLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
              <RefreshCw className="animate-spin" size={24} style={{ opacity: 0.3 }} />
            </div>
          ) : filteredTables.length > 0 ? (
            filteredTables.map(t => {
              const active = selectedTable === t.name;
              return (
                <div 
                  key={t.name}
                  onClick={() => setSelectedTable(t.name)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.75rem 0.85rem',
                    borderRadius: '12px',
                    marginBottom: '0.5rem',
                    cursor: 'pointer',
                    background: active ? 'rgba(99, 102, 241, 0.12)' : 'transparent',
                    border: active ? '1px solid rgba(99, 102, 241, 0.25)' : '1px solid transparent',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
                  onMouseOut={(e) => { if (!active) e.currentTarget.style.background = 'transparent' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', overflow: 'hidden' }}>
                    <TableIcon size={15} style={{ color: active ? '#6366f1' : '#a1a1aa' }} />
                    <span style={{ fontSize: '0.8rem', fontWeight: active ? 600 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
                  </div>
                  <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>{t.rows?.toLocaleString()}</span>
                </div>
              );
            })
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem', opacity: 0.4, fontSize: '0.8rem' }}>No se encontraron tablas.</div>
          )}
        </div>
      </div>

      {/* 2. Main Analytics Creator Area */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%', overflowY: 'auto', paddingRight: '0.75rem' }}>
        
        {!selectedTable ? (
          /* Empty State: Prompt selection */
          <div style={{ flex: 1, background: 'rgba(13, 13, 20, 0.4)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem', textAlign: 'center' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.2)', display: 'flex', alignItems: 'center', justify: 'center', marginBottom: '2rem' }}>
              <TrendingUp size={36} style={{ color: '#6366f1' }} />
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.5rem' }}>Explorador Analítico de Datos</h2>
            <p style={{ color: '#9ca3af', maxWidth: '480px', fontSize: '0.9rem', lineHeight: '1.6' }}>
              Selecciona una tabla en el menú lateral para iniciar un panel dinámico al estilo PowerBI. Podrás agrupar columnas, aplicar filtros lógicos y renderizar KPI's y visualizaciones de manera inmediata.
            </p>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: '#9ca3af', background: 'rgba(255,255,255,0.03)', padding: '0.5rem 1rem', borderRadius: '50px' }}>
                <Database size={12} /> MariaDB & PG
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: '#9ca3af', background: 'rgba(255,255,255,0.03)', padding: '0.5rem 1rem', borderRadius: '50px' }}>
                <BarChart3 size={12} /> Live Visualizations
              </span>
            </div>
          </div>
        ) : (
          /* Analysis Workspace */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Top Workspace Bar */}
            <div style={{ background: 'rgba(13, 13, 20, 0.7)', backdropFilter: 'blur(12px)', padding: '1.25rem 2rem', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '0.7rem', color: '#6366f1', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 700 }}>PANELES DE CONTROL & BI</span>
                <h1 style={{ margin: '0.25rem 0 0 0', fontSize: '1.5rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  {selectedTable}
                  <span style={{ fontSize: '0.8rem', background: 'rgba(255,255,255,0.05)', padding: '0.2rem 0.6rem', borderRadius: '6px', color: '#9ca3af', fontWeight: 400 }}>{db}</span>
                </h1>
              </div>
              
              <button 
                onClick={executeAnalysis}
                disabled={loading}
                style={{
                  background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                  border: 'none',
                  color: 'white',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '14px',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)' }}
                onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)' }}
              >
                {loading ? <RefreshCw className="animate-spin" size={16} /> : <Play size={16} />}
                Ejecutar Análisis
              </button>
            </div>

            {isLargeTable && (
              <div style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: '16px', padding: '1rem 1.5rem', display: 'flex', gap: '0.75rem', alignItems: 'center', color: '#fbbf24' }}>
                <AlertCircle size={18} style={{ flexShrink: 0 }} />
                <div style={{ fontSize: '0.8rem', lineHeight: '1.4' }}>
                  <strong>Tabla Grande Detectada:</strong> Esta tabla contiene <strong>{selectedTableObj.rows.toLocaleString()}</strong> registros. 
                  Para evitar demoras o límites de tiempo (90s), se recomienda aplicar <strong>Filtros Lógicos (Paso 4)</strong> para reducir el volumen de datos.
                </div>
              </div>
            )}

            {/* Sleek Column & Parameter Search Input */}
            <div style={{ 
              background: 'rgba(13, 13, 20, 0.5)', 
              backdropFilter: 'blur(12px)', 
              borderRadius: '20px', 
              border: '1px solid rgba(99, 102, 241, 0.12)', 
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.7rem', color: '#818cf8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>🔍 Filtrar Campos y Columnas</span>
                {columnSearch && (
                  <button 
                    onClick={() => setColumnSearch('')}
                    style={{ background: 'transparent', border: 'none', color: '#f87171', fontSize: '0.7rem', cursor: 'pointer', fontWeight: 600 }}
                  >
                    Limpiar Filtro ✕
                  </button>
                )}
              </div>
              <input
                type="text"
                placeholder="Escribe para buscar columnas al vuelo (ej: peri, nume, codi, obse, cuen)..."
                value={columnSearch}
                onChange={(e) => setColumnSearch(e.target.value)}
                style={{
                  width: '100%',
                  background: '#0a0a0f',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '12px',
                  padding: '0.75rem 1rem',
                  color: 'white',
                  fontSize: '0.8rem',
                  outline: 'none',
                  transition: 'all 0.2s'
                }}
                onFocus={(e) => { e.currentTarget.style.border = '1px solid rgba(99, 102, 241, 0.4)'; e.currentTarget.style.boxShadow = '0 0 10px rgba(99, 102, 241, 0.15)' }}
                onBlur={(e) => { e.currentTarget.style.border = '1px solid rgba(255,255,255,0.06)'; e.currentTarget.style.boxShadow = 'none' }}
              />
            </div>

            {/* Top Grid: Dimensions & Join Key */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
              
              {/* Group By Columns (Dimensions) */}
              <div style={{ background: 'rgba(13, 13, 20, 0.7)', backdropFilter: 'blur(12px)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.05)', padding: '1.5rem' }}>
                <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.95rem', fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Database size={16} style={{ color: '#6366f1' }} />
                  1. Dimensiones de Agrupación (Group By)
                </h3>
                
                <p style={{ fontSize: '0.8rem', color: '#9ca3af', margin: '-0.5rem 0 1.25rem 0' }}>Elige las columnas base para categorizar el resumen (e.g. Año, Oficina).</p>
                
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', maxHeight: '180px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                  {columns
                    .filter(c => c.name.toLowerCase().includes(columnSearch.toLowerCase()))
                    .map(col => {
                      const active = groupByCols.includes(col.name);
                    return (
                      <button
                        key={col.name}
                        onClick={() => toggleGroupBy(col.name)}
                        style={{
                          padding: '0.4rem 0.8rem',
                          borderRadius: '10px',
                          border: active ? '1px solid rgba(99, 102, 241, 0.4)' : '1px solid rgba(255,255,255,0.08)',
                          background: active ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                          color: active ? '#818cf8' : '#e4e4e7',
                          fontSize: '0.75rem',
                          fontWeight: active ? 600 : 400,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          transition: 'all 0.15s'
                        }}
                      >
                        {active && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#818cf8' }}></span>}
                        {col.name}
                        <span style={{ fontSize: '0.65rem', opacity: 0.4 }}>({col.type.split('(')[0]})</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Card 2: Campo Relacional para Cruces (Join Key) */}
              <div style={{ background: 'rgba(13, 13, 20, 0.7)', backdropFilter: 'blur(12px)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.05)', padding: '1.5rem' }}>
                <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.95rem', fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Link2 size={16} style={{ color: '#ec4899' }} />
                  2. Campo Relacional para Cruces (Join Key)
                </h3>
                
                <p style={{ fontSize: '0.8rem', color: '#9ca3af', margin: '-0.5rem 0 1.25rem 0' }}>Elige un campo específico para enfocar el escaneo de relaciones en la tarjeta 5, o déjalo en amplio.</p>
                
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', maxHeight: '180px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                  <button
                    onClick={() => setSelectedJoinColumn('all')}
                    style={{
                      padding: '0.4rem 0.8rem',
                      borderRadius: '10px',
                      border: selectedJoinColumn === 'all' ? '1px solid rgba(236, 72, 153, 0.4)' : '1px solid rgba(255,255,255,0.08)',
                      background: selectedJoinColumn === 'all' ? 'rgba(236, 72, 153, 0.15)' : 'transparent',
                      color: selectedJoinColumn === 'all' ? '#f472b6' : '#e4e4e7',
                      fontSize: '0.75rem',
                      fontWeight: selectedJoinColumn === 'all' ? 600 : 400,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      transition: 'all 0.15s'
                    }}
                  >
                    {selectedJoinColumn === 'all' && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f472b6' }}></span>}
                    Todos los campos 🌐
                  </button>

                  {columns
                    .filter(c => c.name.toLowerCase().includes(columnSearch.toLowerCase()))
                    .map(col => {
                      const active = Array.isArray(selectedJoinColumn) && selectedJoinColumn.includes(col.name);
                      return (
                      <button
                        key={col.name}
                        onClick={() => toggleJoinColumn(col.name)}
                        style={{
                          padding: '0.4rem 0.8rem',
                          borderRadius: '10px',
                          border: active ? '1px solid rgba(236, 72, 153, 0.4)' : '1px solid rgba(255,255,255,0.08)',
                          background: active ? 'rgba(236, 72, 153, 0.15)' : 'transparent',
                          color: active ? '#f472b6' : '#e4e4e7',
                          fontSize: '0.75rem',
                          fontWeight: active ? 600 : 400,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          transition: 'all 0.15s'
                        }}
                      >
                        {active && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f472b6' }}></span>}
                        {col.name}
                        <span style={{ fontSize: '0.65rem', opacity: 0.4 }}>({col.type.split('(')[0]})</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Middle Grid: Calculations & Filters */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
              
              {/* Calculations (Measures) */}
              <div style={{ background: 'rgba(13, 13, 20, 0.7)', backdropFilter: 'blur(12px)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.05)', padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Hash size={16} style={{ color: '#10b981' }} />
                    3. Métricas y Operaciones (Measures)
                  </h3>
                  
                  <button 
                    onClick={addMeasure}
                    style={{ background: 'rgba(16, 185, 129, 0.1)', border: 'none', color: '#34d399', width: '28px', height: '28px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                  >
                    <Plus size={16} />
                  </button>
                </div>

                <p style={{ fontSize: '0.8rem', color: '#9ca3af', margin: '-0.5rem 0 1.25rem 0' }}>Establece cálculos matemáticos sobre tus columnas numéricas.</p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '180px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                  {measures.map((m, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '0.5rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.04)' }}>
                      <select
                        value={m.op}
                        onChange={(e) => {
                          const updated = [...measures];
                          updated[idx].op = e.target.value;
                          setMeasures(updated);
                        }}
                        style={{ background: '#13131f', color: 'white', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '0.75rem', padding: '0.3rem 0.5rem' }}
                      >
                        <option value="COUNT">Recuento (COUNT)</option>
                        <option value="SUM">Suma (SUM)</option>
                        <option value="AVG">Promedio (AVG)</option>
                        <option value="MAX">Máximo (MAX)</option>
                        <option value="MIN">Mínimo (MIN)</option>
                      </select>

                      <select
                        value={m.col}
                        onChange={(e) => {
                          const updated = [...measures];
                          updated[idx].col = e.target.value;
                          updated[idx].alias = `${updated[idx].op}_${e.target.value.replace('*', 'Regs').replace(/\./g, '_')}`;
                          setMeasures(updated);
                        }}
                        style={{ flex: 1, background: '#13131f', color: 'white', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '0.75rem', padding: '0.3rem 0.5rem' }}
                      >
                        <option value="*">Todos los registros (*)</option>
                        {columns.map(c => (
                          <option key={c.name} value={c.name}>{c.name}</option>
                        ))}
                      </select>

                      <input 
                        type="text" 
                        placeholder="Alias"
                        value={m.alias}
                        onChange={(e) => {
                          const updated = [...measures];
                          updated[idx].alias = e.target.value;
                          setMeasures(updated);
                        }}
                        style={{ width: '120px', background: '#13131f', color: 'white', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '0.75rem', padding: '0.3rem 0.5rem' }}
                      />

                      <button 
                        onClick={() => removeMeasure(idx)}
                        style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.25rem' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  {measures.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '1rem', opacity: 0.4, fontSize: '0.75rem' }}>No hay métricas. Añade una con el botón de suma.</div>
                  )}
                </div>
              </div>

              {/* Filters panel */}
              <div style={{ background: 'rgba(13, 13, 20, 0.7)', backdropFilter: 'blur(12px)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.05)', padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Filter size={16} style={{ color: '#3b82f6' }} />
                    4. Filtros Lógicos Ad-Hoc
                  </h3>
                  <button 
                    onClick={addFilter}
                    style={{ background: 'rgba(59, 130, 246, 0.1)', border: 'none', color: '#60a5fa', width: '28px', height: '28px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                  >
                    <Plus size={16} />
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '200px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                  {filters.map((f, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '0.5rem 0.75rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.04)' }}>
                      <span style={{ fontSize: '0.7rem', color: '#3b82f6', fontWeight: 700, minWidth: '55px', textTransform: 'uppercase' }}>
                        {idx === 0 ? 'DONDE' : 'Y'}
                      </span>
                      
                      <select
                        value={f.col}
                        onChange={(e) => {
                          const updated = [...filters];
                          updated[idx].col = e.target.value;
                          setFilters(updated);
                        }}
                        style={{ flex: 1.5, background: '#13131f', color: 'white', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '0.75rem', padding: '0.35rem 0.5rem', minWidth: '120px' }}
                      >
                        {columns.map(c => (
                          <option key={c.name} value={c.name}>{c.name}</option>
                        ))}
                      </select>

                      <select
                        value={f.op}
                        onChange={(e) => {
                          const updated = [...filters];
                          updated[idx].op = e.target.value;
                          setFilters(updated);
                        }}
                        style={{ width: '100px', background: '#13131f', color: 'white', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '0.75rem', padding: '0.35rem 0.5rem' }}
                      >
                        <option value="=">=</option>
                        <option value="LIKE">LIKE (Contiene)</option>
                        <option value=">">&gt;</option>
                        <option value="<">&lt;</option>
                        <option value=">=">&gt;=</option>
                        <option value="<=">&lt;=</option>
                        <option value="!=">!=</option>
                      </select>

                      <input
                        type="text"
                        placeholder="Escribe el valor..."
                        value={f.val}
                        onChange={(e) => {
                          const updated = [...filters];
                          updated[idx].val = e.target.value;
                          setFilters(updated);
                        }}
                        style={{ flex: 1, background: '#13131f', color: 'white', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '0.75rem', padding: '0.35rem 0.5rem', minWidth: '100px' }}
                      />

                      <button 
                        onClick={() => removeFilter(idx)}
                        style={{ background: 'rgba(239, 68, 68, 0.1)', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.35rem', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  {filters.length === 0 && (
                    <div style={{ opacity: 0.4, fontSize: '0.75rem', padding: '0.5rem 0', textAlign: 'center' }}>No hay filtros aplicados. Todo el universo de la tabla está incluido.</div>
                  )}
                </div>
              </div>

            </div>

            {/* 5. Relaciones e Intersecciones Dinámicas (Joins) */}
            <div style={{ background: 'rgba(13, 13, 20, 0.7)', backdropFilter: 'blur(12px)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.05)', padding: '1.5rem' }}>
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.95rem', fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <TrendingUp size={16} style={{ color: '#a78bfa' }} />
                5. Relaciones e Intersecciones Dinámicas (Joins)
              </h3>
              
              <p style={{ fontSize: '0.8rem', color: '#9ca3af', margin: '-0.5rem 0 1.25rem 0' }}>
                El motor ha escaneado la base de datos y encontrado tablas con columnas en común. Elige relaciones para mezclar campos.
              </p>

              {relationsLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '1rem', opacity: 0.5 }}>
                  <RefreshCw className="animate-spin" size={16} />
                  <span style={{ fontSize: '0.75rem' }}>Escaneando relaciones en la base de datos...</span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  
                  {/* Active Joins Badge List */}
                  {activeJoins.length > 0 && (
                    <div>
                      <span style={{ fontSize: '0.7rem', color: '#a78bfa', fontWeight: 700, display: 'block', marginBottom: '0.5rem', textTransform: 'uppercase' }}>RELACIONES ACTIVAS EN LA CONSULTA:</span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                        {activeJoins.map((j, idx) => (
                          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(167, 139, 250, 0.15)', border: '1px solid rgba(167, 139, 250, 0.3)', borderRadius: '10px', padding: '0.4rem 0.8rem', fontSize: '0.75rem', color: '#c4b5fd' }}>
                            <strong>{j.type}</strong>
                            <span>
                              {Array.isArray(j.leftCol)
                                ? j.leftCol.map((lc, i) => `${selectedTable}.${lc} = ${j.table}.${j.rightCol[i]}`).join(' AND ')
                                : `${selectedTable}.${j.leftCol} = ${j.table}.${j.rightCol}`
                              }
                            </span>
                            <button 
                              onClick={() => removeJoin(idx)}
                              style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '0.1rem' }}
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Potential Relations Selector / Cards */}
                  <div>
                    {(() => {
                      const getDbOfRelation = (relTable) => {
                        if (!relTable) return '';
                        if (relTable.includes('.')) {
                          return relTable.split('.')[0];
                        }
                        return engine === 'pg' ? 'public' : db;
                      };
                      
                      // 1. First, filter by selected join column (Card 2)
                      const relationsFilteredByCol = selectedJoinColumn === 'all'
                        ? potentialRelations
                        : potentialRelations.filter(rel => 
                            Array.isArray(selectedJoinColumn)
                              ? selectedJoinColumn.some(col => col.toLowerCase() === rel.matchingCol.toLowerCase())
                              : rel.matchingCol.toLowerCase() === selectedJoinColumn.toLowerCase()
                          );

                      // 2. Next, extract unique databases from these filtered relations
                      const relatedDbs = Array.from(new Set(relationsFilteredByCol.map(rel => getDbOfRelation(rel.table))));
                      
                      // 3. Finally, filter by database select dropdown (Card 5 selector)
                      const displayedRelations = selectedRelationDb === 'all'
                        ? relationsFilteredByCol
                        : relationsFilteredByCol.filter(rel => getDbOfRelation(rel.table) === selectedRelationDb);

                      // 4. Additionally filter by relationSearch text keyword
                      const searchedRelations = relationSearch
                        ? displayedRelations.filter(rel => rel.table.toLowerCase().includes(relationSearch.toLowerCase()))
                        : displayedRelations;

                      // Group displayed relations by table name to handle composite keys beautifully!
                      const groupedRelationsMap = {};
                      searchedRelations.forEach(rel => {
                        if (!groupedRelationsMap[rel.table]) {
                          groupedRelationsMap[rel.table] = {
                            table: rel.table,
                            matches: []
                          };
                        }
                        if (!groupedRelationsMap[rel.table].matches.some(m => m.leftCol === rel.matchingCol && m.rightCol === rel.column)) {
                          groupedRelationsMap[rel.table].matches.push({
                            leftCol: rel.matchingCol,
                            rightCol: rel.column
                          });
                        }
                      });
                      const groupedRelationsList = Object.values(groupedRelationsMap);

                      return (
                        <>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                            <span style={{ fontSize: '0.7rem', color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase' }}>RELACIONES DISPONIBLES ENCONTRADAS:</span>
                            
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                              {/* Table relation search bar! */}
                              <input
                                type="text"
                                placeholder="🔍 Buscar tabla..."
                                value={relationSearch}
                                onChange={(e) => setRelationSearch(e.target.value)}
                                style={{
                                  background: '#13131f',
                                  color: 'white',
                                  border: '1px solid rgba(255,255,255,0.08)',
                                  borderRadius: '8px',
                                  fontSize: '0.7rem',
                                  padding: '0.25rem 0.5rem',
                                  outline: 'none',
                                  width: '130px',
                                  transition: 'all 0.2s'
                                }}
                                onFocus={(e) => e.currentTarget.style.border = '1px solid rgba(167, 139, 250, 0.4)'}
                                onBlur={(e) => e.currentTarget.style.border = '1px solid rgba(255,255,255,0.08)'}
                              />

                              {relatedDbs.length > 0 && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <span style={{ fontSize: '0.7rem', color: '#6b7280' }}>Base:</span>
                                  <select
                                    value={selectedRelationDb}
                                    onChange={(e) => setSelectedRelationDb(e.target.value)}
                                    style={{
                                      background: '#13131f',
                                      color: 'white',
                                      border: '1px solid rgba(255,255,255,0.08)',
                                      borderRadius: '8px',
                                      fontSize: '0.7rem',
                                      padding: '0.25rem 0.5rem',
                                      cursor: 'pointer',
                                      outline: 'none'
                                    }}
                                  >
                                    <option value="all">Todas ({potentialRelations.length})</option>
                                    {relatedDbs.map(d => {
                                      const count = potentialRelations.filter(r => getDbOfRelation(r.table) === d).length;
                                      return (
                                        <option key={d} value={d}>{d} ({count})</option>
                                      );
                                    })}
                                  </select>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {groupedRelationsList.length === 0 ? (
                            <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.01)', border: '1px dashed rgba(255,255,255,0.05)', borderRadius: '12px', textAlign: 'center', fontSize: '0.75rem', color: '#9ca3af', opacity: 0.5 }}>
                              {potentialRelations.length === 0 
                                ? 'No se detectaron tablas con columnas cruzadas directas. ¡Puedes agrupar y analizar sobre los campos de esta tabla!'
                                : 'No hay relaciones disponibles en la base de datos seleccionada.'}
                            </div>
                          ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem', maxHeight: '350px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                              {groupedRelationsList.map((rel, idx) => {
                                const isAlreadyActive = activeJoins.some(j => j.table === rel.table);
                                return (
                                  <div 
                                    key={idx}
                                    style={{ 
                                      background: 'rgba(255,255,255,0.02)', 
                                      border: '1px solid rgba(255,255,255,0.05)', 
                                      borderRadius: '12px', 
                                      padding: '0.75rem',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      justifyContent: 'space-between',
                                      gap: '0.5rem',
                                      opacity: isAlreadyActive ? 0.5 : 1
                                    }}
                                  >
                                    <div>
                                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        Tabla: {rel.table}
                                      </div>
                                      <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '0.25rem' }}>
                                        Vínculos:
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', marginTop: '0.25rem' }}>
                                          {rel.matches.map((m, mIdx) => (
                                            <div key={mIdx} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                              <code style={{ background: 'rgba(0,0,0,0.3)', padding: '0.1rem 0.25rem', borderRadius: '4px', color: '#f43f5e', fontSize: '0.65rem' }}>{m.leftCol}</code>
                                              <span style={{ fontSize: '0.65rem', opacity: 0.5 }}>➔</span>
                                              <code style={{ background: 'rgba(0,0,0,0.3)', padding: '0.1rem 0.25rem', borderRadius: '4px', color: '#34d399', fontSize: '0.65rem' }}>{m.rightCol}</code>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    </div>

                                    <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem' }}>
                                      <button
                                        disabled={isAlreadyActive}
                                        onClick={() => addJoin('INNER JOIN', rel)}
                                        style={{ 
                                          flex: 1,
                                          background: 'rgba(167, 139, 250, 0.1)', 
                                          border: '1px solid rgba(167, 139, 250, 0.2)', 
                                          color: '#c4b5fd', 
                                          borderRadius: '8px', 
                                          padding: '0.3rem 0.5rem', 
                                          fontSize: '0.7rem', 
                                          fontWeight: 600,
                                          cursor: isAlreadyActive ? 'not-allowed' : 'pointer',
                                          transition: 'all 0.2s'
                                        }}
                                        onMouseOver={(e) => { if(!isAlreadyActive) e.currentTarget.style.background = 'rgba(167, 139, 250, 0.2)' }}
                                        onMouseOut={(e) => { if(!isAlreadyActive) e.currentTarget.style.background = 'rgba(167, 139, 250, 0.1)' }}
                                      >
                                        Inner Join 🔗
                                      </button>
                                      <button
                                        disabled={isAlreadyActive}
                                        onClick={() => addJoin('LEFT JOIN', rel)}
                                        style={{ 
                                          flex: 1,
                                          background: 'rgba(59, 130, 246, 0.1)', 
                                          border: '1px solid rgba(59, 130, 246, 0.2)', 
                                          color: '#93c5fd', 
                                          borderRadius: '8px', 
                                          padding: '0.3rem 0.5rem', 
                                          fontSize: '0.7rem', 
                                          fontWeight: 600,
                                          cursor: isAlreadyActive ? 'not-allowed' : 'pointer',
                                          transition: 'all 0.2s'
                                        }}
                                        onMouseOver={(e) => { if(!isAlreadyActive) e.currentTarget.style.background = 'rgba(59, 130, 246, 0.2)' }}
                                        onMouseOut={(e) => { if(!isAlreadyActive) e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)' }}
                                      >
                                        Left Join ⛓️
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>

            {/* Real-time SQL Query Preview Card */}
            <div style={{ 
              background: 'rgba(13, 13, 20, 0.75)', 
              backdropFilter: 'blur(12px)', 
              borderRadius: '24px', 
              border: '1px solid rgba(99, 102, 241, 0.15)', 
              padding: '1.5rem', 
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
              position: 'relative',
              overflow: 'hidden'
            }}>
              {/* Subtle glowing background effect */}
              <div style={{ position: 'absolute', top: '-50px', right: '-50px', width: '150px', height: '150px', borderRadius: '50%', background: 'rgba(99, 102, 241, 0.08)', filter: 'blur(40px)', pointerEvents: 'none' }} />
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.65rem', background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', padding: '0.15rem 0.5rem', borderRadius: '50px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {engine === 'pg' ? 'PostgreSQL' : 'MariaDB'}
                  </span>
                  <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: 'white' }}>
                    Consulta SQL Generada al Vuelo (Live Preview)
                  </h4>
                </div>
                
                <button
                  onClick={() => {
                    const sqlText = generateSQLPreview();
                    navigator.clipboard.writeText(sqlText);
                    const btn = document.getElementById('sql-copy-btn');
                    if (btn) {
                      const originalHTML = btn.innerHTML;
                      btn.innerHTML = '¡Copiado! ✓';
                      btn.style.color = '#34d399';
                      btn.style.background = 'rgba(52, 211, 153, 0.15)';
                      btn.style.border = '1px solid rgba(52, 211, 153, 0.3)';
                      setTimeout(() => {
                        btn.innerHTML = originalHTML;
                        btn.style.color = '#c4b5fd';
                        btn.style.background = 'rgba(167, 139, 250, 0.1)';
                        btn.style.border = '1px solid rgba(167, 139, 250, 0.2)';
                      }, 2000);
                    }
                  }}
                  id="sql-copy-btn"
                  style={{
                    background: 'rgba(167, 139, 250, 0.1)',
                    border: '1px solid rgba(167, 139, 250, 0.2)',
                    borderRadius: '8px',
                    color: '#c4b5fd',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    padding: '0.3rem 0.6rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem'
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(167, 139, 250, 0.18)' }}
                  onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(167, 139, 250, 0.1)' }}
                >
                  Copiar SQL 📋
                </button>
              </div>

              <div style={{ position: 'relative' }}>
                <pre style={{ 
                  margin: 0, 
                  background: '#0a0a0f', 
                  border: '1px solid rgba(255,255,255,0.03)', 
                  borderRadius: '12px', 
                  padding: '1rem', 
                  fontSize: '0.75rem', 
                  color: '#e2e8f0', 
                  fontFamily: 'Consolas, Monaco, monospace', 
                  overflowX: 'auto',
                  maxHeight: '180px',
                  lineHeight: '1.45',
                  scrollbarWidth: 'thin'
                }}>
                  {generateSQLPreview()}
                </pre>
              </div>
              
              <span style={{ fontSize: '0.62rem', color: '#6b7280', display: 'block', marginTop: '0.5rem', textAlign: 'right' }}>
                💡 Puedes copiar esta sentencia directamente y ejecutarla en DBeaver o tu consola de base de datos.
              </span>
            </div>

            {/* Error Message */}
            {error && (
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '16px', padding: '1rem', display: 'flex', gap: '0.75rem', alignItems: 'center', color: '#f87171' }}>
                <AlertCircle size={18} />
                <span style={{ fontSize: '0.85rem' }}>{error}</span>
              </div>
            )}

            {/* Query Loading Spinner Card */}
            {loading && (
              <div style={{ 
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(139, 92, 246, 0.04) 100%)', 
                backdropFilter: 'blur(16px)', 
                border: '1px solid rgba(99, 102, 241, 0.25)', 
                borderRadius: '24px', 
                padding: '2.5rem 2rem', 
                display: 'flex', 
                flexDirection: 'column',
                alignItems: 'center', 
                justifyContent: 'center',
                gap: '1.25rem',
                boxShadow: '0 8px 32px rgba(99, 102, 241, 0.05)',
                marginTop: '0.5rem'
              }}>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {/* Glowing background ring */}
                  <div style={{ 
                    position: 'absolute', 
                    width: '56px', 
                    height: '56px', 
                    borderRadius: '50%', 
                    border: '2px dashed rgba(99, 102, 241, 0.2)', 
                  }} />
                  {/* Spinner icon */}
                  <RefreshCw 
                    size={36} 
                    className="animate-spin"
                    style={{ 
                      color: '#818cf8', 
                      filter: 'drop-shadow(0 0 8px rgba(99, 102, 241, 0.5))' 
                    }} 
                  />
                </div>
                
                <div style={{ textAlign: 'center' }}>
                  <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'white' }}>
                    Consultando Base de Datos...
                  </h4>
                  <p style={{ margin: '0.4rem 0 0 0', fontSize: '0.8rem', color: '#9ca3af', maxWidth: '420px', lineHeight: '1.4' }}>
                    Procesando registros en {engine === 'pg' ? 'PostgreSQL' : 'MariaDB'} ({db}). Las consultas complejas o uniones (Joins) pesadas pueden tomar unos segundos.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '0.35rem 0.75rem', borderRadius: '100px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }}></span>
                  <span style={{ fontSize: '0.7rem', color: '#a7f3d0', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                    Límite máximo de consulta: 90 segundos
                  </span>
                </div>
              </div>
            )}

            {/* 3. Output - KPIs & Visualizations */}
            {queryResult && queryResult.data && !loading && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '0.5rem' }}>
                
                {/* Dynamic Key Performance Indicators (KPIs) */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
                  
                  {/* Total Records Card */}
                  <div style={{ background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(99, 102, 241, 0.01) 100%)', backdropFilter: 'blur(12px)', border: '1px solid rgba(99, 102, 241, 0.15)', borderRadius: '20px', padding: '1.25rem' }}>
                    <span style={{ fontSize: '0.7rem', color: '#818cf8', fontWeight: 700, letterSpacing: '1px' }}>GRUPOS GENERADOS</span>
                    <h2 style={{ fontSize: '2rem', fontWeight: 800, margin: '0.25rem 0 0 0' }}>{queryResult.data.length}</h2>
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.7rem', color: '#9ca3af' }}>Divisiones de datos encontradas</p>
                  </div>

                  {/* Primary Sum Metric Card */}
                  {executedConfig.measures.length > 0 && (
                    <div style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, rgba(16, 185, 129, 0.01) 100%)', backdropFilter: 'blur(12px)', border: '1px solid rgba(16, 185, 129, 0.15)', borderRadius: '20px', padding: '1.25rem' }}>
                      <span style={{ fontSize: '0.7rem', color: '#34d399', fontWeight: 700, letterSpacing: '1px' }}>
                        {executedConfig.measures[0].alias.toUpperCase()} (SUMA)
                      </span>
                      <h2 style={{ fontSize: '2rem', fontWeight: 800, margin: '0.25rem 0 0 0', color: 'white' }}>
                        {formatVal(queryResult.data.reduce((acc, row) => acc + (parseFloat(getRowVal(row, executedConfig.measures[0].alias)) || 0), 0))}
                      </h2>
                      <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.7rem', color: '#9ca3af' }}>Métrica de mayor peso analítico</p>
                    </div>
                  )}

                  {/* Secondary Sum Metric Card */}
                  {executedConfig.measures.length > 1 && (
                    <div style={{ background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, rgba(59, 130, 246, 0.01) 100%)', backdropFilter: 'blur(12px)', border: '1px solid rgba(59, 130, 246, 0.15)', borderRadius: '20px', padding: '1.25rem' }}>
                      <span style={{ fontSize: '0.7rem', color: '#60a5fa', fontWeight: 700, letterSpacing: '1px' }}>
                        {executedConfig.measures[1].alias.toUpperCase()}
                      </span>
                      <h2 style={{ fontSize: '2rem', fontWeight: 800, margin: '0.25rem 0 0 0' }}>
                        {formatVal(queryResult.data.reduce((acc, row) => acc + (parseFloat(getRowVal(row, executedConfig.measures[1].alias)) || 0), 0))}
                      </h2>
                      <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.7rem', color: '#9ca3af' }}>Suma consolidada secundaria</p>
                    </div>
                  )}
                </div>

                {/* Dashboard Tabs Header */}
                <div style={{ background: 'rgba(13, 13, 20, 0.7)', backdropFilter: 'blur(12px)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={() => setActiveTab('chart')}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          padding: '0.5rem 1rem',
                          borderRadius: '10px',
                          border: 'none',
                          background: activeTab === 'chart' ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                          color: activeTab === 'chart' ? '#818cf8' : '#9ca3af',
                          fontWeight: 600,
                          fontSize: '0.8rem',
                          cursor: 'pointer'
                        }}
                      >
                        <BarChart3 size={15} /> Visualizaciones
                      </button>
                      <button
                        onClick={() => setActiveTab('grid')}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          padding: '0.5rem 1rem',
                          borderRadius: '10px',
                          border: 'none',
                          background: activeTab === 'grid' ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                          color: activeTab === 'grid' ? '#818cf8' : '#9ca3af',
                          fontWeight: 600,
                          fontSize: '0.8rem',
                          cursor: 'pointer'
                        }}
                      >
                        <Grid size={15} /> Grid de Datos
                      </button>
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                      {activeTab === 'chart' && (
                        <div style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', padding: '0.2rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                          <button 
                            onClick={() => setChartType('bar')}
                            style={{ background: chartType === 'bar' ? '#312e81' : 'transparent', border: 'none', color: chartType === 'bar' ? '#818cf8' : '#9ca3af', padding: '0.25rem 0.5rem', borderRadius: '6px', cursor: 'pointer' }}
                          >
                            <BarChart3 size={14} />
                          </button>
                          <button 
                            onClick={() => setChartType('donut')}
                            style={{ background: chartType === 'donut' ? '#312e81' : 'transparent', border: 'none', color: chartType === 'donut' ? '#818cf8' : '#9ca3af', padding: '0.25rem 0.5rem', borderRadius: '6px', cursor: 'pointer' }}
                          >
                            <PieIcon size={14} />
                          </button>
                        </div>
                      )}
                      
                      <button
                        onClick={exportToCSV}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          padding: '0.5rem 1rem',
                          borderRadius: '10px',
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          color: 'white',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        <Download size={14} /> Exportar CSV
                      </button>
                    </div>
                  </div>

                  {/* Render Chart */}
                  {activeTab === 'chart' && (
                    <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                      {chartData.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '3rem', opacity: 0.4 }}>Configura una métrica y dimensión y ejecuta para graficar.</div>
                      ) : chartType === 'bar' ? (
                        /* Beautiful Gradient SVG Bar Chart */
                        <div style={{ width: '100%', maxWidth: '850px' }}>
                          <svg viewBox="0 0 800 350" style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
                            <defs>
                              <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#6366f1" />
                                <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.4" />
                              </linearGradient>
                              <linearGradient id="barHoverGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#818cf8" />
                                <stop offset="100%" stopColor="#6366f1" stopOpacity="0.6" />
                              </linearGradient>
                            </defs>
                            
                            {/* Grid Lines */}
                            {[0, 0.25, 0.5, 0.75, 1].map((p, idx) => {
                              const y = 300 - p * 250;
                              return (
                                <g key={idx}>
                                  <line x1="50" y1={y} x2="750" y2={y} stroke="rgba(255,255,255,0.04)" strokeDasharray="4 4" />
                                  <text x="40" y={y + 4} fill="#9ca3af" fontSize="9" textAnchor="end">
                                    {formatVal(maxChartVal * p)}
                                  </text>
                                </g>
                              );
                            })}

                            {/* Axis Lines */}
                            <line x1="50" y1="300" x2="750" y2="300" stroke="rgba(255,255,255,0.15)" />
                            
                            {/* Bars */}
                            {chartData.map((d, i) => {
                              const barCount = chartData.length;
                              const chartWidth = 700;
                              const spacing = chartWidth / barCount;
                              const barWidth = Math.max(spacing * 0.6, 12);
                              const x = 50 + i * spacing + (spacing - barWidth) / 2;
                              
                              const height = (d.value / maxChartVal) * 250;
                              const y = 300 - height;
                              const active = hoveredBarIndex === i;

                              return (
                                <g key={i}>
                                  {/* Bar Rect */}
                                  <rect
                                    x={x}
                                    y={y}
                                    width={barWidth}
                                    height={height}
                                    rx="6"
                                    fill={active ? 'url(#barHoverGrad)' : 'url(#barGrad)'}
                                    style={{ transition: 'all 0.2s', cursor: 'pointer' }}
                                    onMouseOver={() => setHoveredBarIndex(i)}
                                    onMouseOut={() => setHoveredBarIndex(null)}
                                    onClick={() => triggerDrillDown(d.row)}
                                  />
                                  
                                  {/* Value label on active */}
                                  {active && (
                                    <g>
                                      <rect x={x + barWidth/2 - 50} y={y - 30} width="100" height="24" rx="6" fill="#1e1b4b" stroke="#818cf8" strokeWidth="1" />
                                      <text x={x + barWidth/2} y={y - 14} fill="white" fontSize="9" fontWeight="bold" textAnchor="middle">
                                        {formatVal(d.value)}
                                      </text>
                                    </g>
                                  )}

                                  {/* X Label */}
                                  <text
                                    x={x + barWidth/2}
                                    y="320"
                                    fill={active ? 'white' : '#9ca3af'}
                                    fontSize="8"
                                    textAnchor="middle"
                                    transform={`rotate(15, ${x + barWidth/2}, 320)`}
                                    style={{ transition: 'fill 0.2s' }}
                                  >
                                    {d.label.length > 18 ? `${d.label.slice(0, 15)}...` : d.label}
                                  </text>
                                </g>
                              );
                            })}
                          </svg>
                        </div>
                      ) : (
                        /* Premium Circle Stroke Donut Chart */
                        <div style={{ display: 'flex', gap: '3rem', alignItems: 'center', width: '100%', maxWidth: '700px', justifyContent: 'center' }}>
                          <svg width="220" height="220" viewBox="0 0 40 40" style={{ transform: 'rotate(-90deg)' }}>
                            {(() => {
                              const totalSum = chartData.reduce((acc, d) => acc + d.value, 0) || 1;
                              let accumulatedPercent = 0;
                              const colors = ['#6366f1', '#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#14b8a6', '#f43f5e'];

                              return chartData.map((d, i) => {
                                const percent = d.value / totalSum;
                                const strokeDash = percent * 100;
                                const strokeOffset = 100 - accumulatedPercent;
                                accumulatedPercent += strokeDash;
                                const color = colors[i % colors.length];

                                return (
                                  <circle
                                    key={i}
                                    cx="20"
                                    cy="20"
                                    r="15.915"
                                    fill="transparent"
                                    stroke={color}
                                    strokeWidth="4"
                                    strokeDasharray={`${strokeDash} ${100 - strokeDash}`}
                                    strokeDashoffset={strokeOffset}
                                    style={{ transition: 'all 0.3s', cursor: 'pointer' }}
                                    onClick={() => triggerDrillDown(d.row)}
                                  />
                                );
                              });
                            })()}
                            <circle cx="20" cy="20" r="12" fill="#0d0d14" />
                          </svg>

                          {/* Legend */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '200px', overflowY: 'auto' }}>
                            {chartData.map((d, i) => {
                              const colors = ['#6366f1', '#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#14b8a6', '#f43f5e'];
                              const color = colors[i % colors.length];
                              const totalSum = chartData.reduce((acc, x) => acc + x.value, 0) || 1;
                              const percentage = ((d.value / totalSum) * 100).toFixed(1);

                              return (
                                <div 
                                  key={i} 
                                  onClick={() => triggerDrillDown(d.row)}
                                  style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', padding: '0.25rem', borderRadius: '6px', transition: 'background 0.2s' }}
                                  onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                                  onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                                >
                                  <div style={{ width: '12px', height: '12px', borderRadius: '4px', background: color }}></div>
                                  <span style={{ fontSize: '0.8rem', color: '#9ca3af', fontWeight: 500 }}>
                                    {d.label}: <strong style={{ color: 'white' }}>{formatVal(d.value)}</strong> ({percentage}%)
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Render Data Grid */}
                  {activeTab === 'grid' && (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                          <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                            {/* Grouping Columns */}
                            {executedConfig.groupByCols.map(col => (
                              <th key={col} style={{ padding: '1rem', textAlign: 'left', fontWeight: 700, color: '#818cf8', textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.5px' }}>
                                {col}
                              </th>
                            ))}
                            {/* Measures */}
                            {executedConfig.measures.map(m => (
                              <th key={m.alias} style={{ padding: '1rem', textAlign: 'right', fontWeight: 700, color: '#34d399', textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.5px' }}>
                                {m.alias}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {queryResult.data.map((row, idx) => (
                            <tr 
                              key={idx} 
                              onClick={() => triggerDrillDown(row)}
                              title="Hacer clic para ver registros detallados individuales de este grupo"
                              style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', transition: 'background 0.2s', cursor: 'pointer' }} 
                              onMouseOver={(e) => e.currentTarget.style.background = 'rgba(99, 102, 241, 0.08)'} 
                              onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                              {executedConfig.groupByCols.map(col => (
                                <td key={col} style={{ padding: '1rem', color: '#f3f4f6', fontWeight: 500 }}>
                                  {String(getRowVal(row, col) ?? 'N/A')}
                                </td>
                              ))}
                              {executedConfig.measures.map(m => (
                                <td key={m.alias} style={{ padding: '1rem', textAlign: 'right', fontWeight: 700, color: '#f3f4f6' }}>
                                  {formatVal(getRowVal(row, m.alias))}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 4. Drill Down Detailed Records Modal Overlay */}
      {isDrillDownOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(5, 5, 8, 0.85)',
          backdropFilter: 'blur(16px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '2rem'
        }}>
          <div style={{
            background: '#0d0d15',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '24px',
            width: '100%',
            maxWidth: '1200px',
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '1.5rem 2rem',
              borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'rgba(255,255,255,0.01)'
            }}>
              <div>
                <span style={{ fontSize: '0.7rem', color: '#818cf8', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' }}>
                  REGISTROS DETALLADOS (DRILL DOWN)
                </span>
                <h2 style={{ margin: '0.2rem 0 0 0', fontSize: '1.25rem', fontWeight: 800, color: 'white' }}>
                  Detalle de Grupo: <span style={{ color: '#818cf8' }}>{selectedGroupInfo?.desc || 'General'}</span>
                </h2>
              </div>
              <button 
                onClick={() => setIsDrillDownOpen(false)}
                style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: 'none',
                  color: '#ef4444',
                  padding: '0.5rem 1rem',
                  borderRadius: '10px',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  transition: 'background 0.2s'
                }}
              >
                Cerrar Detalle
              </button>
            </div>

            {/* Modal Actions Bar (Local Search, Export CSV, Total Count badge) */}
            <div style={{
              padding: '1rem 2rem',
              borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '1.5rem',
              background: 'rgba(0, 0, 0, 0.1)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, maxWidth: '400px', position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: '0.85rem', opacity: 0.4 }} />
                <input 
                  type="text"
                  placeholder="Buscar en registros detallados..."
                  value={drillDownSearchQuery}
                  onChange={(e) => { setDrillDownSearchQuery(e.target.value); setDrillDownPage(0); }}
                  style={{
                    width: '100%',
                    background: '#13131f',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '10px',
                    padding: '0.5rem 1rem 0.5rem 2.25rem',
                    color: 'white',
                    fontSize: '0.8rem'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: '#9ca3af', background: 'rgba(255, 255, 255, 0.03)', padding: '0.4rem 0.75rem', borderRadius: '8px' }}>
                  Total en Grupo: <strong style={{ color: 'white' }}>{drillDownData ? drillDownData.length : 0}</strong>
                </span>
                <button
                  onClick={exportDrillDownCSV}
                  disabled={!drillDownData || drillDownData.length === 0}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.5rem 1rem',
                    borderRadius: '10px',
                    background: 'rgba(16, 185, 129, 0.1)',
                    border: '1px solid rgba(16, 185, 129, 0.2)',
                    color: '#34d399',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  <Download size={14} /> Exportar Detalle (CSV)
                </button>
              </div>
            </div>

            {/* Modal Body / Records Table */}
            <div style={{ flex: 1, overflow: 'auto', padding: '1.5rem 2rem' }}>
              {drillDownLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px', gap: '1rem' }}>
                  <RefreshCw className="animate-spin" size={32} style={{ color: '#6366f1' }} />
                  <span style={{ fontSize: '0.85rem', opacity: 0.5 }}>Recuperando registros reales de la base de datos...</span>
                </div>
              ) : drillDownError ? (
                <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '16px', padding: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center', color: '#f87171' }}>
                  <AlertCircle size={24} />
                  <div>
                    <h4 style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem' }}>Error al cargar detalles</h4>
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', opacity: 0.8 }}>{drillDownError}</p>
                  </div>
                </div>
              ) : !drillDownData || drillDownData.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', opacity: 0.4 }}>No se encontraron registros de detalle para este grupo.</div>
              ) : (() => {
                // Filter records in memory
                const filteredDrillRows = drillDownData.filter(row => 
                  Object.values(row).some(val => 
                    val !== null && String(val).toLowerCase().includes(drillDownSearchQuery.toLowerCase())
                  )
                );

                const totalPages = Math.ceil(filteredDrillRows.length / drillDownPageSize);
                const displayedRows = filteredDrillRows.slice(drillDownPage * drillDownPageSize, (drillDownPage + 1) * drillDownPageSize);

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between', gap: '1.5rem' }}>
                    {/* Horizontal scrollable table */}
                    <div style={{ overflowX: 'auto', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', background: 'rgba(0,0,0,0.15)' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                        <thead>
                          <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                            {drillDownColumns.map(col => (
                              <th key={col} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 700, color: '#9ca3af', fontSize: '0.7rem', textTransform: 'uppercase' }}>
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {displayedRows.map((row, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', transition: 'background 0.15s' }} onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'} onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}>
                              {drillDownColumns.map(col => {
                                const val = getRowVal(row, col);
                                return (
                                  <td key={col} style={{ padding: '0.75rem 1rem', color: '#e4e4e7' }}>
                                    {val === null ? <span style={{ opacity: 0.3 }}>NULL</span> : String(val)}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination Footer */}
                    {totalPages > 1 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
                        <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>
                          Mostrando {displayedRows.length} de {filteredDrillRows.length} registros filtrados (Pág. {drillDownPage + 1} de {totalPages})
                        </span>
                        
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            disabled={drillDownPage === 0}
                            onClick={() => setDrillDownPage(drillDownPage - 1)}
                            style={{
                              background: 'rgba(255,255,255,0.03)',
                              border: '1px solid rgba(255,255,255,0.08)',
                              color: drillDownPage === 0 ? '#4b5563' : 'white',
                              padding: '0.4rem 0.8rem',
                              borderRadius: '8px',
                              cursor: drillDownPage === 0 ? 'not-allowed' : 'pointer',
                              fontSize: '0.75rem'
                            }}
                          >
                            Anterior
                          </button>
                          <button
                            disabled={drillDownPage >= totalPages - 1}
                            onClick={() => setDrillDownPage(drillDownPage + 1)}
                            style={{
                              background: 'rgba(255,255,255,0.03)',
                              border: '1px solid rgba(255,255,255,0.08)',
                              color: drillDownPage >= totalPages - 1 ? '#4b5563' : 'white',
                              padding: '0.4rem 0.8rem',
                              borderRadius: '8px',
                              cursor: drillDownPage >= totalPages - 1 ? 'not-allowed' : 'pointer',
                              fontSize: '0.75rem'
                            }}
                          >
                            Siguiente
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalyticsExplorer;

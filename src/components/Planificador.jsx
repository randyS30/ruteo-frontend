import React, { useState } from 'react';
import axios from 'axios';
import { 
    Upload, Calendar, Settings, MapPin, CheckCircle, AlertCircle, 
    FileSpreadsheet, X, Download, MousePointer2, Layers, Users, Map, ArrowLeft 
} from 'lucide-react';
import MapaRutas from './MapaRutas';
const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

const Planificador = () => {
  // --- ESTADO DE NAVEGACIÓN ---
  const [currentView, setCurrentView] = useState('SELECCION');

  // --- ESTADOS DEL FORMULARIO ---
  const [file, setFile] = useState(null);
  const [frecuencia, setFrecuencia] = useState('SEMANAL');
  const [sabado, setSabado] = useState(false);
  const [flex, setFlex] = useState(0.2);
  const [capacidad, setCapacidad] = useState(50); 
  
  // --- ESTADOS DE UI ---
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dataPlanificada, setDataPlanificada] = useState(null);

  // --- ESTADOS DE FILTRO ---
  const [filterMercaderista, setFilterMercaderista] = useState('ALL');
  const [filterRuta, setFilterRuta] = useState('ALL');

  // --- ESTADOS DE MODAL INDIVIDUAL ---
  const [modalData, setModalData] = useState(null);
  const [targetRuta, setTargetRuta] = useState('');

  // --- ESTADOS DE SELECCIÓN MASIVA ---
  const [selectionMode, setSelectionMode] = useState(false);
  const [bulkModalData, setBulkModalData] = useState(null);

  // --- HANDLERS ---
  const handleReset = () => {
    setCurrentView('SELECCION');
    setFile(null);
    setDataPlanificada(null);
    setError(null);
    setLoading(false);
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError("Por favor sube un archivo Excel.");
      return;
    }

    setLoading(true);
    setError(null);
    setDataPlanificada(null);
    setFilterMercaderista('ALL');
    setFilterRuta('ALL');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('flex', flex);
    formData.append('modo', currentView); 
    
    // CAMBIO 1: Enviamos 'sabado' siempre (sirve para ambos modos ahora)
    formData.append('sabado', sabado);

    if (currentView === 'ASIGNADO') {
        formData.append('frecuencia', frecuencia);
    } else {
        formData.append('capacidad', capacidad); 
    }

    try {
      const response = await axios.post(`${API_URL}/planificar`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setDataPlanificada(response.data);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || "Error al conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  };

  const handlePdvClick = (mercaderistaData, rutaId, pdvData) => {
    setModalData({ mercaderista: mercaderistaData, rutaOrigen: rutaId, pdv: pdvData });
    setTargetRuta(''); 
  };

  const handleConfirmarMovimiento = async () => {
    if (!modalData || !targetRuta) return;
    setLoading(true);
    try {
        const payload = {
            mercaderista: modalData.mercaderista.mercaderista,
            cod_live_tra: modalData.pdv.cod_live_tra,
            from_ruta: modalData.rutaOrigen,
            to_ruta: parseInt(targetRuta, 10),
            rango: modalData.mercaderista.rango,
            rutas: modalData.mercaderista.rutas
        };
        const response = await axios.post(`${API_URL}/rutas/reasignar-pdv`, payload);
        actualizarData(response.data);
        setModalData(null);
        alert("¡Punto movido exitosamente!");
    } catch (err) {
        setError("Error al mover el punto.");
    } finally { setLoading(false); }
  };

  const handleBulkSelect = (selectedPoints) => {
      if (!selectedPoints || selectedPoints.length === 0) return;
      const primerMerc = selectedPoints[0].mercaderista.mercaderista;
      const inconsistente = selectedPoints.some(p => p.mercaderista.mercaderista !== primerMerc);
      if (inconsistente) {
          alert("Por favor selecciona puntos de un solo mercaderista a la vez.");
          setSelectionMode(false);
          return;
      }
      setBulkModalData({
          mercaderistaName: primerMerc,
          mercaderistaFull: selectedPoints[0].mercaderista,
          count: selectedPoints.length,
          points: selectedPoints 
      });
      setSelectionMode(false);
  };

  const handleConfirmarMasivo = async () => {
      if (!bulkModalData || !targetRuta) return;
      setLoading(true);
      try {
          const codigosLimpios = bulkModalData.points.map(p => p.id).filter(id => id !== null && id !== undefined);
          const payload = {
            mercaderista: bulkModalData.mercaderistaName,
            codigos_pdv: codigosLimpios,
            to_ruta: parseInt(targetRuta, 10),
            rutas: bulkModalData.mercaderistaFull.rutas,
            rango: bulkModalData.mercaderistaFull.rango
          };
          const response = await axios.post(`${API_URL}/rutas/reasignar-masivo`, payload);
          actualizarData(response.data);
          setBulkModalData(null);
          setTargetRuta('');
          alert(`¡${bulkModalData.count} puntos movidos exitosamente!`);
      } catch (err) {
          const msg = err.response?.data?.detail || "Error al mover los puntos masivamente.";
          setError(msg);
      } finally { setLoading(false); }
  };

  const actualizarData = (responseData) => {
      const newData = { ...dataPlanificada };
      const mercIndex = newData.mercaderistas.findIndex(m => m.mercaderista === responseData.mercaderista);
      if (mercIndex !== -1) { newData.mercaderistas[mercIndex].rutas = responseData.rutas; }
      setDataPlanificada(newData);
  };

  const handleExportarExcel = async () => {
    if (!dataPlanificada) return;
    setLoading(true);
    try {
        const response = await axios.post(`${API_URL}/exportar`, dataPlanificada, { responseType: 'blob' });
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'Ruteo_Final.xlsx');
        document.body.appendChild(link);
        link.click();
        link.remove();
    } catch (err) { alert("Error al generar el Excel."); } finally { setLoading(false); }
  };

  if (currentView === 'SELECCION') {
      return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-8">
            <div className="text-center mb-10">
                <div className="flex justify-center mb-4">
                    <div className="p-4 bg-white rounded-full shadow-lg">
                        <MapPin className="text-blue-600 w-12 h-12" />
                    </div>
                </div>
                <h1 className="text-4xl font-bold text-gray-800">Bienvenido al Ruteador</h1>
                <p className="text-gray-500 mt-2 text-lg">Selecciona el tipo de cuenta para comenzar</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl w-full">
                <button onClick={() => setCurrentView('ASIGNADO')} className="group bg-white p-8 rounded-2xl shadow-md hover:shadow-xl transition-all border border-gray-100 flex flex-col items-center text-center hover:-translate-y-1">
                    <div className="p-4 bg-blue-50 text-blue-600 rounded-full mb-4 group-hover:bg-blue-600 group-hover:text-white transition-colors"><Users size={48} /></div>
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">Cuenta Poco HC</h2>
                    <p className="text-gray-500">Para equipos con rutas pre-asignadas. <br/>Optimiza rutas por Vendedor.</p>
                    <span className="mt-6 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg text-sm font-semibold group-hover:bg-blue-600 group-hover:text-white">Seleccionar</span>
                </button>
                <button onClick={() => setCurrentView('BOLSA')} className="group bg-white p-8 rounded-2xl shadow-md hover:shadow-xl transition-all border border-gray-100 flex flex-col items-center text-center hover:-translate-y-1">
                    <div className="p-4 bg-purple-50 text-purple-600 rounded-full mb-4 group-hover:bg-purple-600 group-hover:text-white transition-colors"><Map size={48} /></div>
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">Cuenta Mucho HC</h2>
                    <p className="text-gray-500">Para bases grandes (Bolsa de puntos). <br/>Diseña territorios automáticos.</p>
                    <span className="mt-6 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg text-sm font-semibold group-hover:bg-purple-600 group-hover:text-white">Seleccionar</span>
                </button>
            </div>
        </div>
      );
  }

  const isBolsa = currentView === 'BOLSA';
  const colorTheme = isBolsa ? 'purple' : 'blue';

  return (
    <div className="min-h-screen bg-gray-50 p-8 flex flex-col items-center">
      <div className="w-full max-w-6xl flex items-center justify-between mb-8">
        <button onClick={handleReset} className="flex items-center text-gray-500 hover:text-gray-800 font-medium transition-colors">
            <ArrowLeft size={20} className="mr-2"/> Volver al inicio
        </button>
        <div className="text-center flex-1 pr-24">
            <h1 className="text-3xl font-bold text-gray-800 flex items-center justify-center gap-2">
            {isBolsa ? <Map className="text-purple-600" /> : <Users className="text-blue-600" />}
            {isBolsa ? 'Diseño de Territorios (Bolsa)' : 'Ruteo por Asignación'}
            </h1>
        </div>
      </div>

      <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* PANEL IZQUIERDO: CONFIG */}
        <div className="md:col-span-1">
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2"><Settings size={20} /> Configuración</h2>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">Archivo Maestro (.xlsx)</label>
                <div className={`relative border-2 border-dashed border-gray-300 rounded-lg p-4 hover:bg-gray-50 transition-colors text-center cursor-pointer group`}>
                  <input type="file" accept=".xlsx, .xls" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                  <div className="flex flex-col items-center justify-center text-gray-400 group-hover:text-gray-600">
                    {file ? (<><FileSpreadsheet size={32} className={`text-${colorTheme}-500 mb-2`} /><span className="text-sm text-gray-800 font-medium truncate w-full px-2">{file.name}</span></>) : (<><Upload size={32} className="mb-2" /><span className="text-sm">Arrastra o haz clic</span></>)}
                  </div>
                </div>
              </div>
              {isBolsa ? (
                  <div className="animate-fadeIn p-4 bg-purple-50 rounded-lg border border-purple-100">
                      <label className="block text-sm font-bold text-purple-800 mb-1">🎯 Puntos Objetivo por Ruta</label>
                      <p className="text-xs text-purple-600 mb-2">El sistema calculará cuántas rutas se necesitan.</p>
                      <input type="number" min="10" value={capacidad} onChange={(e) => setCapacidad(e.target.value)} className="w-full px-4 py-2 bg-white border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none font-semibold text-gray-700 mb-4"/>
                      
                      {/* CAMBIO 2: BOTÓN DE SÁBADO PARA BOLSA (Mismo estilo que abajo) */}
                      <div className="flex items-center justify-between bg-purple-100 p-3 rounded-lg border border-purple-200">
                        <span className="text-sm font-bold text-purple-800">¿Sábado Medio Día?</span>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" checked={sabado} onChange={(e) => setSabado(e.target.checked)} className="sr-only peer" />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:bg-purple-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 peer-checked:after:translate-x-full peer-checked:after:border-white transition-all"></div>
                        </label>
                      </div>
                  </div>
              ) : (
                  <div className="animate-fadeIn space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Frecuencia</label>
                        <div className="relative">
                          <select value={frecuencia} onChange={(e) => setFrecuencia(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-700">
                            <option value="SEMANAL">📅 Semanal</option><option value="QUINCENAL">📅 Quincenal</option><option value="MENSUAL">📅 Mensual</option>
                          </select>
                          <Calendar size={18} className="absolute left-3 top-2.5 text-gray-400" />
                        </div>
                      </div>
                      <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border border-gray-200">
                        <span className="text-sm font-medium text-gray-600">¿Sábados?</span>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" checked={sabado} onChange={(e) => setSabado(e.target.checked)} className="sr-only peer" />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 peer-checked:after:translate-x-full peer-checked:after:border-white transition-all"></div>
                        </label>
                      </div>
                  </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Flexibilidad (Flex)</label>
                <div className="flex items-center gap-2">
                    <input type="number" step="0.1" min="0" max="1" value={flex} onChange={(e) => setFlex(parseFloat(e.target.value))} className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                    <span className="text-xs text-gray-400 whitespace-nowrap">{(flex * 100).toFixed(0)}% tolerancia</span>
                </div>
              </div>
              <button type="submit" disabled={loading} className={`w-full py-3 rounded-lg text-white font-semibold shadow-md transition-all ${loading ? 'bg-gray-400 cursor-not-allowed' : isBolsa ? 'bg-purple-600 hover:bg-purple-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
                {loading ? 'Procesando...' : (isBolsa ? 'Generar Territorios' : 'Generar Planificación')}
              </button>
              {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-start gap-2"><AlertCircle size={18} className="mt-0.5" /><span>{error}</span></div>}
            </form>
          </div>
        </div>

        {/* PANEL DERECHO: MAPA (IGUAL) */}
        <div className="md:col-span-2">
          <div className="bg-white rounded-xl shadow-lg h-full min-h-[600px] border border-gray-100 p-6 flex flex-col">
             {dataPlanificada ? (
               <div className="flex-1 flex flex-col">
                 <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-gray-800">Resultados</h3>
                    <div className="flex gap-2 items-center">
                         <button onClick={() => setSelectionMode(!selectionMode)} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg shadow-sm text-sm font-bold transition-all ${selectionMode ? 'bg-blue-600 text-white ring-2 ring-blue-300' : 'bg-white text-gray-700 border hover:bg-gray-50'}`}>
                            <MousePointer2 size={16} />{selectionMode ? 'Seleccionando...' : 'Seleccionar Zona'}
                        </button>
                         <button onClick={handleExportarExcel} className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 shadow-sm text-sm font-medium">
                            <Download size={16} /> Excel
                        </button>
                        <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium flex items-center gap-1"><CheckCircle size={16} /></span>
                    </div>
                 </div>
                 
                 <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div>
                       <label className="text-sm font-semibold text-gray-600 mr-2">{isBolsa ? 'Departamento:' : 'Mercaderista:'}</label>
                       <select className="border rounded p-1 text-sm bg-white w-full" value={filterMercaderista} onChange={(e) => { setFilterMercaderista(e.target.value); setFilterRuta('ALL'); }}>
                          <option value="ALL">Ver Todos (Global)</option>
                          {dataPlanificada.mercaderistas.map(m => (<option key={m.mercaderista} value={m.mercaderista}>{m.mercaderista}</option>))}
                       </select>
                   </div>
                   <div>
                       <label className="text-sm font-semibold text-gray-600 mr-2">Ruta N°:</label>
                       <select className="border rounded p-1 text-sm bg-white w-full disabled:bg-gray-100 disabled:text-gray-400" value={filterRuta} onChange={(e) => setFilterRuta(e.target.value)} disabled={filterMercaderista === 'ALL'}>
                          <option value="ALL">Todas las Rutas</option>
                          {filterMercaderista !== 'ALL' && dataPlanificada.mercaderistas.find(m => m.mercaderista === filterMercaderista)?.rutas.map(r => (
                              <option key={r.ruta_id} value={r.ruta_id}>Ruta {r.ruta_id} ({r.total_pdv} pdvs)</option>
                          ))}
                       </select>
                   </div>
                 </div>

                 <div className="h-[500px] w-full border rounded-lg overflow-hidden shadow-inner relative z-0 flex-1">
                    <MapaRutas 
                        data={dataPlanificada} 
                        filterMercaderista={filterMercaderista} 
                        filterRuta={filterRuta}
                        onPdvClick={handlePdvClick}
                        selectionMode={selectionMode}
                        onBulkSelect={handleBulkSelect} 
                        isBolsa={isBolsa} 
                    />
                 </div>
               </div>
             ) : (
               <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                 {isBolsa ? <Map size={64} className="mb-4 text-purple-200" /> : <Users size={64} className="mb-4 text-blue-200" />}
                 <p className="text-lg">Configura los parámetros para {isBolsa ? 'generar territorios' : 'planificar rutas'}.</p>
               </div>
             )}
          </div>
        </div>
      </div>

      {/* MODALES INDIVIDUAL Y MASIVO (MANTENIDOS IGUALES) */}
      {modalData && ( <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"> <div className="bg-white rounded-lg p-6 w-96 shadow-2xl"> <div className="flex justify-between items-center mb-4"> <h3 className="text-lg font-bold text-gray-800">Mover PDV</h3> <button onClick={() => setModalData(null)}><X size={20}/></button> </div> <div className="mb-4 text-sm text-gray-600"> <p><strong>PDV:</strong> {modalData.pdv.razon_social}</p> <p><strong>Ruta Actual:</strong> {modalData.rutaOrigen}</p> </div> <label className="block text-sm font-medium mb-2">Mover a Ruta:</label> <select className="w-full border p-2 rounded mb-4 focus:ring-2 focus:ring-blue-500 outline-none" value={targetRuta} onChange={(e) => setTargetRuta(e.target.value)}> <option value="">Seleccionar...</option> <option value="-1" className="font-bold text-blue-600 bg-blue-50">➕ Crear Nueva Ruta</option> <option disabled>────────────────────</option> {modalData.mercaderista.rutas.map(r => (<option key={r.ruta_id} value={r.ruta_id} disabled={r.ruta_id === modalData.rutaOrigen}>Ruta {r.ruta_id} ({r.total_pdv} pdvs)</option>))} </select> <div className="flex gap-2 justify-end"> <button onClick={() => setModalData(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancelar</button> <button onClick={handleConfirmarMovimiento} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700" disabled={!targetRuta || loading}>{loading ? 'Guardando...' : 'Confirmar'}</button> </div> </div> </div> )}
      {bulkModalData && ( <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"> <div className="bg-white rounded-lg p-6 w-96 shadow-2xl border-t-4 border-blue-600"> <div className="flex justify-between items-center mb-4"> <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2"><Layers size={20} className="text-blue-600"/>Reasignación Masiva</h3> <button onClick={() => setBulkModalData(null)}><X size={20}/></button> </div> <div className="mb-6 text-center"> <div className="text-4xl font-bold text-blue-600 mb-1">{bulkModalData.count}</div> <p className="text-gray-500 text-sm">Puntos seleccionados de</p> <p className="font-semibold text-gray-800">{bulkModalData.mercaderistaName}</p> </div> <label className="block text-sm font-medium mb-2">Mover todos a Ruta:</label> <select className="w-full border p-2 rounded mb-6 bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none" value={targetRuta} onChange={(e) => setTargetRuta(e.target.value)}> <option value="">Seleccionar destino...</option> <option value="-1" className="font-bold text-blue-600 bg-blue-50">➕ Crear Nueva Ruta</option> <option disabled>────────────────────</option> {bulkModalData.mercaderistaFull.rutas.map(r => (<option key={r.ruta_id} value={r.ruta_id}>Ruta {r.ruta_id} ({r.total_pdv} pdvs)</option>))} </select> <div className="flex gap-2 justify-end"> <button onClick={() => setBulkModalData(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancelar</button> <button onClick={handleConfirmarMasivo} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium" disabled={!targetRuta || loading}>{loading ? 'Procesando...' : 'Mover Todo'}</button> </div> </div> </div> )}
    </div>
  );
};

export default Planificador;
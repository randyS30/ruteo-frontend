import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap, Polyline } from 'react-leaflet';
import L from 'leaflet';
import axios from 'axios'; 
import 'leaflet/dist/leaflet.css';

// --- CAPA DE SELECCIÓN (Sin cambios) ---
const SelectionLayer = ({ active, onSelectionComplete }) => {
    const map = useMap();
    const [startPoint, setStartPoint] = useState(null);
    const [currentPoint, setCurrentPoint] = useState(null);
    const [isDrawing, setIsDrawing] = useState(false);

    useEffect(() => {
        if (active) {
            map.dragging.disable(); map.boxZoom.disable(); map.keyboard.disable(); map.scrollWheelZoom.disable(); map.doubleClickZoom.disable();
            map.getContainer().style.cursor = 'crosshair';
        } else {
            map.dragging.enable(); map.boxZoom.enable(); map.keyboard.enable(); map.scrollWheelZoom.enable(); map.doubleClickZoom.enable();
            map.getContainer().style.cursor = '';
        }
    }, [active, map]);

    if (!active) return null;

    const handleMouseDown = (e) => {
        e.stopPropagation(); e.preventDefault();
        const rect = map.getContainer().getBoundingClientRect();
        setStartPoint({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        setCurrentPoint({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        setIsDrawing(true);
    };

    const handleMouseMove = (e) => {
        if (!isDrawing) return;
        e.stopPropagation(); e.preventDefault();
        const rect = map.getContainer().getBoundingClientRect();
        setCurrentPoint({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    };

    const handleMouseUp = (e) => {
        if (!isDrawing) return;
        e.stopPropagation(); e.preventDefault();
        setIsDrawing(false);
        if (startPoint && currentPoint) {
            const p1 = map.containerPointToLatLng([startPoint.x, startPoint.y]);
            const p2 = map.containerPointToLatLng([currentPoint.x, currentPoint.y]);
            const bounds = L.latLngBounds(p1, p2);
            if (bounds.isValid() && !p1.equals(p2)) onSelectionComplete(bounds);
        }
        setStartPoint(null); setCurrentPoint(null);
    };

    const getRectStyle = () => {
        if (!startPoint || !currentPoint) return {};
        const left = Math.min(startPoint.x, currentPoint.x);
        const top = Math.min(startPoint.y, currentPoint.y);
        const width = Math.abs(currentPoint.x - startPoint.x);
        const height = Math.abs(currentPoint.y - startPoint.y);
        return { position: 'absolute', left, top, width, height, border: '2px dashed #2563eb', backgroundColor: 'rgba(37, 99, 235, 0.2)', pointerEvents: 'none' };
    };

    return <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000 }} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>{isDrawing && <div style={getRectStyle()} />}</div>;
};

// --- ZOOM AUTOMÁTICO ---
const AutoZoom = ({ bounds }) => {
  const map = useMap();
  useEffect(() => { if (bounds.length > 0) map.fitBounds(bounds, { padding: [50, 50] }); }, [bounds, map]);
  return null;
};

// --- CONTROL DE MODOS ---
const RoutingControl = ({ mode, setMode }) => {
    return (
        <div className="leaflet-bottom leaflet-left" style={{ marginBottom: '20px', marginLeft: '10px', pointerEvents: 'auto', zIndex: 1000 }}>
            <div className="bg-white rounded-lg shadow-md border border-gray-300 overflow-hidden flex flex-col text-xs font-bold">
                <button 
                    onClick={() => setMode('smart')}
                    className={`p-2 border-b hover:bg-gray-50 text-left flex items-center gap-2 ${mode === 'smart' ? 'bg-purple-100 text-purple-700' : 'text-gray-600'}`}
                    title="Se adapta a la calle, pero cruza 'muros' si es necesario"
                >
                    ⚡ Inteligente
                </button>
                <button 
                    onClick={() => setMode('straight')}
                    className={`p-2 hover:bg-gray-50 text-left flex items-center gap-2 ${mode === 'straight' ? 'bg-gray-200 text-gray-800' : 'text-gray-600'}`}
                    title="Líneas rectas puras"
                >
                    📏 Lineal
                </button>
            </div>
        </div>
    );
};

// --- COMPONENTE PRINCIPAL ---
const MapaRutas = ({ data, filterMercaderista, filterRuta, onPdvClick, selectionMode, onBulkSelect, isBolsa }) => {
  const [bounds, setBounds] = useState([]);
  const [routePolyline, setRoutePolyline] = useState([]); 
  
  // Por defecto "Inteligente" (El modo costura)
  const [localMode, setLocalMode] = useState('smart'); 

  const colorsGlobal = ['#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231', '#911eb4', '#46f0f0', '#f032e6', '#bcf60c', '#fabebe', '#008080', '#e6beff', '#9a6324', '#fffac8', '#800000', '#aaffc3', '#808000', '#ffd8b1', '#000075', '#808080', '#000000'];
  const colorsRoutes = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'];

  const markers = [];
  const newBounds = [];
  let activeRoutePoints = []; 

  if (data && data.mercaderistas) {
    data.mercaderistas.forEach((merc, idxMerc) => {
      if (filterMercaderista !== 'ALL' && merc.mercaderista !== filterMercaderista) return;
      const colorBase = colorsGlobal[idxMerc % colorsGlobal.length];

      merc.rutas.forEach((ruta) => {
        if (filterRuta && filterRuta !== 'ALL' && ruta.ruta_id.toString() !== filterRuta.toString()) return;
        const isTargetRoute = (filterRuta !== 'ALL' && ruta.ruta_id.toString() === filterRuta.toString());
        let colorPunto = (filterMercaderista === 'ALL') ? colorBase : colorsRoutes[(ruta.ruta_id - 1) % colorsRoutes.length];
        
        const pdvsOrdenados = [...ruta.pdvs].sort((a, b) => (a.orden || 0) - (b.orden || 0));

        pdvsOrdenados.forEach((pdv) => {
           const lat = parseFloat(pdv.latitud);
           const lng = parseFloat(pdv.longitud);
           if (!isNaN(lat) && !isNaN(lng)) {
             newBounds.push([lat, lng]);
             markers.push({
               id: pdv.cod_live_tra,
               pos: [lat, lng],
               color: colorPunto,
               info: pdv,
               rutaId: ruta.ruta_id,
               mercaderista: merc
             });
             if (isTargetRoute) activeRoutePoints.push({ lat, lng });
           }
        });
      });
    });
  }

  // --- ALGORITMO DE COSTURA (SMART STITCHING) ---
  useEffect(() => {
    if (filterRuta === 'ALL' || activeRoutePoints.length <= 1) {
        setRoutePolyline([]);
        return;
    }

    if (localMode === 'straight') {
        setRoutePolyline(activeRoutePoints.map(p => [p.lat, p.lng]));
        return;
    }

    // Modo Inteligente: Pedimos 'foot' con pasos (steps) para analizar tramo a tramo
    const coordinatesString = activeRoutePoints.map(p => `${p.lng},${p.lat}`).join(';');
    // Importante: steps=true y overview=false para forzar el detalle por tramos
    const url = `https://router.project-osrm.org/route/v1/foot/${coordinatesString}?steps=true&geometries=geojson&overview=false`;

    axios.get(url)
        .then(response => {
            if (response.data.routes && response.data.routes.length > 0) {
                const legs = response.data.routes[0].legs;
                let finalCoords = [];

                // Recorremos cada tramo (Del punto A al B, del B al C...)
                legs.forEach((leg, index) => {
                    const startP = activeRoutePoints[index];
                    const endP = activeRoutePoints[index + 1];
                    
                    // 1. Calculamos la distancia recta de ESTE tramo específico
                    // (Distancia euclidiana aproximada en grados convertida a metros)
                    const distRecta = Math.sqrt(
                        Math.pow(startP.lat - endP.lat, 2) + 
                        Math.pow(startP.lng - endP.lng, 2)
                    ) * 111000;

                    // 2. Comparamos con la distancia que OSRM quiere que caminemos
                    const distCalle = leg.distance;

                    // 3. DECISIÓN DE COSTURA:
                    // Si la calle es 2.5 veces más larga que la recta (o más de 200m de desvío absurdo)
                    // -> Cortamos camino (Recta)
                    // -> Si no, respetamos la calle.
                    if (distCalle > 200 && distCalle > distRecta * 2.5) {
                        // Tramo rebelde: Dibujamos recta
                        finalCoords.push([startP.lat, startP.lng]);
                        finalCoords.push([endP.lat, endP.lng]);
                    } else {
                        // Tramo bueno: Usamos la geometría de los pasos (steps) de OSRM
                        leg.steps.forEach(step => {
                            const stepCoords = step.geometry.coordinates;
                            // GeoJSON viene [Lng, Lat], Leaflet quiere [Lat, Lng]
                            stepCoords.forEach(c => finalCoords.push([c[1], c[0]]));
                        });
                    }
                });

                setRoutePolyline(finalCoords);
            }
        })
        .catch(err => {
            console.error("Error OSRM, fallback lineal", err);
            setRoutePolyline(activeRoutePoints.map(p => [p.lat, p.lng]));
        });

  }, [filterRuta, data, localMode]);

  useEffect(() => {
    if(newBounds.length > 0 && !selectionMode) {
        setBounds(newBounds);
    }
  }, [data, filterMercaderista, filterRuta]);

  const handleBoxSelect = (selectionBounds) => {
    const selectedPoints = markers.filter(m => selectionBounds.contains(m.pos));
    if (selectedPoints.length > 0) onBulkSelect(selectedPoints);
  };

  return (
    <MapContainer center={[-12.0464, -77.0428]} zoom={6} scrollWheelZoom={true} style={{ height: '100%', width: '100%', position: 'relative' }}>
      <TileLayer attribution='&copy; CartoDB' url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
      {bounds.length > 0 && <AutoZoom bounds={bounds} />}
      <SelectionLayer active={selectionMode} onSelectionComplete={handleBoxSelect} />
      
      {/* BOTONES DE MODO */}
      <RoutingControl mode={localMode} setMode={setLocalMode} />

      {routePolyline.length > 0 && (
          <Polyline 
            positions={routePolyline} 
            pathOptions={{ 
                // Morado = Inteligente, Gris = Lineal
                color: localMode === 'smart' ? '#9333ea' : '#6b7280', 
                weight: 4, 
                opacity: 0.8, 
                dashArray: localMode === 'straight' ? '5, 10' : null, 
                lineCap: 'round' 
            }} 
          />
      )}

      {markers.map((m, i) => (
        <CircleMarker 
          key={i} center={m.pos} 
          pathOptions={{ color: '#000', fillColor: m.color, fillOpacity: 0.8, weight: 1 }} 
          radius={6} interactive={!selectionMode} 
          eventHandlers={{ click: () => !selectionMode && onPdvClick(m.mercaderista, m.rutaId, m.info) }}
        >
          {!selectionMode && (
              <Tooltip sticky>
                <div className="text-xs p-1">
                    <div className="font-bold border-b border-gray-300 pb-1 mb-1 text-gray-800">
                        {m.info.orden}. {m.info.razon_social}
                    </div>
                    <div className="text-gray-600 leading-tight">
                        {isBolsa ? (
                             <>
                                <span className="font-bold text-purple-700">Depto:</span> {m.mercaderista.mercaderista}<br/>
                                <span className="font-bold text-gray-700">Ruta:</span> {m.rutaId}<br/>
                                <span className="text-gray-400 text-[10px]">ID: {m.id}</span>
                             </>
                        ) : (
                             <>
                                <span className="font-bold text-blue-700">Vend:</span> {m.mercaderista.mercaderista}<br/>
                                <span className="font-bold text-gray-700">Ruta:</span> {m.rutaId}<br/>
                             </>
                        )}
                    </div>
                </div>
              </Tooltip>
          )}
        </CircleMarker>
      ))}
    </MapContainer>
  );
};

export default MapaRutas;
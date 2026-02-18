import React from 'react';
import Planificador from './components/Planificador';

function App() {
  return (
    // Este div asegura que ocupe toda la pantalla y tenga fondo gris suave
    <div className="w-full min-h-screen bg-gray-50">
      <Planificador />
    </div>
  );
}

export default App;
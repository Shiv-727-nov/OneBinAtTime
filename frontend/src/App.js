import { useState } from 'react';
import '@/App.css';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Landing from './pages/Landing';
import AdminDashboard from './pages/AdminDashboard';
import DriverDashboard from './pages/DriverDashboard';
import { Toaster } from './components/ui/sonner';

function App() {
  const [user, setUser] = useState(null);

  return (
    <div className="App">
      <Toaster position="top-right" />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing setUser={setUser} />} />
          <Route 
            path="/admin" 
            element={user?.role === 'admin' ? <AdminDashboard user={user} setUser={setUser} /> : <Navigate to="/" />} 
          />
          <Route 
            path="/driver" 
            element={user?.role === 'driver' ? <DriverDashboard user={user} setUser={setUser} /> : <Navigate to="/" />} 
          />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
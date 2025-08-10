import React, { useState, useMemo, useEffect } from 'react';
import { Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom';
import axios from 'axios';
import PublicPortal from './pages/PublicPortal.jsx';
import Login from './pages/Login.jsx';
import OfficerDashboard from './pages/OfficerDashboard.jsx';
import GsmbDashboard from './pages/GsmbDashboard.jsx';
import OwnerDashboard from './pages/OwnerDashboard.jsx';

export const AuthContext = React.createContext(null);

function AppShell({ children }) {
  const { user, logout } = React.useContext(AuthContext);
  return (
    <div className="container">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>GSMB Mining Demo</h2>
        <nav>
          <Link to="/">Public</Link>
          {!user && <Link to="/login">Login</Link>}
          {user?.role === 'OWNER' && <Link to="/owner">Owner</Link>}
          {user?.role === 'POLICE' && <Link to="/officer">Officer</Link>}
          {user?.role === 'GSMB' && <Link to="/gsmb">GSMB</Link>}
          {user && <button onClick={logout} style={{ marginLeft: 12 }}>Logout</button>}
        </nav>
      </div>
      <div className="card">{children}</div>
      <p style={{ opacity: .65, marginTop: 12 }}>
        Demo users: police/police123 · gsmb/gsmb123 · owner/owner123
      </p>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  // Optional: keep auth on refresh if you decide to store token (left off by default)
  useEffect(() => {
    // const token = localStorage.getItem('token');
    // const userJson = localStorage.getItem('user');
    // if (token && userJson) {
    //   axios.defaults.headers.common['Authorization'] = 'Bearer ' + token;
    //   setUser(JSON.parse(userJson));
    // }
  }, []);

  const login = async (username, password) => {
    const { data } = await axios.post('/auth/login', { username, password });
    axios.defaults.headers.common['Authorization'] = 'Bearer ' + data.token;
    // localStorage.setItem('token', data.token);
    // localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    setUser(null);
    delete axios.defaults.headers.common['Authorization'];
    // localStorage.removeItem('token');
    // localStorage.removeItem('user');
    navigate('/');
  };

  const ctx = useMemo(() => ({ user, login, logout }), [user]);

  return (
    <AuthContext.Provider value={ctx}>
      <AppShell>
        <Routes>
          <Route path="/" element={<PublicPortal />} />
          <Route path="/login" element={<Login />} />
          <Route
            path="/owner"
            element={user?.role === 'OWNER' ? <OwnerDashboard /> : <Navigate to="/login" />}
          />
          <Route
            path="/officer"
            element={user?.role === 'POLICE' ? <OfficerDashboard /> : <Navigate to="/login" />}
          />
          <Route
            path="/gsmb"
            element={user?.role === 'GSMB' ? <GsmbDashboard /> : <Navigate to="/login" />}
          />
        </Routes>
      </AppShell>
    </AuthContext.Provider>
  );
}

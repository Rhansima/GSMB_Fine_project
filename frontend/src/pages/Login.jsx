import React, { useState, useContext } from 'react';
import { AuthContext } from '../App.jsx';
import { useNavigate } from 'react-router-dom';

export default function Login(){
  const { login } = useContext(AuthContext);
  const [username, setUsername] = useState('police');
  const [password, setPassword] = useState('police123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try{
      const u = await login(username, password);
      nav(u.role === 'POLICE' ? '/officer' : '/gsmb');
    }catch(e){
      setError(e.response?.data?.error || e.message);
    }finally{
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="row">
      <div className="col">
        <label>Username</label>
        <input value={username} onChange={e=>setUsername(e.target.value)} placeholder="username" />
      </div>
      <div className="col">
        <label>Password</label>
        <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="password" />
      </div>
      <div className="col" style={{alignSelf:'end'}}>
        <button disabled={loading}>{loading?'Signing in...':'Login'}</button>
      </div>
      {error && <div style={{color:'#ff8f8f', width:'100%'}}>{error}</div>}
    </form>
  );
}

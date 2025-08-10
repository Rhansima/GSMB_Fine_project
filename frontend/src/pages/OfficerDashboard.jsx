import React, { useEffect, useState } from 'react';
import axios from 'axios';

export default function OfficerDashboard(){
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState(25000);

  const load = async () => {
    setLoading(true);
    const { data } = await axios.get('/officer/reports');
    setReports(data);
    setLoading(false);
  };
  useEffect(()=>{ load(); }, []);

  const check = async (id) => {
    await axios.post(`/officer/reports/${id}/check`);
    await load();
  };

  const fine = async (id) => {
    const reason = prompt('Reason for fine?', 'Unlicensed transport');
    const { data } = await axios.post(`/officer/reports/${id}/fine`, { amount, reason });
    alert(`Fine created. Payment reference: ${data.paymentRef}\nShare this with violator or attach to ticket.`);
    await load();
  };

  return (
    <div>
      <h3>Police Officer</h3>
      {loading ? <p>Loading...</p> : (
        <table>
          <thead>
            <tr><th>ID</th><th>Plate</th><th>Status</th><th>Location</th><th>Note</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {reports.map(r=> (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{r.plate}</td>
                <td><span className="badge">{r.status}</span></td>
                <td>{r.location || '-'}</td>
                <td>{r.note || '-'}</td>
                <td style={{display:'flex', gap:8}}>
                  <button onClick={()=>check(r.id)}>Mark Checked</button>
                  <button onClick={()=>fine(r.id)}>Issue Fine & Suspend</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div style={{marginTop:12}}>
        <label>Default fine amount (LKR)</label>{' '}
        <input type="number" value={amount} onChange={e=>setAmount(parseInt(e.target.value||'0',10))} />
      </div>
    </div>
  );
}

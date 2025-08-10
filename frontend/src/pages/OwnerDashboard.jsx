import React, { useEffect, useState } from 'react';
import axios from 'axios';

export default function OwnerDashboard(){
  const [fines, setFines] = useState([]);
  const [uploadingId, setUploadingId] = useState(null);

  const load = async () => {
    const { data } = await axios.get('/owner/fines');
    setFines(data);
  };
  useEffect(()=>{ load(); }, []);

  const checkout = async (fineId) => {
    const { data } = await axios.post(`/owner/fines/${fineId}/create-checkout`);
    alert(`Open gateway checkout:\n${data.checkoutUrl}\n\nPaymentRef: ${data.paymentRef}`);
    // In real integration, redirect window.location to data.checkoutUrl
  };

  const uploadSlip = async (fineId, file) => {
    const form = new FormData();
    form.append('file', file);
    form.append('note', 'Bank deposit slip');
    setUploadingId(fineId);
    try{
      await axios.post(`/owner/fines/${fineId}/upload-slip`, form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      alert('Slip uploaded for review.');
    } finally {
      setUploadingId(null);
    }
  };

  return (
    <div>
      <h3>License Owner</h3>
      <table>
        <thead><tr><th>ID</th><th>Plate</th><th>License</th><th>Amount</th><th>Paid</th><th>Actions</th></tr></thead>
        <tbody>
          {fines.map(f => (
            <tr key={f.id}>
              <td>{f.id}</td>
              <td>{f.plate}</td>
              <td>{f.licenseNo} (#{f.licenseId})</td>
              <td>{f.amount}</td>
              <td>{f.is_paid ? 'YES' : 'NO'}</td>
              <td style={{display:'flex', gap:8}}>
                {!f.is_paid && <button onClick={()=>checkout(f.id)}>Pay Online</button>}
                {!f.is_paid && (
                  <label style={{border:'1px solid #2c4a6a', padding:'8px 10px', borderRadius:8, cursor:'pointer'}}>
                    {uploadingId===f.id ? 'Uploading...' : 'Upload Slip'}
                    <input type="file" style={{display:'none'}}
                      onChange={(e)=> e.target.files?.[0] && uploadSlip(f.id, e.target.files[0])}
                    />
                  </label>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{opacity:.7, marginTop:8}}>
        Note: After online payment the gateway will notify GSMB via webhook. Slip upload is for manual verification when needed.
      </p>
    </div>
  );
}

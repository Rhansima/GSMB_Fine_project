import React, { useEffect, useState } from 'react';
import axios from 'axios';

export default function GsmbDashboard(){
  const [fines, setFines] = useState([]);
  const [licenseId, setLicenseId] = useState('');
  const [paymentRef, setPaymentRef] = useState('');
  const [amount, setAmount] = useState('');

  const load = async () => {
    const { data } = await axios.get('/gsmb/fines');
    setFines(data);
  };
  useEffect(()=>{ load(); }, []);

  const simulateWebhook = async () => {
    if (!paymentRef || !amount) return alert('Enter paymentRef and amount');
    await axios.post('/gsmb/payments/webhook', { paymentRef, amount, gatewayTxnId: 'DEMO-'+Date.now() });
    await load();
    alert('Webhook simulated. Fine marked paid.');
  };

  const reactivate = async () => {
    if (!licenseId) return;
    try{
      await axios.post(`/gsmb/licenses/${licenseId}/reactivate`);
      alert('License reactivated.');
    }catch(e){
      alert(e.response?.data?.error || e.message);
    }
  };

  return (
    <div>
      <h3>GSMB Officer</h3>
      <div className="row">
        <div className="col">
          <label>Payment Ref</label>
          <input value={paymentRef} onChange={e=>setPaymentRef(e.target.value)} placeholder="FINE-..." />
        </div>
        <div className="col">
          <label>Amount (LKR)</label>
          <input type="number" value={amount} onChange={e=>setAmount(e.target.value)} />
        </div>
        <div className="col" style={{alignSelf:'end'}}>
          <button onClick={simulateWebhook}>Simulate Payment Webhook</button>
        </div>
      </div>

      <h4 style={{marginTop:16}}>Fines</h4>
      <table>
        <thead><tr><th>ID</th><th>Plate</th><th>Amount</th><th>Paid</th><th>PaymentRef</th></tr></thead>
        <tbody>
          {fines.map(f => (
            <tr key={f.id}>
              <td>{f.id}</td>
              <td>{f.plate}</td>
              <td>{f.amount}</td>
              <td>{f.is_paid ? 'YES' : 'NO'}</td>
              <td>{f.payment_ref}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="row" style={{marginTop:16}}>
        <div className="col">
          <label>License ID to reactivate</label>
          <input value={licenseId} onChange={e=>setLicenseId(e.target.value)} placeholder="e.g., 1" />
        </div>
        <div className="col" style={{alignSelf:'end'}}>
          <button onClick={reactivate}>Reactivate License</button>
        </div>
      </div>
      <p style={{opacity:.65, marginTop:8}}>Tip: Get licenseId by checking a lorry (backend stores license links).</p>
    </div>
  );
}

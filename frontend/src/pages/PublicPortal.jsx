import React, { useState } from 'react';
import axios from 'axios';

export default function PublicPortal(){
  const [plate, setPlate] = useState('SP-1234');
  const [checkResult, setCheckResult] = useState(null);
  const [reportNote, setReportNote] = useState('Overloaded lorry near river.');
  const [location, setLocation] = useState('Anuradhapura');
  const [reportId, setReportId] = useState(null);

  const checkPlate = async () => {
    setReportId(null);
    const { data } = await axios.get('/public/lorry/'+plate);
    setCheckResult(data);
  };

  const report = async () => {
    const { data } = await axios.post('/public/report', { plate, location, note: reportNote });
    setReportId(data.id);
  };

  return (
    <div>
      <h3>Public Portal</h3>
      <div className="row">
        <div className="col">
          <label>Enter lorry plate</label>
          <input value={plate} onChange={e=>setPlate(e.target.value)} />
          <button onClick={checkPlate} style={{marginLeft:8}}>Check License</button>
        </div>
      </div>

      {checkResult && (
        <div style={{marginTop:12}}>
          {checkResult.found ? (
            <div>
              <div>
                Lorry: <b>{checkResult.lorry.plate}</b> • License: <b>{checkResult.lorry.licenseNo}</b> •
                Status: <span className="badge">{checkResult.lorry.status}</span>
              </div>
              <div>Valid: <b>{checkResult.valid ? 'YES' : 'NO'}</b></div>
            </div>
          ) : <div>Not found in registry.</div>}
        </div>
      )}

      <hr style={{opacity:.2, margin:'16px 0'}} />
      <h4>Report a suspicious lorry</h4>
      <div className="row">
        <div className="col">
          <label>Location</label>
          <input value={location} onChange={e=>setLocation(e.target.value)} />
        </div>
        <div className="col">
          <label>Note</label>
          <input value={reportNote} onChange={e=>setReportNote(e.target.value)} />
        </div>
        <div className="col" style={{alignSelf:'end'}}>
          <button onClick={report}>Submit Report</button>
        </div>
      </div>

      {reportId && <p style={{marginTop:8}}>Thank you! Report ID: <b>{reportId}</b> (forwarded to Police)</p>}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import axios from 'axios';
import { ethers } from 'ethers';
import L from 'leaflet';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Search, MapPin, ShoppingBag, BarChart2, Zap, ShieldCheck, Car, Truck, Bike, Wallet, CheckCircle, Navigation, Timer, Gauge, Coins, Leaf, X, ChevronDown } from 'lucide-react';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

const startIcon = new L.Icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png', shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png', iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41] });
const endIcon = new L.Icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png', shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png', iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41] });

const RTO_REGISTRY = { "0xb030...c864": { plate: "TN-23-BX-1998", type: "car", owner: "Sriaditya S", balance: 120 }, "0xDEMO": { plate: "TN-66-V-4982", type: "bike", owner: "Demo User", balance: 50 } };

function FitBounds({ routeData }) {
  const map = useMap();
  useEffect(() => {
    if (routeData) {
      const bounds = L.latLngBounds([...routeData.routes.fastest.path, ...routeData.routes.eco.path]);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [routeData, map]);
  return null;
}

const formatTime = (mins) => {
  if (!mins) return "--";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h} hr ${m} mins` : `${m} mins`;
};

function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [wallet, setWallet] = useState(null);
  const [vehicleInfo, setVehicleInfo] = useState(null);

  // --- RESTORED: Vehicle Type State ---
  const [vehicleType, setVehicleType] = useState("car");

  const [tripData, setTripData] = useState(null);
  const [status, setStatus] = useState("Ready");
  const [txHash, setTxHash] = useState("");
  const [startText, setStartText] = useState("");
  const [endText, setEndText] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [activeField, setActiveField] = useState(null);
  const [adminStats, setAdminStats] = useState(null);

  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const address = await signer.getAddress();
        const shortAddr = `${address.slice(0, 6)}...${address.slice(-4)}`;
        setWallet(shortAddr);
        const info = RTO_REGISTRY[shortAddr] || RTO_REGISTRY["0xb030...c864"];
        setVehicleInfo(info);
        setVehicleType(info.type); // Auto-select wallet vehicle
      } catch (err) { }
    } else {
      setWallet("0xb030...c864");
      const info = RTO_REGISTRY["0xb030...c864"];
      setVehicleInfo(info);
      setVehicleType(info.type);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeField && ((activeField === 'start' && startText.length > 2) || (activeField === 'end' && endText.length > 2))) {
        const q = activeField === 'start' ? startText : endText;
        axios.get(`http://127.0.0.1:5000/api/search?q=${q}`).then(res => setSuggestions(res.data));
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [startText, endText, activeField]);

  const handleSearch = async () => {
    if (!vehicleInfo) return alert("Please Connect Wallet First!");
    if (!startText || !endText) return alert("Please enter both locations!");

    setStatus("Calculating routes...");
    try {
      // --- SENDING SELECTED VEHICLE TYPE ---
      const res = await axios.post('http://127.0.0.1:5000/api/get-routes', {
        origin_text: startText,
        destination_text: endText,
        wallet,
        vehicle_type: vehicleType // Uses the dropdown value
      });
      setTripData(res.data);
      setStatus("Routes Loaded");
    } catch (e) { setStatus("Route Failed"); }
  };

  const verifyTrip = async (type) => {
    setStatus(`Simulating Drive (${type})...`);
    setTimeout(async () => {
      setStatus("Verifying GPS...");
      try {
        const res = await axios.post('http://127.0.0.1:5000/api/verify-and-reward', { trip_id: tripData.trip_id, selected_route: type, gps_trace: [] });
        setTxHash(res.data.tx_hash);
        if (res.data.reward > 0) {
          setVehicleInfo(prev => ({ ...prev, balance: prev.balance + res.data.reward }));
          setStatus(`Verified! +${res.data.reward} ECO`);
        } else { setStatus("Verified."); }
      } catch (err) { setStatus("Verification Failed"); }
    }, 1500);
  };

  const clearTrip = () => {
    setTripData(null);
    setTxHash("");
    setStatus("Ready");
    setStartText("");
    setEndText("");
  };

  async function loadAdmin() {
    const res = await axios.get('http://127.0.0.1:5000/api/admin/stats');
    setAdminStats(res.data);
    setActiveTab('admin');
  }

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: "'Inter', sans-serif", background: '#f8fafc' }}>
      <div style={{ width: '80px', background: '#0f172a', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 0', color: 'white', zIndex: 1002 }}>
        <div style={{ marginBottom: '40px' }}><Zap size={32} color="#10b981" fill="#10b981" /></div>
        <div onClick={() => setActiveTab('home')} style={{ marginBottom: '30px', cursor: 'pointer', opacity: activeTab === 'home' ? 1 : 0.5 }}><Navigation size={24} /></div>
        <div onClick={() => setActiveTab('market')} style={{ marginBottom: '30px', cursor: 'pointer', opacity: activeTab === 'market' ? 1 : 0.5 }}><ShoppingBag size={24} /></div>
        <div onClick={loadAdmin} style={{ marginBottom: '30px', cursor: 'pointer', opacity: activeTab === 'admin' ? 1 : 0.5 }}><BarChart2 size={24} /></div>
      </div>

      <div style={{ width: '420px', background: 'white', display: 'flex', flexDirection: 'column', borderRight: '1px solid #e2e8f0', zIndex: 1001 }}>
        <div style={{ padding: '24px', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', color: 'white' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>Eco-Traffic</h2>
            {vehicleInfo && <div style={{ background: 'rgba(16, 185, 129, 0.2)', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', color: '#34d399' }}>{vehicleInfo.balance} ECO</div>}
          </div>
          {!vehicleInfo ? <button onClick={connectWallet} style={s.connectBtn}><Wallet size={16} /> Connect Wallet</button> :
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.1)', padding: '12px', borderRadius: '8px' }}>
              <div style={{ background: '#3b82f6', padding: '8px', borderRadius: '50%' }}>{vehicleType === 'car' ? <Car size={20} color="white" /> : (vehicleType === 'truck' ? <Truck size={20} color="white" /> : <Bike size={20} color="white" />)}</div>
              <div><div style={{ fontSize: '14px', fontWeight: 'bold' }}>{vehicleInfo.plate}</div><div style={{ fontSize: '11px', opacity: 0.8, display: 'flex', alignItems: 'center', gap: '4px' }}><ShieldCheck size={10} /> Verified Owner</div></div>
            </div>}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {activeTab === 'home' && (
            <>
              {!tripData ? (
                <div style={{ marginBottom: '24px' }}>

                  {/* --- RESTORED: Vehicle Selector --- */}
                  {vehicleInfo && (
                    <div style={{ marginBottom: '15px' }}>
                      <label style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', marginBottom: '5px', display: 'block' }}>Mode of Transport</label>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        {['car', 'bike', 'truck'].map(type => (
                          <button
                            key={type}
                            onClick={() => setVehicleType(type)}
                            style={{
                              flex: 1, padding: '10px', borderRadius: '8px', border: vehicleType === type ? '2px solid #0f172a' : '1px solid #e2e8f0',
                              background: vehicleType === type ? '#f1f5f9' : 'white', fontWeight: '600', fontSize: '13px', textTransform: 'capitalize',
                              cursor: 'pointer'
                            }}
                          >
                            {type}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div style={s.inputGroup}><div style={s.inputIcon}><div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }}></div></div><input value={startText} onChange={e => setStartText(e.target.value)} onFocus={() => setActiveField('start')} style={s.input} placeholder="Start Location" /></div>
                  <div style={s.connectorLine}></div>
                  <div style={s.inputGroup}><div style={s.inputIcon}><MapPin size={14} color="#ef4444" /></div><input value={endText} onChange={e => setEndText(e.target.value)} onFocus={() => setActiveField('end')} style={s.input} placeholder="Destination" /></div>
                  {suggestions.length > 0 && <div style={s.dropdown}>{suggestions.map((s, i) => <div key={i} onClick={() => { if (activeField === 'start') setStartText(s.display_name.split(',')[0]); else setEndText(s.display_name.split(',')[0]); setSuggestions([]); setActiveField(null) }} style={s.suggestionItem}>{s.display_name}</div>)}</div>}
                  <button onClick={handleSearch} style={s.findBtn} disabled={!vehicleInfo}>Find Routes</button>
                </div>
              ) : (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div style={{ fontSize: 14, fontWeight: 'bold', color: '#0f172a' }}>Current Trip ({vehicleType})</div>
                    <button onClick={clearTrip} style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: '600' }}><X size={14} /> Clear / New</button>
                  </div>
                </div>
              )}

              <div style={{ ...s.status, background: status.includes('Failed') ? '#fef2f2' : '#f0fdf4', color: status.includes('Failed') ? '#dc2626' : '#15803d' }}>{status}</div>

              {tripData && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={s.card}>
                    <div style={s.cardHeader}>
                      <span style={{ fontWeight: 'bold', color: '#0f172a' }}>Fastest Route</span>
                      <span style={{ fontSize: '11px', color: '#ef4444', fontWeight: 'bold', background: '#fee2e2', padding: '2px 6px', borderRadius: 4 }}>{tripData.emissions.fastest}g CO2</span>
                    </div>
                    <div style={s.metricGrid}>
                      <div><span style={s.label}>Time</span><br /><div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Timer size={12} />{formatTime(tripData.routes.fastest.time_mins)}</div></div>
                      <div><span style={s.label}>Dist</span><br /><div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Gauge size={12} />{tripData.routes.fastest.distance} km</div></div>

                      {/* --- RESTORED: Toll Count + Price --- */}
                      <div>
                        <span style={s.label}>Tolls</span><br />
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Coins size={12} />
                          {tripData.routes.fastest.tolls > 0 ? `${tripData.routes.fastest.tolls} (₹${tripData.routes.fastest.toll_price})` : "Free"}
                        </div>
                      </div>

                    </div>
                    {!txHash && <button onClick={() => verifyTrip('fastest')} style={s.outlineBtn}>Select Route</button>}
                  </div>

                  <div style={{ ...s.card, border: '1px solid #10b981', background: '#ecfdf5' }}>
                    <div style={s.cardHeader}>
                      <span style={{ fontWeight: 'bold', color: '#064e3b', display: 'flex', alignItems: 'center', gap: '5px' }}><Leaf size={14} /> Eco-Recommended</span>
                      <span style={{ fontSize: '11px', background: '#10b981', color: 'white', padding: '2px 6px', borderRadius: 4 }}>Save {tripData.savings}g</span>
                    </div>
                    <div style={s.metricGrid}>
                      <div><span style={s.label}>Time</span><br /><div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Timer size={12} />{formatTime(tripData.routes.eco.time_mins)}</div></div>
                      <div><span style={s.label}>Dist</span><br /><div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Gauge size={12} />{tripData.routes.eco.distance} km</div></div>

                      {/* --- RESTORED: Toll Count + Price --- */}
                      <div>
                        <span style={s.label}>Tolls</span><br />
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Coins size={12} />
                          {tripData.routes.eco.tolls > 0 ? `${tripData.routes.eco.tolls} (₹${tripData.routes.eco.toll_price})` : "Free"}
                        </div>
                      </div>

                    </div>
                    {!txHash && <button onClick={() => verifyTrip('eco')} style={s.greenBtn}>Select & Earn 10 ECO</button>}
                  </div>

                  {txHash && <div style={s.receipt}><CheckCircle size={32} color="#10b981" /><div><div style={{ fontWeight: 'bold', color: '#0f172a' }}>Verified on Blockchain</div><div style={{ fontSize: '10px', color: '#64748b' }}>Tx: {txHash.slice(0, 20)}...</div></div></div>}
                </div>
              )}
            </>
          )}
          {activeTab === 'market' && <div><h2 style={{ fontSize: '20px', fontWeight: 'bold' }}>Rewards</h2>{[{ name: "NHAI Toll Pass", cost: 100 }, { name: "Metro Pass", cost: 50 }].map((item, i) => <div key={i} style={s.marketCard}><div><div style={{ fontWeight: 'bold' }}>{item.name}</div></div><button style={s.buyBtn}>{item.cost} ECO</button></div>)}</div>}
          {activeTab === 'admin' && adminStats && <div><h2 style={{ fontSize: '20px', fontWeight: 'bold' }}>Dashboard</h2><div style={s.statBox}><div style={s.statVal}>{adminStats.total_co2_saved}g</div><div style={s.statLabel}>CO2 Saved</div></div></div>}
        </div>
      </div>
      <div style={{ flex: 1, position: 'relative' }}>
        <MapContainer center={[11.1271, 78.6569]} zoom={7} style={{ height: "100%", width: "100%" }} zoomControl={false}>
          <TileLayer attribution='&copy; CartoDB' url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
          <FitBounds routeData={tripData} />
          {tripData && <><Marker position={tripData.start} icon={startIcon} /><Marker position={tripData.end} icon={endIcon} /><Polyline positions={tripData.routes.fastest.path} color="#ef4444" weight={5} opacity={0.6} /><Polyline positions={tripData.routes.eco.path} color="#10b981" weight={6} opacity={0.9} /></>}
        </MapContainer>
      </div>
    </div>
  );
}

const s = {
  connectBtn: { width: '100%', padding: '10px', background: 'white', color: '#0f172a', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' },
  inputGroup: { display: 'flex', alignItems: 'center', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0 12px' },
  input: { flex: 1, padding: '14px 0', border: 'none', background: 'transparent', outline: 'none', fontSize: '14px', marginLeft: '10px', fontWeight: '500' },
  inputIcon: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '20px' },
  connectorLine: { width: '2px', height: '12px', background: '#e2e8f0', marginLeft: '21px', margin: '4px 0' },
  findBtn: { width: '100%', padding: '14px', background: '#0f172a', color: 'white', borderRadius: '8px', fontWeight: 'bold', fontSize: '14px', marginTop: '16px', cursor: 'pointer', border: 'none' },
  status: { padding: '12px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', textAlign: 'center', marginBottom: '20px' },
  card: { background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' },
  metricGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '16px' },
  label: { fontSize: '10px', color: '#94a3b8', fontWeight: 'normal', textTransform: 'uppercase' },
  outlineBtn: { width: '100%', padding: '10px', background: 'transparent', border: '1px solid #cbd5e1', color: '#64748b', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' },
  greenBtn: { width: '100%', padding: '10px', background: '#10b981', border: 'none', color: 'white', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.3)' },
  dropdown: { position: 'absolute', background: 'white', width: '100%', border: '1px solid #e2e8f0', borderRadius: '8px', top: '125px', zIndex: 100, boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' },
  suggestionItem: { padding: '12px', borderBottom: '1px solid #f1f5f9', fontSize: '13px', cursor: 'pointer' },
  marketCard: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', marginBottom: '12px' },
  buyBtn: { padding: '8px 16px', background: '#f1f5f9', color: '#0f172a', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' },
  statBox: { background: 'white', border: '1px solid #e2e8f0', padding: '16px', borderRadius: '12px', textAlign: 'center' },
  statVal: { fontSize: '24px', fontWeight: '800', color: '#0f172a' },
  statLabel: { fontSize: '12px', color: '#64748b', fontWeight: '600' },
  receipt: { background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '16px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px' }
};

export default App;
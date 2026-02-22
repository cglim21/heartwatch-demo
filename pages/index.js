import { useState, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Heart, Activity, AlertTriangle, Battery, User } from 'lucide-react';
import Head from 'next/head';

export default function Home() {
  const [data, setData] = useState([]);
  const [currentHR, setCurrentHR] = useState(0);
  const [currentSpO2, setCurrentSpO2] = useState(0);
  const [status, setStatus] = useState('normal');
  const [isMoving, setIsMoving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Track continuous ECG array specifically
  const [ecgStream, setEcgStream] = useState([]);

  // Fetch initial batch
  useEffect(() => {
    fetch('/api/stream')
      .then(res => res.json())
      .then(initialData => {
        setData(initialData);
        // Expand ECG points for the 60 second window
        const expandedEcg = initialData.flatMap(d => 
            d.ecgWaveform.map((val, idx) => ({ time: d.id * 10 + idx, ecg: val }))
        );
        // Keep last 150 points for faster UI
        setEcgStream(expandedEcg.slice(-150));
        updateStats(initialData[initialData.length - 1]);
        setIsLoading(false);
      });
  }, []);

  // Poll for new data every second (simulating Websocket push)
  useEffect(() => {
    if (isLoading || data.length === 0) return;

    const intervalId = setInterval(() => {
      const lastItem = data[data.length - 1];
      
      fetch(`/api/stream?cursor=${lastItem.timestamp}`)
        .then(res => res.json())
        .then(newData => {
          if(newData.length > 0) {
             const newPoint = newData[0];
             
             setData(prev => {
                const nextData = [...prev, newPoint];
                if (nextData.length > 60) nextData.shift(); // Keep last 60 seconds
                return nextData;
             });

             setEcgStream(prev => {
                const newEcgPts = newPoint.ecgWaveform.map((val, idx) => ({ time: newPoint.id * 10 + idx, ecg: val }));
                const nextEcg = [...prev, ...newEcgPts];
                if (nextEcg.length > 150) return nextEcg.slice(-150);
                return nextEcg;
             });

             updateStats(newPoint);
          }
        });
    }, 1000);

    return () => clearInterval(intervalId);
  }, [isLoading, data]);

  const updateStats = (latest) => {
    if (!latest) return;
    setCurrentHR(latest.heartRate);
    setCurrentSpO2(latest.spO2);
    setStatus(latest.status);
    setIsMoving(latest.isMoving);
  };


  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans">
      <Head>
        <title>HeartWatch | Patient Dashboard</title>
      </Head>

      {/* Header */}
      <header className="flex justify-between items-center mb-8 bg-white p-4 rounded-xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${status === 'warning' ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-rose-100 text-rose-500'}`}>
                <Activity size={24} />
            </div>
            <div>
                <h1 className="text-xl font-bold text-slate-800">HeartWatch Monitor</h1>
                <p className="text-sm text-slate-500">Live from IoT Sensor Node (BLE)</p>
            </div>
        </div>
        <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-full text-sm font-medium text-slate-600">
                <Battery size={16} className="text-green-500" /> 84%
            </div>
            <div className="flex items-center gap-2 bg-indigo-50 px-3 py-1.5 rounded-full text-sm font-medium text-indigo-700">
                <User size={16} /> 김OO (49세)
            </div>
        </div>
      </header>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Heart Rate Card */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 relative overflow-hidden">
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-slate-500 font-medium mb-1 flex items-center gap-2">
                        Heart Rate (bpm)
                        {status === 'warning' && <AlertTriangle size={16} className="text-red-500 animate-bounce" />}
                    </p>
                    <div className="flex items-baseline gap-2">
                        <h2 className={`text-5xl font-black tabular-nums transition-colors duration-300 ${status === 'warning' ? 'text-red-600' : 'text-slate-800'}`}>
                            {currentHR}
                        </h2>
                        <span className="text-slate-400 font-medium">BPM</span>
                    </div>
                </div>
                <div className={`p-3 rounded-2xl ${status === 'warning' ? 'bg-red-50 text-red-500' : 'bg-rose-50 text-rose-400'}`}>
                    <Heart size={32} className={`${status === 'warning' ? 'animate-ping' : 'animate-pulse'}`} />
                </div>
            </div>
            {/* Mini trend line */}
            <div className="h-16 mt-4 -mx-2">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data}>
                        <Line type="monotone" dataKey="heartRate" stroke={status === 'warning' ? "#ef4444" : "#fb7185"} strokeWidth={3} dot={false} isAnimationActive={false} />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>

        {/* SpO2 Card */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
             <div className="flex justify-between items-start mb-4">
                <div>
                    <p className="text-slate-500 font-medium mb-1">Blood Oxygen (SpO2)</p>
                    <div className="flex items-baseline gap-2">
                        <h2 className="text-5xl font-black text-sky-600 tabular-nums">{currentSpO2}</h2>
                        <span className="text-slate-400 font-medium">%</span>
                    </div>
                </div>
                <div className="p-3 rounded-2xl bg-sky-50 text-sky-500">
                    <div className="font-bold text-xl">O₂</div>
                </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-sky-700 bg-sky-50 px-3 py-2 rounded-lg mt-8">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-sky-500"></span>
                </span>
                Normal Saturation
            </div>
        </div>

         {/* Motion / Context Card */}
         <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-6">
            <div>
                <p className="text-slate-500 font-medium mb-2">Patient Activity</p>
                <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 ${isMoving ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-indigo-100 bg-indigo-50 text-indigo-700'}`}>
                    <div className={`w-3 h-3 rounded-full ${isMoving ? 'bg-amber-500 animate-pulse' : 'bg-indigo-500'}`}></div>
                    <span className="font-bold">{isMoving ? 'In Motion / Active' : 'Resting / Still'}</span>
                </div>
            </div>
            <div>
                 <p className="text-slate-500 font-medium mb-2">Supabase Sync Status</p>
                 <div className="flex items-center justify-between text-sm px-4 py-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-slate-600">Realtime Stream</span>
                    <span className="text-green-600 font-medium flex items-center gap-1">
                        <Activity size={14} /> Connected
                    </span>
                 </div>
            </div>
        </div>
      </div>

      {/* Main Charts */}
      <div className="space-y-6">
          {/* ECG Streaming Chart */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
              <div className="flex justify-between items-center mb-6">
                  <div>
                      <h3 className="text-lg font-bold text-slate-800">ECG / EKG Waveform (Live)</h3>
                      <p className="text-sm text-slate-500">Lead II Analog Front-End Signal</p>
                  </div>
                  <div className="text-xs font-mono bg-emerald-50 text-emerald-600 px-3 py-1 rounded-md border border-emerald-100">
                      10 Hz Sampling
                  </div>
              </div>
              <div className="h-64 w-full bg-[linear-gradient(to_right,#f0f0f0_1px,transparent_1px),linear-gradient(to_bottom,#f0f0f0_1px,transparent_1px)] bg-[size:10px_10px] rounded-lg overflow-hidden relative border border-slate-200">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={ecgStream} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                        <XAxis dataKey="time" hide />
                        <YAxis domain={[-1, 2]} hide />
                        <Line 
                            type="monotone" 
                            dataKey="ecg" 
                            stroke="#10b981" 
                            strokeWidth={2} 
                            dot={false} 
                            isAnimationActive={false} // Crucial for realtime feel
                        />
                    </LineChart>
                  </ResponsiveContainer>
              </div>
          </div>

          {/* Historical Heart Rate Area Chart */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
             <div className="mb-6">
                  <h3 className="text-lg font-bold text-slate-800">Heart Rate Trend (Last 60s)</h3>
                  <p className="text-sm text-slate-500">Continuous BPM tracking via PPG sensor</p>
              </div>
              <div className="h-48 w-full">
                   <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorHR" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={status === 'warning' ? '#ef4444' : '#fb7185'} stopOpacity={0.3}/>
                                <stop offset="95%" stopColor={status === 'warning' ? '#ef4444' : '#fb7185'} stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <XAxis dataKey="timestamp" hide />
                        <YAxis domain={['auto', 'auto']} stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <Tooltip 
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            labelStyle={{ color: '#64748b', fontSize: '12px' }}
                        />
                        <Area 
                            type="monotone" 
                            dataKey="heartRate" 
                            stroke={status === 'warning' ? '#ef4444' : '#fb7185'} 
                            strokeWidth={3} 
                            fillOpacity={1} 
                            fill="url(#colorHR)" 
                            isAnimationActive={false}
                        />
                    </AreaChart>
                  </ResponsiveContainer>
              </div>
          </div>
      </div>
    </div>
  );
}

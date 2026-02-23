import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Heart, Activity, AlertTriangle, Battery, User } from 'lucide-react';
import Head from 'next/head';
import { supabase } from '../utils/supabaseClient';

export default function Home() {
  const [data, setData] = useState([]);
  const [currentHR, setCurrentHR] = useState(0);
  const [currentSpO2, setCurrentSpO2] = useState(0);
  const [status, setStatus] = useState('normal');
  const [isMoving, setIsMoving] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  
  // Chatbot State
  const [messages, setMessages] = useState([{role: 'assistant', text: '안녕하세요! HeartWatch AI 어시스턴트입니다. 지금 심박수나 전체적인 건강 상태에 대해 궁금한 점이 있으신가요?'}]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  
  // ML Prediction States
  const [mlRisks, setMlRisks] = useState({
    min30: 12.5,
    hour1: 18.2,
    hour10: 25.4,
    hour24: 31.0,
    day7: 45.8
  });

  // Track continuous ECG array specifically
  const [ecgStream, setEcgStream] = useState([]);

  useEffect(() => {
    // 1. Fetch initial historical data (last 60 records)
    const fetchInitialData = async () => {
      const { data: history, error } = await supabase
        .from('vital_signals')
        .select('*')
        .order('id', { ascending: false })
        .limit(60);

      if (history && history.length > 0) {
        // Supabase returns newest first, so we reverse it for the chart (oldest to newest left to right)
        const sortedHistory = history.reverse();
        
        // Transform Supabase data format to match our chart model
        const chartData = sortedHistory.map(row => ({
           id: row.id,
           timestamp: row.recorded_at,
           heartRate: row.heart_rate,
           spO2: row.spo2,
           isMoving: row.is_moving,
           status: row.status,
           ecgWaveform: row.ecg_waveform || []
        }));

        setData(chartData);
        updateStats(chartData[chartData.length - 1]);

        // Expand ECG
        const expandedEcg = chartData.flatMap(d => 
           (d.ecgWaveform || []).map((val, idx) => ({ time: parseInt(d.id) * 10 + idx, ecg: val }))
        );
        setEcgStream(expandedEcg.slice(-150));
      }
    };

    fetchInitialData();

    // 2. Subscribe to Supabase Realtime inserts
    const channel = supabase
      .channel('public:vital_signals')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'vital_signals' }, payload => {
        setIsConnected(true);
        const newRow = payload.new;
        
        const newPoint = {
           id: newRow.id,
           timestamp: newRow.recorded_at,
           heartRate: newRow.heart_rate,
           spO2: newRow.spo2,
           isMoving: newRow.is_moving,
           status: newRow.status,
           ecgWaveform: newRow.ecg_waveform || []
        };

        setData(prev => {
          const nextData = [...prev, newPoint];
          if (nextData.length > 60) nextData.shift(); // Keep last 60 seconds
          return nextData;
        });

        setEcgStream(prev => {
           const newEcgPts = newPoint.ecgWaveform.map((val, idx) => ({ time: parseInt(newPoint.id) * 10 + idx, ecg: val }));
           const nextEcg = [...prev, ...newEcgPts];
           if (nextEcg.length > 150) return nextEcg.slice(-150);
           return nextEcg;
        });
        
        // Simulate incoming ML Predictions slightly based on HR
        setMlRisks(prev => ({
           min30: Math.max(0, Math.min(100, prev.min30 + (Math.random() * 4 - 2) + (newPoint.heartRate > 100 ? 5 : 0))),
           hour1: Math.max(0, Math.min(100, prev.hour1 + (Math.random() * 3 - 1.5))),
           hour10: Math.max(0, Math.min(100, prev.hour10 + (Math.random() * 2 - 1))),
           hour24: Math.max(0, Math.min(100, prev.hour24 + (Math.random() * 1.5 - 0.75))),
           day7: Math.max(0, Math.min(100, prev.day7 + (Math.random() * 1 - 0.5)))
        }));

        updateStats(newPoint);
      })
      .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
              setIsConnected(true);
          } else {
              setIsConnected(false);
          }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const updateStats = (latest) => {
    if (!latest) return;
    setCurrentHR(latest.heartRate);
    setCurrentSpO2(latest.spO2);
    setStatus(latest.status);
    setIsMoving(latest.isMoving);
   };

  const handleSendMessage = async (e) => {
      e.preventDefault();
      if (!chatInput.trim()) return;

      const newUserMsg = { role: 'user', text: chatInput };
      setMessages(prev => [...prev, newUserMsg]);
      setChatInput('');
      setIsChatLoading(true);

      try {
          const response = await fetch('/api/chat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                  message: newUserMsg.text,
                  hr: currentHR,
                  spo2: currentSpO2
              })
          });
          const data = await response.json();
          
          setMessages(prev => [...prev, { role: 'assistant', text: data.reply }]);
      } catch (error) {
          console.error("Chat API Error:", error);
          setMessages(prev => [...prev, { role: 'assistant', text: "네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." }]);
      } finally {
          setIsChatLoading(false);
      }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans">
      <Head>
        <title>HeartWatch | Supabase Realtime</title>
      </Head>

      {/* Header */}
      <header className="flex justify-between items-center mb-8 bg-white p-4 rounded-xl shadow-sm border border-slate-100 relative">
        <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${status === 'warning' ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-rose-100 text-rose-500'}`}>
                <Activity size={24} />
            </div>
            <div>
                <h1 className="text-xl font-bold text-slate-800">HeartWatch</h1>
                <p className="text-sm text-slate-500">AI Monitoring</p>
            </div>
        </div>

        {/* Company Logo - Center positioned */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-3">
            <img 
                src="/logo.png" 
                alt="AID Logo" 
                className="h-9 object-contain drop-shadow-sm" 
                onError={(e) => { e.target.style.display = 'none'; }} 
            />
            <span className="text-2xl font-black bg-gradient-to-r from-purple-800 to-indigo-900 bg-clip-text text-transparent tracking-tight">
                (주) 에이드
            </span>
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
                  <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${currentSpO2 < 95 ? 'bg-amber-400 animate-ping' : 'bg-sky-400'} `}></span>
                  <span className={`relative inline-flex rounded-full h-3 w-3 ${currentSpO2 < 95 ? 'bg-amber-500' : 'bg-sky-500'}`}></span>
                </span>
                {currentSpO2 < 95 ? 'Low Saturation' : 'Normal Saturation'}
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
                    <span className="text-slate-600">Postgres WebSockets</span>
                    <span className={`font-medium flex items-center gap-1 ${isConnected ? 'text-emerald-600' : 'text-slate-400'}`}>
                        <Activity size={14} /> {isConnected ? 'Connected' : 'Connecting...'}
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
                      <h3 className="text-lg font-bold text-slate-800">ECG / EKG Waveform (Live from DB)</h3>
                      <p className="text-sm text-slate-500">Real-time inserts tracked via pg_changes</p>
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
                            isAnimationActive={false} 
                        />
                    </LineChart>
                  </ResponsiveContainer>
              </div>
          </div>

          {/* Historical Heart Rate Area Chart */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
             <div className="mb-6">
                  <h3 className="text-lg font-bold text-slate-800">Heart Rate Trend (Last 60s)</h3>
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
      
      {/* 🚀 Phase 5: Predictive ML Risk Gauges */}
      <div className="mt-6 bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <div className="mb-6 pb-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                  <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                      <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                      AI 부정맥 예측 (Arrhythmia Risk Forecast)
                  </h3>
                  <p className="text-sm text-slate-500">실시간 생체 데이터를 기반으로 다가올 위험도를 5가지 시간대별로 예측합니다.</p>
              </div>
              <span className="bg-indigo-50 text-indigo-700 font-semibold px-3 py-1 rounded-full text-xs">ML Engine Active</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                  { label: "30분 뒤", value: mlRisks.min30 },
                  { label: "1시간 뒤", value: mlRisks.hour1 },
                  { label: "10시간 뒤", value: mlRisks.hour10 },
                  { label: "24시간 뒤", value: mlRisks.hour24 },
                  { label: "1주일 뒤", value: mlRisks.day7 }
              ].map((risk, idx) => {
                  const isHighRisk = risk.value > 50;
                  const isMediumRisk = risk.value > 25 && risk.value <= 50;
                  const colorClass = isHighRisk ? 'text-rose-500' : isMediumRisk ? 'text-amber-500' : 'text-emerald-500';
                  const bgClass = isHighRisk ? 'bg-rose-500' : isMediumRisk ? 'bg-amber-500' : 'bg-emerald-500';

                  return (
                      <div key={idx} className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col items-center text-center">
                          <span className="text-sm font-medium text-slate-500 mb-2">{risk.label}</span>
                          <div className={`text-2xl font-bold ${colorClass} mb-2`}>
                              {risk.value.toFixed(1)}%
                          </div>
                          {/* Progress Bar */}
                          <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                              <div className={`h-1.5 rounded-full ${bgClass} transition-all duration-500`} style={{ width: `${Math.min(100, risk.value)}%` }}></div>
                          </div>
                      </div>
                  )
              })}
          </div>
      </div>

      {/* AI Assistant Chat Section */}
      <div className="mt-6 bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col h-[400px]">
          <div className="mb-4 pb-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                  <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                       ✨ HeartWatch AI 주치의
                  </h3>
                  <p className="text-sm text-slate-500">실시간 생체 데이터를 분석하여 답변합니다.</p>
              </div>
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
              {messages.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                          msg.role === 'user' 
                          ? 'bg-slate-800 text-white rounded-br-none' 
                          : 'bg-indigo-50 text-indigo-900 border border-indigo-100 rounded-bl-none'
                      }`}>
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                      </div>
                  </div>
              ))}
              {isChatLoading && (
                  <div className="flex justify-start">
                      <div className="bg-slate-100 text-slate-500 rounded-2xl rounded-bl-none px-4 py-3 flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-slate-400 animate-bounce"></div>
                          <div className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                          <div className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                      </div>
                  </div>
              )}
          </div>

          <form onSubmit={handleSendMessage} className="flex gap-2 relative">
              <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="현재 심박수 상태에 대해 질문해보세요..."
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  disabled={isChatLoading}
              />
              <button 
                  type="submit" 
                  disabled={isChatLoading || !chatInput.trim()}
                  className="bg-slate-800 text-white px-6 py-3 rounded-xl font-medium text-sm hover:bg-slate-700 disabled:opacity-50 transition-colors"
              >
                  질문하기
              </button>
          </form>
      </div>

    </div>
  );
}

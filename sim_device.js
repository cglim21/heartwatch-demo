require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { getMockData } = require('./data/mockStream');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// The hardcoded ID from the SQL script
const PATIENT_ID = '11111111-1111-1111-1111-111111111111';

console.log('Starting IoT Device Simulator...');
console.log('Connecting to Supabase:', supabaseUrl);

setInterval(async () => {
    try {
        // Generate 1 new data point
        const dataPoint = getMockData(1)[0];
        
        const payload = {
            patient_id: PATIENT_ID,
            heart_rate: dataPoint.heartRate,
            spo2: dataPoint.spO2,
            is_moving: dataPoint.isMoving,
            status: dataPoint.status,
            ecg_waveform: dataPoint.ecgWaveform
        };

        const { error } = await supabase
            .from('vital_signals')
            .insert([payload]);

        if (error) {
            console.error('Error inserting data:', error.message);
        } else {
            console.log(`[${new Date().toISOString()}] Inserted new vitals (HR: ${payload.heart_rate}, SpO2: ${payload.spo2})`);
        }
    } catch (err) {
        console.error('Unexpected error:', err);
    }
}, 1000); // 1 데이터 로우당 1초 간격으로 삽입 (1Hz)

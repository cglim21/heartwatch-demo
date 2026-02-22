export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { message, hr, spo2 } = req.body;

  // Simulate network delay for AI thinking (1-2 seconds)
  await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));

  let mockResponse = "";

  // Basic keyword matching for a demo
  const userMsg = message.toLowerCase();
  
  if (userMsg.includes('심박수') || userMsg.includes('hr')) {
      if (hr > 100) {
          mockResponse = `현재 심박수가 ${hr} BPM으로 다소 높게 측정되고 있습니다. 최근에 운동을 하셨거나 스트레스를 받으셨나요? 안정을 취하시고 지속적으로 100회 이상 유지된다면 내원하시는 것을 권장합니다.`;
      } else if (hr < 60) {
          mockResponse = `현재 심박수가 ${hr} BPM으로 서맥(느린 맥박)에 해당합니다. 평소 운동선수처럼 단련된 상태가 아니라면 어지럼증 여부를 확인해보세요.`;
      } else {
          mockResponse = `현재 심박수는 ${hr} BPM으로, 아주 정상적인 범위를 유지하고 있습니다. 좋은 상태입니다.`;
      }
  } else if (userMsg.includes('산소') || userMsg.includes('spo2')) {
      if (spo2 < 95) {
          mockResponse = `현재 혈중 산소포화도가 ${spo2}%로 주의가 필요한 수치입니다. 호흡이 불편하지 않으신지 확인하시고, 창문을 열어 환기를 시켜보세요. 수치가 계속 떨어지면 병원 진료가 필요할 수 있습니다.`;
      } else {
          mockResponse = `산소포화도가 ${spo2}%로 정상 범위(95~100%)에 있습니다. 호흡기 건강이 아주 양호한 상태입니다.`;
      }
  } else if (userMsg.includes('안녕') || userMsg.includes('의사')) {
      mockResponse = `안녕하세요! HeartWatch AI 주치의입니다. 저는 현재 환자분의 심박수(${hr} BPM)와 산소포화도(${spo2}%) 데이터를 실시간으로 보고 있습니다. 어떤 점이 궁금하신가요?`;
  } else {
      mockResponse = `질문해주셔서 감사합니다. 현재 환자분의 생체 신호(심박수: ${hr} BPM, 산소포화도: ${spo2}%)를 기준으로 보았을 때 즉각적인 위험 상황은 감지되지 않았습니다. 다른 궁금한 점이 있으시다면 언제든 말씀해 주세요.`;
  }

  return res.status(200).json({ reply: mockResponse });
}

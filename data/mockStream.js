module.exports = {
  getMockData: (count = 100) => {
    const data = [];
    let currentTime = new Date().getTime() - count * 1000;

    // Simulate some realistic baseline values
    let baseHR = 72; // Heart rate
    let baseSpO2 = 98; // Oxygen saturation

    for (let i = 0; i < count; i++) {
      // Add some random noise and slight variance
      const hrVariance = Math.floor(Math.random() * 5) - 2; // -2 to +2
      let currentHR = baseHR + hrVariance;

      // Simulating a slight heart rate spike every ~20 seconds
      if (i % 20 === 0 && i !== 0) {
        currentHR += 15;
      }

      const spo2Variance = Math.floor(Math.random() * 2); // 0 to 1
      const currentSpO2 = Math.min(
        100,
        baseSpO2 + spo2Variance - (Math.random() > 0.8 ? 1 : 0),
      );

      // Generate a simple math-based ECG wave shape (just for visual effect)
      // A real ECG has P, Q, R, S, T waves. We'll simplify.
      // Creating an array of 10 rapid samples per second for the ECG chart
      const ecgSamples = [];
      for (let j = 0; j < 10; j++) {
        let ecgVal = 0;
        // Simulate the R peak (sharp spike)
        if (j === 4) ecgVal = 1.5 + Math.random() * 0.2;
        // Simulate S wave (sharp dip)
        else if (j === 5) ecgVal = -0.5 - Math.random() * 0.1;
        // Simulate T wave (small bump)
        else if (j === 7 || j === 8) ecgVal = 0.3 + Math.random() * 0.1;
        // Baseline noise
        else ecgVal = Math.random() * 0.1 - 0.05;

        ecgSamples.push(ecgVal);
      }

      // Movement status
      const isMoving = Math.random() > 0.8;

      data.push({
        id: i,
        timestamp: new Date(currentTime + i * 1000).toISOString(),
        heartRate: currentHR,
        spO2: currentSpO2,
        isMoving: isMoving,
        ecgWaveform: ecgSamples, // 10 points per second
        status: currentHR > 85 ? "warning" : "normal",
      });
    }

    return data;
  },
};

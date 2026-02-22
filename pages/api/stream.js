import { getMockData } from '../../data/mockStream';

// Generate 5 minutes of data ahead of time
const mockDatabase = getMockData(300); 

export default function handler(req, res) {
  // Simulate polling behavior by returning a small window of data
  // based on the client's requested timestamp or a random slice.
  
  const { cursor } = req.query;
  const now = new Date().getTime();
  
  // If no cursor provided, just return the most recent 60 seconds
  if (!cursor) {
     const initialPayload = mockDatabase.slice(mockDatabase.length - 60);
     return res.status(200).json(initialPayload);
  }

  // If a cursor is provided, return simulated "new" data
  // For demo, we just return 1 "new" second of data every time it's called
  // to simulate a realtime 1-second interval push
  const cursorTime = new Date(cursor).getTime();
  
  // Create a brand new data point matching the elapsed time
  const newDataPoint = getMockData(1)[0];
  newDataPoint.timestamp = new Date(now).toISOString();

  res.status(200).json([newDataPoint]);
}

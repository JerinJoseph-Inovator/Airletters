// src/lib/testFlights.js
// Test flight data that starts "now" for immediate simulation
export function generateTestFlights() {
  const now = new Date();
  
  // Flight A: Starts now, duration 3 hours
  const flightADep = new Date(now.getTime() - 30 * 60000); // Started 30 mins ago
  const flightAArr = new Date(flightADep.getTime() + 3 * 60 * 60000); // 3 hour flight
  
  // Flight B: Starts 10 minutes after Flight A, duration 2.5 hours  
  const flightBDep = new Date(flightADep.getTime() + 10 * 60000); // 10 mins after A
  const flightBArr = new Date(flightBDep.getTime() + 2.5 * 60 * 60000); // 2.5 hour flight

  return {
    flightA: {
      flightNumber: '6E 6633 (TEST)',
      origin: 'Bengaluru (BLR – T1)',
      destination: 'Chandigarh (IXC)',
      departureUTC: flightADep.toISOString(),
      arrivalUTC: flightAArr.toISOString(),
    },
    flightB: {
      flightNumber: '6E 5205 (TEST)',
      origin: 'Bengaluru (BLR – T1)', 
      destination: 'Mumbai (BOM – T1)',
      departureUTC: flightBDep.toISOString(),
      arrivalUTC: flightBArr.toISOString(),
    },
  };
}

// Quick test flights that are mid-journey right now
export function getMidFlightTest() {
  const now = new Date();
  
  // Both flights started 1 hour ago, will end in 1 hour (so we're at 50% progress)
  const startTime = new Date(now.getTime() - 60 * 60000); // 1 hour ago
  const endTime = new Date(now.getTime() + 60 * 60000);   // 1 hour from now
  
  return {
    flightA: {
      flightNumber: '6E 6633 (MID-FLIGHT)',
      origin: 'Bengaluru (BLR – T1)',
      destination: 'Chandigarh (IXC)', 
      departureUTC: startTime.toISOString(),
      arrivalUTC: endTime.toISOString(),
    },
    flightB: {
      flightNumber: '6E 5205 (MID-FLIGHT)',
      origin: 'Bengaluru (BLR – T1)',
      destination: 'Mumbai (BOM – T1)',
      departureUTC: startTime.toISOString(), 
      arrivalUTC: endTime.toISOString(),
    },
  };
}
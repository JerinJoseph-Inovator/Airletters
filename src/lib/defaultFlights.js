// src/lib/defaultFlights.js
// Default ticket data for AirLetters (from your itineraries)
// export default {
//   flightA: {
//     flightNumber: '6E 6633',
//     origin: 'Bengaluru (BLR – T1)',
//     destination: 'Chandigarh (IXC)',
//     departureUTC: '2025-08-20T04:45:00Z',
//     arrivalUTC: '2025-08-20T07:45:00Z',
//     departure: 'Bengaluru',
//     arrival: 'Chandigarh'
//   },
//   flightB: {
//     flightNumber: '6E 5205',
//     origin: 'Bengaluru (BLR – T1)',
//     destination: 'Mumbai (BOM – T1)',
//     departureUTC: '2025-08-20T04:55:00Z',
//     arrivalUTC: '2025-08-20T07:00:00Z',
//     departure: 'Bengaluru',
//     arrival: 'Mumbai'
//   },
// };

/* 
// TESTING FLIGHTS - Uncomment and replace above for testing with current time
// These flights start shortly after current time for immediate testing
export default {
  flightA: {
    flightNumber: '6E 6633',
    origin: 'Bengaluru (BLR – T1)',
    destination: 'Chandigarh (IXC)',
    departureUTC: '2025-08-12T14:00:00Z', // Starts at 2 PM UTC today
    arrivalUTC: '2025-08-12T17:00:00Z',   // Ends at 5 PM UTC today
    departure: 'Bengaluru',
    arrival: 'Chandigarh'
  },
  flightB: {
    flightNumber: '6E 5205',
    origin: 'Bengaluru (BLR – T1)',
    destination: 'Mumbai (BOM – T1)',
    departureUTC: '2025-08-12T14:10:00Z', // Starts 10 minutes after Flight A
    arrivalUTC: '2025-08-12T16:15:00Z',   // Ends at 4:15 PM UTC today
    departure: 'Bengaluru',
    arrival: 'Mumbai'
  },
};
*/

/*
// IMMEDIATE TESTING FLIGHTS - For testing right now
// These flights start in 1 minute from current time
*/


const now = new Date();
const startTime = new Date(now.getTime() + 1 * 60 * 1000); // 1 minute from now
const endTimeA = new Date(now.getTime() + 3 * 60 * 60 * 1000); // 3 hours from now
const endTimeB = new Date(now.getTime() + 2 * 60 * 60 * 1000 + 10 * 60 * 1000); // 2h 10m from now

export default {
  flightA: {
    flightNumber: '6E 6633',
    origin: 'Bengaluru (BLR – T1)',
    destination: 'Chandigarh (IXC)',
    departureUTC: startTime.toISOString(),
    arrivalUTC: endTimeA.toISOString(),
    departure: 'Bengaluru',
    arrival: 'Chandigarh'
  },
  flightB: {
    flightNumber: '6E 5205',
    origin: 'Bengaluru (BLR – T1)',
    destination: 'Mumbai (BOM – T1)',
    departureUTC: new Date(startTime.getTime() + 10 * 60 * 1000).toISOString(), // 10 minutes after Flight A
    arrivalUTC: endTimeB.toISOString(),
    departure: 'Bengaluru',
    arrival: 'Mumbai'
  },
};


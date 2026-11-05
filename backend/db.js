import mongoose from 'mongoose';

// Keep a single MongoDB connection for the lifetime of the API process.
let connectionPromise;

export async function connectDatabase() {
  if (mongoose.connection.readyState === 1) return;
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is missing.');

  if (!connectionPromise) {
    connectionPromise = mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000
    }).catch((error) => {
      connectionPromise = undefined;
      throw error;
    });
  }
  await connectionPromise;
}

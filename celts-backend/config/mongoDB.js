const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI not defined in .env');
    }
    await mongoose.connect(process.env.MONGO_URI, {
      maxPoolSize: 200,          
      minPoolSize: 50,            
      serverSelectionTimeoutMS: 10000, 
      socketTimeoutMS: 45000,   
      family: 4,                  
    });
    console.log('MongoDB Connected Successfully with connection pool (maxPoolSize: 200, minPoolSize: 50).');
  } catch (err) {
    console.error('MongoDB Connection Failed:', err.message);
    process.exit(1);
  }
};

module.exports = connectDB;

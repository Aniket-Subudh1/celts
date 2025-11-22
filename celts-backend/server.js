require('dotenv').config();
require('./services/gradingWorker');
const express = require('express');
const path = require('path');
const cors = require('cors');
const { GoogleGenAI } = require("@google/genai");

const connectDB = require('./config/mongoDB');
const logger = require('./config/logger');
const apiRoutes = require('./routes/index');
const examTimerService = require('./services/examTimerService'); 

const ai= new GoogleGenAI({});

connectDB();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));



app.use(cors({
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:3000',
  credentials: true
}));


const rateLimit = require('express-rate-limit');
app.use('/api/auth', rateLimit({ windowMs: 60 * 1000, max: 20 }));

console.log(`Starting CELTS Backend on port ${PORT}...`);

app.use('/api', apiRoutes);

const frontendPath = path.join(__dirname, 'public');
app.use(express.static(frontendPath));

app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ message: 'API Endpoint Not Found' });
  }
  res.sendFile(path.join(frontendPath, 'index.html'));
});

app.use((err, req, res, next) => {
  logger.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Server Error' });
});

const server = app.listen(PORT, () =>
  console.log( `Server running in ${process.env.NODE_ENV || 'development'} mode on http://localhost:${PORT}`)
);

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

function gracefulShutdown(signal) {
  console.log(`\nReceived ${signal}. Starting graceful shutdown...`);
  
  server.close(() => {
    console.log('HTTP server closed.');
    
    if (examTimerService && typeof examTimerService.shutdown === 'function') {
      examTimerService.shutdown();
    }
    
    process.exit(0);
  });
  
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
}

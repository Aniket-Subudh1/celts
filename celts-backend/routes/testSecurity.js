const express = require('express');
const rateLimit = require('express-rate-limit');
const { protect } = require('../middleware/authMiddleware');
const DeviceSession = require('../models/DeviceSession');
const ExamSecurity = require('../models/ExamSecurity');
const TestAttempt = require('../models/TestAttempt');
const examTimerService = require('../services/examTimerService');

const router = express.Router();


const testSecurityRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, 
  max: 50, 
  message: 'Too many test security requests from this IP',
  standardHeaders: true,
  legacyHeaders: false,
});

const simulateViolationRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, 
  max: 10,
  message: 'Too many violation simulation requests',
});


router.get('/security/health', testSecurityRateLimit, protect, async (req, res) => {
  try {
    const health = {
      timestamp: new Date(),
      models: {},
      services: {},
      middleware: {},
      errors: []
    };

    const modelTests = [
      { name: 'DeviceSession', model: DeviceSession },
      { name: 'ExamSecurity', model: ExamSecurity },
      { name: 'TestAttempt', model: TestAttempt }
    ];

    for (const test of modelTests) {
      try {
        await test.model.findOne().limit(1).maxTimeMS(5000); 
        health.models[test.name] = 'OK';
      } catch (error) {
        health.models[test.name] = 'ERROR: ' + error.message;
        health.errors.push(`${test.name} model error: ${error.message}`);
      }
    }

    try {
      if (examTimerService && typeof examTimerService.getRemainingTime === 'function') {
        health.services.examTimerService = 'OK';
      } else {
        health.services.examTimerService = 'ERROR: Service not properly loaded';
        health.errors.push('ExamTimerService not properly loaded');
      }
    } catch (error) {
      health.services.examTimerService = 'ERROR: ' + error.message;
      health.errors.push('ExamTimerService error: ' + error.message);
    }

    try {
      const { generateDeviceFingerprint, getClientIP, networkSecurity, browserSecurity, examSecurity } = require('../middleware/authMiddleware');
      
      health.middleware.generateDeviceFingerprint = typeof generateDeviceFingerprint === 'function' ? 'OK' : 'ERROR';
      health.middleware.getClientIP = typeof getClientIP === 'function' ? 'OK' : 'ERROR';
      health.middleware.networkSecurity = typeof networkSecurity === 'function' ? 'OK' : 'ERROR';
      health.middleware.browserSecurity = typeof browserSecurity === 'function' ? 'OK' : 'ERROR';
      health.middleware.examSecurity = typeof examSecurity === 'function' ? 'OK' : 'ERROR';

      // Test fingerprint generation
      try {
        const fingerprint = generateDeviceFingerprint(req);
        if (fingerprint && fingerprint.length > 0) {
          health.middleware.generateDeviceFingerprint = 'OK - Generated: ' + fingerprint.substring(0, 8) + '...';
        }
      } catch (error) {
        health.middleware.generateDeviceFingerprint = 'ERROR: ' + error.message;
        health.errors.push('Device fingerprinting error: ' + error.message);
      }

      // Test IP extraction
      try {
        const ip = getClientIP(req);
        health.middleware.getClientIP = 'OK - Detected: ' + ip;
      } catch (error) {
        health.middleware.getClientIP = 'ERROR: ' + error.message;
        health.errors.push('IP extraction error: ' + error.message);
      }
    } catch (middlewareError) {
      health.errors.push('Middleware import error: ' + middlewareError.message);
    }

    health.status = health.errors.length === 0 ? 'HEALTHY' : 'ISSUES_DETECTED';
    health.timestamp = new Date();

    res.json(health);
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Health check failed',
      error: error.message,
      timestamp: new Date()
    });
  }
});


router.post('/security/simulate-violation', simulateViolationRateLimit, protect, async (req, res) => {
  try {
    const { attemptId, violationType = 'test_violation', severity = 'medium' } = req.body;
    
    if (!attemptId) {
      return res.status(400).json({ message: 'attemptId is required' });
    }

    const examSecurity = await ExamSecurity.findOne({
      testAttempt: attemptId
    });

    if (!examSecurity) {
      return res.status(404).json({ message: 'Exam security record not found' });
    }

    await examSecurity.addViolation(violationType, severity, `Test violation simulated at ${new Date()}`);

    res.json({
      success: true,
      message: 'Violation simulated successfully',
      securityScore: examSecurity.securityScore,
      totalViolations: examSecurity.violations.length
    });
  } catch (error) {
    console.error('Simulate violation error:', error);
    res.status(500).json({ message: 'Failed to simulate violation' });
  }
});


router.get('/security/stats', testSecurityRateLimit, protect, async (req, res) => {
  try {
    const stats = {
      timestamp: new Date(),
      deviceSessions: {},
      examSecurity: {},
      violations: {}
    };

    stats.deviceSessions.total = await DeviceSession.countDocuments();
    stats.deviceSessions.active = await DeviceSession.countDocuments({ status: 'active' });
    stats.deviceSessions.terminated = await DeviceSession.countDocuments({ status: 'terminated' });
    stats.deviceSessions.examSessions = await DeviceSession.countDocuments({ isExamSession: true });

    stats.examSecurity.total = await ExamSecurity.countDocuments();
    stats.examSecurity.secure = await ExamSecurity.countDocuments({ securityStatus: 'secure' });
    stats.examSecurity.violated = await ExamSecurity.countDocuments({ securityStatus: 'violated' });
    stats.examSecurity.terminated = await ExamSecurity.countDocuments({ securityStatus: 'terminated' });

    const violationAggregation = await ExamSecurity.aggregate([
      { $unwind: '$violations' },
      { 
        $group: {
          _id: '$violations.type',
          count: { $sum: 1 },
          severityBreakdown: {
            $push: '$violations.severity'
          }
        }
      },
      { $sort: { count: -1 } }
    ]);

    stats.violations.byType = violationAggregation;
    stats.violations.total = violationAggregation.reduce((sum, item) => sum + item.count, 0);

    res.json(stats);
  } catch (error) {
    console.error('Security stats error:', error);
    res.status(500).json({ message: 'Failed to get security stats' });
  }
});

module.exports = router;
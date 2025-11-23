const express = require('express');
const crypto = require('crypto');
const { protect, examSecurity, networkSecurity, browserSecurity, generateDeviceFingerprint, getClientIP } = require('../middleware/authMiddleware');
const DeviceSession = require('../models/DeviceSession');
const ExamSecurity = require('../models/ExamSecurity');
const TestAttempt = require('../models/TestAttempt');
const User = require('../models/User');
const examTimerService = require('../services/examTimerService');

const router = express.Router();

// Violation types configuration
const VIOLATION_TYPES = {
  'clipboard': { severity: 'medium', action: 'warning', description: 'Clipboard operation blocked' },
  'context_menu': { severity: 'low', action: 'warning', description: 'Right-click blocked' },
  'dev_tools': { severity: 'high', action: 'terminate', description: 'Developer tools access attempted' },
  'new_tab': { severity: 'high', action: 'terminate', description: 'New tab creation attempted' },
  'new_window': { severity: 'high', action: 'terminate', description: 'New window creation attempted' },
  'incognito': { severity: 'high', action: 'terminate', description: 'Incognito window attempted' },
  'close_tab': { severity: 'medium', action: 'warning', description: 'Tab close attempted' },
  'window_switch': { severity: 'critical', action: 'terminate', description: 'Window switching detected' },
  'tab_switch': { severity: 'critical', action: 'terminate', description: 'Tab switching detected' },
  'refresh': { severity: 'medium', action: 'warning', description: 'Page refresh attempted' },
  'print': { severity: 'medium', action: 'warning', description: 'Print attempted' },
  'save': { severity: 'medium', action: 'warning', description: 'Save operation attempted' },
  'window_blur': { severity: 'critical', action: 'terminate', description: 'Window lost focus' },
  'fullscreen_exit': { severity: 'high', action: 'terminate', description: 'Fullscreen mode exited' },
  'multiple_monitors': { severity: 'high', action: 'terminate', description: 'Multiple monitors detected' },
  'mouse_leave_top': { severity: 'medium', action: 'warning', description: 'Mouse left window area' },
  'dev_tools_open': { severity: 'high', action: 'terminate', description: 'Developer tools detected' },
  'network_disconnect': { severity: 'high', action: 'flag', description: 'Network connection lost' },
  'auto_submit': { severity: 'critical', action: 'terminate', description: 'Exam auto-submitted' }
};

const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60000; 
const RATE_LIMIT_MAX = 10;

const rateLimit = (req, res, next) => {
  const clientIP = getClientIP(req);
  const now = Date.now();
  const userRequests = rateLimitMap.get(clientIP) || [];
  
  const validRequests = userRequests.filter(time => now - time < RATE_LIMIT_WINDOW);
  
  if (validRequests.length >= RATE_LIMIT_MAX) {
    return res.status(429).json({
      success: false,
      message: 'Too many requests. Please try again later.'
    });
  }
  
  validRequests.push(now);
  rateLimitMap.set(clientIP, validRequests);
  next();
};


router.post('/session/start', rateLimit, protect, networkSecurity, browserSecurity, async (req, res) => {
  try {
    const { testId, browserFeatures = {} } = req.body;
    const userId = req.user._id;
    
    if (!userId) {
      return res.status(400).json({ 
        success: false,
        message: 'User ID is required' 
      });
    }
    
    if (testId) {
      const TestSet = require('../models/TestSet');
      const testSet = await TestSet.findById(testId);
      if (!testSet) {
        return res.status(404).json({
          success: false,
          message: 'Test not found'
        });
      }
    }

    const deviceFingerprint = generateDeviceFingerprint(req);
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const clientIP = getClientIP(req);

    await DeviceSession.updateMany(
      { user: userId, status: 'active' },
      { 
        status: 'terminated', 
        terminationReason: 'new_session' 
      }
    );

    const deviceSession = new DeviceSession({
      user: userId,
      testSet: testId || null,
      deviceFingerprint,
      sessionToken,
      browserInfo: {
        userAgent: req.headers['user-agent'] || 'Unknown',
        platform: req.body.platform || navigator?.platform || 'Unknown',
        language: req.body.language || 'en-US',
        cookieEnabled: req.body.cookieEnabled ?? true,
        javaEnabled: req.body.javaEnabled ?? false,
        onlineStatus: req.body.onlineStatus ?? true,
        screenResolution: req.body.screenResolution || '1920x1080',
        timezone: req.body.timezone || 'UTC',
        browserName: req.browserInfo?.browserName || 'Unknown',
        browserVersion: req.browserInfo?.browserVersion || 'Unknown',
      },
      networkInfo: {
        ipAddress: clientIP,
        country: req.geoInfo?.country || 'Unknown',
        region: req.geoInfo?.region || 'Unknown',
        city: req.geoInfo?.city || 'Unknown',
        isVPN: req.networkInfo?.isVPN || false,
        isProxy: false,
        isp: req.geoInfo?.org || 'Unknown',
      },
      isExamSession: !!testId,
      examStartTime: testId ? new Date() : null,
      isSecureBrowser: req.browserInfo?.isSecureBrowser || false,
      browserFeatures: browserFeatures
    });

    await deviceSession.save();

    res.json({
      success: true,
      sessionToken,
      deviceFingerprint,
      securityChecks: {
        isSecureBrowser: deviceSession.isSecureBrowser,
        isVPN: deviceSession.networkInfo.isVPN,
        multipleSessionsDetected: false
      },
      message: 'Device session started successfully'
    });
  } catch (error) {
    console.error('Session start error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to start session',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});


router.post('/exam/start', rateLimit, protect, examSecurity, networkSecurity, browserSecurity, async (req, res) => {
  try {
    const { testId, deviceFingerprint, sessionToken, sections = [] } = req.body;
    const userId = req.user._id;

    if (!testId || !sessionToken) {
      return res.status(400).json({
        success: false,
        message: 'testId and sessionToken are required',
        code: 'MISSING_PARAMETERS'
      });
    }

    const deviceSession = await DeviceSession.findOne({
      sessionToken,
      user: userId,
      status: 'active'
    });

    if (!deviceSession || !deviceSession.isValid()) {
      return res.status(403).json({ 
        success: false,
        message: 'Invalid device session. Please restart.',
        code: 'INVALID_SESSION'
      });
    }

    const existingAttempt = await TestAttempt.findOne({
      student: userId,
      testSet: testId,
      status: 'started'
    });

    if (existingAttempt) {
      return res.status(409).json({
        success: false,
        message: 'Test already in progress',
        code: 'TEST_IN_PROGRESS',
        attemptId: existingAttempt._id
      });
    }

    const testAttempt = new TestAttempt({
      student: userId,
      testSet: testId,
      status: 'started'
    });
    await testAttempt.save();

    const examSecurity = new ExamSecurity({
      testAttempt: testAttempt._id,
      student: userId,
      testSet: testId,
      deviceSession: deviceSession._id,
      securityStatus: 'secure',
      networkSecurity: {
        allowedIPs: [getClientIP(req)],
        detectedVPN: req.networkInfo?.isVPN || false,
        detectedProxy: false,
        networkDisconnections: 0,
        lastNetworkCheck: new Date(),
        networkViolations: []
      },
      browserSecurity: {
        isSecureBrowser: req.browserInfo?.isSecureBrowser || false,
        browserName: req.browserInfo?.browserName || 'Unknown',
        browserVersion: req.browserInfo?.browserVersion || 'Unknown',
        securityFeatures: req.body.browserFeatures || {}
      },
      screenSecurity: {
        fullscreenExits: 0,
        tabSwitches: 0,
        windowBlurs: 0,
        multipleMonitorsDetected: false,
        violations: []
      },
      timingSecurity: {
        serverStartTime: new Date(),
        clientStartTime: new Date(req.body.clientStartTime || Date.now()),
        timeDrift: 0,
        autoSubmissions: []
      },
      violations: []
    });
    await examSecurity.save();

    deviceSession.isExamSession = true;
    deviceSession.testSet = testId;
    deviceSession.examStartTime = new Date();
    await deviceSession.save();

    const timerResult = await examTimerService.startExamTimer(
      testAttempt._id.toString(), 
      testId, 
      sections
    );

    res.json({
      success: true,
      attemptId: testAttempt._id,
      securityId: examSecurity._id,
      sessionId: deviceSession._id,
      timer: timerResult,
      message: 'Exam started successfully'
    });
  } catch (error) {
    console.error('Exam start error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to start exam',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});


router.post('/session/validate', protect, async (req, res) => {
  try {
    const { sessionToken, examContext } = req.body;
    const userId = req.user._id;

    if (!sessionToken) {
      return res.status(400).json({ 
        valid: false, 
        message: 'Session token is required' 
      });
    }

    const session = await DeviceSession.findOne({
      sessionToken,
      user: userId,
      status: 'active'
    });

    if (!session) {
      return res.status(401).json({ 
        valid: false, 
        message: 'Session not found or has expired',
        details: 'Your exam session may have timed out. Please restart the exam.'
      });
    }

    if (!session.isValid()) {
      await session.terminate('expired');
      return res.status(401).json({ 
        valid: false, 
        message: 'Session expired due to inactivity',
        details: `Sessions expire after ${session.isExamSession ? '2 hours' : '30 minutes'} of inactivity. Please restart the exam.`
      });
    }

    // Enhanced validation for exam sessions
    if (session.isExamSession && examContext) {
      // Verify exam context matches session
      if (examContext.testId && session.testSet && 
          examContext.testId !== session.testSet.toString()) {
        return res.status(403).json({ 
          valid: false, 
          message: 'Exam context mismatch' 
        });
      }

      // Check if there's an active test attempt - but allow grace period for newly started exams
      const activeAttempt = await TestAttempt.findOne({
        student: userId,
        testSet: session.testSet,
        status: 'started'
      });

      // If session was just created (within last 30 seconds), don't require active attempt yet
      const sessionAge = Date.now() - session.examStartTime?.getTime();
      const isNewSession = sessionAge < 30000; // 30 seconds grace period

      if (!activeAttempt && !isNewSession) {
        return res.status(404).json({ 
          valid: false, 
          message: 'No active exam attempt found' 
        });
      }

      // Check exam security status only if attempt exists
      if (activeAttempt) {
        const examSecurity = await ExamSecurity.findOne({
          testAttempt: activeAttempt._id,
          student: userId
        });

        if (examSecurity && examSecurity.securityStatus === 'terminated') {
          return res.status(403).json({ 
            valid: false, 
            message: 'Exam terminated due to security violations',
            details: `Your exam was terminated due to ${examSecurity.violations.length} security violations. Score: ${examSecurity.securityScore}`
          });
        }
      }
    }

    // Update session activity
    await session.updateActivity();

    res.json({
      valid: true,
      session: {
        id: session._id,
        isExamSession: session.isExamSession,
        testSet: session.testSet,
        lastActivity: session.lastActivity,
        examStartTime: session.examStartTime,
        securityStatus: session.isExamSession ? 'exam_active' : 'active'
      }
    });
  } catch (error) {
    console.error('Session validation error:', error);
    res.status(500).json({ 
      valid: false, 
      message: 'Validation failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});


router.post('/session/heartbeat', protect, async (req, res) => {
  try {
    const { sessionToken } = req.body;
    const userId = req.user._id;

    if (!sessionToken) {
      return res.status(400).json({ 
        success: false, 
        message: 'Session token is required' 
      });
    }

    const session = await DeviceSession.findOne({
      sessionToken,
      user: userId,
      status: 'active'
    });

    if (session && session.isValid()) {
      await session.updateActivity();
      res.json({ success: true });
    } else {
      res.status(401).json({ success: false, message: 'Invalid session' });
    }
  } catch (error) {
    console.error('Session heartbeat error:', error);
    res.status(500).json({ success: false });
  }
});


router.post('/session/end', protect, async (req, res) => {
  try {
    const { sessionToken, reason = 'logout' } = req.body;
    const userId = req.user._id;

    if (sessionToken) {
      const session = await DeviceSession.findOne({
        sessionToken,
        user: userId,
        status: 'active'
      });

      if (session) {
        if (session.isExamSession) {
          session.examEndTime = new Date();
        }
        await session.terminate(reason);
      }
    }

    res.json({ success: true, message: 'Session ended successfully' });
  } catch (error) {
    console.error('Session end error:', error);
    res.status(500).json({ success: false });
  }
});


router.get('/status/:attemptId', protect, async (req, res) => {
  try {
    const { attemptId } = req.params;
    const userId = req.user._id;

    const examSecurity = await ExamSecurity.findOne({
      testAttempt: attemptId,
      student: userId
    }).populate('deviceSession');

    if (!examSecurity) {
      return res.status(404).json({ message: 'Security record not found' });
    }

    res.json({
      securityStatus: examSecurity.securityStatus,
      securityScore: examSecurity.securityScore,
      violations: examSecurity.violations.length,
      networkSecurity: {
        isVPN: examSecurity.networkSecurity.detectedVPN,
        isProxy: examSecurity.networkSecurity.detectedProxy,
        disconnections: examSecurity.networkSecurity.networkDisconnections || 0
      },
      browserSecurity: {
        isSecure: examSecurity.browserSecurity.isSecureBrowser,
        browser: examSecurity.browserSecurity.browserName
      },
      screenViolations: {
        fullscreenExits: examSecurity.screenSecurity.fullscreenExits,
        tabSwitches: examSecurity.screenSecurity.tabSwitches,
        windowBlurs: examSecurity.screenSecurity.windowBlurs
      },
      postExamSecurity: examSecurity.postExamSecurity || {
        submissionLocked: false,
        reattemptBlocked: false,
        dataWiped: false,
        lockTimestamp: null
      }
    });
  } catch (error) {
    console.error('Security status error:', error);
    res.status(500).json({ message: 'Failed to get security status' });
  }
});


router.get('/timer/remaining/:attemptId', protect, async (req, res) => {
  try {
    const { attemptId } = req.params;
    const { type = 'exam', id } = req.query;
    const userId = req.user._id;

    // Verify ownership
    const testAttempt = await TestAttempt.findOne({
      _id: attemptId,
      student: userId,
      status: 'started'
    });

    if (!testAttempt) {
      return res.status(404).json({ 
        remaining: 0, 
        endTime: null,
        message: 'Test attempt not found' 
      });
    }

    const remaining = examTimerService.getRemainingTime(attemptId, type, id);
    res.json(remaining);
  } catch (error) {
    console.error('Get remaining time error:', error);
    res.status(500).json({ remaining: 0, endTime: null });
  }
});


// Post-exam security endpoint for submission lockdown
router.post('/exam/submit', protect, async (req, res) => {
  try {
    const { attemptId, reason = 'completed' } = req.body;
    const userId = req.user._id;

    if (!attemptId) {
      return res.status(400).json({
        success: false,
        message: 'attemptId is required'
      });
    }

    // Verify ownership and that exam is in progress
    const testAttempt = await TestAttempt.findOne({
      _id: attemptId,
      student: userId,
      status: 'started'
    });

    if (!testAttempt) {
      return res.status(404).json({
        success: false,
        message: 'Active test attempt not found'
      });
    }

    // Get exam security record
    const examSecurity = await ExamSecurity.findOne({
      testAttempt: attemptId,
      student: userId
    });

    if (!examSecurity) {
      return res.status(404).json({
        success: false,
        message: 'Exam security record not found'
      });
    }

    // Update test attempt to completed
    testAttempt.status = 'completed';
    testAttempt.completedAt = new Date();
    testAttempt.exitReason = reason;
    await testAttempt.save();

    // Apply post-exam security lockdown
    examSecurity.postExamSecurity = {
      submissionLocked: true,
      reattemptBlocked: true,
      dataWiped: false, // Will be wiped on client side
      lockTimestamp: new Date()
    };
    examSecurity.securityStatus = 'completed';
    await examSecurity.save();

    // Terminate all device sessions for this exam
    await DeviceSession.updateMany(
      {
        user: userId,
        testSet: testAttempt.testSet,
        status: 'active'
      },
      {
        status: 'terminated',
        terminationReason: 'exam_completed',
        examEndTime: new Date()
      }
    );

    // Clear any active timers
    examTimerService.clearTimers(attemptId);

    res.json({
      success: true,
      securityLocked: true,
      postExamSecurity: examSecurity.postExamSecurity,
      message: 'Exam submitted and secured successfully'
    });

  } catch (error) {
    console.error('Exam submission security error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to secure exam submission',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

router.post('/violation', rateLimit, protect, async (req, res) => {
  try {
    const { testAttemptId, violationType, details, clientTimestamp } = req.body;
    const userId = req.user._id;

    // Input validation
    if (!testAttemptId || !violationType) {
      return res.status(400).json({ 
        success: false, 
        message: 'testAttemptId and violationType are required' 
      });
    }

    const violationConfig = VIOLATION_TYPES[violationType];
    if (!violationConfig) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid violation type',
        validTypes: Object.keys(VIOLATION_TYPES)
      });
    }

    const sanitizedDetails = typeof details === 'string' 
      ? details.replace(/[<>"'&]/g, '').substring(0, 500)
      : JSON.stringify(details).replace(/[<>"'&]/g, '').substring(0, 500);

    const testAttempt = await TestAttempt.findOne({
      _id: testAttemptId,
      student: userId,
      status: 'started'
    });

    if (!testAttempt) {
      return res.status(404).json({ 
        success: false, 
        message: 'Active test attempt not found' 
      });
    }

    const examSecurity = await ExamSecurity.findOne({
      testAttempt: testAttemptId,
      student: userId
    });

    if (!examSecurity) {
      return res.status(404).json({ 
        success: false,
        message: 'Exam security record not found' 
      });
    }

    if (examSecurity.securityStatus === 'terminated') {
      return res.status(409).json({ 
        success: false,
        message: 'Exam already terminated' 
      });
    }

    await examSecurity.addViolation(
      violationType, 
      violationConfig.severity, 
      sanitizedDetails, 
      violationConfig.action
    );
    
    const criticalViolations = examSecurity.violations.filter(v => v.severity === 'critical').length;
    const highViolations = examSecurity.violations.filter(v => v.severity === 'high').length;
    
    // Made less strict: require 2 critical OR 3 high violations before termination
    const shouldTerminate = 
      criticalViolations >= 2 || 
      examSecurity.securityScore < 30 || 
      highViolations >= 3;

    let terminated = false;
    if (shouldTerminate) {
      try {
        examSecurity.securityStatus = 'terminated';
        await examSecurity.save();
        
        testAttempt.status = 'terminated';
        testAttempt.endTime = new Date();
        await testAttempt.save();
        
        await examTimerService.autoSubmitExam(testAttemptId, 'security_violation');
        terminated = true;
      } catch (submitError) {
        console.error('Auto-submit failed:', submitError);
      }
    }

    res.json({
      success: true,
      violationLogged: true,
      violationType,
      severity: violationConfig.severity,
      action: violationConfig.action,
      securityScore: examSecurity.securityScore,
      shouldTerminate: terminated,
      remainingViolations: terminated ? 0 : Math.max(0, 5 - highViolations),
      message: terminated 
        ? 'Exam terminated due to security violations'
        : violationConfig.description
    });
  } catch (error) {
    console.error('Violation logging error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to log violation',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Session recovery endpoint
router.post('/session/recover', protect, async (req, res) => {
  try {
    const { testId, deviceFingerprint } = req.body;
    const userId = req.user._id;

    if (!testId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Test ID is required for session recovery' 
      });
    }

    // Check if there's an active test attempt that can be recovered
    const activeAttempt = await TestAttempt.findOne({
      student: userId,
      testSet: testId,
      status: 'started'
    });

    if (!activeAttempt) {
      return res.status(404).json({ 
        success: false, 
        message: 'No active exam attempt found to recover' 
      });
    }

    // Check if exam is still within time limits
    const TestSet = require('../models/TestSet');
    const test = await TestSet.findById(testId);
    if (!test) {
      return res.status(404).json({ 
        success: false, 
        message: 'Test not found' 
      });
    }

    const timeElapsed = Math.floor((new Date() - activeAttempt.startTime) / 1000);
    const timeLimit = test.timeLimit * 60; // Convert to seconds

    if (timeElapsed >= timeLimit) {
      return res.status(400).json({ 
        success: false, 
        message: 'Test time has expired, cannot recover session' 
      });
    }

    // Terminate any existing sessions
    await DeviceSession.updateMany(
      { user: userId, testSet: testId, status: 'active' },
      { status: 'terminated', terminationReason: 'session_recovery' }
    );

    // Create new session
    const newSession = new DeviceSession({
      user: userId,
      testSet: testId,
      deviceFingerprint: deviceFingerprint || generateDeviceFingerprint(req),
      sessionToken: crypto.randomBytes(32).toString('hex'),
      isExamSession: true,
      examStartTime: activeAttempt.startTime,
      networkInfo: {
        ipAddress: getClientIP(req),
        country: req.geoInfo?.country || 'Unknown',
        region: req.geoInfo?.region || 'Unknown',
        city: req.geoInfo?.city || 'Unknown',
      }
    });

    await newSession.save();

    res.json({
      success: true,
      message: 'Session recovered successfully',
      sessionToken: newSession.sessionToken,
      timeRemaining: Math.max(0, timeLimit - timeElapsed),
      attemptId: activeAttempt._id
    });

  } catch (error) {
    console.error('Session recovery error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to recover session',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;

module.exports = router;
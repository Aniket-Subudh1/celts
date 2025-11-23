const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const geoip = require('geoip-lite');
const User = require('../models/User');

let DeviceSession;
const getDeviceSession = () => {
  if (!DeviceSession) {
    DeviceSession = require('../models/DeviceSession');
  }
  return DeviceSession;
};

const fingerprintCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; 

// Clean up cache periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of fingerprintCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      fingerprintCache.delete(key);
    }
  }
}, 60000); // Clean every minute


const protect = async (req, res, next) => {
  let token;

  try {
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      const user = await User.findById(decoded.id).select('-password');
      if (!user) {
        return res.status(401).json({ message: 'Not authorized, user not found' });
      }

      const deviceFingerprint = generateDeviceFingerprint(req);
      
      // Check for active session if session token is provided
      const sessionToken = req.headers['x-session-token'];
      if (sessionToken) {
        const DeviceSessionModel = getDeviceSession();
        const session = await DeviceSessionModel.findOne({ 
          sessionToken,
          user: user._id,
          status: 'active'
        });
        
        if (session && session.isValid()) {
          await session.updateActivity();
          req.deviceSession = session;
        }
      }

      req.user = user;
      req.deviceFingerprint = deviceFingerprint;
      req.clientIP = getClientIP(req);
      return next();
    }

    // If no header or startsWith not matched
    return res.status(401).json({ message: 'Not authorized, no token' });
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(401).json({ message: 'Not authorized, token failed' });
  }
};

/**
 * Middleware to restrict access based on user role.
 * @param {string[]} roles - Array of roles allowed (e.g., ['admin','teacher'])
 */
const restrictTo = (roles = []) => (req, res, next) => {
  if (!req.user) {
    return res.status(403).json({ message: 'Access denied. User not authenticated.' });
  }
  if (!roles.includes(req.user.role)) {
    return res
      .status(403)
      .json({ message: `Access denied. Requires one of the following roles: ${roles.join(', ')}` });
  }
  return next();
};

/**
 * Generate device fingerprint based on request headers and client info with caching
 */
const generateDeviceFingerprint = (req) => {
  const userAgent = req.headers['user-agent'] || '';
  const acceptLanguage = req.headers['accept-language'] || '';
  const acceptEncoding = req.headers['accept-encoding'] || '';
  const ip = getClientIP(req);
  
  // Create cache key
  const cacheKey = `${userAgent}-${acceptLanguage}-${acceptEncoding}-${ip}`;
  
  // Check cache first
  const cached = fingerprintCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    return cached.fingerprint;
  }
  
  // Generate new fingerprint
  const fingerprint = crypto
    .createHash('sha256')
    .update(cacheKey)
    .digest('hex');
  
  // Cache the result
  fingerprintCache.set(cacheKey, {
    fingerprint,
    timestamp: Date.now()
  });
  
  return fingerprint;
};

/**
 * Get client IP address accounting for proxies
 */
const getClientIP = (req) => {
  return req.headers['x-forwarded-for']?.split(',')[0] ||
         req.headers['x-real-ip'] ||
         req.connection?.remoteAddress ||
         req.socket?.remoteAddress ||
         req.ip ||
         '127.0.0.1';
};

/**
 * Middleware for exam-specific security checks
 */
const examSecurity = async (req, res, next) => {
  try {
    if (!req.user || req.user.role !== 'student') {
      return next(); // Only apply to students
    }

    const testId = req.params.testId || req.body.testId;
    if (!testId) {
      return next(); // No test context
    }

    // Lazy load models to avoid circular dependencies
    const TestAttempt = require('../models/TestAttempt');
    const DeviceSession = require('../models/DeviceSession');

    // Check for active test attempt
    const activeAttempt = await TestAttempt.findOne({
      student: req.user._id,
      testSet: testId,
      status: 'started'
    });

    if (activeAttempt) {
      // Verify device session for exam
      const examSession = await DeviceSession.findOne({
        user: req.user._id,
        testSet: testId,
        status: 'active',
        isExamSession: true
      });

      if (!examSession || !examSession.isValid()) {
        return res.status(403).json({ 
          message: 'Invalid exam session. Please restart the exam.',
          code: 'INVALID_EXAM_SESSION'
        });
      }

      // Check for multiple concurrent sessions
      const concurrentSessions = await DeviceSession.countDocuments({
        user: req.user._id,
        status: 'active',
        _id: { $ne: examSession._id }
      });

      if (concurrentSessions > 0) {
        // Terminate other sessions
        await DeviceSession.updateMany(
          {
            user: req.user._id,
            status: 'active',
            _id: { $ne: examSession._id }
          },
          {
            status: 'terminated',
            terminationReason: 'multiple_sessions'
          }
        );

        return res.status(403).json({ 
          message: 'Multiple sessions detected. Other sessions have been terminated.',
          code: 'MULTIPLE_SESSIONS'
        });
      }

      req.examSession = examSession;
      req.testAttempt = activeAttempt;
    }

    return next();
  } catch (error) {
    console.error('Exam security middleware error:', error);
    return res.status(500).json({ message: 'Security check failed' });
  }
};

/**
 * Middleware for network security checks (VPN/Proxy detection)
 */
const networkSecurity = async (req, res, next) => {
  try {
    const clientIP = req.clientIP || getClientIP(req);
    
    // Skip for localhost/development
    if (clientIP === '127.0.0.1' || clientIP === '::1' || 
        clientIP.startsWith('192.168.') || clientIP.startsWith('10.') ||
        clientIP.startsWith('172.')) {
      req.networkInfo = {
        ip: clientIP,
        isVPN: false,
        geo: null
      };
      return next();
    }

    // Get geolocation info
    const geo = geoip.lookup(clientIP);
    req.geoInfo = geo;

    // Basic VPN/Proxy detection
    let isVPN = false;
    if (geo && geo.org) {
      const suspiciousPatterns = [
        /vpn/i, /proxy/i, /hosting/i, /cloud/i, /server/i,
        /datacenter/i, /digital ocean/i, /amazon/i, /google/i
      ];
      isVPN = suspiciousPatterns.some(pattern => pattern.test(geo.org));
    }
    
    if (isVPN && req.user?.role === 'student') {
      console.warn(`Potential VPN/Proxy detected for user ${req.user._id} from IP ${clientIP}`);
      
      // If this is an exam context, log violation
      if (req.examSession) {
        try {
          const ExamSecurity = require('../models/ExamSecurity');
          const examSecurity = await ExamSecurity.findOne({ 
            testAttempt: req.testAttempt._id 
          });
          
          if (examSecurity) {
            examSecurity.networkSecurity.detectedVPN = true;
            examSecurity.networkSecurity.networkViolations = 
              examSecurity.networkSecurity.networkViolations || [];
            examSecurity.networkSecurity.networkViolations.push({
              type: 'vpn_detected',
              timestamp: new Date(),
              details: `VPN/Proxy detected from IP: ${clientIP}, Org: ${geo?.org || 'Unknown'}`
            });
            await examSecurity.save();
          }
        } catch (violationError) {
          console.error('Error logging VPN violation:', violationError);
        }
      }
    }

    req.networkInfo = {
      ip: clientIP,
      isVPN: !!isVPN,
      geo: geo
    };

    return next();
  } catch (error) {
    console.error('Network security middleware error:', error);
    // Don't block on network security errors
    req.networkInfo = {
      ip: req.clientIP || getClientIP(req),
      isVPN: false,
      geo: null
    };
    return next();
  }
};

/**
 * Middleware for browser security checks
 */
const browserSecurity = (req, res, next) => {
  try {
    const userAgent = req.headers['user-agent'] || '';
    
    // Check if it's a secure browser (Safe Exam Browser, etc.)
    const secureBrowserPatterns = [
      /SEB/i, // Safe Exam Browser
      /SecureBrowser/i,
      /ExamBrowser/i
    ];

    const isSecureBrowser = secureBrowserPatterns.some(pattern => pattern.test(userAgent));
    
    // Extract browser info
    const browserInfo = {
      userAgent,
      isSecureBrowser,
      browserName: extractBrowserName(userAgent),
      browserVersion: extractBrowserVersion(userAgent)
    };

    req.browserInfo = browserInfo;

    // For exam contexts, require secure browser
    if (req.user?.role === 'student' && req.examSession && !isSecureBrowser) {
      // Log warning but allow (can be configured to block)
      console.warn(`Non-secure browser detected for exam: ${userAgent}`);
    }

    return next();
  } catch (error) {
    console.error('Browser security middleware error:', error);
    return next();
  }
};

/**
 * Extract browser name from user agent
 */
const extractBrowserName = (userAgent) => {
  if (userAgent.includes('Chrome')) return 'Chrome';
  if (userAgent.includes('Firefox')) return 'Firefox';
  if (userAgent.includes('Safari')) return 'Safari';
  if (userAgent.includes('Edge')) return 'Edge';
  if (userAgent.includes('Opera')) return 'Opera';
  if (userAgent.includes('SEB')) return 'Safe Exam Browser';
  return 'Unknown';
};

/**
 * Extract browser version from user agent
 */
const extractBrowserVersion = (userAgent) => {
  const match = userAgent.match(/(?:Chrome|Firefox|Safari|Edge|Opera)\/(\d+\.\d+)/);
  return match ? match[1] : 'Unknown';
};

module.exports = { 
  protect, 
  restrictTo, 
  examSecurity, 
  networkSecurity, 
  browserSecurity,
  generateDeviceFingerprint,
  getClientIP
};

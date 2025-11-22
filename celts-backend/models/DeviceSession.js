const mongoose = require('mongoose');
const crypto = require('crypto');

const DeviceSessionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },

  testSet: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TestSet',
    default: null,
  },

  deviceFingerprint: {
    type: String,
    required: true,
  },

  browserInfo: {
    userAgent: String,
    platform: String,
    language: String,
    cookieEnabled: Boolean,
    javaEnabled: Boolean,
    onlineStatus: Boolean,
    screenResolution: String,
    timezone: String,
    browserName: String,
    browserVersion: String,
  },

  networkInfo: {
    ipAddress: {
      type: String,
      required: true,
    },
    country: String,
    region: String,
    city: String,
    isVPN: {
      type: Boolean,
      default: false,
    },
    isProxy: {
      type: Boolean,
      default: false,
    },
    isp: String,
    org: String,
  },

  sessionToken: {
    type: String,
    required: true,
    unique: true,
  },

  status: {
    type: String,
    enum: ['active', 'terminated', 'expired', 'violation'],
    default: 'active',
  },

  isExamSession: {
    type: Boolean,
    default: false,
  },

  examStartTime: {
    type: Date,
    default: null,
  },

  examEndTime: {
    type: Date,
    default: null,
  },

  lastActivity: {
    type: Date,
    default: Date.now,
  },

  violations: [{
    type: String,
    timestamp: {
      type: Date,
      default: Date.now,
    },
    details: String,
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
    },
  }],

  terminationReason: {
    type: String,
    enum: ['logout', 'timeout', 'violation', 'multiple_sessions', 'network_disconnect', 'device_change'],
    default: null,
  },

  isSecureBrowser: {
    type: Boolean,
    default: false,
  },

  browserFeatures: {
    webSecurity: Boolean,
    devToolsDisabled: Boolean,
    printingDisabled: Boolean,
    downloadDisabled: Boolean,
    copyPasteDisabled: Boolean,
    rightClickDisabled: Boolean,
  },

}, { timestamps: true });

DeviceSessionSchema.index({ user: 1, status: 1 });
DeviceSessionSchema.index({ user: 1, testSet: 1, isExamSession: 1 });
DeviceSessionSchema.index({ sessionToken: 1, status: 1 });
DeviceSessionSchema.index({ lastActivity: 1 }, { expireAfterSeconds: 86400 }); // Auto-expire after 24 hours

DeviceSessionSchema.index(
  { user: 1, testSet: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { 
      status: 'active', 
      isExamSession: true 
    },
    name: 'unique_active_exam_session'
  }
);

DeviceSessionSchema.methods.isValid = function() {
  const now = new Date();
  // For exam sessions: 3 hours timeout, for regular sessions: 30 minutes
  const timeoutMinutes = this.isExamSession ? 180 : 30;
  const lastActivityThreshold = new Date(now.getTime() - (timeoutMinutes * 60 * 1000)); 
  
  // Session is valid if it's active and not timed out
  const isActiveAndNotTimedOut = this.status === 'active' && this.lastActivity > lastActivityThreshold;
  
  // For exam sessions, also check if we're within exam time bounds
  if (this.isExamSession && this.examStartTime) {
    const examAge = now.getTime() - this.examStartTime.getTime();
    const maxExamDuration = 4 * 60 * 60 * 1000; // 4 hours max exam duration
    
    // If exam has been running too long, consider it invalid
    if (examAge > maxExamDuration) {
      return false;
    }
  }
  
  return isActiveAndNotTimedOut;
};

// Method to update last activity
DeviceSessionSchema.methods.updateActivity = function() {
  this.lastActivity = new Date();
  return this.save();
};

// Method to terminate session
DeviceSessionSchema.methods.terminate = function(reason) {
  this.status = 'terminated';
  this.terminationReason = reason;
  return this.save();
};

// Additional compound indexes for performance optimization
DeviceSessionSchema.index({ deviceFingerprint: 1, status: 1 });
DeviceSessionSchema.index({ lastActivity: 1, status: 1 });

module.exports = mongoose.model('DeviceSession', DeviceSessionSchema);
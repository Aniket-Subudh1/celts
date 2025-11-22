const mongoose = require('mongoose');

const ExamSecuritySchema = new mongoose.Schema({
  testAttempt: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TestAttempt',
    required: true,
  },

  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },

  testSet: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TestSet',
    required: true,
  },

  deviceSession: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DeviceSession',
    required: true,
  },

  questionTimings: [{
    questionId: String,
    timeSpent: Number, 
    startTime: Date,
    endTime: Date,
    autoSubmitted: Boolean,
    violations: [{
      type: String,
      timestamp: Date,
      details: String,
    }],
  }],

  sectionTimings: [{
    sectionId: String,
    sectionName: String,
    timeLimit: Number, 
    timeSpent: Number, 
    startTime: Date,
    endTime: Date,
    autoSubmitted: Boolean,
    questionsCompleted: Number,
    questionsTotal: Number,
  }],

  securityStatus: {
    type: String,
    enum: ['secure', 'compromised', 'violated', 'terminated'],
    default: 'secure',
  },

  violations: [{
    type: {
      type: String,
      required: true,
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    details: String,
    handled: {
      type: Boolean,
      default: false,
    },
    action: {
      type: String,
      enum: ['warning', 'terminate', 'flag', 'auto_submit'],
      default: 'warning',
    },
  }],

  // Network security
  networkSecurity: {
    allowedIPs: [String],
    detectedVPN: {
      type: Boolean,
      default: false,
    },
    detectedProxy: {
      type: Boolean,
      default: false,
    },
    networkDisconnections: Number,
    lastNetworkCheck: Date,
    networkViolations: [{
      type: String,
      timestamp: Date,
      details: String,
    }],
  },

  // Browser security
  browserSecurity: {
    isSecureBrowser: {
      type: Boolean,
      default: false,
    },
    browserName: String,
    browserVersion: String,
    securityFeatures: {
      devToolsDisabled: Boolean,
      printingDisabled: Boolean,
      downloadDisabled: Boolean,
      copyPasteDisabled: Boolean,
      rightClickDisabled: Boolean,
      screenshotDisabled: Boolean,
    },
    violations: [{
      type: String,
      timestamp: Date,
      details: String,
    }],
  },

  // Screen monitoring
  screenSecurity: {
    fullscreenExits: Number,
    tabSwitches: Number,
    windowBlurs: Number,
    multipleMonitorsDetected: Boolean,
    screenRecording: {
      enabled: Boolean,
      violationsDetected: Number,
    },
    violations: [{
      type: String,
      timestamp: Date,
      details: String,
    }],
  },

  timingSecurity: {
    serverStartTime: Date,
    clientStartTime: Date,
    timeDrift: Number,
    timeViolations: Number,
    autoSubmissions: [{
      reason: String,
      timestamp: Date,
      questionId: String,
      sectionId: String,
    }],
  },

  securityScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 100,
  },

  postExamSecurity: {
    submissionLocked: {
      type: Boolean,
      default: false,
    },
    reattemptBlocked: {
      type: Boolean,
      default: true,
    },
    dataWiped: {
      type: Boolean,
      default: false,
    },
    lockTimestamp: Date,
  },

}, { timestamps: true });

ExamSecuritySchema.index({ testAttempt: 1 });
ExamSecuritySchema.index({ student: 1, testSet: 1 });
ExamSecuritySchema.index({ securityStatus: 1 });
ExamSecuritySchema.index({ 'violations.severity': 1 });

ExamSecuritySchema.methods.calculateSecurityScore = function() {
  let score = 100;
  
  this.violations.forEach(violation => {
    switch (violation.severity) {
      case 'low':
        score -= 2;
        break;
      case 'medium':
        score -= 5;
        break;
      case 'high':
        score -= 15;
        break;
      case 'critical':
        score -= 30;
        break;
    }
  });

  score -= this.screenSecurity.fullscreenExits * 10;
  score -= this.screenSecurity.tabSwitches * 15;
  score -= this.networkSecurity.networkDisconnections * 10;
  
  if (this.networkSecurity.detectedVPN) score -= 20;
  if (this.networkSecurity.detectedProxy) score -= 20;
  if (!this.browserSecurity.isSecureBrowser) score -= 10;

  this.securityScore = Math.max(0, score);
  return this.securityScore;
};

// Method to add violation
ExamSecuritySchema.methods.addViolation = function(type, severity, details, action = 'warning') {
  this.violations.push({
    type,
    severity,
    details,
    action,
  });

  // Update security status based on violation severity
  if (severity === 'critical' && this.securityStatus !== 'terminated') {
    this.securityStatus = 'violated';
  }

  // Recalculate security score
  this.calculateSecurityScore();

  return this.save();
};

module.exports = mongoose.model('ExamSecurity', ExamSecuritySchema);
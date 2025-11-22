const TestAttempt = require('../models/TestAttempt');
const ExamSecurity = require('../models/ExamSecurity');
const DeviceSession = require('../models/DeviceSession');

class ExamTimerService {
  constructor() {
    this.activeTimers = new Map();
    this.sectionTimers = new Map();
    this.questionTimers = new Map();
    
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredTimers();
    }, 60000); 
  }

  
  async startExamTimer(attemptId, testId, sections = []) {
    try {
      const testAttempt = await TestAttempt.findById(attemptId).populate('testSet');
      if (!testAttempt || testAttempt.status !== 'started') {
        return { success: false, message: 'Invalid test attempt' };
      }

      const testSet = testAttempt.testSet;
      const totalTimeLimit = (testSet.timeLimitMinutes || 120) * 60 * 1000; 
      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + totalTimeLimit);

      const examTimer = setTimeout(async () => {
        await this.autoSubmitExam(attemptId, 'time_expired');
      }, totalTimeLimit);

      this.activeTimers.set(attemptId, {
        timer: examTimer,
        startTime,
        endTime,
        totalTimeLimit,
        testId,
        studentId: testAttempt.student
      });

      return {
        success: true,
        startTime,
        endTime,
        totalTimeLimit: totalTimeLimit / 1000, 
        message: 'Exam timer started'
      };
    } catch (error) {
      console.error('Start exam timer error:', error);
      return { success: false, message: 'Failed to start timer' };
    }
  }

  async autoSubmitExam(attemptId, reason = 'time_expired') {
    try {
      this.clearTimers(attemptId);
      
      const testAttempt = await TestAttempt.findById(attemptId);
      if (!testAttempt || testAttempt.status !== 'started') {
        return { success: false, message: 'Invalid test attempt' };
      }

      testAttempt.status = 'completed';
      testAttempt.completedAt = new Date();
      testAttempt.exitReason = reason;
      await testAttempt.save();

      const examSecurity = await ExamSecurity.findOne({ testAttempt: attemptId });
      if (examSecurity) {
        examSecurity.timingSecurity = examSecurity.timingSecurity || {};
        examSecurity.timingSecurity.autoSubmissions = examSecurity.timingSecurity.autoSubmissions || [];
        examSecurity.timingSecurity.autoSubmissions.push({
          reason,
          timestamp: new Date(),
          questionId: null,
          sectionId: null
        });
        await examSecurity.save();
      }

      await DeviceSession.updateMany(
        { 
          user: testAttempt.student,
          testSet: testAttempt.testSet,
          status: 'active' 
        },
        { 
          status: 'terminated',
          terminationReason: 'exam_completed',
          examEndTime: new Date()
        }
      );

      this.clearTimers(attemptId);

      console.log(`Exam auto-submitted for attempt ${attemptId}, reason: ${reason}`);
      
      return {
        success: true,
        message: 'Exam auto-submitted successfully'
      };
    } catch (error) {
      console.error('Auto-submit exam error:', error);
      return { success: false, message: 'Failed to auto-submit exam' };
    }
  }

  
  clearTimers(attemptId) {
    const examTimer = this.activeTimers.get(attemptId);
    if (examTimer && examTimer.timer) {
      clearTimeout(examTimer.timer);
    }
    this.activeTimers.delete(attemptId);

    const sectionTimers = this.sectionTimers.get(attemptId);
    if (sectionTimers) {
      sectionTimers.forEach(st => {
        if (st.timer) clearTimeout(st.timer);
      });
    }
    this.sectionTimers.delete(attemptId);

    const questionTimers = this.questionTimers.get(attemptId);
    if (questionTimers) {
      questionTimers.forEach(qt => {
        if (qt.timer) clearTimeout(qt.timer);
      });
    }
    this.questionTimers.delete(attemptId);
  }

 
  getRemainingTime(attemptId, type = 'exam', id = null) {
    try {
      if (type === 'exam') {
        const examTimer = this.activeTimers.get(attemptId);
        if (examTimer) {
          const now = new Date();
          const remaining = Math.max(0, examTimer.endTime.getTime() - now.getTime());
          return {
            remaining: Math.floor(remaining / 1000),
            endTime: examTimer.endTime
          };
        }
      }
      
      return { remaining: 0, endTime: null };
    } catch (error) {
      console.error('Get remaining time error:', error);
      return { remaining: 0, endTime: null };
    }
  }

  // Cleanup expired timers to prevent memory leaks
  cleanupExpiredTimers() {
    try {
      const now = Date.now();
      
      // Clean up expired exam timers
      for (const [attemptId, timerInfo] of this.activeTimers.entries()) {
        if (timerInfo.endTime && now > timerInfo.endTime.getTime()) {
          console.log(`Cleaning up expired timer for attempt ${attemptId}`);
          this.clearTimers(attemptId);
        }
      }
      
      // Clean up orphaned section timers
      for (const [attemptId, sectionTimers] of this.sectionTimers.entries()) {
        if (!this.activeTimers.has(attemptId)) {
          console.log(`Cleaning up orphaned section timers for attempt ${attemptId}`);
          sectionTimers.forEach(st => {
            if (st.timer) clearTimeout(st.timer);
          });
          this.sectionTimers.delete(attemptId);
        }
      }
      
      // Clean up orphaned question timers
      for (const [attemptId, questionTimers] of this.questionTimers.entries()) {
        if (!this.activeTimers.has(attemptId)) {
          console.log(`Cleaning up orphaned question timers for attempt ${attemptId}`);
          questionTimers.forEach(qt => {
            if (qt.timer) clearTimeout(qt.timer);
          });
          this.questionTimers.delete(attemptId);
        }
      }
      
    } catch (error) {
      console.error('Cleanup expired timers error:', error);
    }
  }

  // Method to gracefully shutdown the timer service
  shutdown() {
    try {
      // Clear the cleanup interval
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
        this.cleanupInterval = null;
      }
      
      // Clear all active timers
      for (const [attemptId] of this.activeTimers.entries()) {
        this.clearTimers(attemptId);
      }
      
      console.log('ExamTimerService shutdown complete');
    } catch (error) {
      console.error('Timer service shutdown error:', error);
    }
  }
}

const examTimerService = new ExamTimerService();

module.exports = examTimerService;
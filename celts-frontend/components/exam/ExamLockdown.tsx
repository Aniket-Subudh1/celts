import React, { useEffect, useState, useCallback } from 'react';
import { Lock, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import api from '@/lib/api';

interface PostExamSecurity {
  submissionLocked: boolean;
  reattemptBlocked: boolean;
  dataWiped: boolean;
  lockTimestamp: string;
}

interface ExamLockdownProps {
  testId: string;
  attemptId: string;
  isSubmitted: boolean;
  onReattemptBlocked?: () => void;
  showLockdownDetails?: boolean;
}

export function ExamLockdown({
  testId,
  attemptId,
  isSubmitted,
  onReattemptBlocked,
  showLockdownDetails = true
}: ExamLockdownProps) {
  const [lockdownStatus, setLockdownStatus] = useState<PostExamSecurity | null>(null);
  const [loading, setLoading] = useState(true);
  const [blockingReattempt, setBlockingReattempt] = useState(false);

  const fetchLockdownStatus = useCallback(async () => {
    try {
      const response = await api.apiGet(`/security/status/${attemptId}`);
      const data = response.data || response;
      
      if (data.postExamSecurity) {
        setLockdownStatus(data.postExamSecurity);
      }
    } catch (error) {
      console.error('Failed to fetch lockdown status:', error);
    } finally {
      setLoading(false);
    }
  }, [attemptId]);

  const initiateLockdown = useCallback(async () => {
    if (!isSubmitted) return;

    try {
      setBlockingReattempt(true);
      
      // Submit the exam with lockdown
      const response = await api.apiPost('/security/exam/submit', {
        attemptId,
        reason: 'completed'
      });

      const data = response.data || response;
      
      if (data.success && data.securityLocked) {
        toast.success('Exam Secured', {
          description: 'Your exam has been submitted and secured. No further attempts are allowed.',
          duration: 5000,
        });
        
        // Refresh lockdown status
        await fetchLockdownStatus();
        
        // Block any reattempt UI
        onReattemptBlocked?.();
        
        // Prevent navigation away
        preventNavigation();
        
        // Clear sensitive data from storage
        clearExamData();
      }
    } catch (error) {
      console.error('Lockdown initiation error:', error);
      toast.error('Lockdown Failed', {
        description: 'Failed to secure exam. Please contact support.',
        duration: 5000,
      });
    } finally {
      setBlockingReattempt(false);
    }
  }, [isSubmitted, attemptId, fetchLockdownStatus, onReattemptBlocked]);

  const preventNavigation = useCallback(() => {
    // Disable browser back button
    window.history.pushState(null, '', window.location.href);
    
    const handlePopState = () => {
      window.history.pushState(null, '', window.location.href);
      toast.warning('Navigation Blocked', {
        description: 'You cannot navigate away from this page after exam submission.',
        duration: 3000,
      });
    };
    
    window.addEventListener('popstate', handlePopState);
    
    // Block refresh and close
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = 'Exam has been submitted and locked. Are you sure you want to leave?';
      return e.returnValue;
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    // Store cleanup functions
    (window as any).__examLockdownCleanup = () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  const clearExamData = useCallback(() => {
    // Clear exam-related data from localStorage
    const keysToRemove = [
      'exam_session_token',
      'exam_progress',
      'exam_answers',
      'exam_start_time',
      'celts_failed_logs'
    ];
    
    keysToRemove.forEach(key => {
      try {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      } catch (error) {
        console.warn(`Failed to remove ${key} from storage:`, error);
      }
    });
    
    // Clear any cached exam data
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => {
          if (name.includes('exam') || name.includes('test')) {
            caches.delete(name);
          }
        });
      });
    }
  }, []);

  const checkForExistingAttempts = useCallback(async () => {
    try {
      const response = await api.apiGet(`/student/tests/${testId}/attempts`);
      const data = response.data || response;
      
      if (data.hasCompletedAttempt && data.reattemptBlocked) {
        setLockdownStatus({
          submissionLocked: true,
          reattemptBlocked: true,
          dataWiped: false,
          lockTimestamp: data.completedAt
        });
        
        onReattemptBlocked?.();
      }
    } catch (error) {
      console.error('Failed to check existing attempts:', error);
    }
  }, [testId, onReattemptBlocked]);

  // Initialize lockdown on submission
  useEffect(() => {
    if (isSubmitted && !lockdownStatus?.submissionLocked) {
      initiateLockdown();
    }
  }, [isSubmitted, lockdownStatus, initiateLockdown]);

  // Check for existing lockdown on mount
  useEffect(() => {
    fetchLockdownStatus();
    checkForExistingAttempts();
  }, [fetchLockdownStatus, checkForExistingAttempts]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if ((window as any).__examLockdownCleanup) {
        (window as any).__examLockdownCleanup();
      }
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center space-x-2 p-4">
        <Lock className="w-4 h-4 animate-pulse" />
        <span className="text-sm text-gray-600">Checking exam security status...</span>
      </div>
    );
  }

  // Show lockdown status if exam is submitted or locked
  if (isSubmitted || lockdownStatus?.submissionLocked) {
    return (
      <div className="space-y-4">
        {/* Main lockdown alert */}
        <Alert className="border-red-200 bg-red-50">
          <Lock className="h-4 w-4 text-red-600" />
          <AlertTitle className="text-red-800">Exam Secured & Locked</AlertTitle>
          <AlertDescription className="text-red-700">
            Your exam has been submitted and is now permanently locked. No further attempts or modifications are allowed.
          </AlertDescription>
        </Alert>

        {/* Lockdown details */}
        {showLockdownDetails && lockdownStatus && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-sm">
                <Lock className="w-4 h-4" />
                <span>Security Status</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <span className="text-sm font-medium">Submission</span>
                  <div className="flex items-center space-x-1">
                    {lockdownStatus.submissionLocked ? (
                      <>
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <Badge variant="default">Locked</Badge>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-4 h-4 text-red-600" />
                        <Badge variant="destructive">Unlocked</Badge>
                      </>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <span className="text-sm font-medium">Reattempt</span>
                  <div className="flex items-center space-x-1">
                    {lockdownStatus.reattemptBlocked ? (
                      <>
                        <XCircle className="w-4 h-4 text-red-600" />
                        <Badge variant="destructive">Blocked</Badge>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <Badge variant="default">Allowed</Badge>
                      </>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <span className="text-sm font-medium">Data</span>
                  <div className="flex items-center space-x-1">
                    {lockdownStatus.dataWiped ? (
                      <>
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <Badge variant="default">Cleared</Badge>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-4 h-4 text-yellow-600" />
                        <Badge variant="secondary">Retained</Badge>
                      </>
                    )}
                  </div>
                </div>
              </div>
              
              {lockdownStatus.lockTimestamp && (
                <div className="pt-2 border-t text-sm text-gray-600">
                  Locked on: {new Date(lockdownStatus.lockTimestamp).toLocaleString()}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Blocking in progress */}
        {blockingReattempt && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Securing Exam...</AlertTitle>
            <AlertDescription>
              Please wait while we secure your exam submission and block any further attempts.
            </AlertDescription>
          </Alert>
        )}

        {/* Instructions */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2 text-sm text-gray-700">
              <h4 className="font-medium">Post-Exam Security Measures:</h4>
              <ul className="space-y-1 text-xs list-disc list-inside ml-2">
                <li>Your exam answers have been securely submitted and cannot be modified</li>
                <li>No additional attempts are permitted for this exam</li>
                <li>Local exam data has been cleared from your device</li>
                <li>Navigation away from this page is restricted for security</li>
                <li>Your session will expire automatically in 10 minutes</li>
              </ul>
            </div>
            
            <div className="mt-4 pt-4 border-t">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => window.location.href = '/student/dashboard'}
                className="w-full"
              >
                Return to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show pre-submission security info
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2 text-sm">
          <Lock className="w-4 h-4" />
          <span>Post-Submission Security</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-600">
          After submitting your exam, additional security measures will be automatically applied to prevent any modifications or reattempts.
        </p>
      </CardContent>
    </Card>
  );
}

export default ExamLockdown;
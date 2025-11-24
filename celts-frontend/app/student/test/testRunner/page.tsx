"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { BookOpen, Headphones, Mic, Pen, Loader2, Clock, AlertCircle, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import api from "@/lib/api";

import { useTestProctoring } from "@/hooks/use-test-proctoring";
import { ViolationDialog } from "@/components/ViolationDialog";
import { ViolationWarningDialog } from "@/components/ViolationWarningDialog";

type TestType = "reading" | "listening" | "writing" | "speaking" | string;
type Option = { text: string };
type SpeakingMode = "audio" | "video" | "oral";

interface Question {
  _id?: string;
  questionType: "mcq" | "writing" | "speaking";
  prompt: string;
  options?: Option[];
  correctIndex?: number;
  writingType?: string;
  wordLimit?: number;
  charLimit?: number;
  speakingMode?: SpeakingMode;
  recordLimitSeconds?: number;
  marks?: number;
  explanation?: string;
  sectionId?: string | null;
}

interface ReadingSection {
  id: string;
  title?: string;
  passage: string;
}

interface ListeningSection {
  id: string;
  title?: string;
  audioUrl: string;
  listenLimit?: number;
}

interface TestSet {
  _id: string;
  title: string;
  description?: string;
  type: TestType;
  passage?: string;
  audioUrl?: string;
  listenLimit?: number;
  readingSections?: ReadingSection[];
  listeningSections?: ListeningSection[];
  timeLimitMinutes?: number;
  questions: Question[];
  createdAt?: string;
}

type SpeakingUIState = {
  recording?: boolean;
  blobUrl?: string;
  error?: string;
  liveStream?: MediaStream;
};

type EvalItem =
  | {
    kind: "writing";
    questionId?: string;
    prompt: string;
    writingType?: string;
    wordLimit?: number;
    marks: number;
    studentAnswer: string;
  }
  | {
    kind: "speaking";
    questionId?: string;
    prompt: string;
    speakingMode?: SpeakingMode;
    marks: number;
    audioUrl?: string;
  };

// Audio Player Component with play limit enforcement
function AudioPlayer({ audioUrl, playLimit, sectionId }: { audioUrl: string; playLimit: number; sectionId: string }) {
  const [playCount, setPlayCount] = useState(0);
  const [canPlay, setCanPlay] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handlePlay = () => {
      if (playCount >= playLimit) {
        audio.pause();
        audio.currentTime = 0;
        setCanPlay(false);
        toast.error("Play Limit Reached", {
          description: `You can only play this audio ${playLimit} time${playLimit > 1 ? 's' : ''}.`,
          duration: 3000,
        });
        return;
      }
      setPlayCount(prev => prev + 1);
    };

    const handleCanPlayThrough = () => {
      setIsLoading(false);
      setHasError(false);
    };

    const handleError = () => {
      setIsLoading(false);
      setHasError(true);
      console.error('Audio loading error for:', audioUrl);
    };

    const handleLoadStart = () => {
      setIsLoading(true);
      setHasError(false);
    };

    audio.addEventListener('play', handlePlay);
    audio.addEventListener('canplaythrough', handleCanPlayThrough);
    audio.addEventListener('error', handleError);
    audio.addEventListener('loadstart', handleLoadStart);
    
    return () => {
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('canplaythrough', handleCanPlayThrough);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('loadstart', handleLoadStart);
    };
  }, [playCount, playLimit, audioUrl]);

  return (
    <div>
      {isLoading && (
        <div className="flex items-center justify-center py-4">
          <div className="text-slate-600">Loading audio...</div>
        </div>
      )}
      {hasError && (
        <div className="flex items-center justify-center py-4">
          <div className="text-red-600">Failed to load audio. Please contact your instructor.</div>
        </div>
      )}
      <audio 
        ref={audioRef} 
        controls 
        src={audioUrl} 
        className="w-full"
        preload="metadata"
      />
      <div className="mt-3 flex items-center justify-between text-sm">
        <p className="text-slate-600">
          Played: {playCount} / {playLimit}
        </p>
        {!canPlay && (
          <p className="text-red-600 font-medium">Limit reached</p>
        )}
      </div>
    </div>
  );
}

export default function TestRunnerPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const testId = searchParams.get("testId");

  const [test, setTest] = useState<TestSet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const [startAttempting, setStartAttempting] = useState(false);
  const [attemptId, setAttemptId] = useState<string | null>(null);

  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [isTestCompromised, setIsTestCompromised] = useState(false);
  const [violationMessage, setViolationMessage] = useState<string | null>(null);
  const submitFunctionRef = useRef<((autoSubmit?: boolean) => Promise<void>) | null>(null);
  const [isSubmissionInProgress, setIsSubmissionInProgress] = useState(false);
  const [isAutoSubmitting, setIsAutoSubmitting] = useState(false);
  const [showSubmissionModal, setShowSubmissionModal] = useState(false);

  // Get session token safely on client side
  const [sessionToken, setSessionToken] = useState<string | undefined>(undefined);
  const [deviceSessionCreated, setDeviceSessionCreated] = useState(false);
  const [microphonePermission, setMicrophonePermission] = useState<'granted' | 'denied' | 'prompt' | null>(null);

  // Timer state
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [timerWarning, setTimerWarning] = useState(false);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Create device session when component mounts
  useEffect(() => {
    if (typeof window !== 'undefined' && testId && !deviceSessionCreated) {
      const createDeviceSession = async () => {
        try {
          console.log('Creating device session for test:', testId);

          // Check if user is authenticated first
          const authToken = localStorage.getItem('celts_token');
          console.log('Authentication token present:', !!authToken);

          if (!authToken) {
            console.error('No authentication token found');
            toast.error('Authentication Required', {
              description: 'Please log in again to start the exam.',
              duration: 5000,
            });
            return;
          }

          // Try to decode the token to check if it's valid (just basic check)
          try {
            const tokenParts = authToken.split('.');
            if (tokenParts.length === 3) {
              const payload = JSON.parse(atob(tokenParts[1]));
              const currentTime = Math.floor(Date.now() / 1000);
              console.log('Token expires at:', new Date(payload.exp * 1000));
              console.log('Current time:', new Date(currentTime * 1000));
              console.log('Token valid:', payload.exp > currentTime);

              if (payload.exp <= currentTime) {
                console.error('Token has expired');
                toast.error('Session Expired', {
                  description: 'Your session has expired. Please log in again.',
                  duration: 5000,
                });
                return;
              }
            }
          } catch (tokenError) {
            console.error('Error parsing token:', tokenError);
          }

          // Test authentication by making a simple API call first
          console.log('Testing authentication...');
          const authTestResponse = await api.apiGet('/student/tests');
          console.log('Auth test response:', authTestResponse);

          if (!authTestResponse.ok) {
            console.error('Authentication test failed:', authTestResponse);

            if (authTestResponse.status === 401) {
              localStorage.removeItem('celts_token');
              toast.error('Authentication Failed', {
                description: 'Your session has expired. Please log in again.',
                duration: 5000,
              });
              setTimeout(() => {
                window.location.href = '/auth/login';
              }, 2000);
            } else {
              toast.error('Connection Error', {
                description: 'Unable to verify authentication. Please check your connection.',
                duration: 5000,
              });
            }
            return;
          }

          console.log('Authentication verified, proceeding with device session creation...');

          const response = await api.apiPost('/security/session/start', {
            testId: testId,
            platform: navigator.platform,
            language: navigator.language,
            cookieEnabled: navigator.cookieEnabled,
            onlineStatus: navigator.onLine,
            screenResolution: `${screen.width}x${screen.height}`,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            browserFeatures: {
              webSecurity: true,
              devToolsDisabled: false, // Will be monitored
              printingDisabled: true,
              downloadDisabled: true,
              copyPasteDisabled: true,
              rightClickDisabled: true
            }
          });

          console.log('Device session response:', response);

          if (response.ok && response.data?.sessionToken) {
            console.log('Device session created successfully');
            setSessionToken(response.data.sessionToken);
            setDeviceSessionCreated(true);
          } else {
            console.error('Failed to create device session:');
            console.error('Response status:', response.status);
            console.error('Response error:', response.error);
            console.error('Response data:', response.data);

            // Handle specific error cases
            let errorMessage = 'Unknown error';
            let shouldRedirectToLogin = false;

            if (response.status === 401) {
              shouldRedirectToLogin = true;
              errorMessage = response.error?.message || response.data?.message || 'Authentication failed';
            } else if (response.status === 404) {
              errorMessage = 'Test not found';
            } else if (response.status === 429) {
              errorMessage = 'Too many requests, please wait and try again';
            } else {
              errorMessage = response.error?.message || response.data?.message || `Server error (${response.status})`;
            }

            const statusCode = response.status || 'unknown';

            if (shouldRedirectToLogin) {
              toast.error('Authentication Failed', {
                description: `${errorMessage}. Redirecting to login...`,
                duration: 5000,
              });

              // Clear stored token and redirect after a delay
              localStorage.removeItem('celts_token');
              setTimeout(() => {
                window.location.href = '/auth/login';
              }, 2000);
            } else {
              toast.error('Session Creation Failed', {
                description: `Unable to create exam session (${statusCode}): ${errorMessage}. Please refresh and try again.`,
                duration: 7000,
              });
            }
          }
        } catch (error) {
          console.error('Device session creation error:', error);
          toast.error('Connection Error', {
            description: 'Unable to establish exam session. Please check your connection and try again.',
            duration: 5000,
          });
        }
      };

      createDeviceSession();
    }
  }, [testId, deviceSessionCreated]);

  const redirectToCompletion = useCallback(async (reason: string) => {
    if (hasSubmittedRef.current) return;
    hasSubmittedRef.current = true;

    if (!testId) {
      console.error('Cannot redirect to completion: testId is missing');
      router.push('/student/dashboard');
      return;
    }



    // Log violation if we have an attempt ID
    if (attemptId) {
      try {
        await api.apiPost(`/student/tests/${testId}/violation`, {
          type: reason,
          details: `Student ${reason} during test`,
        });
      } catch (err) {
        console.error('Failed to log violation:', err);
      }

      // End the attempt with violation data
      try {
        await api.apiPost(`/student/tests/${testId}/end`, {
          reason,
          submissionId: null,
          violations: proctoring.violations || [],
        });
      } catch (err) {
        console.error('Failed to end attempt:', err);
      }
    }

    // Exit fullscreen
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => { });
    }

    // Redirect to completion page
    const params = new URLSearchParams({
      testTitle: test?.title || "Test",
      testType: test?.type || "test",
      autoSubmit: "true",
      reason: reason,
    });
    router.push(`/student/test/complete?${params.toString()}`);
  }, [attemptId, testId, test?.title, test?.type, router]);

  const hasSubmittedRef = useRef(false);
  const autoSubmitCalledRef = useRef(false);

  const handleAutoSubmit = async () => {
    if (hasSubmittedRef.current) return;

    console.log('Auto-submit triggered - setting submission states');
    setIsAutoSubmitting(true);
    setIsSubmissionInProgress(true);
    setIsTestCompromised(true);
    setViolationMessage('Security violation detected. Test being auto-submitted.');
    hasSubmittedRef.current = true;


    // Force submit the test
    if (submitFunctionRef.current) {
      await submitFunctionRef.current(true);
    } else {
      await redirectToCompletion('violation');
    }
  };

  const handleViolationDetected = (violationType: string, details: string) => {
    // Skip violations during submission process
    if (submitting || isSubmissionInProgress || isAutoSubmitting) {
      console.log(`Skipping violation ${violationType} during submission:`, details);
      return;
    }

    console.warn(`Security violation: ${violationType} - ${details}`);

    // Immediately compromise test for critical violations
    const criticalViolations = ['multiple_monitors', 'tab_switch', 'window_blur', 'fullscreen_exit'];
    if (criticalViolations.includes(violationType)) {
      setIsTestCompromised(true);
      setViolationMessage(`Critical violation: ${details}`);

      // Show immediate warning
      toast.error('Test Compromised', {
        description: `Security violation detected: ${details}`,
        duration: 6000,
      });
    }
  };

  const handleCriticalViolation = (violationType: string, details: string) => {
    // Skip violations during submission process  
    if (submitting || isSubmissionInProgress || isAutoSubmitting) {
      console.log(`Skipping critical violation ${violationType} during submission:`, details);
      return;
    }

    console.error(`Critical security violation: ${violationType} - ${details}`);

    setIsTestCompromised(true);
    setViolationMessage(`Critical violation: ${details}`);

    if (!isAutoSubmitting && !isSubmissionInProgress) {
      toast.error('🚨 Critical Security Violation', {
        description: `${details}. Your test is being auto-submitted immediately.`,
        duration: 8000,
      });

      // Trigger auto-submit
      setTimeout(() => {
        handleAutoSubmit();
      }, 100);
    }
  };


  const proctoring = useTestProctoring({
    testId: testId || undefined,
    enabled: !!testId && !!test && hasStarted && deviceSessionCreated && !submitting && !isSubmissionInProgress && !isAutoSubmitting,
    autoSubmitOnViolation: true,
    warningsBeforeAutoSubmit: 2,
    sessionToken,
    attemptId: attemptId || undefined,
    isSubmissionInProgress,
    onAutoSubmit: handleAutoSubmit,
    onViolation: handleViolationDetected,
    onCriticalViolation: handleCriticalViolation,
    enableDeviceRestrictions: true,
    enableNetworkMonitoring: true,
  });

  // Timer management within proctoring
  useEffect(() => {
    if (test?.timeLimitMinutes && hasStarted && !isAutoSubmitting) {
      const warningThresholds = [5, 10, 15, 30];
      const totalMinutes = test.timeLimitMinutes;

      warningThresholds.forEach(threshold => {
        if (timeRemaining && timeRemaining > 0) {
          const minutesLeft = Math.floor(timeRemaining / 60);
          if (minutesLeft === threshold && minutesLeft > 0) {
            toast.warning(`⏰ ${minutesLeft} minute${minutesLeft === 1 ? '' : 's'} remaining!`, {
              description: 'Please review your answers and prepare to submit.',
              duration: 5000,
            });
          }
        }
      });
    }
  }, [timeRemaining, test?.timeLimitMinutes, hasStarted, isAutoSubmitting]);

  const [speakingState, setSpeakingState] = useState<Record<string, SpeakingUIState>>({});
  const speakingBlobsRef = useRef<Record<string, Blob>>({});
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaChunksRef = useRef<Blob[]>([]);

  const liveVideoRef = useRef<HTMLVideoElement | null>(null);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [flatQuestions, setFlatQuestions] = useState<{ q: Question; idx: number }[]>([]);

  // Store submit function in ref for proctoring
  useEffect(() => {
    submitFunctionRef.current = handleSubmit;
  });

  useEffect(() => {
    if (testId) {
      console.log('Fetching test with ID:', testId);
      fetchTest(testId);
    }
  }, [testId]); // Only depend on testId

  useEffect(() => {
    // Prevent navigation away without confirmation
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (test && !submitting) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    // cleanup on unmount
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);

      stopAnyRecording();
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
      }
      // Exit fullscreen on unmount
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => { });
      }
      // Clear timer
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      // Clear background submission timeout
      if (backgroundSubmissionTimeoutRef.current) {
        clearTimeout(backgroundSubmissionTimeoutRef.current);
        backgroundSubmissionTimeoutRef.current = null;
      }
    };
  }, []); // Only run once on mount

  // Timer effect
  useEffect(() => {
    if (test && test.timeLimitMinutes && test.timeLimitMinutes > 0 && hasStarted) {
      // Initialize timer
      const totalSeconds = test.timeLimitMinutes * 60;
      setTimeRemaining(totalSeconds);

      // Start countdown
      timerIntervalRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev === null || prev <= 0) {
            if (timerIntervalRef.current) {
              clearInterval(timerIntervalRef.current);
              timerIntervalRef.current = null;
            }
            // Auto-submit when time runs out (only if not already submitting)
            if (!submitting && !autoSubmitCalledRef.current && submitFunctionRef.current) {
              autoSubmitCalledRef.current = true;
              setTimeout(() => submitFunctionRef.current!(true), 100);
            }
            return 0;
          }

          // Show warning when 5 minutes remaining
          if (prev <= 300 && !timerWarning) {
            setTimerWarning(true);
            toast.warning("⏰ 5 Minutes Remaining", {
              description: "Please finish up your test soon.",
              duration: 5000,
            });
          }

          // Show warning when 1 minute remaining
          if (prev === 60) {
            toast.error("⏰ 1 Minute Remaining!", {
              description: "Test will auto-submit when time expires.",
              duration: 10000,
            });
          }

          return prev - 1;
        });
      }, 1000);

      return () => {
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
        }
      };
    }
  }, [test, hasStarted, submitting]);

  // Format time display
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    if (test) {
      const flat: { q: Question; idx: number }[] = test.questions.map((q, idx) => ({ q, idx }));
      setFlatQuestions(flat);
      setCurrentIndex(0);
    } else {
      setFlatQuestions([]);
      setCurrentIndex(0);
    }
  }, [test]);

  const handleStartTest = async () => {
    console.log("Starting test...");
    setStartAttempting(true);

    // Request microphone permission before starting test
    try {
      console.log("Requesting microphone permission...");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicrophonePermission('granted');
      // Stop the stream immediately as we just needed permission
      stream.getTracks().forEach(track => track.stop());
      toast.success('Microphone Access Granted', {
        description: 'Speaking questions will work properly during the test.',
        duration: 3000,
      });
      console.log("Microphone permission granted");
    } catch (micError) {
      console.warn("Microphone permission denied:", micError);
      setMicrophonePermission('denied');
      toast.warning('Microphone Access Denied', {
        description: 'You can still take the test, but speaking questions may not work properly.',
        duration: 5000,
      });
    }

    try {
      // Start test attempt in backend
      const startRes = await api.apiPost(`/student/tests/${testId}/start`, {});
      if (!startRes.ok) {
        const errorMessage = startRes.error?.message || "Failed to start test attempt";

        // Handle specific error cases
        if (errorMessage.includes("already in progress")) {
          // Try to recover the existing attempt
          if (startRes.data?.existingAttempt) {
            const existingAttemptId = startRes.data.existingAttempt.attemptId;
            setAttemptId(existingAttemptId);
            setHasStarted(true); toast.success("Resumed Test", {
              description: "Continuing your existing test session.",
              duration: 3000,
            });
            return;
          }

          // If no existing attempt data, try cleanup
          toast.info("Cleaning up session...", {
            description: "Attempting to resolve session conflict.",
            duration: 2000,
          });

          try {
            await api.apiPost(`/student/tests/${testId}/cleanup`, {});
            // Retry starting the test after cleanup
            setTimeout(() => {
              handleStartTest();
            }, 1000);
          } catch (cleanupError) {
            toast.error("Session Conflict", {
              description: "Unable to start test. Please refresh the page.",
              duration: 5000,
            });
            setTimeout(() => {
              window.location.reload();
            }, 2000);
          }
          return;
        } else if (errorMessage.includes("already attempted")) {
          toast.error("Test Completed", {
            description: "You have already completed this test. Contact admin if you need to retake it.",
            duration: 5000,
          });
          // Redirect to dashboard
          setTimeout(() => {
            router.push('/student/dashboard');
          }, 2000);
          return;
        }

        toast.error("Cannot start test", {
          description: errorMessage,
        });
        return;
      }

      setAttemptId(startRes.data.attemptId);
      console.log("Test attempt started:", startRes.data);

      // Also start the exam security session if we have a device session
      if (sessionToken) {
        try {
          const examStartRes = await api.apiPost('/security/exam/start', {
            testId: testId,
            sessionToken: sessionToken,
            deviceFingerprint: `${navigator.platform}-${navigator.userAgent}`,
            clientStartTime: new Date().toISOString()
          });

          if (examStartRes.ok) {
            console.log('Exam security session started successfully');
          } else {
            console.warn('Failed to start exam security session:', examStartRes.error);
          }
        } catch (examStartError) {
          console.warn('Exam security session start error:', examStartError);
        }
      }

      // Now try to enter fullscreen
      if (document.documentElement.requestFullscreen) {
        console.log("Requesting fullscreen...");
        await document.documentElement.requestFullscreen();
        console.log("Fullscreen granted, starting test");
        setHasStarted(true);
      } else {
        console.log("Fullscreen not supported, starting anyway");
        toast.warning("Fullscreen not supported", {
          description: "Starting test without fullscreen mode.",
          duration: 3000,
        });
        setHasStarted(true);

      }
    } catch (err) {
      console.error("Fullscreen failed:", err);
      toast.warning("Fullscreen was denied", {
        description: "Starting test without fullscreen mode. Note: This may affect proctoring.",
        duration: 5000,
      });
      setHasStarted(true);
    } finally {
      setStartAttempting(false);
    }
  };

  const fullscreenExitCountRef = useRef(0);

  const backgroundSubmissionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!test || loading || !hasStarted) return;

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && !submitting && hasStarted && !isSubmissionInProgress && !isAutoSubmitting) {
        fullscreenExitCountRef.current += 1;

        console.log(`Fullscreen exited - Auto-submitting test (${fullscreenExitCountRef.current} violations)`);

        proctoring.logViolation?.('fullscreen_exit', `Fullscreen exited ${fullscreenExitCountRef.current} times`);

        setTimeout(() => {
          if (submitFunctionRef.current) {
            submitFunctionRef.current(true);
          }
        }, 100);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [hasStarted, submitting, isSubmissionInProgress, isAutoSubmitting, proctoring]);

  async function fetchTest(id: string) {
    console.log('fetchTest called with id:', id);
    setLoading(true);
    setError(null);
    try {
      console.log('Making API call to fetch test');
      const res = await api.apiGet(`/student/tests/${id}`);
      console.log('API response:', res);
      if (!res.ok) {
        console.error('API error:', res.error);
        setError(res.error?.message || "Failed to load test");
        setLoading(false);
        return;
      }
      const testData = res.data;
      console.log('Test data received:', testData);

      // Check if student can attempt this test
      if (!testData.canAttempt && testData.attemptInfo) {
        // Handle completed test with proper UI
        const message = testData.attemptInfo.message;
        if (message.includes('already completed') || message.includes('already attempted') || testData.attemptInfo.status === 'completed') {
          setError('Test Already Completed: You have already completed this test. Contact admin if you need to retake it.');
        } else {
          setError(message);
        }
        setLoading(false);
        return;
      }

      const t: TestSet = testData;
      console.log('Test data received:', t);

      t.questions = t.questions.map((q) =>
        q.questionType === "mcq"
          ? {
            ...q,
            options: Array.isArray(q.options) && q.options.length ? q.options : [{ text: "" }, { text: "" }],
            correctIndex: typeof q.correctIndex === "number" ? q.correctIndex : 0,
            sectionId: typeof q.sectionId === "string" ? q.sectionId : q.sectionId ?? null,
          }
          : {
            ...q,
            sectionId: typeof q.sectionId === "string" ? q.sectionId : q.sectionId ?? null,
          }
      );

      setTest(t);
      setAnswers({});
      setSpeakingState({});
      speakingBlobsRef.current = {};
      setSubmitMessage(null);
      console.log('Test state set successfully');
    } catch (err: any) {
      console.error('fetchTest error:', err);
      setError(err?.message || "Network error");
    } finally {
      console.log('Setting loading to false');
      setLoading(false);
    }
  }

  const qKey = (q: Question, index: number) => q._id || String(index);

  async function startRecording(key: string, mode: SpeakingMode, recordLimit?: number) {
    try {
      stopAnyRecording();

      // Check if microphone permission was already granted
      if (microphonePermission === 'denied') {
        toast.error('Microphone Access Required', {
          description: 'Please allow microphone access and refresh the page to record speaking responses.',
          duration: 5000,
        });
        return;
      }

      const constraints =
        mode === "video"
          ? { video: { width: 1280, height: 720, facingMode: "user" }, audio: true }
          : { audio: true };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      mediaStreamRef.current = stream;

      // Auto-stop recording after time limit
      if (recordLimit && recordLimit > 0) {
        setTimeout(() => {
          if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
            stopRecording();
            toast.info("Recording Time Limit Reached", {
              description: `Maximum recording time of ${recordLimit} seconds reached.`,
              duration: 3000,
            });
          }
        }, recordLimit * 1000);
      }

      // WAIT until video element is fully mounted
      setSpeakingState((prev) => ({
        ...prev,
        [key]: { ...(prev[key] || {}), recording: true, liveStream: stream },
      }));

      setTimeout(() => {
        const video = liveVideoRef.current;
        if (video) {
          video.muted = true;
          video.playsInline = true;
          video.autoplay = true;

          try {
            video.srcObject = stream;
          } catch {
            (video as any).srcObject = stream;
          }

          video.onloadedmetadata = () => {
            video.play().catch(() => { });
          };
        }
      }, 150); // <<< KEY FIX (delay allows DOM to mount)

      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      mediaChunksRef.current = [];

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) mediaChunksRef.current.push(e.data);
      };

      mr.onstop = () => {
        const blob = new Blob(mediaChunksRef.current, {
          type: mode === "video" ? "video/webm" : "audio/webm",
        });

        const url = URL.createObjectURL(blob);
        speakingBlobsRef.current[key] = blob;

        setSpeakingState((prev) => ({
          ...prev,
          [key]: { recording: false, blobUrl: url },
        }));

        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((t) => t.stop());
          mediaStreamRef.current = null;
        }

        if (liveVideoRef.current) {
          try {
            liveVideoRef.current.srcObject = null;
            liveVideoRef.current.pause();
          } catch { }
        }
      };

      mr.start();
    } catch (err: any) {
      setSpeakingState((prev) => ({
        ...prev,
        [key]: { recording: false, error: err.message },
      }));
    }
  }



  function stopRecording() {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== "inactive") {
      mr.stop();
    } else {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
      }
    }
  }

  function stopAnyRecording() {
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
    } catch {
      //
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (liveVideoRef.current) {
      try {
        liveVideoRef.current.srcObject = null;
      } catch { }
    }
    mediaChunksRef.current = [];
    mediaRecorderRef.current = null;
  }

  function toggleMcqSelection(key: string, optionIndex: number) {
    setAnswers((prev) => {
      const current = prev?.[key]?.selectedIndex;
      const next = current === optionIndex ? null : optionIndex;
      return { ...prev, [key]: { ...prev[key], selectedIndex: next } };
    });
  }

  function getReadingSections(test: TestSet): ReadingSection[] {
    if (Array.isArray(test.readingSections) && test.readingSections.length > 0) {
      return test.readingSections;
    }
    if (test.passage) {
      return [{ id: "_legacy_reading_", title: "Passage 1", passage: test.passage }];
    }
    return [];
  }

  function getListeningSections(test: TestSet): ListeningSection[] {
    if (Array.isArray(test.listeningSections) && test.listeningSections.length > 0) {
      return test.listeningSections;
    }
    if (test.audioUrl) {
      return [{ id: "_legacy_listening_", title: "Audio 1", audioUrl: test.audioUrl, listenLimit: test.listenLimit ?? 1 }];
    }
    return [];
  }

  function findSectionForQuestion(q: Question) {
    if (!test) return {};
    if (test.type === "reading") {
      const secs = getReadingSections(test);
      if (q.sectionId) {
        const s = secs.find((x) => x.id === q.sectionId);
        if (s) return { passage: s };
      }
      if (secs.length === 1) return { passage: secs[0] };
      return { passage: secs[0] || undefined };
    }
    if (test.type === "listening") {
      const secs = getListeningSections(test);
      if (q.sectionId) {
        const s = secs.find((x) => x.id === q.sectionId);
        if (s) return { audio: s };
      }
      if (secs.length === 1) return { audio: secs[0] };
      return { audio: secs[0] || undefined };
    }
    return {};
  }

  function renderLeftForCurrent(q: Question) {
    if (!test) return null;
    if (test.type === "reading") {
      const sec = findSectionForQuestion(q).passage;
      if (sec) {
        return (
          <div className="h-full flex flex-col">
            <div className="mb-3">
              <h3 className="text-base font-semibold text-indigo-700">Passage</h3>
              <div className="text-sm text-slate-500 mt-1">{sec.title || "Passage"}</div>
            </div>
            <div className="flex-1 overflow-auto p-6 bg-indigo-50 rounded-md text-lg text-slate-800 leading-relaxed whitespace-pre-wrap">
              {sec.passage}
            </div>
          </div>
        );
      }
      return null;
    }
    if (test.type === "listening") {
      const sec = findSectionForQuestion(q).audio;
      if (sec) {
        return (
          <div className="h-full flex flex-col">
            <div className="mb-3">
              <h3 className="text-base font-semibold text-indigo-700">Audio</h3>
              <div className="text-sm text-slate-500 mt-1">{sec.title || "Audio"}</div>
            </div>
            <div className="flex-1 p-6 bg-indigo-50 rounded-md">
              {sec.audioUrl ? (
                <AudioPlayer
                  audioUrl={sec.audioUrl}
                  playLimit={sec.listenLimit ?? 1}
                  sectionId={sec.id}
                />
              ) : (
                <div className="text-lg text-slate-600">No audio configured.</div>
              )}
            </div>
          </div>
        );
      }
      return null;
    }
    if (test.type === "writing" || test.type === "speaking") {
      return (
        <div className="h-full flex flex-col">
          <div className="mb-3">
            <h3 className="text-base font-semibold text-indigo-700">Prompt</h3>
          </div>
          <div className="flex-1 p-6 bg-indigo-50 rounded-md text-lg text-slate-800 leading-relaxed whitespace-pre-wrap">{q.prompt}</div>
        </div>
      );
    }
    return null;
  }

  function renderRightForCurrent(q: Question, index: number) {
    const key = qKey(q, index);
    const ans = answers[key];
    const speaking = speakingState[key];

    if (q.questionType === "mcq") {
      return (
        <div>
          <div className="mb-5">
            <h3 className="text-lg font-semibold text-slate-800">Question</h3>
            <p className="text-lg text-slate-700 mt-2">{q.prompt}</p>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {q.options?.map((opt, i) => {
              const selected = ans?.selectedIndex === i;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleMcqSelection(key, i)}
                  className={`w-full flex items-center gap-4 p-4 rounded-full transition-shadow text-left text-base leading-snug
                    ${selected ? "bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-lg" : "bg-white border border-slate-200 text-slate-800 hover:shadow-sm"}
                  `}
                >
                  <div className={`w-4 h-4 rounded-full flex-shrink-0 ${selected ? "bg-white/95" : "bg-slate-300"}`}></div>
                  <span>{opt.text}</span>
                </button>
              );
            })}
          </div>

          <div className="text-sm text-slate-500 mt-3">Click again to deselect an option.</div>
        </div>
      );
    }

    if (q.questionType === "writing") {
      const text = ans?.text || "";
      const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
      const charCount = text.length;
      const hasWordLimit = typeof q.wordLimit === 'number' && q.wordLimit > 0;
      const hasCharLimit = typeof q.charLimit === 'number' && q.charLimit > 0;

      const wordLimitExceeded = hasWordLimit && wordCount > q.wordLimit!;
      const charLimitExceeded = hasCharLimit && charCount > q.charLimit!;

      return (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-800">Write your answer</h3>
            <div className="text-sm space-y-1">
              {hasWordLimit && (
                <div className={`${wordLimitExceeded ? 'text-red-600 font-semibold' : 'text-slate-600'}`}>
                  Words: {wordCount} / {q.wordLimit}
                </div>
              )}
              {hasCharLimit && (
                <div className={`${charLimitExceeded ? 'text-red-600 font-semibold' : 'text-slate-600'}`}>
                  Characters: {charCount} / {q.charLimit}
                </div>
              )}
              {!hasWordLimit && !hasCharLimit && (
                <div className="text-slate-600">Words: {wordCount}</div>
              )}
            </div>
          </div>
          <textarea
            className={`w-full min-h-[420px] border-2 rounded-md p-5 text-lg leading-relaxed resize-vertical transition-colors ${wordLimitExceeded || charLimitExceeded
              ? 'border-red-400 focus:border-red-500'
              : 'border-slate-200 focus:border-indigo-400'
              }`}
            placeholder="Type your response here..."
            value={text}
            onChange={(e) => setAnswers((p) => ({ ...p, [key]: { text: e.target.value } }))}
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
            autoComplete="off"
            data-gramm="false"
            data-enable-grammarly="false"
            data-gramm_editor="false"
            style={{ imeMode: 'disabled' }}
          />
          {(wordLimitExceeded || charLimitExceeded) && (
            <p className="text-sm text-red-600 mt-2">
              ⚠️ You have exceeded the limit. Please reduce your answer.
            </p>
          )}
        </div>
      );
    }

    if (q.questionType === "speaking") {
      return (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-800">Record your response</h3>
              <p className="text-sm text-slate-500 mt-1">Mode: {q.speakingMode || "audio"}</p>
            </div>
            <div className="text-sm text-slate-600">Time: {q.recordLimitSeconds ?? "-"}s</div>
          </div>

          <div className="mb-4">
            <div className="flex items-center gap-3">
              {!speaking?.recording ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => startRecording(key, q.speakingMode === "video" ? "video" : "audio", q.recordLimitSeconds)}
                  className="rounded-md bg-indigo-600 text-white px-4 py-2"
                >
                  {speaking?.blobUrl ? "Re-record" : "Start Recording"}
                </Button>
              ) : (
                <Button type="button" size="sm" variant="destructive" onClick={stopRecording} className="px-4 py-2">
                  Stop
                </Button>
              )}

              <div className="text-sm text-slate-600">
                {speaking?.recording ? "Recording..." : speaking?.blobUrl ? "Recorded — preview below" : "No recording yet"}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {speaking?.recording && q.speakingMode === "video" && (
              <div className="bg-black rounded-xl overflow-hidden border border-slate-300 mt-4">
                <video
                  ref={liveVideoRef}
                  className="w-full h-[520px] object-cover rounded-xl"
                  playsInline
                  muted
                  autoPlay
                />
              </div>
            )}

            {!speaking?.recording && speaking?.blobUrl && q.speakingMode === "video" && (
              <div className="bg-black rounded-md overflow-hidden">
                <video src={speaking.blobUrl} controls className="w-full h-64 object-contain" />
              </div>
            )}

            {!speaking?.recording && speaking?.blobUrl && q.speakingMode !== "video" && (
              <audio src={speaking.blobUrl} controls className="w-full" />
            )}

            {speaking?.error && <p className="text-sm text-red-600 mt-2">{speaking.error}</p>}
          </div>
        </div>
      );
    }

    return null;
  }

  function buildEvaluationPayload(): EvalItem[] {
    if (!test) return [];
    const items: EvalItem[] = [];

    test.questions.forEach((q, idx) => {
      const key = qKey(q, idx);
      const ans = answers[key];

      if (q.questionType === "writing") {
        const textAns = ans?.text || "";
        items.push({
          kind: "writing",
          questionId: q._id ? String(q._id) : undefined,
          prompt: q.prompt,
          writingType: q.writingType,
          wordLimit: q.wordLimit,
          marks: q.marks || 0,
          studentAnswer: textAns,
        });
      }

      if (q.questionType === "speaking") {
        items.push({
          kind: "speaking",
          questionId: q._id ? String(q._id) : undefined,
          prompt: q.prompt,
          speakingMode: q.speakingMode,
          marks: q.marks || 0,
          audioUrl: undefined,
        });
      }
    });

    return items;
  }

  async function handleSubmit(autoSubmit: boolean = false): Promise<void> {
    if (!test) {
      console.error('No test loaded');
      return;
    }

    if (submitting) {
      console.warn('Submission already in progress');
      return;
    }

    if (!autoSubmit && isTestCompromised) {
      toast.error('Submission Blocked', {
        description: 'Test has been compromised due to security violations. Manual submission is disabled.',
        duration: 5000,
      });
      return;
    }

    // Immediately disable proctoring when submission process starts
    setIsSubmissionInProgress(true);

    if (proctoring.dismissCriticalViolation) {
      proctoring.dismissCriticalViolation();
    }

    if (!autoSubmit) {
      if (!showSubmissionModal) {
        setShowSubmissionModal(true);
        // Note: isSubmissionInProgress stays true to disable monitoring during modal
        return;
      }
    }

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    setSubmitting(true);
    setSubmitMessage(autoSubmit ? "Auto-submitting test..." : "Submitting your test...");

    try {
      const skill = typeof test.type === "string" ? test.type : "reading";
      const evaluationPayload = buildEvaluationPayload();

      const hasAnswers = Object.keys(answers).length > 0;
      if (!hasAnswers && !autoSubmit) {
        console.log('Submitting test without answers - this is allowed');
      }

      if (skill === "speaking") {
        const speakingQuestions = test.questions.map((q, idx) => ({ q, idx })).filter((x) => x.q.questionType === "speaking");

        let speakingBlob: Blob | undefined;
        if (speakingQuestions.length > 0) {
          const main = speakingQuestions[0];
          const key = qKey(main.q, main.idx);
          speakingBlob = speakingBlobsRef.current[key];
        }

        if (!speakingBlob && !autoSubmit) {

          console.log('Submitting speaking test without recording - user confirmed');
        }

        setSubmitMessage("Test submitted! Redirecting...");

        if (document.fullscreenElement) {
          await document.exitFullscreen().catch(() => { });
        }

        const params = new URLSearchParams({
          testTitle: test.title,
          testType: skill,
          autoSubmit: autoSubmit ? "true" : "false",
          submissionId: "processing",
        });
        router.push(`/student/test/complete?${params.toString()}`);

        backgroundSubmissionTimeoutRef.current = setTimeout(async () => {
          try {
            const form = new FormData();
            if (speakingBlob) {
              form.append("media", speakingBlob, "speaking.webm");
            }
            form.append("response", JSON.stringify(answers));
            form.append("evaluationPayload", JSON.stringify(evaluationPayload));

            const API = process.env.NEXT_PUBLIC_API_URL;
            const token = localStorage.getItem("celts_token");

            await fetch(`${API}/student/submit/${test._id}/${skill}`, {
              method: "POST",
              headers: token ? { Authorization: `Bearer ${token}` } : {},
              body: form,
            });

            // Mark test attempt as completed
            await fetch(`${API}/student/tests/${test._id}/end`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
              body: JSON.stringify({
                reason: autoSubmit ? "time_expired" : "completed",
                submissionId: null,
                violations: [],
              }),
            });

            console.log('Background submission completed for speaking test');
          } catch (error) {
            console.error('Background submission failed:', error);
          } finally {
            backgroundSubmissionTimeoutRef.current = null;
          }
        }, 100);

        return;
      }


      setSubmitMessage("Test submitted! Redirecting...");

      if (document.fullscreenElement) {
        await document.exitFullscreen().catch(() => { });
      }

      const params = new URLSearchParams({
        testTitle: test.title,
        testType: skill,
        autoSubmit: autoSubmit ? "true" : "false",
        submissionId: "processing",
      });
      router.push(`/student/test/complete?${params.toString()}`);

      backgroundSubmissionTimeoutRef.current = setTimeout(async () => {
        try {
          await api.apiPost(`/student/submit/${test._id}/${skill}`, {
            response: answers,
            evaluationPayload,
          });

          // Mark test attempt as completed
          await api.apiPost(`/student/tests/${test._id}/end`, {
            reason: autoSubmit ? "time_expired" : "completed",
            submissionId: null,
            violations: [],
          });

          console.log('Background submission completed for', skill, 'test');
        } catch (error) {
          console.error('Background submission failed:', error);
          // Silent failure - user is already on completion page
        } finally {
          backgroundSubmissionTimeoutRef.current = null;
        }
      }, 100);
    } catch (err: any) {
      console.error('Submission error:', err);
      // Even on error, redirect immediately for better UX
      if (document.fullscreenElement) {
        await document.exitFullscreen().catch(() => { });
      }

      const params = new URLSearchParams({
        testTitle: test?.title || "Test",
        testType: test?.type || "test",
        autoSubmit: autoSubmit ? "true" : "false",
        submissionId: autoSubmit ? "auto-error" : "error",
      });
      router.push(`/student/test/complete?${params.toString()}`);
    } finally {
      setSubmitting(false);
      setIsSubmissionInProgress(false);
      setIsAutoSubmitting(false);
    }
  }

  const goNext = useCallback(() => {
    stopAnyRecording();
    if (currentIndex < flatQuestions.length - 1) {
      setCurrentIndex((i) => i + 1);
      window.scrollTo({ top: 0 });
    }
  }, [currentIndex, flatQuestions.length]);

  const goPrev = useCallback(() => {
    stopAnyRecording();
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
      window.scrollTo({ top: 0 });
    }
  }, [currentIndex]);

  if (process.env.NODE_ENV === 'development') {
    console.log('Render state:', { testId, loading, error: !!error, hasTest: !!test, hasStarted });
  }

  if (!testId) {
    return (
      <div className="w-screen min-h-screen bg-gradient-to-b from-indigo-50 via-violet-50 to-white flex items-center justify-center p-8">
        <div className="max-w-[1200px] w-full bg-white rounded-xl shadow-md border p-8 text-center">
          <div className="text-red-600 text-lg">No testId provided in URL.</div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="w-screen min-h-screen bg-gradient-to-b from-indigo-50 via-violet-50 to-white flex items-center justify-center p-8">
        <Card className="max-w-md w-full p-8 text-center space-y-6 shadow-lg">
          <Loader2 className="w-12 h-12 animate-spin text-indigo-600 mx-auto" />
          <p className="text-slate-600">Loading test...</p>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-screen min-h-screen bg-gradient-to-b from-indigo-50 via-violet-50 to-white flex items-center justify-center p-8">
        <Card className="max-w-md w-full p-8 text-center space-y-6 shadow-lg">
          <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <div className="text-red-600 text-lg font-semibold">
            {error.includes('Test Already Completed') ? 'Test Already Completed' :
              error.includes('already attempted') || error.includes('already completed') ? 'Test Already Completed' :
                'Error Loading Test'}
          </div>
          <p className="text-slate-600">{error}</p>
          {(error.includes('Test Already Completed') || error.includes('already attempted') || error.includes('already completed')) ? (
            <div className="space-y-3">
              <Button onClick={() => router.push('/student/test')} className="w-full bg-indigo-600 hover:bg-indigo-700">
                View Other Tests
              </Button>
              <Button variant="outline" onClick={() => router.push('/student/dashboard')} className="w-full">
                Back to Dashboard
              </Button>
            </div>
          ) : (
            <Button onClick={() => router.push('/student/test')} className="w-full">
              Back to Tests
            </Button>
          )}
        </Card>
      </div>
    );
  }

  if (!hasStarted && test) {
    console.log('Test loaded, showing start screen');
    return (
      <div className="w-screen min-h-screen bg-gradient-to-b from-indigo-50 via-violet-50 to-white flex items-center justify-center p-8">
        <Card className="max-w-md w-full p-8 text-center space-y-6 shadow-lg">
          <div className="mx-auto w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mb-4">
            <BookOpen className="w-8 h-8 text-indigo-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Ready to start?</h1>
          <div className="space-y-2 text-slate-600">
            <p>The test <strong>{test.title}</strong> is about to begin.</p>
            <p className="text-sm bg-amber-50 text-amber-800 p-3 rounded-md border border-amber-200">
              ⚠️ This test will run in full-screen mode. Exiting full-screen or switching tabs will be recorded as a violation.
            </p>
            {microphonePermission && (
              <div className={`text-sm p-3 rounded-md border ${microphonePermission === 'granted'
                ? 'bg-green-50 text-green-800 border-green-200'
                : 'bg-red-50 text-red-800 border-red-200'
                }`}>
                {microphonePermission === 'granted'
                  ? '🎤 Microphone access granted - speaking questions will work properly'
                  : '🎤 Microphone access denied - speaking questions may not work'
                }
              </div>
            )}
          </div>
          <Button
            onClick={handleStartTest}
            size="lg"
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
            disabled={startAttempting}
          >
            {startAttempting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Starting...
              </>
            ) : (
              "Start Test"
            )}
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <>
      {/* Violation Dialog */}
      {proctoring.criticalViolationType && !isSubmissionInProgress && !isAutoSubmitting && (
        <ViolationDialog
          type={proctoring.criticalViolationType}
          onClose={proctoring.dismissCriticalViolation}
        />
      )}

      {/* Screen monitoring warning dialog */}
      <ViolationWarningDialog
        open={proctoring.screenMonitoring.showWarningDialog}
        violationType={proctoring.screenMonitoring.currentViolationType}
        onReturnToExam={proctoring.screenMonitoring.returnToExam}
        onProceedWithViolation={proctoring.screenMonitoring.proceedWithAutoSubmit}
      />

      {/* Input restrictions warning dialog */}
      <ViolationWarningDialog
        open={proctoring.inputRestrictions.showWarningDialog}
        violationType={proctoring.inputRestrictions.currentViolationType}
        onReturnToExam={proctoring.inputRestrictions.dismissWarning}
        onProceedWithViolation={proctoring.inputRestrictions.proceedWithViolation}
      />

      {showSubmissionModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-8">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/90 backdrop-blur-sm"></div>

          {/* Modal */}
          <div className="relative bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl border border-slate-200">
            <div className="text-center space-y-6">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle className="w-8 h-8 text-blue-600" />
              </div>

              <div>
                <h2 className="text-2xl font-bold text-slate-800 mb-2">Submit Test?</h2>
                <div className="text-slate-600 space-y-1">
                  <p>Are you sure you want to submit your test?</p>
                  <p className="text-sm text-slate-500">You cannot change your answers afterwards.</p>
                </div>
              </div>

              <div className="flex gap-4 justify-center">
                <Button
                  onClick={() => {
                    setShowSubmissionModal(false);
                    setIsSubmissionInProgress(false); // Re-enable monitoring if user cancels
                  }}
                  variant="outline"
                  className="px-8 py-3 text-sm font-medium"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    setShowSubmissionModal(false);
                    // Continue with submission immediately
                    handleSubmit(false);
                  }}
                  className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 text-sm font-medium shadow-lg"
                >
                  Submit Test
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Exit Warning Dialog - REMOVED: No modal should allow exit */}

      <div className="w-screen min-h-screen bg-gradient-to-b from-indigo-50 via-violet-50 to-white flex items-center justify-center p-8">
        <div className="max-w-[1200px] w-full bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden" style={{ minHeight: "80vh" }}>
          {/* Security Warning Banner */}
          {isTestCompromised && (
            <div className="bg-red-100 border-b border-red-400 p-4">
              <div className="flex items-center text-red-700">
                <AlertCircle className="w-5 h-5 mr-3 flex-shrink-0" />
                <div>
                  <div className="font-bold text-sm">🚨 Test Security Compromised</div>
                  <div className="text-sm">{violationMessage}</div>
                  <div className="text-xs mt-1">
                    {isAutoSubmitting
                      ? "Auto-submitting test now. Please wait and do not close this window."
                      : "Manual submission disabled. Test will auto-submit to prevent cheating."
                    }
                  </div>
                </div>
              </div>
            </div>
          )}
          <div className="flex h-full">
            <div className="w-2/5 min-w-[420px] border-r border-slate-100 p-6">
              <div className="h-full sticky top-6 flex flex-col">
                <div className="mb-5 space-y-3">
                  {/* Enhanced Timer Display */}
                  {timeRemaining !== null && timeRemaining > 0 && (
                    <div className={`rounded-lg p-4 border-2 ${timeRemaining <= 60 ? 'bg-red-50 border-red-300 animate-pulse' :
                      timeRemaining <= 300 ? 'bg-amber-50 border-amber-300' :
                        'bg-green-50 border-green-300'
                      }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Clock className={`w-5 h-5 ${timeRemaining <= 60 ? 'text-red-600' :
                            timeRemaining <= 300 ? 'text-amber-600' :
                              'text-green-600'
                            }`} />
                          <span className={`font-mono text-lg font-bold ${timeRemaining <= 60 ? 'text-red-700' :
                            timeRemaining <= 300 ? 'text-amber-700' :
                              'text-green-700'
                            }`}>
                            {formatTime(timeRemaining)}
                          </span>
                        </div>
                        <span className={`text-sm font-medium ${timeRemaining <= 60 ? 'text-red-600' :
                          timeRemaining <= 300 ? 'text-amber-600' :
                            'text-green-600'
                          }`}>
                          {Math.floor(timeRemaining / 60)}min left
                        </span>
                      </div>

                      {/* Progress bar */}
                      <div className="mt-3">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-slate-600">Progress</span>
                          <span className="text-slate-600">{Math.floor((1 - (timeRemaining / ((test?.timeLimitMinutes || 60) * 60))) * 100)}%</span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all duration-1000 ${timeRemaining <= 60 ? 'bg-red-500' :
                              timeRemaining <= 300 ? 'bg-amber-500' :
                                'bg-green-500'
                              }`}
                            style={{ width: `${Math.floor((1 - (timeRemaining / ((test?.timeLimitMinutes || 60) * 60))) * 100)}%` }}
                          ></div>
                        </div>
                      </div>

                      {timeRemaining <= 300 && (
                        <div className={`text-xs mt-2 p-2 rounded ${timeRemaining <= 60 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                          ⚠️ {timeRemaining <= 60 ? 'URGENT: Submit soon!' : 'Time running low!'}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Test Info */}
                  <div className="rounded-md p-4" style={{ background: "linear-gradient(180deg, rgba(239,246,255,1) 0%, rgba(245,243,255,1) 100%)" }}>
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-indigo-100 rounded-md">
                        {test?.type === "reading" ? <BookOpen className="w-6 h-6 text-indigo-700" /> : test?.type === "listening" ? <Headphones className="w-6 h-6 text-indigo-700" /> : test?.type === "writing" ? <Pen className="w-6 h-6 text-indigo-700" /> : <Mic className="w-6 h-6 text-indigo-700" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-slate-500">Test</div>
                        <div className="text-lg font-semibold text-slate-800 truncate">{test?.title || "Test"}</div>
                        {typeof test?.timeLimitMinutes === "number" && test?.timeLimitMinutes > 0 && <div className="text-sm text-slate-500 mt-1">Time limit: {test?.timeLimitMinutes} minutes</div>}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-auto">
                  {loading && (
                    <div className="flex items-center justify-center h-48">
                      <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                    </div>
                  )}

                  {error && <div className="text-red-600">{error}</div>}

                  {!loading && !error && test && flatQuestions.length > 0 && (
                    <div className="space-y-6">
                      {renderLeftForCurrent(flatQuestions[currentIndex].q)}
                    </div>
                  )}

                  {!loading && !error && test && flatQuestions.length === 0 && <div className="text-slate-600">No content available.</div>}
                </div>

                <div className="mt-4 space-y-3">
                  {/* Progress Stats */}
                  {(() => {
                    const answered = flatQuestions.filter((item, idx) => {
                      const key = qKey(item.q, idx);
                      const ans = answers[key];
                      if (item.q.questionType === "mcq") return ans?.selectedIndex !== undefined;
                      if (item.q.questionType === "writing") return ans?.text && ans.text.trim().length > 0;
                      if (item.q.questionType === "speaking") return !!speakingBlobsRef.current[key];
                      return false;
                    }).length;
                    const total = flatQuestions.length;
                    const percentage = total > 0 ? Math.round((answered / total) * 100) : 0;

                    return (
                      <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-xs text-slate-600">Progress</div>
                          <div className="text-xs font-semibold text-indigo-600">
                            {answered} / {total} answered ({percentage}%)
                          </div>
                        </div>
                        <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className="h-2 bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-300"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })()}

                  {/* Current Question Indicator */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm text-slate-600">Question {flatQuestions.length ? `${currentIndex + 1} / ${flatQuestions.length}` : "0 / 0"}</div>
                    <div className="w-40 h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-2 bg-indigo-500" style={{ width: `${flatQuestions.length ? ((currentIndex + 1) / flatQuestions.length) * 100 : 0}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="w-3/5 p-8 overflow-auto">
              <div className="max-w-[760px] mx-auto">
                <div className="mb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-slate-500">Question</div>
                      <div className="text-2xl font-semibold text-slate-800 mt-2">
                        {flatQuestions[currentIndex]?.q?.questionType === "writing" || flatQuestions[currentIndex]?.q?.questionType === "speaking"
                          ? `Task ${currentIndex + 1}`
                          : `Q${currentIndex + 1}`}
                      </div>
                    </div>

                    <div className="text-sm text-slate-600">
                      Marks <div className="font-medium text-slate-700">{flatQuestions[currentIndex]?.q?.marks ?? "-"}</div>
                    </div>
                  </div>
                </div>

                <div>
                  {!loading && !error && test && flatQuestions.length > 0 && (
                    <Card className="p-6 rounded-md shadow-sm border border-slate-100">
                      {renderRightForCurrent(flatQuestions[currentIndex].q, flatQuestions[currentIndex].idx)}
                    </Card>
                  )}

                  {!loading && !error && test && flatQuestions.length === 0 && <div className="text-slate-600">No questions available.</div>}
                </div>

                <div className="mt-6 sticky bottom-6 bg-white/95 backdrop-blur-sm pt-6 pb-2 -mx-6 px-6 border-t border-slate-100">
                  <div className="flex flex-col gap-4">
                    {/* Navigation Buttons */}
                    <div className="flex items-center justify-between">
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={goPrev}
                          disabled={currentIndex === 0}
                          className="rounded-md bg-white border-2 border-slate-300 text-slate-800 hover:bg-slate-100 hover:border-slate-400 disabled:opacity-50 disabled:cursor-not-allowed px-5 py-2.5 font-medium shadow-sm"
                        >
                          ← Previous
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={goNext}
                          disabled={currentIndex >= flatQuestions.length - 1}
                          className="rounded-md bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 disabled:cursor-not-allowed px-5 py-2.5 font-medium shadow-md"
                        >
                          Next →
                        </Button>
                      </div>

                      <div className="flex items-center gap-3">
                        {submitMessage && (
                          <div className="text-sm text-slate-600 bg-blue-50 px-3 py-1.5 rounded-md border border-blue-200">
                            {submitMessage}
                          </div>
                        )}
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleSubmit()}
                          disabled={submitting || isTestCompromised || isAutoSubmitting}
                          className="rounded-md bg-green-600 hover:bg-green-70 text-white! font-semibold! px-6 py-2.5 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {submitting || isAutoSubmitting ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              {isAutoSubmitting ? "Auto-Submitting..." : "Submitting..."}
                            </>
                          ) : isTestCompromised ? (
                            <span className="text-white!">Submission Blocked</span>
                          ) : (
                            <span className="text-white!">Submit Test</span>
                          )}
                        </Button>

                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

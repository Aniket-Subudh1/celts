import React from 'react';
import { useTestProctoring } from '@/hooks/use-test-proctoring';
import { ViolationWarningDialog } from '@/components/ViolationWarningDialog';

interface ExamWithWarningsProps {
  testId: string;
  attemptId: string;
  sessionToken: string;
  onAutoSubmit: () => void;
}

export function ExamWithWarnings({
  testId,
  attemptId,
  sessionToken,
  onAutoSubmit,
}: ExamWithWarningsProps) {
  const {
    screenMonitoring,
    inputRestrictions,
    securityScore,
    isSessionValid,
    networkConnected,
  } = useTestProctoring({
    testId,
    attemptId,
    sessionToken,
    enabled: true,
    autoSubmitOnViolation: true,
    warningsBeforeAutoSubmit: 2, // Give 2 warnings before auto-submit
    onAutoSubmit,
    onViolation: (violationType, details) => {
      console.log('Violation detected:', violationType, details);
    },
    onCriticalViolation: (violationType, details) => {
      console.log('Critical violation detected:', violationType, details);
    },
  });

  return (
    <div className="exam-container">
      {/* Screen monitoring warning dialog */}
      <ViolationWarningDialog
        open={screenMonitoring.showWarningDialog}
        violationType={screenMonitoring.currentViolationType}
        onReturnToExam={screenMonitoring.returnToExam}
        onProceedWithViolation={screenMonitoring.proceedWithAutoSubmit}
      />

      {/* Input restrictions warning dialog */}
      <ViolationWarningDialog
        open={inputRestrictions.showWarningDialog}
        violationType={inputRestrictions.currentViolationType}
        onReturnToExam={inputRestrictions.dismissWarning}
        onProceedWithViolation={inputRestrictions.proceedWithViolation}
      />

      {/* Security status display */}
      <div className="security-status mb-4 p-3 bg-gray-50 rounded-lg">
        <div className="flex justify-between items-center text-sm">
          <div className="flex items-center gap-4">
            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
              securityScore >= 80 ? 'bg-green-100 text-green-800' :
              securityScore >= 60 ? 'bg-yellow-100 text-yellow-800' :
              'bg-red-100 text-red-800'
            }`}>
              Security Score: {securityScore}%
            </span>
            
            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
              isSessionValid ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              Session: {isSessionValid ? 'Valid' : 'Invalid'}
            </span>
            
            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
              networkConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              Network: {networkConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          
          <div className="text-xs text-gray-600">
            {screenMonitoring.isFullscreen ? '🔒 Fullscreen' : '⚠️ Not Fullscreen'} | 
            {screenMonitoring.isWindowFocused ? ' 👁️ Focused' : ' ⚠️ Unfocused'}
          </div>
        </div>
      </div>

      {/* Exam content */}
      <div className="exam-content">
        <h1 className="text-2xl font-bold mb-6">Secure Exam Interface</h1>
        
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg mb-6">
          <h3 className="font-semibold text-blue-800 mb-2">Security Features Active:</h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• Copy/Paste operations are blocked with warnings</li>
            <li>• Tab switching and window focus loss detection</li>
            <li>• Fullscreen mode enforcement</li>
            <li>• Function key restrictions</li>
            <li>• Right-click context menu blocking</li>
            <li>• Developer tools detection</li>
            <li>• Multiple monitor detection</li>
            <li>• Network connectivity monitoring</li>
          </ul>
        </div>

        <div className="space-y-4">
          <p className="text-gray-700">
            This is a demonstration of the enhanced exam security system with warning dialogs.
          </p>
          
          <p className="text-gray-700">
            Try the following to see the warning system in action:
          </p>
          
          <ul className="list-disc list-inside text-gray-700 space-y-1">
            <li>Press Ctrl+C or Ctrl+V (will show warnings)</li>
            <li>Switch tabs or minimize the window</li>
            <li>Press F12 or other function keys</li>
            <li>Right-click for context menu</li>
            <li>Try to select and copy text</li>
          </ul>

          <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
            <p className="text-yellow-800 font-semibold">Warning System:</p>
            <p className="text-yellow-700 text-sm mt-1">
              You will receive {2} warnings for most violations before the exam is automatically submitted.
              Some critical violations (like tab switching) may result in immediate submission.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ArrowLeft, LogOut } from 'lucide-react';

interface ViolationWarningDialogProps {
  open: boolean;
  violationType: string;
  onReturnToExam: () => void;
  onProceedWithViolation: () => void;
}

const VIOLATION_MESSAGES: Record<string, { title: string; description: string; severity: 'warning' | 'critical' }> = {
  copy_attempt: {
    title: 'Copy Operation Detected',
    description: 'Copying content is not allowed during the examination. This action has been blocked.',
    severity: 'warning'
  },
  paste_attempt: {
    title: 'Paste Operation Detected',
    description: 'Pasting content is not allowed during the examination. This action has been blocked.',
    severity: 'warning'
  },
  cut_attempt: {
    title: 'Cut Operation Detected',
    description: 'Cutting content is not allowed during the examination. This action has been blocked.',
    severity: 'warning'
  },
  tab_switch: {
    title: 'Tab Switch Detected',
    description: 'You switched to a different browser tab. Please return to the exam immediately.',
    severity: 'critical'
  },
  window_blur: {
    title: 'Window Focus Lost',
    description: 'You switched away from the exam window. Please return focus to the exam.',
    severity: 'critical'
  },
  fullscreen_exit: {
    title: 'Fullscreen Mode Exited',
    description: 'You exited fullscreen mode. Please return to fullscreen to continue the exam.',
    severity: 'critical'
  },
  dev_tools_open: {
    title: 'Developer Tools Detected',
    description: 'Browser developer tools were detected as open. Please close them immediately.',
    severity: 'critical'
  },
  context_menu_attempt: {
    title: 'Right-Click Menu Blocked',
    description: 'Right-click context menu access is not allowed during the examination.',
    severity: 'warning'
  },
  function_key_attempt: {
    title: 'Function Key Blocked',
    description: 'Function keys are not allowed during the examination.',
    severity: 'warning'
  },
  alt_tab_attempt: {
    title: 'Alt+Tab Blocked',
    description: 'Window switching using Alt+Tab is not allowed during the examination.',
    severity: 'warning'
  },
  screen_change: {
    title: 'Screen Configuration Changed',
    description: 'A change in screen configuration was detected. Please maintain a consistent setup.',
    severity: 'critical'
  },
  multiple_monitors: {
    title: 'Multiple Monitors Detected',
    description: 'Multiple monitor setups may not be allowed during this examination.',
    severity: 'critical'
  },
  zoom_change: {
    title: 'Browser Zoom Changed',
    description: 'Please maintain the default browser zoom level during the examination.',
    severity: 'warning'
  }
};

export function ViolationWarningDialog({
  open,
  violationType,
  onReturnToExam,
  onProceedWithViolation,
}: ViolationWarningDialogProps) {
  const violation = VIOLATION_MESSAGES[violationType] || {
    title: 'Security Violation Detected',
    description: 'An unauthorized action was detected during the examination.',
    severity: 'warning' as const
  };

  const isCritical = violation.severity === 'critical';

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <AlertTriangle 
              className={`h-6 w-6 ${isCritical ? 'text-red-500' : 'text-yellow-500'}`}
            />
            <DialogTitle className={`text-lg font-semibold ${isCritical ? 'text-red-700' : 'text-yellow-700'}`}>
              🚨 FINAL WARNING
            </DialogTitle>
          </div>
          <DialogDescription className="text-gray-700 space-y-3">
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <h4 className="font-medium text-red-800 mb-1">{violation.title}</h4>
              <p className="text-sm text-red-700">{violation.description}</p>
            </div>
            
            <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <p className="text-sm text-orange-800 font-medium">
                ⚠️ Your exam will be automatically submitted if you continue this behavior.
              </p>
              <p className="text-sm text-orange-700 mt-1">
                You have reached the maximum number of warnings for this type of violation.
              </p>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>What happens next:</strong>
              </p>
              <ul className="text-sm text-blue-700 mt-1 space-y-1">
                <li>• Return to exam: Continue your test safely</li>
                <li>• Proceed anyway: Your exam will be submitted immediately</li>
                <li>• Auto-submit in 10 seconds if no action is taken</li>
              </ul>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-3 mt-6">
          <Button
            onClick={onReturnToExam}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Return to Exam
          </Button>
          
          <Button
            onClick={onProceedWithViolation}
            variant="destructive"
            className="flex-1"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Submit & Exit
          </Button>
        </div>

        <div className="text-center mt-3">
          <p className="text-xs text-gray-500">
            This dialog will auto-submit your exam in 10 seconds
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
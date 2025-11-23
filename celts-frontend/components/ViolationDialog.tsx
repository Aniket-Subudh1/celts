"use client";

import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle, Monitor, Eye, Wifi, Shield, Clock, Keyboard, Globe } from "lucide-react";

interface ViolationDialogProps {
  type: string;
  onClose: () => void;
}

export function ViolationDialog({ type, onClose }: ViolationDialogProps) {
  const [open, setOpen] = useState(true);

  const handleClose = () => {
    setOpen(false);
    onClose();
  };

  const getDialogContent = () => {
    switch (type) {
      case "multiple_monitors":
        return {
          icon: <Monitor className="w-12 h-12 text-red-500" />,
          title: "Multiple Monitors Detected",
          description: (
            <div className="space-y-3">
              <div className="text-red-600 font-semibold">
                You are using multiple monitors which is NOT ALLOWED during the test.
              </div>
              <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                <div className="font-semibold mb-2">Required Actions:</div>
                <ol className="list-decimal list-inside space-y-1 text-sm">
                  <li>Disconnect all extra monitors immediately</li>
                  <li>Use only ONE screen for the test</li>
                  <li>Refresh the test page if needed</li>
                </ol>
              </div>
              <div className="text-sm text-slate-600">
                <strong>Warning:</strong> Continued use of multiple monitors will result in automatic test submission.
              </div>
            </div>
          ),
          actionText: "I Understand",
        };

      case "tab_switch":
        return {
          icon: <Eye className="w-12 h-12 text-red-500" />,
          title: "Tab Switch Detected",
          description: (
            <div className="space-y-3">
              <div className="text-red-600 font-semibold text-lg">
                CRITICAL VIOLATION DETECTED
              </div>
              <div>You switched to another tab or window.</div>
              <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                <div className="font-semibold text-red-700">
                  This is a critical violation.
                </div>
                <div className="text-sm mt-2">
                  Your test is being automatically submitted now.
                </div>
              </div>
            </div>
          ),
          actionText: "OK",
        };

      case "window_blur":
        return {
          icon: <AlertTriangle className="w-12 h-12 text-red-500" />,
          title: "Window Focus Lost",
          description: (
            <div className="space-y-3">
              <div className="text-red-600 font-semibold text-lg">
                CRITICAL VIOLATION DETECTED
              </div>
              <div>You left the test window or switched applications.</div>
              <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                <div className="font-semibold text-red-700">
                  This is a critical violation.
                </div>
                <div className="text-sm mt-2">
                  Your test is being automatically submitted now.
                </div>
              </div>
            </div>
          ),
          actionText: "OK",
        };

      case "clipboard_critical":
        return {
          icon: <Keyboard className="w-12 h-12 text-red-500" />,
          title: "Copy/Paste Violation",
          description: (
            <div className="space-y-3">
              <div className="text-red-600 font-semibold text-lg">
                CRITICAL VIOLATION DETECTED
              </div>
              <div>You attempted to copy, cut, or paste content multiple times after warnings.</div>
              <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                <div className="font-semibold text-red-700">
                  This is a critical violation.
                </div>
                <div className="text-sm mt-2">
                  Your test is being automatically submitted now.
                </div>
              </div>
            </div>
          ),
          actionText: "OK",
        };

      case "new_tab":
      case "new_window":
      case "incognito":
        return {
          icon: <Eye className="w-12 h-12 text-red-500" />,
          title: "Browser Navigation Violation",
          description: (
            <div className="space-y-3">
              <div className="text-red-600 font-semibold text-lg">
                CRITICAL VIOLATION DETECTED
              </div>
              <div>You attempted to open a new tab, window, or incognito session.</div>
              <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                <div className="font-semibold text-red-700">
                  Browser navigation outside the exam is prohibited.
                </div>
                <div className="text-sm mt-2">
                  Your test is being automatically submitted now.
                </div>
              </div>
            </div>
          ),
          actionText: "OK",
        };

      case "mobile_device":
        return {
          icon: <Monitor className="w-12 h-12 text-red-500" />,
          title: "Device Not Supported",
          description: (
            <div className="space-y-3">
              <div className="text-red-600 font-semibold text-lg">
                MOBILE DEVICE DETECTED
              </div>
              <div>This exam requires a desktop or laptop computer.</div>
              <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                <div className="font-semibold text-red-700">
                  Mobile devices are not allowed for this exam.
                </div>
                <div className="text-sm mt-2">
                  Please use a desktop or laptop computer and restart the exam.
                </div>
              </div>
            </div>
          ),
          actionText: "OK",
        };

      default:
        return null;
    }
  };

  const content = getDialogContent();

  if (!content) return null;

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex flex-col items-center mb-4">
            {content.icon}
          </div>
          <AlertDialogTitle className="text-center text-xl">
            {content.title}
          </AlertDialogTitle>
          <div className="text-center text-muted-foreground text-sm">
            {content.description}
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction
            onClick={handleClose}
            className="w-full bg-red-600 hover:bg-red-700"
          >
            {content.actionText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

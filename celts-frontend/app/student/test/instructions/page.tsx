"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, XCircle, Eye, Monitor, Keyboard, Mouse } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

function TestInstructionsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const testId = searchParams.get("testId");
  const [agreed, setAgreed] = useState(false);

  const handleStartTest = () => {
    if (!agreed) {
      alert("Please read and accept all rules before starting the test.");
      return;
    }
    if (!testId) {
      alert("No test ID provided.");
      return;
    }
    router.push(`/student/test/testRunner?testId=${testId}`);
  };

  const rules = [
    {
      icon: <Monitor className="w-6 h-6 text-red-500" />,
      title: "Single Monitor Only",
      description: "You must use only ONE monitor. Multiple monitors will be detected and may result in auto-submission.",
      severity: "critical"
    },
    {
      icon: <Eye className="w-6 h-6 text-red-500" />,
      title: "Stay Focused",
      description: "Do not switch tabs, minimize the window, or leave the test page. This will trigger immediate auto-submission.",
      severity: "critical"
    },
    {
      icon: <Keyboard className="w-6 h-6 text-orange-500" />,
      title: "No Copy/Paste",
      description: "Cut, copy, and paste operations are disabled. Right-click context menu is also blocked.",
      severity: "high"
    },
    {
      icon: <XCircle className="w-6 h-6 text-orange-500" />,
      title: "No Browser Tools",
      description: "Developer tools, browser console, and view source are blocked. Do not attempt to access them.",
      severity: "high"
    },
    {
      icon: <Mouse className="w-6 h-6 text-yellow-500" />,
      title: "Stay in Window",
      description: "Keep your mouse and focus within the test window. Excessive movement outside may be logged.",
      severity: "medium"
    },
    {
      icon: <AlertTriangle className="w-6 h-6 text-yellow-500" />,
      title: "Violation Limits",
      description: "You are allowed 3 minor violations. After that, your test will be automatically submitted.",
      severity: "medium"
    }
  ];

  const consequences = [
    "Tab switching or window blur → Immediate auto-submission",
    "Multiple monitors detected → Warning popup and possible auto-submission",
    "3 minor violations → Automatic test submission",
    "All violations are logged and reviewed by faculty",
    "Attempting to cheat may result in test disqualification"
  ];

  return (
    <div className="w-screen min-h-screen bg-gradient-to-b from-indigo-50 via-violet-50 to-white flex items-center justify-center p-8">
      <div className="max-w-[900px] w-full">
        <Card className="p-8 shadow-xl border-2 border-indigo-200">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-100 rounded-full mb-4">
              <AlertTriangle className="w-8 h-8 text-indigo-600" />
            </div>
            <h1 className="text-3xl font-bold text-slate-800 mb-2">Test Rules & Instructions</h1>
            <p className="text-slate-600">Please read carefully before starting your test</p>
          </div>

          {/* Rules Grid */}
          <div className="space-y-4 mb-8">
            <h2 className="text-xl font-semibold text-slate-800 mb-4">Proctoring Rules</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {rules.map((rule, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-lg border-2 ${
                    rule.severity === 'critical'
                      ? 'border-red-200 bg-red-50'
                      : rule.severity === 'high'
                      ? 'border-orange-200 bg-orange-50'
                      : 'border-yellow-200 bg-yellow-50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0">{rule.icon}</div>
                    <div>
                      <h3 className="font-semibold text-slate-800 mb-1">{rule.title}</h3>
                      <p className="text-sm text-slate-600">{rule.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Consequences */}
          <div className="bg-slate-50 rounded-lg p-6 mb-8 border border-slate-200">
            <h2 className="text-xl font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <XCircle className="w-6 h-6 text-red-500" />
              Consequences of Violations
            </h2>
            <ul className="space-y-2">
              {consequences.map((consequence, index) => (
                <li key={index} className="flex items-start gap-2 text-slate-700">
                  <span className="text-red-500 mt-1">•</span>
                  <span>{consequence}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Technical Requirements */}
          <div className="bg-blue-50 rounded-lg p-6 mb-8 border border-blue-200">
            <h2 className="text-xl font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <CheckCircle2 className="w-6 h-6 text-blue-500" />
              Before You Start
            </h2>
            <ul className="space-y-2 text-slate-700">
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-1">✓</span>
                <span>Disconnect any additional monitors (use only one screen)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-1">✓</span>
                <span>Close all unnecessary tabs and applications</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-1">✓</span>
                <span>Ensure stable internet connection</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-1">✓</span>
                <span>Use a supported browser (Chrome, Firefox, Edge)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-1">✓</span>
                <span>Be in a quiet environment with minimal distractions</span>
              </li>
            </ul>
          </div>

          {/* Agreement Checkbox */}
          <div className="bg-white rounded-lg p-6 mb-6 border-2 border-indigo-200">
            <div className="flex items-start gap-3">
              <Checkbox
                id="agreement"
                checked={agreed}
                onCheckedChange={(checked: boolean) => setAgreed(checked)}
                className="mt-1"
              />
              <label htmlFor="agreement" className="text-slate-700 cursor-pointer">
                <span className="font-semibold">I have read and understood all the rules above.</span>
                <br />
                <span className="text-sm text-slate-600">
                  I agree to follow these rules and understand that violations will be logged and may result in test disqualification.
                  I confirm that I am using only one monitor and have closed all unnecessary applications.
                </span>
              </label>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between gap-4">
            <Button
              variant="outline"
              onClick={() => router.back()}
              className="px-6"
            >
              Go Back
            </Button>
            <Button
              onClick={handleStartTest}
              disabled={!agreed}
              className="px-8 bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              I Agree - Start Test
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default function TestInstructionsPage() {
  return (
    <Suspense fallback={<div className="w-screen min-h-screen bg-gradient-to-b from-indigo-50 via-violet-50 to-white flex items-center justify-center"><div className="text-center">Loading...</div></div>}>
      <TestInstructionsContent />
    </Suspense>
  );
}

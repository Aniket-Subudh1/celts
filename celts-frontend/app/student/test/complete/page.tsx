"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CheckCircle2, Clock, FileText, AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function TestCompleteContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const testTitle = searchParams.get("testTitle") || "Test";
  const testType = searchParams.get("testType") || "test";
  const autoSubmitted = searchParams.get("autoSubmit") === "true";
  const submissionId = searchParams.get("submissionId");
  const reason = searchParams.get("reason");

  const [countdown, setCountdown] = useState(5);

  const getExitMessage = () => {
    // Handle temporary submission IDs
    if (submissionId === "processing") {
      return {
        icon: <Clock className="w-12 h-12 text-blue-500" />,
        title: "Test Submitted!",
        subtitle: "Processing your submission...",
        message: "Your test has been submitted successfully. The results are being processed and will be available shortly.",
        bgColor: "from-blue-50 to-indigo-50",
        alertColor: "blue"
      };
    }
    
    if (submissionId === "error" || submissionId === "auto-error") {
      return {
        icon: <AlertCircle className="w-12 h-12 text-orange-500" />,
        title: "Test Submitted!",
        subtitle: "Submission completed with processing delay",
        message: "Your test has been submitted. There may be a delay in processing results. Contact support if you don't see results within an hour.",
        bgColor: "from-orange-50 to-yellow-50",
        alertColor: "orange"
      };
    }
    
    switch (reason) {
      case 'fullscreen_exit':
        return {
          icon: <AlertCircle className="w-12 h-12 text-orange-500" />,
          title: "Test Ended",
          subtitle: "Fullscreen mode was exited",
          message: "The test was automatically ended because you exited fullscreen mode. This action has been recorded.",
          bgColor: "from-orange-50 to-red-50",
          alertColor: "orange"
        };
      case 'tab_switch':
        return {
          icon: <AlertCircle className="w-12 h-12 text-red-500" />,
          title: "Test Ended", 
          subtitle: "Tab switching detected",
          message: "The test was automatically ended due to navigation away from the test page. This action has been recorded.",
          bgColor: "from-red-50 to-pink-50",
          alertColor: "red"
        };
      case 'violation':
        return {
          icon: <AlertCircle className="w-12 h-12 text-red-500" />,
          title: "Test Ended",
          subtitle: "Multiple violations detected", 
          message: "The test was automatically ended due to multiple proctoring violations. All actions have been recorded.",
          bgColor: "from-red-50 to-pink-50",
          alertColor: "red"
        };
      default:
        return {
          icon: <CheckCircle2 className="w-12 h-12 text-green-500" />,
          title: "Test Completed!",
          subtitle: autoSubmitted ? "Time limit reached - Test auto-submitted" : "Successfully submitted",
          message: "Your test has been submitted successfully and is being processed.",
          bgColor: "from-green-50 to-emerald-50",
          alertColor: "green"
        };
    }
  };

  const exitInfo = getExitMessage();

  useEffect(() => {
    // Only start countdown if we have a valid submission ID (not temporary ones)
    const isValidSubmissionId = submissionId && 
      submissionId !== "processing" && 
      submissionId !== "error" && 
      submissionId !== "auto-error";
      
    if (isValidSubmissionId) {
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            router.push(`/student/test/testScore?submissionId=${submissionId}`);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [submissionId, router]);

  return (
    <div className={`w-screen min-h-screen bg-gradient-to-br ${exitInfo.bgColor} flex items-center justify-center p-4`}>
      <Card className="max-w-2xl w-full p-8 md:p-12 text-center space-y-6 shadow-2xl border-0">
        <div className="flex justify-center">
          <div className={`w-20 h-20 bg-gradient-to-br rounded-full flex items-center justify-center shadow-lg ${reason ? 'animate-none' : 'animate-pulse'}`}>
            {exitInfo.icon}
          </div>
        </div>

        <div className="space-y-3">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-800">
            {exitInfo.title}
          </h1>
          {(autoSubmitted || reason) && (
            <div className={`flex items-center justify-center gap-2 text-${exitInfo.alertColor}-600 bg-${exitInfo.alertColor}-50 py-2 px-4 rounded-lg`}>
              {reason ? <AlertCircle className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
              <p className="text-sm font-medium">
                {exitInfo.subtitle}
              </p>
            </div>
          )}
        </div>

        <div className="bg-indigo-50 rounded-xl p-6 space-y-3">
          <div className="flex items-center justify-center gap-2 text-indigo-700">
            <FileText className="w-5 h-5" />
            <h2 className="text-lg font-semibold">{testTitle}</h2>
          </div>
          <p className="text-sm text-slate-600 capitalize">
            {testType} Section
          </p>
        </div>

        <div className="space-y-4">
          <p className="text-slate-600 text-sm md:text-base">
            {exitInfo.message}
          </p>
          
          {/* Check if submission ID is valid (not temporary) */}
          {submissionId && 
           submissionId !== "processing" && 
           submissionId !== "error" && 
           submissionId !== "auto-error" ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-green-800 text-sm font-medium mb-2">
                ✓ Submission Recorded
              </p>
              <p className="text-slate-600 text-xs">
                Redirecting to your results in <span className="font-bold text-green-600">{countdown}</span> second{countdown !== 1 ? 's' : ''}...
              </p>
            </div>
          ) : submissionId === "processing" ? (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-blue-600" />
                <p className="text-blue-800 text-sm font-medium">
                  Processing Your Submission
                </p>
              </div>
              <p className="text-slate-600 text-xs">
                Your test is being processed in the background. Results will appear in your dashboard within a few minutes.
              </p>
            </div>
          ) : (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center justify-center gap-2 mb-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <p className="text-green-800 text-sm font-medium">
                  ✓ Submission Complete
                </p>
              </div>
              <p className="text-slate-600 text-xs">
                Your test has been submitted. Results are being processed and will be available in your dashboard.
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
          {/* Only show 'View Results Now' button for valid submission IDs */}
          {submissionId && 
           submissionId !== "processing" && 
           submissionId !== "error" && 
           submissionId !== "auto-error" && (
            <Button
              onClick={() => router.push(`/student/test/testScore?submissionId=${submissionId}`)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg shadow-md"
            >
              View Results Now
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => {
              // Force a page refresh when going back to dashboard to ensure test data is updated
              router.push("/student/dashboard");
              // Alternative: you could also use router.refresh() here if needed
            }}
            className="border-slate-300 text-slate-700 hover:bg-slate-50 px-6 py-3 rounded-lg"
          >
            Back to Dashboard
          </Button>
        </div>

        {/* Additional Info */}
        <div className="pt-6 border-t border-slate-200">
          <p className="text-xs text-slate-500">
            {submissionId && 
             submissionId !== "processing" && 
             submissionId !== "error" && 
             submissionId !== "auto-error"
              ? "Your performance is being evaluated. Results will be displayed momentarily."
              : "Your performance is being evaluated and scores will be available in your dashboard shortly."}
            {!autoSubmitted && " Thank you for completing the test!"}
          </p>
        </div>
      </Card>
    </div>
  );
}

export default function TestCompletePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="text-center">Loading...</div></div>}>
      <TestCompleteContent />
    </Suspense>
  );
}

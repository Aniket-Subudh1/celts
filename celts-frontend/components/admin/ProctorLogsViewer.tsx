"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  AlertTriangle, 
  Monitor, 
  Eye, 
  Keyboard, 
  MousePointer, 
  Maximize, 
  RefreshCw,
  User,
  Calendar,
  Clock
} from "lucide-react";
import api from "@/lib/api";

interface ProctorLog {
  _id: string;
  student: {
    _id: string;
    name: string;
    email: string;
  };
  testSet: string;
  eventType: string;
  eventData: any;
  createdAt: string;
}

interface ProctorLogsViewerProps {
  testId: string;
}

export function ProctorLogsViewer({ testId }: ProctorLogsViewerProps) {
  const [logs, setLogs] = useState<ProctorLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<string>("all");

  useEffect(() => {
    if (testId) {
      fetchLogs();
    }
  }, [testId]);

  async function fetchLogs() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.apiGet(`/proctor/logs/${testId}`);
      if (!res.ok) {
        setError(res.error?.message || "Failed to load logs");
        return;
      }
      setLogs(res.data || []);
    } catch (err: any) {
      setError(err?.message || "Network error");
    } finally {
      setLoading(false);
    }
  }

  const getViolationIcon = (type: string) => {
    switch (type) {
      case "tab_switch":
        return <Eye className="w-5 h-5 text-red-500" />;
      case "window_blur":
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
      case "multiple_monitors":
        return <Monitor className="w-5 h-5 text-orange-500" />;
      case "fullscreen_exit":
        return <Maximize className="w-5 h-5 text-yellow-500" />;
      case "clipboard":
      case "context_menu":
        return <Keyboard className="w-5 h-5 text-yellow-500" />;
      case "mouse_leave_top":
        return <MousePointer className="w-5 h-5 text-yellow-500" />;
      case "dev_tools":
      case "dev_tools_open":
        return <AlertTriangle className="w-5 h-5 text-orange-500" />;
      default:
        return <AlertTriangle className="w-5 h-5 text-slate-500" />;
    }
  };

  const getSeverityBadge = (type: string) => {
    if (["tab_switch", "window_blur"].includes(type)) {
      return <Badge variant="destructive">Critical</Badge>;
    }
    if (["multiple_monitors", "dev_tools", "fullscreen_exit"].includes(type)) {
      return <Badge className="bg-orange-500">High</Badge>;
    }
    return <Badge variant="secondary">Medium</Badge>;
  };

  const getViolationLabel = (type: string) => {
    const labels: Record<string, string> = {
      tab_switch: "Tab Switch",
      window_blur: "Window Focus Lost",
      multiple_monitors: "Multiple Monitors",
      fullscreen_exit: "Fullscreen Exit",
      clipboard: "Clipboard Action",
      context_menu: "Right-Click Attempt",
      dev_tools: "Dev Tools Access",
      dev_tools_open: "Dev Tools Detected",
      mouse_leave_top: "Mouse Left Window",
      new_tab: "New Tab Attempt",
      new_window: "New Window Attempt",
      refresh: "Refresh Attempt",
      warning: "General Warning",
      auto_submit: "Auto-Submit",
    };
    return labels[type] || type;
  };

  const uniqueStudents = Array.from(
    new Set(logs.map((log) => log.student?._id))
  ).map((id) => {
    const log = logs.find((l) => l.student?._id === id);
    return { id, name: log?.student?.name || "Unknown" };
  });

  const filteredLogs =
    selectedStudent === "all"
      ? logs
      : logs.filter((log) => log.student?._id === selectedStudent);

  const violationSummary = logs.reduce((acc, log) => {
    acc[log.eventType] = (acc[log.eventType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Proctoring Logs</h2>
          <p className="text-sm text-slate-600">
            View all violations and monitoring events for this test
          </p>
        </div>
        <Button onClick={fetchLogs} disabled={loading} size="sm">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-sm text-slate-600">Total Events</div>
          <div className="text-2xl font-bold text-slate-800">{logs.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-slate-600">Critical Violations</div>
          <div className="text-2xl font-bold text-red-600">
            {(violationSummary.tab_switch || 0) + (violationSummary.window_blur || 0)}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-slate-600">Students Monitored</div>
          <div className="text-2xl font-bold text-slate-800">
            {uniqueStudents.length}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-slate-600">Auto-Submits</div>
          <div className="text-2xl font-bold text-orange-600">
            {violationSummary.auto_submit || 0}
          </div>
        </Card>
      </div>

      {/* Filter */}
      <Card className="p-4">
        <div className="flex items-center gap-4">
          <User className="w-5 h-5 text-slate-600" />
          <select
            value={selectedStudent}
            onChange={(e) => setSelectedStudent(e.target.value)}
            className="flex-1 px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Students ({logs.length} events)</option>
            {uniqueStudents.map((student) => (
              <option key={student.id} value={student.id}>
                {student.name} (
                {logs.filter((l) => l.student?._id === student.id).length} events)
              </option>
            ))}
          </select>
        </div>
      </Card>

      {/* Logs List */}
      {loading && (
        <div className="text-center py-8 text-slate-600">Loading logs...</div>
      )}

      {error && (
        <div className="text-center py-8 text-red-600">{error}</div>
      )}

      {!loading && !error && filteredLogs.length === 0 && (
        <Card className="p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <p className="text-slate-600">No proctoring events recorded yet.</p>
        </Card>
      )}

      {!loading && !error && filteredLogs.length > 0 && (
        <div className="space-y-3">
          {filteredLogs.map((log) => (
            <Card key={log._id} className="p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 mt-1">{getViolationIcon(log.eventType)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-slate-800">
                          {getViolationLabel(log.eventType)}
                        </h3>
                        {getSeverityBadge(log.eventType)}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-slate-600">
                        <div className="flex items-center gap-1">
                          <User className="w-4 h-4" />
                          {log.student?.name || "Unknown"}
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {new Date(log.createdAt).toLocaleDateString()}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {new Date(log.createdAt).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  </div>
                  {log.eventData && (
                    <div className="text-sm text-slate-600 bg-slate-50 p-3 rounded-md">
                      <strong>Details:</strong> {log.eventData.details || JSON.stringify(log.eventData)}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

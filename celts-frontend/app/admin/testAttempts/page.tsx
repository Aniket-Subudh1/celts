"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { navItems } from "@/components/admin/NavItems";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, CheckCircle, XCircle, Clock, RotateCcw, Search, Filter, RefreshCw } from "lucide-react";
import api from "@/lib/api";
import { toast } from "sonner";

// Add debounce hook
function useDebounce(value: string, delay: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

interface TestAttempt {
  _id: string;
  student: {
    _id: string;
    name: string;
    email: string;
    systemId?: string;
  };
  testSet: {
    _id: string;
    title: string;
    type: string;
  };
  attemptNumber: number;
  status: 'started' | 'completed' | 'abandoned' | 'violation_exit';
  startedAt: string;
  completedAt?: string;
  exitReason?: string;
  violations: Array<{
    type: string;
    timestamp: string;
    details: string;
  }>;
  isRetryAllowed: boolean;
  retryAllowedBy?: {
    name: string;
    email: string;
  };
  retryAllowedAt?: string;
  retryReason?: string;
  createdAt: string;
}

interface Pagination {
  current: number;
  total: number;
  count: number;
}

export default function TestAttemptsPage() {
  const [attempts, setAttempts] = useState<TestAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<Pagination>({ current: 1, total: 1, count: 0 });
  const [filters, setFilters] = useState({
    studentId: '',
    testId: '',
    status: '',
    page: 1
  });
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300); // Debounce search
  const [retryDialog, setRetryDialog] = useState<{ open: boolean; attempt: TestAttempt | null }>({
    open: false,
    attempt: null
  });
  const [retryReason, setRetryReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchAttempts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters.studentId) params.append('studentId', filters.studentId);
      if (filters.testId) params.append('testId', filters.testId);
      if (filters.status) params.append('status', filters.status);
      params.append('page', filters.page.toString());
      params.append('limit', '20');

      const res = await api.apiGet(`/admin/test-attempts?${params.toString()}`);
      if (res.ok) {
        setAttempts(res.data.attempts);
        setPagination(res.data.pagination);
      } else {
        const errorMsg = res.error?.message || 'Unknown error';
        setError(errorMsg);
        toast.error('Failed to fetch test attempts', {
          description: errorMsg
        });
      }
    } catch (error) {
      console.error('Error fetching attempts:', error);
      const errorMsg = 'Failed to fetch test attempts';
      setError(errorMsg);
      toast.error('Network error', { description: errorMsg });
    } finally {
      setLoading(false);
    }
  }, [filters]); // Only depend on filters

  useEffect(() => {
    fetchAttempts();
  }, [fetchAttempts]);

  // Memoize filtered attempts to prevent unnecessary recalculations
  const filteredAttempts = useMemo(() => {
    if (!debouncedSearchTerm) return attempts;
    
    const searchLower = debouncedSearchTerm.toLowerCase();
    return attempts.filter(attempt =>
      attempt.student.name.toLowerCase().includes(searchLower) ||
      attempt.student.email.toLowerCase().includes(searchLower) ||
      attempt.testSet.title.toLowerCase().includes(searchLower)
    );
  }, [attempts, debouncedSearchTerm]);

  // Memoize statistics to prevent recalculation on every render
  const statistics = useMemo(() => ({
    active: attempts.filter(a => a.status === 'started').length,
    completed: attempts.filter(a => a.status === 'completed').length,
    violations: attempts.filter(a => a.status === 'violation_exit').length,
    retryAllowed: attempts.filter(a => a.isRetryAllowed).length
  }), [attempts]);

  const getStatusBadge = useCallback((status: TestAttempt['status']) => {
    const variants = {
      started: { variant: 'outline' as const, icon: Clock, color: 'blue' },
      completed: { variant: 'default' as const, icon: CheckCircle, color: 'green' },
      abandoned: { variant: 'secondary' as const, icon: XCircle, color: 'gray' },
      violation_exit: { variant: 'destructive' as const, icon: AlertTriangle, color: 'red' }
    };
    
    const config = variants[status];
    const Icon = config.icon;
    
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="w-3 h-3" />
        {status.replace('_', ' ')}
      </Badge>
    );
  }, []);

  const handleAllowRetry = async () => {
    if (!retryDialog.attempt || !retryReason.trim()) {
      toast.error('Please provide a reason for allowing retry');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.apiPost('/admin/allow-retry', {
        studentId: retryDialog.attempt.student._id,
        testId: retryDialog.attempt.testSet._id,
        reason: retryReason
      });

      if (res.ok) {
        toast.success('Retry permission granted');
        setRetryDialog({ open: false, attempt: null });
        setRetryReason('');
        fetchAttempts(); // Refresh the list
      } else {
        toast.error('Failed to allow retry', {
          description: res.error?.message || 'Unknown error'
        });
      }
    } catch (error) {
      console.error('Error allowing retry:', error);
      toast.error('Network error', { description: 'Failed to allow retry' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevokeRetry = async (attempt: TestAttempt) => {
    if (!confirm('Are you sure you want to revoke retry permission?')) return;

    try {
      const res = await api.apiPost('/admin/revoke-retry', {
        studentId: attempt.student._id,
        testId: attempt.testSet._id
      });

      if (res.ok) {
        toast.success('Retry permission revoked');
        fetchAttempts();
      } else {
        toast.error('Failed to revoke retry', {
          description: res.error?.message || 'Unknown error'
        });
      }
    } catch (error) {
      console.error('Error revoking retry:', error);
      toast.error('Network error', { description: 'Failed to revoke retry' });
    }
  };

  return (
    <DashboardLayout navItems={navItems} sidebarHeader="Admin Panel">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Test Attempts Management</h1>
          <div className="flex items-center gap-3">
            <Button 
              onClick={fetchAttempts}
              disabled={loading}
              variant="outline"
              size="sm"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card className="p-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Filters & Search
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Search Students/Tests</label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search by name, email, or test title"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <Select value={filters.status} onValueChange={(value: string) => setFilters(prev => ({ ...prev, status: value, page: 1 }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Statuses</SelectItem>
                    <SelectItem value="started">Started</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="abandoned">Abandoned</SelectItem>
                    <SelectItem value="violation_exit">Violation Exit</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <Button 
                  onClick={() => setFilters({ studentId: '', testId: '', status: '', page: 1 })}
                  variant="outline"
                >
                  Clear Filters
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Clock className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Active</p>
                <p className="text-2xl font-bold">
                  {statistics.active}
                </p>
              </div>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Completed</p>
                <p className="text-2xl font-bold">
                  {statistics.completed}
                </p>
              </div>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Violations</p>
                <p className="text-2xl font-bold">
                  {statistics.violations}
                </p>
              </div>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <RotateCcw className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Retry Allowed</p>
                <p className="text-2xl font-bold">
                  {statistics.retryAllowed}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Attempts Table */}
        <Card className="overflow-hidden">
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4">Test Attempts</h3>
            
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-8 space-y-4">
                <AlertTriangle className="w-12 h-12 text-red-500" />
                <div className="text-center">
                  <p className="text-lg font-medium text-gray-900">Failed to load test attempts</p>
                  <p className="text-sm text-gray-500 mt-1">{error}</p>
                  <Button 
                    className="mt-4"
                    onClick={fetchAttempts}
                    variant="outline"
                  >
                    Try Again
                  </Button>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <div className="min-w-[800px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[200px]">Student</TableHead>
                        <TableHead className="min-w-[150px]">Test</TableHead>
                        <TableHead>Attempt #</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="min-w-[120px]">Started</TableHead>
                        <TableHead>Violations</TableHead>
                        <TableHead className="min-w-[120px]">Retry Status</TableHead>
                        <TableHead className="min-w-[140px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                  <TableBody>
                    {filteredAttempts.map((attempt) => (
                      <TableRow key={attempt._id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{attempt.student.name}</div>
                            <div className="text-sm text-gray-500">{attempt.student.email}</div>
                            {attempt.student.systemId && (
                              <div className="text-xs text-gray-400">ID: {attempt.student.systemId}</div>
                            )}
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          <div>
                            <div className="font-medium">{attempt.testSet.title}</div>
                            <div className="text-sm text-gray-500 capitalize">{attempt.testSet.type}</div>
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          <Badge variant="outline">#{attempt.attemptNumber}</Badge>
                        </TableCell>
                        
                        <TableCell>
                          {getStatusBadge(attempt.status)}
                          {attempt.exitReason && (
                            <div className="text-xs text-gray-500 mt-1">{attempt.exitReason}</div>
                          )}
                        </TableCell>
                        
                        <TableCell>
                          <div className="text-sm">
                            {new Date(attempt.startedAt).toLocaleDateString()}
                          </div>
                          <div className="text-xs text-gray-500">
                            {new Date(attempt.startedAt).toLocaleTimeString()}
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {attempt.violations.length > 0 ? (
                              <Badge variant="destructive">{attempt.violations.length}</Badge>
                            ) : (
                              <Badge variant="outline">0</Badge>
                            )}
                            {attempt.violations.length > 0 && (
                              <details className="text-xs">
                                <summary className="cursor-pointer text-blue-600">View</summary>
                                <div className="mt-2 space-y-1 p-2 bg-gray-50 rounded">
                                  {attempt.violations.slice(0, 3).map((violation, i) => (
                                    <div key={i} className="text-xs">
                                      <span className="font-medium">{violation.type}:</span> {violation.details}
                                    </div>
                                  ))}
                                  {attempt.violations.length > 3 && (
                                    <div className="text-xs text-gray-500">
                                      +{attempt.violations.length - 3} more
                                    </div>
                                  )}
                                </div>
                              </details>
                            )}
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          {attempt.isRetryAllowed ? (
                            <div>
                              <Badge className="bg-green-100 text-green-800">Allowed</Badge>
                              {attempt.retryAllowedBy && (
                                <div className="text-xs text-gray-500 mt-1">
                                  By: {attempt.retryAllowedBy.name}
                                </div>
                              )}
                            </div>
                          ) : (
                            <Badge variant="outline">Not Allowed</Badge>
                          )}
                        </TableCell>
                        
                        <TableCell>
                          <div className="flex gap-2">
                            {!attempt.isRetryAllowed && attempt.status !== 'started' ? (
                              <Button
                                size="sm"
                                onClick={() => setRetryDialog({ open: true, attempt })}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                <RotateCcw className="w-4 h-4 mr-1" />
                                Allow Retry
                              </Button>
                            ) : attempt.isRetryAllowed ? (
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleRevokeRetry(attempt)}
                              >
                                Revoke Retry
                              </Button>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    </TableBody>
                  </Table>
                </div>                {filteredAttempts.length === 0 && !loading && !error && (
                  <div className="text-center py-12">
                    <div className="flex flex-col items-center space-y-3">
                      <Clock className="w-12 h-12 text-gray-300" />
                      <div>
                        <p className="text-lg font-medium text-gray-900">No test attempts found</p>
                        <p className="text-sm text-gray-500">No attempts match your current search criteria.</p>
                      </div>
                      {(searchTerm || filters.status) && (
                        <Button 
                          variant="outline" 
                          onClick={() => {
                            setSearchTerm('');
                            setFilters({ studentId: '', testId: '', status: '', page: 1 });
                          }}
                        >
                          Clear filters
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Pagination */}
            {pagination.total > 1 && (
              <div className="flex justify-between items-center mt-6">
                <div className="text-sm text-gray-500">
                  Showing {Math.min(20, pagination.count)} of {pagination.count} attempts
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pagination.current === 1}
                    onClick={() => setFilters(prev => ({ ...prev, page: prev.page - 1 }))}
                  >
                    Previous
                  </Button>
                  <span className="px-3 py-2 text-sm">
                    Page {pagination.current} of {pagination.total}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pagination.current === pagination.total}
                    onClick={() => setFilters(prev => ({ ...prev, page: prev.page + 1 }))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Allow Retry Dialog */}
        <Dialog 
          open={retryDialog.open} 
          onOpenChange={(open: boolean) => {
            if (!open) {
              setRetryDialog({ open: false, attempt: null });
              setRetryReason('');
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Allow Test Retry</DialogTitle>
              <DialogDescription>
                Allow {retryDialog.attempt?.student.name} to retake "{retryDialog.attempt?.testSet.title}"
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label htmlFor="reason" className="text-sm font-medium">
                  Reason for allowing retry *
                </label>
                <Textarea
                  id="reason"
                  placeholder="Explain why this student should be allowed to retake the test..."
                  value={retryReason}
                  onChange={(e) => setRetryReason(e.target.value)}
                  className="min-h-[100px]"
                />
              </div>
              
              <div className="flex justify-end gap-3">
                <Button 
                  variant="outline" 
                  onClick={() => setRetryDialog({ open: false, attempt: null })}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleAllowRetry}
                  disabled={submitting || !retryReason.trim()}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {submitting ? 'Processing...' : 'Allow Retry'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
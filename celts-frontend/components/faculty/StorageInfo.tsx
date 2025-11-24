"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import api from "@/lib/api";
import { Cloud, HardDrive, Info } from "lucide-react";
import ErrorBoundary from "@/components/common/ErrorBoundary";

interface StorageConfig {
  storageProvider: 'S3' | 'Local';
  description: string;
  bucketName?: string;
  region?: string;
}

export function StorageInfo() {
  const [config, setConfig] = useState<StorageConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchConfig() {
      try {
        const response = await api.apiGet('/media/config');
        if (response.ok) {
          setConfig(response.data);
        }
      } catch (error) {
        console.error('Failed to fetch storage config:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchConfig();
  }, []);

  const StorageInfoContent = () => {
    if (loading) {
      return (
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Loading storage info...</div>
          </CardContent>
        </Card>
      );
    }

    if (!config) {
      return null;
    }

    const isS3 = config.storageProvider === 'S3';

    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Info className="h-4 w-4" />
            Audio Storage
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            {isS3 ? (
              <Cloud className="h-5 w-5 text-blue-600" />
            ) : (
              <HardDrive className="h-5 w-5 text-gray-600" />
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{config.description}</span>
                <Badge variant={isS3 ? "default" : "secondary"}>
                  {config.storageProvider}
                </Badge>
              </div>
              {isS3 && config.bucketName && (
                <div className="text-xs text-muted-foreground mt-1">
                  Bucket: {config.bucketName} • Region: {config.region}
                </div>
              )}
            </div>
          </div>
          <div className="mt-3 text-xs text-muted-foreground">
            {isS3 
              ? "Audio files are stored in Amazon S3 for better performance and reliability."
              : "Audio files are stored on the local server. Consider configuring S3 for better performance."
            }
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <ErrorBoundary>
      <StorageInfoContent />
    </ErrorBoundary>
  );
}
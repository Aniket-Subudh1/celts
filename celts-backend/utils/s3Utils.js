// utils/s3Utils.js

/**
 * Utility functions for S3 integration
 */

/**
 * Check if a given URL is an S3 URL
 * @param {string} url - The URL to check
 * @returns {boolean} - True if it's an S3 URL
 */
function isS3Url(url) {
  if (!url || typeof url !== 'string') return false;
  
  return (
    url.includes('amazonaws.com') ||
    url.includes('s3.') ||
    url.includes('.s3.')
  );
}

/**
 * Extract bucket name from S3 URL
 * @param {string} s3Url - The S3 URL
 * @returns {string|null} - Bucket name or null if not a valid S3 URL
 */
function extractBucketName(s3Url) {
  if (!isS3Url(s3Url)) return null;
  
  try {
    const url = new URL(s3Url);
    const hostname = url.hostname;
    
    // Pattern: bucket-name.s3.region.amazonaws.com
    if (hostname.includes('.s3.') && hostname.includes('.amazonaws.com')) {
      return hostname.split('.s3.')[0];
    }
    
    // Pattern: s3.region.amazonaws.com/bucket-name
    if (hostname.includes('s3.') && hostname.includes('.amazonaws.com')) {
      const pathParts = url.pathname.split('/').filter(Boolean);
      return pathParts[0] || null;
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Extract S3 key from S3 URL
 * @param {string} s3Url - The S3 URL
 * @returns {string|null} - S3 key or null if not a valid S3 URL
 */
function extractS3Key(s3Url) {
  if (!isS3Url(s3Url)) return null;
  
  try {
    const url = new URL(s3Url);
    const hostname = url.hostname;
    
    // Pattern: bucket-name.s3.region.amazonaws.com/key
    if (hostname.includes('.s3.') && hostname.includes('.amazonaws.com')) {
      return url.pathname.substring(1); // Remove leading slash
    }
    
    // Pattern: s3.region.amazonaws.com/bucket-name/key
    if (hostname.includes('s3.') && hostname.includes('.amazonaws.com')) {
      const pathParts = url.pathname.split('/').filter(Boolean);
      return pathParts.slice(1).join('/'); // Skip bucket name
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Generate a display name for storage provider
 * @param {string} url - The file URL
 * @returns {string} - Human-readable storage provider name
 */
function getStorageProvider(url) {
  if (isS3Url(url)) {
    return 'Amazon S3 (Cloud)';
  }
  return 'Local Server';
}

module.exports = {
  isS3Url,
  extractBucketName,
  extractS3Key,
  getStorageProvider
};
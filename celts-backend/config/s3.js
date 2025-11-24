const AWS = require('aws-sdk');

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1'
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'celts-audio-files';

async function uploadToS3(fileBuffer, fileName, mimeType, folder = 'audio') {
  const key = `${folder}/${Date.now()}-${fileName}`;
  
  const params = {
    Bucket: BUCKET_NAME,
    Key: key,
    Body: fileBuffer,
    ContentType: mimeType,
    ACL: 'public-read' 
  };

  try {
    const result = await s3.upload(params).promise();
    console.log('File uploaded successfully to S3:', result.Location);
    return result.Location;
  } catch (error) {
    console.error('Error uploading file to S3:', error);
    throw new Error('Failed to upload file to S3');
  }
}


async function deleteFromS3(s3Url) {
  try {
    // Extract key from S3 URL
    const urlParts = s3Url.split('/');
    const bucketIndex = urlParts.findIndex(part => part.includes(BUCKET_NAME));
    if (bucketIndex === -1) {
      throw new Error('Invalid S3 URL');
    }
    
    const key = urlParts.slice(bucketIndex + 1).join('/');
    
    const params = {
      Bucket: BUCKET_NAME,
      Key: key
    };

    await s3.deleteObject(params).promise();
    console.log('File deleted successfully from S3:', key);
  } catch (error) {
    console.error('Error deleting file from S3:', error);
    throw new Error('Failed to delete file from S3');
  }
}


async function getSignedUrl(s3Key, expiresIn = 3600) {
  const params = {
    Bucket: BUCKET_NAME,
    Key: s3Key,
    Expires: expiresIn
  };

  try {
    const url = await s3.getSignedUrlPromise('getObject', params);
    return url;
  } catch (error) {
    console.error('Error generating signed URL:', error);
    throw new Error('Failed to generate signed URL');
  }
}

module.exports = {
  uploadToS3,
  deleteFromS3,
  getSignedUrl,
  BUCKET_NAME,
  isS3Configured
};
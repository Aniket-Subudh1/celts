const corsConfiguration = {
  "CORSRules": [
    {
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["GET", "HEAD"],
      "AllowedOrigins": ["*"],
      "ExposeHeaders": ["ETag", "x-amz-meta-custom-header"],
      "MaxAgeSeconds": 3000
    }
  ]
};

const bucketPolicy = {
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::YOUR-BUCKET-NAME/*"
    }
  ]
};

console.log('=== S3 Bucket CORS Configuration ===');
console.log('Apply this CORS configuration to your S3 bucket:');
console.log(JSON.stringify(corsConfiguration, null, 2));
console.log();
console.log('=== S3 Bucket Policy ===');
console.log('Apply this policy to your S3 bucket (replace YOUR-BUCKET-NAME):');
console.log(JSON.stringify(bucketPolicy, null, 2));

module.exports = {
  corsConfiguration,
  bucketPolicy
};
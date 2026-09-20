# ui

Tempvs UI

The UI uses Cognito through the same-origin authentication edge. Google and email/password sign-in, registration, session refresh, and logout are supported by the AWS deployment at `dev.tempvs.club`.

The manual [AWS UI deployment workflow](.github/workflows/deploy-aws-dev.yml) builds and tests the selected ref, archives the build in a private versioned S3 bucket, publishes to CloudFront, and supports restoring an archived commit SHA. It requires the `dev` GitHub environment variables `AWS_DEPLOY_ROLE_ARN`, `WEB_BUCKET_NAME`, and `CLOUDFRONT_DISTRIBUTION_ID` from the `tempvs-dev-web` CloudFormation outputs.

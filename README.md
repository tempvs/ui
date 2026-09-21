# ui

Tempvs UI

The current UI still uses legacy user authentication through the old Gateway. Cognito Google and email/password sign-in have been verified only on the separate dark auth edge; the UI has **not** switched to Cognito. Do not treat a successful static build as an application cutover.

The manual [dark AWS UI deployment workflow](.github/workflows/deploy-aws-dev.yml) builds and tests the selected ref, archives the build in a private versioned S3 bucket, publishes to CloudFront, and supports restoring an archived commit SHA. It requires the `dev` GitHub environment variables `AWS_DEPLOY_ROLE_ARN`, `WEB_BUCKET_NAME`, and `CLOUDFRONT_DISTRIBUTION_ID` from the `tempvs-dev-web` CloudFormation outputs. No static AWS deployment changes `dev.tempvs.club` or stops the existing Render deployment. Sign-in and most API routes will not work on the generated CloudFront hostname until the same-origin edge and domain cutover are implemented.

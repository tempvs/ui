# ui

Tempvs UI

The UI uses Cognito through the same-origin authentication edge. Google and email/password sign-in, registration, session refresh, and logout are supported by the AWS deployment at `dev.tempvs.club`.

The [AWS UI deployment workflow](.github/workflows/deploy-aws-dev.yml) runs automatically for `master`: its `build` job tests, type-checks, builds, and uploads an artifact; its separate `deploy` job downloads that artifact, archives it in a private versioned S3 bucket, publishes it to CloudFront, and supports restoring an archived commit SHA when run manually. It requires the `dev` GitHub environment variables `AWS_DEPLOY_ROLE_ARN`, `WEB_BUCKET_NAME`, and `CLOUDFRONT_DISTRIBUTION_ID` from the `tempvs-dev-web` CloudFormation outputs.

The UI's AWS infrastructure is intentionally kept in the separate [`aws-infrastructure.cdk`](../aws-infrastructure.cdk) repository, in `WebStack`. The UI workflow does not run CDK; it deploys assets only after that stack has provisioned the bucket, distribution, and scoped GitHub OIDC role.

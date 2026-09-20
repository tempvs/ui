# ui

Tempvs UI

Google-only User migration is prepared behind the build-time `REACT_APP_GOOGLE_ONLY_AUTH` flag. The default is `false` while the current User service is live. After the User DynamoDB import and Gateway/Library cutover pass acceptance, set the GitHub repository variable `REACT_APP_GOOGLE_ONLY_AUTH=true` and deploy the UI build to hide email/password forms, the registration route, and old User/Email Render warmups. Do not set this flag during the dark API deployment.

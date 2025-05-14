# E-Commerce Portfolio Project

This portfolio project demonstrates a comprehensive e-commerce system built with modern patterns and best practices. The architecture showcases scalable cloud-native design, microservices, and industry-standard e-commerce patterns.

## Project Features

### ✅ Infrastructure Setup & Deployment Pipeline
- ✅ Local development environment with podman
- ✅ AWS CDK infrastructure project setup
- ✅ Github Actions Pipeline setup 
  - ✅ VPC and ECS infrastructure
  - ✅ Build and publish API image
  - ✅ Deployment ECS Go API service with CodeDeploy
    - ✅ Blue/Green deployment configured
    - ✅ 5XX error monitoring and automated rollbacks
  - [ ] Build and deploy Next.js frontend

### ⬜ User Authentication
- [ ] Cognito user pools configuration
- [ ] Workflow to create or delete accounts
- [ ] Custom JWT token handling w/ authz claims
- [ ] Social login integration
- [ ] Token refresh mechanism
- [ ] Auth middleware for API validating authn and verifying permissions

### ⬜ User Profile
- [ ] View and edit user profile
  - [ ] Upload profile image
  - [ ] Change user profile details

### ⬜ Product Catalog
- [ ] RDS PostgreSQL for product data
- [ ] View and Edit Product details
- [ ] S3 for product images
- [ ] CloudFront for image delivery
- [ ] ElastiCache Redis for product caching

### ⬜ Search
- [ ] OpenSearch for product search
- [ ] ElastiCache Redis for caching search results
- [ ] Filter by product categories
- [ ] Outbox+SQS+Lambda for updating search indexes on product change

### ⬜ Shopping Cart
- [ ] DynamoDb for storing cart
- [ ] Add or remove items from cart
- [ ] Redis for cart session caching

### ⬜ Checkout & Payment
- [ ] Stripe API Gateway integration
- [ ] Payment webhook handling
- [ ] SQS for order processing

### ⬜ Order Management
- [ ] RDS PostgreSQL for order data
- [ ] SNS for order notifications
- [ ] Order lifecycle management (timed mock events)

### ⬜ Analytics & Personalization
- [ ] User behavior/Event tracking on user interactions
- [ ] Conversion funnel analytics
- [ ] A/B testing capability

## Getting Started

### Prerequisites
- Go 1.x
- Node.js and Yarn
- AWS CDK
- Docker/Podman

### Local Development
```bash
# Start the system locally
make reset

```

## Project Structure
```
portfolio-ecommerce-service/
├── api/                # Go API service
├── infrastructure/     # AWS CDK infrastructure code
```


#!/bin/bash
set -e

# Disable AWS CLI paging for the entire script
export AWS_PAGER=""

# Colors for prettier output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Script to perform a full deployment
echo -e "${BLUE}========================================================${NC}"
echo -e "${BLUE}      Portfolio E-commerce Full Deployment Script       ${NC}"
echo -e "${BLUE}========================================================${NC}"

# Determine environment
ENV=${1:-dev}
SKIP_INFRA=${2:-false}
SKIP_APP=${3:-false}

echo -e "${GREEN}Deploying for environment:${NC} ${YELLOW}$ENV${NC}"

if [ "$ENV" != "dev" ] && [ "$ENV" != "prod" ]; then
  echo -e "${RED}ERROR: Invalid environment. Use dev or prod.${NC}"
  exit 1
fi

# Get the directory of this script
SCRIPTS_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Step 1: Update infrastructure if not skipped
if [ "$SKIP_INFRA" != "true" ]; then
  echo -e "\n${BLUE}Step 1: Updating infrastructure...${NC}"
  $SCRIPTS_DIR/infra-update.sh $ENV
else
  echo -e "\n${YELLOW}Skipping infrastructure update as requested.${NC}"
fi

# Step 2: Build and publish app if not skipped
if [ "$SKIP_APP" != "true" ]; then
  echo -e "\n${BLUE}Step 2: Building and publishing app...${NC}"
  $SCRIPTS_DIR/app-build-publish.sh $ENV
else
  echo -e "\n${YELLOW}Skipping app build and publish as requested.${NC}"
fi

# Step 3: Update ECS service to use the latest image
if [ "$SKIP_APP" != "true" ]; then
  echo -e "\n${BLUE}Step 3: Updating ECS service...${NC}"
  AWS_REGION=${AWS_REGION:-us-east-1}
  
  aws --no-cli-pager ecs update-service \
    --cluster portfolio-ecommerce-cluster \
    --service portfolio-ecommerce-web \
    --force-new-deployment \
    --region $AWS_REGION
    
  echo -e "${GREEN}✓ ECS service update initiated.${NC}"
else
  echo -e "\n${YELLOW}Skipping ECS service update as app build was skipped.${NC}"
fi

echo -e "\n${GREEN}=== Full deployment process completed! ===${NC}"
echo -e "${GREEN}Environment:${NC} ${YELLOW}$ENV${NC}"
echo -e "\n${BLUE}To monitor the deployment status:${NC}"
echo -e "aws ecs describe-services --cluster portfolio-ecommerce-cluster --services portfolio-ecommerce-web --region $AWS_REGION --query 'services[0].deployments'"

#!/bin/bash
set -e

# Colors for prettier output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Script to locally build and publish the app similar to the CI/CD pipeline
echo -e "${BLUE}========================================================${NC}"
echo -e "${BLUE}    Portfolio E-commerce App Build & Publish Script     ${NC}"
echo -e "${BLUE}========================================================${NC}"

# Determine environment
ENV=${1:-dev}
echo -e "${GREEN}Building for environment:${NC} ${YELLOW}$ENV${NC}"

# ECR repository details
AWS_REGION=${AWS_REGION:-us-east-1}
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

if [ -z "$AWS_ACCOUNT_ID" ]; then
  echo -e "${RED}ERROR: Failed to get AWS account ID. Make sure you're logged in to AWS CLI.${NC}"
  exit 1
fi

# Repository names
if [ "$ENV" == "dev" ]; then
  ACCOUNT_ID=427566522857
elif [ "$ENV" == "prod" ]; then
  ACCOUNT_ID=914847526688
else
  echo -e "${RED}ERROR: Invalid environment. Use dev or prod.${NC}"
  exit 1
fi

WEB_ECR_REPO=portfolio-ecommerce-web
IMAGE_TAG=$(date +%Y%m%d%H%M%S)

echo -e "${GREEN}AWS Account ID:${NC} ${YELLOW}$ACCOUNT_ID${NC}"
echo -e "${GREEN}Repository:${NC} ${YELLOW}$WEB_ECR_REPO${NC}"
echo -e "${GREEN}Image Tag:${NC} ${YELLOW}$IMAGE_TAG${NC}"

# Function to check for docker
check_docker() {
  if ! command -v docker &> /dev/null; then
    echo -e "${RED}Docker is not installed or not in PATH. Please install Docker first.${NC}"
    exit 1
  fi
  
  if ! docker info &> /dev/null; then
    echo -e "${RED}Docker daemon is not running. Please start Docker first.${NC}"
    exit 1
  fi
}

# Step 1: Build Docker image
build_image() {
  echo -e "\n${BLUE}Step 1: Building Docker image...${NC}"
  cd web
  # Build specifically for linux/amd64 platform to ensure compatibility with ECS
  docker build --platform linux/amd64 -t $WEB_ECR_REPO:$IMAGE_TAG .
  echo -e "${GREEN}✓ Docker image built successfully.${NC}"
}

# Step 2: Tag image for ECR
tag_image() {
  echo -e "\n${BLUE}Step 2: Tagging image for ECR...${NC}"
  docker tag $WEB_ECR_REPO:$IMAGE_TAG $ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$WEB_ECR_REPO:$IMAGE_TAG
  echo -e "${GREEN}✓ Docker image tagged successfully.${NC}"
}

# Step 3: Login to ECR
ecr_login() {
  echo -e "\n${BLUE}Step 3: Logging in to Amazon ECR...${NC}"
  aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com
  echo -e "${GREEN}✓ Successfully logged in to Amazon ECR.${NC}"
}

# Step 4: Push image to ECR
push_image() {
  echo -e "\n${BLUE}Step 4: Pushing image to Amazon ECR...${NC}"
  docker push $ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$WEB_ECR_REPO:$IMAGE_TAG
  echo -e "${GREEN}✓ Successfully pushed image to Amazon ECR.${NC}"
}

# Step 5: Update latest tag
update_latest_tag() {
  echo -e "\n${BLUE}Step 5: Updating latest tag...${NC}"
  docker tag $WEB_ECR_REPO:$IMAGE_TAG $ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$WEB_ECR_REPO:latest
  docker push $ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$WEB_ECR_REPO:latest
  echo -e "${GREEN}✓ Successfully updated latest tag.${NC}"
}

# Main execution
check_docker
build_image
tag_image
ecr_login
push_image
update_latest_tag

echo -e "\n${GREEN}=== Build and publish completed successfully! ===${NC}"
echo -e "${GREEN}Image:${NC} ${YELLOW}$ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$WEB_ECR_REPO:$IMAGE_TAG${NC}"
echo -e "${GREEN}Also tagged as:${NC} ${YELLOW}$ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$WEB_ECR_REPO:latest${NC}"
echo -e "\n${BLUE}To update your ECS service, run:${NC}"
echo -e "aws ecs update-service --cluster portfolio-ecommerce-cluster --service portfolio-ecommerce-web --force-new-deployment --region $AWS_REGION"
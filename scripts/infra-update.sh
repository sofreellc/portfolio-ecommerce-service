#!/bin/bash
set -e

# Colors for prettier output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Script to deploy infrastructure updates
echo -e "${BLUE}========================================================${NC}"
echo -e "${BLUE}   Portfolio E-commerce Infrastructure Update Script    ${NC}"
echo -e "${BLUE}========================================================${NC}"

# Determine environment
ENV=${1:-dev}
echo -e "${GREEN}Deploying for environment:${NC} ${YELLOW}$ENV${NC}"

if [ "$ENV" != "dev" ] && [ "$ENV" != "prod" ]; then
  echo -e "${RED}ERROR: Invalid environment. Use dev or prod.${NC}"
  exit 1
fi

# Deploy CDK infrastructure
deploy_infrastructure() {
  echo -e "\n${BLUE}Deploying infrastructure with CDK...${NC}"
  cd infrastructure
  
  echo -e "${YELLOW}Running yarn install...${NC}"
  yarn install
  
  echo -e "${YELLOW}Building TypeScript...${NC}"
  yarn build
  
  echo -e "${YELLOW}Deploying with CDK...${NC}"
  yarn cdk deploy --all --context targetEnv=$ENV --require-approval never
  
  echo -e "${GREEN}✓ Infrastructure deployment completed.${NC}"
}

# Main execution
deploy_infrastructure

echo -e "\n${GREEN}=== Infrastructure update completed successfully! ===${NC}"
echo -e "${GREEN}Environment:${NC} ${YELLOW}$ENV${NC}"
echo -e "\n${BLUE}To view your CloudFormation stacks:${NC}"
echo -e "aws cloudformation list-stacks --query 'StackSummaries[?contains(StackName, `portfolio-stage-$ENV`) && StackStatus!=`DELETE_COMPLETE`].StackName' --output table"
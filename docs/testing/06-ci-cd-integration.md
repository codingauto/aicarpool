# 阶段 6：CI/CD 集成指南

## 📋 本阶段目标

将测试集成到持续集成/持续部署流程中，实现自动化测试和质量门禁。

**预计时间**: 3-5天  
**前置要求**: 测试套件已完成

## 🔧 GitHub Actions 配置

### 主测试工作流

创建 `.github/workflows/test.yml`:

```yaml
name: Test Suite

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]
  schedule:
    # 每天凌晨2点运行
    - cron: '0 2 * * *'

env:
  NODE_VERSION: '20'
  MYSQL_VERSION: '8.0'
  REDIS_VERSION: '7'

jobs:
  # 代码质量检查
  lint:
    name: Lint and Type Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run ESLint
        run: npm run lint
      
      - name: Run TypeScript check
        run: npm run type-check
      
      - name: Check formatting
        run: npx prettier --check "src/**/*.{ts,tsx,js,jsx}"

  # 单元测试
  unit-tests:
    name: Unit Tests
    runs-on: ubuntu-latest
    needs: lint
    strategy:
      matrix:
        node-version: [18, 20]
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run unit tests
        run: npm run test:unit -- --coverage
      
      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage/lcov.info
          flags: unit
          name: unit-tests-node-${{ matrix.node-version }}
      
      - name: Archive test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: unit-test-results-${{ matrix.node-version }}
          path: |
            coverage/
            test-results/

  # 集成测试
  integration-tests:
    name: Integration Tests
    runs-on: ubuntu-latest
    needs: lint
    
    services:
      mysql:
        image: mysql:${{ env.MYSQL_VERSION }}
        env:
          MYSQL_ROOT_PASSWORD: root
          MYSQL_DATABASE: aicarpool_test
        ports:
          - 3306:3306
        options: >-
          --health-cmd="mysqladmin ping"
          --health-interval=10s
          --health-timeout=5s
          --health-retries=5
      
      redis:
        image: redis:${{ env.REDIS_VERSION }}
        ports:
          - 6379:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Wait for MySQL
        run: |
          until mysqladmin ping -h 127.0.0.1 -P 3306 --silent; do
            echo 'Waiting for MySQL...'
            sleep 2
          done
      
      - name: Setup test database
        env:
          DATABASE_URL: mysql://root:root@localhost:3306/aicarpool_test
        run: |
          npx prisma generate
          npx prisma migrate deploy
      
      - name: Run integration tests
        env:
          DATABASE_URL: mysql://root:root@localhost:3306/aicarpool_test
          REDIS_URL: redis://localhost:6379
          JWT_SECRET: test-secret-key
        run: npm run test:integration -- --coverage
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage/lcov.info
          flags: integration
          name: integration-tests

  # E2E测试
  e2e-tests:
    name: E2E Tests
    runs-on: ubuntu-latest
    needs: [unit-tests, integration-tests]
    
    strategy:
      matrix:
        browser: [chromium, firefox, webkit]
    
    services:
      mysql:
        image: mysql:8.0
        env:
          MYSQL_ROOT_PASSWORD: root
          MYSQL_DATABASE: aicarpool_e2e
        ports:
          - 3306:3306
        options: >-
          --health-cmd="mysqladmin ping"
          --health-interval=10s
          --health-timeout=5s
          --health-retries=5
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Install Playwright
        run: npx playwright install --with-deps ${{ matrix.browser }}
      
      - name: Setup database
        env:
          DATABASE_URL: mysql://root:root@localhost:3306/aicarpool_e2e
        run: |
          npx prisma generate
          npx prisma migrate deploy
          npx prisma db seed
      
      - name: Build application
        run: npm run build
      
      - name: Run E2E tests
        env:
          DATABASE_URL: mysql://root:root@localhost:3306/aicarpool_e2e
          REDIS_URL: redis://localhost:6379
        run: npx playwright test --project=${{ matrix.browser }}
      
      - name: Upload test report
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report-${{ matrix.browser }}
          path: playwright-report/
      
      - name: Upload test videos
        if: failure()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-videos-${{ matrix.browser }}
          path: test-results/

  # 性能测试（仅在主分支）
  performance-tests:
    name: Performance Tests
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    needs: [unit-tests, integration-tests]
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup k6
        run: |
          sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
          echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
          sudo apt-get update
          sudo apt-get install k6
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      
      - name: Install and build
        run: |
          npm ci
          npm run build
      
      - name: Start application
        env:
          DATABASE_URL: mysql://root:root@localhost:3306/aicarpool_test
          REDIS_URL: redis://localhost:6379
        run: |
          npm run start &
          npx wait-on http://localhost:3000 -t 60000
      
      - name: Run performance tests
        run: |
          k6 run k6-tests/scenarios/api-load.js --out json=performance-results.json
      
      - name: Upload performance results
        uses: actions/upload-artifact@v3
        with:
          name: performance-results
          path: performance-results.json
      
      - name: Comment PR with results
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v6
        with:
          script: |
            const fs = require('fs');
            const results = JSON.parse(fs.readFileSync('performance-results.json', 'utf8'));
            
            const comment = `## Performance Test Results
            
            - **Average Response Time**: ${results.metrics.http_req_duration.avg}ms
            - **P95 Response Time**: ${results.metrics.http_req_duration['p(95)']}ms
            - **Error Rate**: ${results.metrics.http_req_failed.rate * 100}%
            - **Throughput**: ${results.metrics.http_reqs.rate} req/s
            `;
            
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: comment
            });

  # 安全扫描
  security:
    name: Security Scan
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          scan-ref: '.'
          format: 'sarif'
          output: 'trivy-results.sarif'
      
      - name: Upload Trivy results to GitHub Security
        uses: github/codeql-action/upload-sarif@v2
        with:
          sarif_file: 'trivy-results.sarif'
      
      - name: Run npm audit
        run: npm audit --audit-level=moderate

  # 构建和发布
  build:
    name: Build and Push
    runs-on: ubuntu-latest
    needs: [unit-tests, integration-tests, e2e-tests, security]
    if: github.ref == 'refs/heads/main'
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build application
        run: npm run build
      
      - name: Build Docker image
        run: |
          docker build -t aicarpool:${{ github.sha }} .
          docker tag aicarpool:${{ github.sha }} aicarpool:latest
      
      - name: Login to Docker Hub
        if: success()
        uses: docker/login-action@v2
        with:
          username: ${{ secrets.DOCKER_USERNAME }}
          password: ${{ secrets.DOCKER_PASSWORD }}
      
      - name: Push Docker image
        if: success()
        run: |
          docker push aicarpool:${{ github.sha }}
          docker push aicarpool:latest
```

### PR 检查工作流

创建 `.github/workflows/pr-check.yml`:

```yaml
name: PR Validation

on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  # PR标题检查
  pr-title:
    name: Check PR Title
    runs-on: ubuntu-latest
    steps:
      - name: Check PR title format
        uses: amannn/action-semantic-pull-request@v5
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          types: |
            feat
            fix
            docs
            style
            refactor
            perf
            test
            build
            ci
            chore
            revert

  # 文件大小检查
  file-size:
    name: Check File Sizes
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Check for large files
        run: |
          find . -type f -size +1M | grep -v node_modules | grep -v .git > large_files.txt || true
          if [ -s large_files.txt ]; then
            echo "⚠️ Large files detected:"
            cat large_files.txt
            exit 1
          fi

  # 依赖检查
  dependencies:
    name: Check Dependencies
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Check for dependency changes
        run: |
          if git diff HEAD^ HEAD --name-only | grep -E "package(-lock)?\.json"; then
            echo "📦 Dependencies changed, running audit..."
            npm audit --audit-level=high
          fi

  # 测试覆盖率检查
  coverage-check:
    name: Coverage Requirements
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests with coverage
        run: npm run test:coverage
      
      - name: Check coverage thresholds
        run: |
          npx nyc check-coverage --lines 80 --functions 80 --branches 70
      
      - name: Generate coverage report comment
        if: github.event_name == 'pull_request'
        uses: romeovs/lcov-reporter-action@v0.3.1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          lcov-file: ./coverage/lcov.info
```

## 🚀 部署流程

### 生产部署工作流

创建 `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production

on:
  push:
    tags:
      - 'v*'
  workflow_dispatch:
    inputs:
      environment:
        description: 'Environment to deploy to'
        required: true
        default: 'staging'
        type: choice
        options:
          - staging
          - production

jobs:
  deploy:
    name: Deploy Application
    runs-on: ubuntu-latest
    environment: ${{ github.event.inputs.environment || 'production' }}
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup deployment
        run: |
          echo "Deploying to ${{ github.event.inputs.environment || 'production' }}"
      
      - name: Build and push Docker image
        env:
          DOCKER_REGISTRY: ${{ secrets.DOCKER_REGISTRY }}
        run: |
          docker build -t $DOCKER_REGISTRY/aicarpool:${{ github.sha }} .
          docker push $DOCKER_REGISTRY/aicarpool:${{ github.sha }}
      
      - name: Deploy to Kubernetes
        env:
          KUBE_CONFIG: ${{ secrets.KUBE_CONFIG }}
        run: |
          echo "$KUBE_CONFIG" | base64 -d > kubeconfig
          export KUBECONFIG=kubeconfig
          
          kubectl set image deployment/aicarpool \
            aicarpool=$DOCKER_REGISTRY/aicarpool:${{ github.sha }} \
            --namespace=${{ github.event.inputs.environment || 'production' }}
          
          kubectl rollout status deployment/aicarpool \
            --namespace=${{ github.event.inputs.environment || 'production' }}
      
      - name: Run smoke tests
        run: |
          npm run test:smoke -- --env=${{ github.event.inputs.environment || 'production' }}
      
      - name: Notify deployment
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          text: |
            Deployment to ${{ github.event.inputs.environment || 'production' }} ${{ job.status }}
            Commit: ${{ github.sha }}
            Author: ${{ github.actor }}
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

## 📊 测试报告和监控

### 测试报告生成

创建 `.github/workflows/test-report.yml`:

```yaml
name: Test Report

on:
  workflow_run:
    workflows: ["Test Suite"]
    types:
      - completed

jobs:
  report:
    name: Generate Test Report
    runs-on: ubuntu-latest
    if: github.event.workflow_run.conclusion == 'success'
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Download artifacts
        uses: actions/github-script@v6
        with:
          script: |
            const artifacts = await github.rest.actions.listWorkflowRunArtifacts({
              owner: context.repo.owner,
              repo: context.repo.repo,
              run_id: ${{ github.event.workflow_run.id }},
            });
            
            for (const artifact of artifacts.data.artifacts) {
              if (artifact.name.includes('test-results')) {
                const download = await github.rest.actions.downloadArtifact({
                  owner: context.repo.owner,
                  repo: context.repo.repo,
                  artifact_id: artifact.id,
                  archive_format: 'zip',
                });
                
                require('fs').writeFileSync(
                  `${artifact.name}.zip`,
                  Buffer.from(download.data)
                );
              }
            }
      
      - name: Generate HTML report
        run: |
          npm install -g jest-html-reporter
          jest-html-reporter --input=test-results.json --output=report.html
      
      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./reports
          destination_dir: test-reports/${{ github.run_number }}
```

## 🛡️ 质量门禁

### SonarQube 集成

创建 `sonar-project.properties`:

```properties
sonar.projectKey=aicarpool
sonar.organization=your-org
sonar.sources=src
sonar.tests=src/__tests__
sonar.javascript.lcov.reportPaths=coverage/lcov.info
sonar.coverage.exclusions=**/*.test.ts,**/*.spec.ts,**/__tests__/**
sonar.cpd.exclusions=**/*.test.ts,**/*.spec.ts
sonar.issue.ignore.multicriteria=e1
sonar.issue.ignore.multicriteria.e1.ruleKey=typescript:S125
sonar.issue.ignore.multicriteria.e1.resourceKey=**/*.ts
```

在工作流中添加 SonarQube 扫描：

```yaml
- name: SonarQube Scan
  uses: SonarSource/sonarcloud-github-action@master
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
```

## 🔄 自动化版本管理

### 语义化版本发布

创建 `.github/workflows/release.yml`:

```yaml
name: Release

on:
  push:
    branches:
      - main

jobs:
  release:
    name: Create Release
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run semantic-release
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
        run: npx semantic-release
```

创建 `.releaserc.json`:

```json
{
  "branches": ["main"],
  "plugins": [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    [
      "@semantic-release/changelog",
      {
        "changelogFile": "CHANGELOG.md"
      }
    ],
    "@semantic-release/npm",
    [
      "@semantic-release/github",
      {
        "assets": [
          "CHANGELOG.md",
          "package.json",
          "package-lock.json"
        ]
      }
    ],
    [
      "@semantic-release/git",
      {
        "assets": ["CHANGELOG.md", "package.json", "package-lock.json"],
        "message": "chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}"
      }
    ]
  ]
}
```

## 🔔 通知配置

### Slack 通知

创建 `.github/workflows/notify.yml`:

```yaml
name: Test Notifications

on:
  workflow_run:
    workflows: ["Test Suite"]
    types:
      - completed

jobs:
  notify:
    runs-on: ubuntu-latest
    steps:
      - name: Send Slack notification
        uses: 8398a7/action-slack@v3
        with:
          status: custom
          custom_payload: |
            {
              text: "Test Suite Results",
              blocks: [
                {
                  type: "section",
                  text: {
                    type: "mrkdwn",
                    text: "*Test Suite*: ${{ github.event.workflow_run.conclusion }}"
                  }
                },
                {
                  type: "section",
                  fields: [
                    {
                      type: "mrkdwn",
                      text: "*Branch:*\n${{ github.event.workflow_run.head_branch }}"
                    },
                    {
                      type: "mrkdwn",
                      text: "*Commit:*\n${{ github.event.workflow_run.head_sha }}"
                    }
                  ]
                },
                {
                  type: "actions",
                  elements: [
                    {
                      type: "button",
                      text: {
                        type: "plain_text",
                        text: "View Results"
                      },
                      url: "${{ github.event.workflow_run.html_url }}"
                    }
                  ]
                }
              ]
            }
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

## 📋 检查清单

- [ ] GitHub Actions工作流已配置
- [ ] 所有测试类型已集成
- [ ] 代码覆盖率报告已配置
- [ ] 安全扫描已启用
- [ ] 自动部署流程已设置
- [ ] 通知系统已配置

## 🎯 下一步

1. 🐛 查看[故障排查指南](./troubleshooting.md)
2. 📊 回顾[测试总览](./testing-overview.md)
3. 🚀 开始使用CI/CD流程

---

*CI/CD确保代码质量和部署可靠性。持续优化，提高效率！*
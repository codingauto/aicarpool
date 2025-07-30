# CentOS 8 部署指南

## TypeScript 严格模式兼容性

CentOS 8 环境下的 TypeScript 编译器使用更严格的类型检查。本项目已针对此环境进行了优化。

## 构建脚本

### 标准构建 (开发环境)
```bash
npm run build
```

### CentOS 8 兼容构建 (生产环境)
```bash
npm run build:centos
```

### 严格类型检查
```bash
npm run type-check:strict
```

## 已修复的类型问题

### 1. RadioGroup 类型兼容性
- 修复了 `onValueChange` 回调函数的联合类型问题
- 使用类型断言确保兼容性

### 2. Prisma 模型关系
- 修正了 `GroupAiService` 模型的关系引用
- 更新了所有相关的数据库查询

### 3. 类型断言优化
- 添加了 `unknown` 中间类型转换
- 修复了 AlertCondition 等复杂类型的转换

### 4. 环境变量访问
- 修复了 `process.env` 的索引访问问题
- 使用方括号访问语法确保兼容性

## TypeScript 配置

### 开发环境配置 (tsconfig.json)
- 启用严格模式但保持灵活性
- 适合日常开发使用

### 生产环境配置 (tsconfig.production.json)
- 专为 CentOS 8 等严格环境设计
- 禁用了可能导致构建失败的选项
- 保持代码质量的同时确保兼容性

## 部署建议

1. **在 CentOS 8 上构建时使用**：
   ```bash
   npm run build:centos
   ```

2. **类型检查**：
   ```bash
   npm run type-check:strict
   ```

3. **确保 Node.js 版本兼容**：
   - 推荐使用 Node.js 18+ 
   - TypeScript 4.9+

## 故障排除

如果仍然遇到类型错误：

1. 清理缓存：
   ```bash
   rm -rf .next
   rm -rf node_modules
   npm install
   ```

2. 使用严格构建：
   ```bash
   npm run build:centos
   ```

3. 检查 TypeScript 版本：
   ```bash
   npx tsc --version
   ```

## 版本历史

- v0.2.6: 全面修复 TypeScript 类型错误，CentOS 8 兼容性
- v0.2.5: 初步修复主要类型问题
- v0.2.4: 基础功能完善
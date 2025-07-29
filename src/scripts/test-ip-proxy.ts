/**
 * IP代理功能测试脚本
 * 用于验证IP代理管理的完整功能流程
 */

interface TestResult {
  testName: string;
  success: boolean;
  message: string;
  data?: any;
}

class IpProxyTester {
  private baseUrl: string;
  private token: string;
  private groupId: string;
  private testResults: TestResult[] = [];

  constructor(baseUrl: string, token: string, groupId: string) {
    this.baseUrl = baseUrl;
    this.token = token;
    this.groupId = groupId;
  }

  private async makeRequest(url: string, options: RequestInit = {}) {
    const response = await fetch(`${this.baseUrl}${url}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`,
        ...options.headers,
      },
    });

    const data = await response.json();
    return { response, data };
  }

  private addTestResult(testName: string, success: boolean, message: string, data?: any) {
    this.testResults.push({ testName, success, message, data });
    console.log(`${success ? '✅' : '❌'} ${testName}: ${message}`);
  }

  // 测试1: 创建IP代理配置
  async testCreateProxyConfig() {
    try {
      const proxyConfig = {
        name: '测试代理配置',
        description: '用于测试的IP代理配置',
        proxyType: 'http',
        host: 'proxy.example.com',
        port: 8080,
        username: 'testuser',
        password: 'testpass',
        location: '美国东部',
        maxConnections: 10,
        trafficLimit: 1024 // 1GB
      };

      const { response, data } = await this.makeRequest(
        `/api/groups/${this.groupId}/ip-proxy`,
        {
          method: 'POST',
          body: JSON.stringify(proxyConfig),
        }
      );

      if (data.success) {
        this.addTestResult('创建IP代理配置', true, '代理配置创建成功', data.data);
        return data.data;
      } else {
        this.addTestResult('创建IP代理配置', false, data.error || '创建失败');
        return null;
      }
    } catch (error) {
      this.addTestResult('创建IP代理配置', false, `网络错误: ${error.message}`);
      return null;
    }
  }

  // 测试2: 获取IP代理配置列表
  async testGetProxyConfigs() {
    try {
      const { response, data } = await this.makeRequest(`/api/groups/${this.groupId}/ip-proxy`);

      if (data.success) {
        this.addTestResult('获取代理配置列表', true, `成功获取${data.data.length}个代理配置`, data.data);
        return data.data;
      } else {
        this.addTestResult('获取代理配置列表', false, data.error || '获取失败');
        return [];
      }
    } catch (error) {
      this.addTestResult('获取代理配置列表', false, `网络错误: ${error.message}`);
      return [];
    }
  }

  // 测试3: 更新IP代理配置
  async testUpdateProxyConfig(proxyId: string) {
    try {
      const updateData = {
        name: '更新后的测试代理',
        description: '已更新的代理配置描述',
        maxConnections: 20,
        isEnabled: true
      };

      const { response, data } = await this.makeRequest(
        `/api/groups/${this.groupId}/ip-proxy/${proxyId}`,
        {
          method: 'PUT',
          body: JSON.stringify(updateData),
        }
      );

      if (data.success) {
        this.addTestResult('更新代理配置', true, '代理配置更新成功', data.data);
        return data.data;
      } else {
        this.addTestResult('更新代理配置', false, data.error || '更新失败');
        return null;
      }
    } catch (error) {
      this.addTestResult('更新代理配置', false, `网络错误: ${error.message}`);
      return null;
    }
  }

  // 测试4: 获取使用统计
  async testGetProxyStats(proxyId: string) {
    try {
      const { response, data } = await this.makeRequest(
        `/api/groups/${this.groupId}/ip-proxy/${proxyId}/stats?period=7d`
      );

      if (data.success) {
        this.addTestResult('获取使用统计', true, '统计数据获取成功', data.data);
        return data.data;
      } else {
        this.addTestResult('获取使用统计', false, data.error || '获取失败');
        return null;
      }
    } catch (error) {
      this.addTestResult('获取使用统计', false, `网络错误: ${error.message}`);
      return null;
    }
  }

  // 测试5: 获取同步状态
  async testGetSyncStatus(proxyId: string) {
    try {
      const { response, data } = await this.makeRequest(
        `/api/groups/${this.groupId}/ip-proxy/${proxyId}/sync`
      );

      if (data.success) {
        this.addTestResult('获取同步状态', true, '同步状态获取成功', data.data);
        return data.data;
      } else {
        this.addTestResult('获取同步状态', false, data.error || '获取失败');
        return null;
      }
    } catch (error) {
      this.addTestResult('获取同步状态', false, `网络错误: ${error.message}`);
      return null;
    }
  }

  // 测试6: 触发配置同步
  async testSyncConfig(proxyId: string) {
    try {
      const { response, data } = await this.makeRequest(
        `/api/groups/${this.groupId}/ip-proxy/${proxyId}/sync`,
        {
          method: 'POST',
          body: JSON.stringify({
            forceSync: false
          }),
        }
      );

      if (data.success) {
        this.addTestResult('配置同步', true, data.message || '配置同步成功', data.data);
        return data.data;
      } else {
        this.addTestResult('配置同步', false, data.error || '同步失败');
        return null;
      }
    } catch (error) {
      this.addTestResult('配置同步', false, `网络错误: ${error.message}`);
      return null;
    }
  }

  // 测试7: 获取实时监控数据
  async testGetMonitorData(proxyId: string) {
    try {
      const { response, data } = await this.makeRequest(
        `/api/groups/${this.groupId}/ip-proxy/${proxyId}/monitor`
      );

      if (data.success) {
        this.addTestResult('获取实时监控数据', true, '监控数据获取成功', data.data);
        return data.data;
      } else {
        this.addTestResult('获取实时监控数据', false, data.error || '获取失败');
        return null;
      }
    } catch (error) {
      this.addTestResult('获取实时监控数据', false, `网络错误: ${error.message}`);
      return null;
    }
  }

  // 测试8: 健康检查
  async testHealthCheck(proxyId: string) {
    try {
      const healthData = {
        action: 'health_check',
        healthCheckData: {
          isHealthy: true,
          responseTime: 150,
          errorMessage: null
        }
      };

      const { response, data } = await this.makeRequest(
        `/api/groups/${this.groupId}/ip-proxy/${proxyId}/monitor`,
        {
          method: 'POST',
          body: JSON.stringify(healthData),
        }
      );

      if (data.success) {
        this.addTestResult('健康检查', true, data.message || '健康检查成功', data.data);
        return data.data;
      } else {
        this.addTestResult('健康检查', false, data.error || '健康检查失败');
        return null;
      }
    } catch (error) {
      this.addTestResult('健康检查', false, `网络错误: ${error.message}`);
      return null;
    }
  }

  // 测试9: 删除IP代理配置
  async testDeleteProxyConfig(proxyId: string) {
    try {
      const { response, data } = await this.makeRequest(
        `/api/groups/${this.groupId}/ip-proxy/${proxyId}`,
        {
          method: 'DELETE',
        }
      );

      if (data.success) {
        this.addTestResult('删除代理配置', true, '代理配置删除成功');
        return true;
      } else {
        this.addTestResult('删除代理配置', false, data.error || '删除失败');
        return false;
      }
    } catch (error) {
      this.addTestResult('删除代理配置', false, `网络错误: ${error.message}`);
      return false;
    }
  }

  // 运行完整测试流程
  async runFullTest() {
    console.log('🚀 开始IP代理功能完整测试...\n');

    // 测试1: 创建代理配置
    const createdProxy = await this.testCreateProxyConfig();
    if (!createdProxy) {
      console.log('❌ 创建代理配置失败，终止测试');
      return this.getTestSummary();
    }

    const proxyId = createdProxy.id;

    // 测试2: 获取代理配置列表
    await this.testGetProxyConfigs();

    // 测试3: 更新代理配置
    await this.testUpdateProxyConfig(proxyId);

    // 测试4: 获取使用统计
    await this.testGetProxyStats(proxyId);

    // 测试5: 获取同步状态
    await this.testGetSyncStatus(proxyId);

    // 测试6: 触发配置同步
    await this.testSyncConfig(proxyId);

    // 测试7: 获取实时监控数据
    await this.testGetMonitorData(proxyId);

    // 测试8: 健康检查
    await this.testHealthCheck(proxyId);

    // 等待一段时间，让数据处理完成
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 测试9: 删除代理配置
    await this.testDeleteProxyConfig(proxyId);

    return this.getTestSummary();
  }

  // 获取测试摘要
  getTestSummary() {
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(r => r.success).length;
    const failedTests = totalTests - passedTests;

    const summary = {
      totalTests,
      passedTests,
      failedTests,
      successRate: Math.round((passedTests / totalTests) * 100),
      results: this.testResults
    };

    console.log('\n📊 测试摘要:');
    console.log(`总测试数: ${totalTests}`);
    console.log(`通过: ${passedTests}`);
    console.log(`失败: ${failedTests}`);
    console.log(`成功率: ${summary.successRate}%`);

    if (failedTests > 0) {
      console.log('\n❌ 失败的测试:');
      this.testResults
        .filter(r => !r.success)
        .forEach(r => console.log(`  - ${r.testName}: ${r.message}`));
    }

    return summary;
  }
}

// 导出测试类
export { IpProxyTester };

// 如果直接运行此脚本
if (typeof window === 'undefined' && require.main === module) {
  console.log('请在浏览器环境中运行此测试，或者通过测试页面调用');
}
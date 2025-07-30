const fetch = require('node-fetch');

async function testIpProxyAPI() {
  const baseUrl = 'http://localhost:4000';
  
  // 测试数据
  const testProxy = {
    name: '测试代理服务器',
    description: '用于测试的代理配置',
    proxyType: 'http',
    host: 'proxy.example.com',
    port: 8080,
    username: 'testuser',
    password: 'testpass',
    location: '美国东部',
    maxConnections: 10,
    trafficLimit: 0
  };

  try {
    // 需要一个有效的JWT token和groupId
    const token = 'your-jwt-token-here'; // 需要替换为真实token
    const groupId = 'your-group-id-here'; // 需要替换为真实group ID
    
    console.log('测试创建IP代理配置...');
    
    const response = await fetch(`${baseUrl}/api/groups/${groupId}/ip-proxy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(testProxy)
    });

    const result = await response.json();
    
    console.log('响应状态:', response.status);
    console.log('响应数据:', JSON.stringify(result, null, 2));
    
    if (result.success) {
      console.log('✅ IP代理创建成功!');
    } else {
      console.log('❌ IP代理创建失败:', result.error);
    }
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  console.log('⚠️  请先修改token和groupId后再运行测试');
  console.log('Usage: node test-ip-proxy.js');
}

module.exports = { testIpProxyAPI };
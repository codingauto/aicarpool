// 测试添加AI服务的调试脚本
// 使用浏览器控制台运行这个脚本来调试

async function testAddAiService() {
    const groupId = 'cmdfwngcn0002fy8xzh0ag8s'; // 从URL中获取
    const token = localStorage.getItem('token');
    
    if (!token) {
        console.error('❌ 未找到token，请先登录');
        return;
    }
    
    console.log('🔍 测试添加AI服务...');
    console.log('Group ID:', groupId);
    console.log('Token exists:', !!token);
    
    const payload = {
        aiServiceId: 'ampcode',
        isEnabled: true,
        priority: 1,
        quota: {
            dailyTokenLimit: 100000,
            monthlyTokenLimit: 3000000,
            dailyCostLimit: 10.0,
            monthlyCostLimit: 300.0,
        },
        authConfig: {
            apiKey: '',
        },
        proxySettings: {
            enableProxy: false,
            proxyType: 'none',
            routingStrategy: 'priority',
            failoverEnabled: true,
            healthCheckEnabled: true,
            priority: 1,
        },
    };
    
    console.log('📋 Payload:', payload);
    
    try {
        const response = await fetch(`/api/groups/${groupId}/ai-services/configure`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(payload)
        });
        
        console.log('📡 Response status:', response.status);
        console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()));
        
        const result = await response.json();
        console.log('📋 Response body:', result);
        
        if (result.success) {
            console.log('✅ AI服务添加成功!');
        } else {
            console.log('❌ AI服务添加失败:', result.error || result.message);
        }
        
    } catch (error) {
        console.error('❌ 网络请求失败:', error);
    }
}

// 导出函数，可以在浏览器控制台中调用 testAddAiService()
console.log('💡 请在浏览器控制台运行: testAddAiService()');
window.testAddAiService = testAddAiService;
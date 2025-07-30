// 检查当前token对应的用户
// 请在浏览器控制台中运行以下代码来检查当前用户权限

const jwt = require('jsonwebtoken');

function checkCurrentUser() {
    const token = localStorage.getItem('token');
    if (!token) {
        console.log('❌ 没有找到token');
        return;
    }
    
    try {
        // 注意：这只能解码header和payload，不能验证签名
        const decoded = jwt.decode(token);
        console.log('🔍 Token信息:', decoded);
        
        // 检查权限
        fetch('/api/user/profile', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })
        .then(response => response.json())
        .then(data => {
            console.log('👤 当前用户信息:', data);
        })
        .catch(error => {
            console.error('❌ 获取用户信息失败:', error);
        });
        
    } catch (error) {
        console.error('❌ Token解析失败:', error);
    }
}

// 浏览器控制台版本
console.log(`
💡 请在浏览器控制台中运行以下代码来检查当前用户:

const token = localStorage.getItem('token');
console.log('Token exists:', !!token);

fetch('/api/user/profile', {
    headers: { 'Authorization': 'Bearer ' + token }
}).then(r => r.json()).then(data => {
    console.log('当前用户:', data);
});
`);
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">AiCarpool 拼车</h1>
              <span className="ml-2 text-sm text-gray-500">AI编程工具拼车服务</span>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/auth/login">
                <Button variant="ghost">登录</Button>
              </Link>
              <Link href="/auth/register">
                <Button>注册</Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 sm:text-6xl">
            AI编程工具
            <span className="text-indigo-600">拼车服务</span>
          </h1>
          <p className="mt-6 text-xl text-gray-600 max-w-3xl mx-auto">
            统一管理Claude Code、Gemini CLI、AmpCode等多种AI编程工具，
            支持团队协作、成本分摊和资源共享。
          </p>
          <div className="mt-10 flex justify-center space-x-4">
            <Link href="/auth/register">
              <Button size="lg" className="px-8 py-3 text-lg">
                开始使用
              </Button>
            </Link>
            <Link href="/docs">
              <Button variant="outline" size="lg" className="px-8 py-3 text-lg">
                了解更多
              </Button>
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="mt-20 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center mr-3">
                  🤖
                </div>
                多AI服务支持
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                支持Claude Code、Gemini CLI、AmpCode等多种AI编程工具的统一管理和调用
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center mr-3">
                  👥
                </div>
                团队协作
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                支持拼车组管理，成员邀请，权限控制，让团队协作更加便捷高效
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center mr-3">
                  💰
                </div>
                成本分摊
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                透明的使用统计和成本分摊机制，让每一分投入都物有所值
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                  🚀
                </div>
                高性能代理
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                分布式代理架构，智能负载均衡，保证服务的稳定性和响应速度
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center mr-3">
                  📊
                </div>
                实时监控
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                实时的使用统计、性能监控和成本分析，让资源使用一目了然
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center mr-3">
                  🔒
                </div>
                安全可靠
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                企业级安全保障，数据加密传输，权限精细控制，保护您的隐私安全
              </CardDescription>
            </CardContent>
          </Card>
        </div>

        {/* CTA Section */}
        <div className="mt-20 bg-indigo-600 rounded-2xl px-8 py-16 text-center">
          <h2 className="text-3xl font-bold text-white">
            立即开始您的AI编程之旅
          </h2>
          <p className="mt-4 text-lg text-indigo-100">
            加入AiCarpool 拼车，体验更智能、更经济的AI编程工具服务
          </p>
          <div className="mt-8">
            <Link href="/auth/register">
              <Button size="lg" variant="secondary" className="px-8 py-3 text-lg">
                免费注册
              </Button>
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <h3 className="text-2xl font-bold">AiCarpool 拼车</h3>
            <p className="mt-4 text-gray-400">
              AI编程工具拼车服务平台 - Share AI, Share Costs
            </p>
            <div className="mt-8 text-sm text-gray-500">
              © 2025 AiCarpool 拼车. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

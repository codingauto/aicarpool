'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { AppHeader } from '@/components/layout/AppHeader';
import { 
  BookOpen,
  Download,
  Terminal,
  Copy,
  CheckCircle,
  AlertTriangle,
  ExternalLink,
  Monitor,
  Apple,
  Smartphone
} from 'lucide-react';
import { toast } from 'sonner';

export default function TutorialPage() {
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      toast.success('已复制到剪贴板');
      setTimeout(() => setCopied(null), 2000);
    } catch (error) {
      toast.error('复制失败');
    }
  };

  const CodeBlock = ({ children, id, language = 'bash' }: { children: string; id: string; language?: string }) => (
    <div className="relative">
      <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
        <code>{children}</code>
      </pre>
      <Button
        variant="ghost"
        size="sm"
        className="absolute top-2 right-2 text-gray-400 hover:text-white"
        onClick={() => copyToClipboard(children, id)}
      >
        {copied === id ? (
          <CheckCircle className="w-4 h-4 text-green-400" />
        ) : (
          <Copy className="w-4 h-4" />
        )}
      </Button>
    </div>
  );

  const StepCard = ({ 
    number, 
    title, 
    children 
  }: { 
    number: number; 
    title: string; 
    children: React.ReactNode 
  }) => (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold">
            {number}
          </div>
          <CardTitle className="text-lg">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {children}
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader title="使用教程" />
      
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 头部介绍 */}
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-4">
            <BookOpen className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">Claude Code 使用教程</h1>
          </div>
          <p className="text-gray-600 text-lg">
            跟着这个教程，你可以快速在自己的电脑上安装并使用 Claude Code。
          </p>
        </div>

        {/* 平台选择标签 */}
        <Tabs defaultValue="windows" className="space-y-8">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="windows" className="flex items-center space-x-2">
              <Monitor className="w-4 h-4" />
              <span>Windows</span>
            </TabsTrigger>
            <TabsTrigger value="macos" className="flex items-center space-x-2">
              <Apple className="w-4 h-4" />
              <span>macOS</span>
            </TabsTrigger>
            <TabsTrigger value="linux" className="flex items-center space-x-2">
              <Terminal className="w-4 h-4" />
              <span>Linux / WSL2</span>
            </TabsTrigger>
          </TabsList>

          {/* Windows 教程 */}
          <TabsContent value="windows" className="space-y-6">
            <StepCard number={1} title="安装 Node.js 环境">
              <p className="mb-4">Claude Code 需要 Node.js 环境才能运行。</p>
              
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">方法一：官网下载（推荐）</h4>
                  <ol className="list-decimal list-inside space-y-2 text-sm">
                    <li>打开浏览器访问：<code className="bg-gray-100 px-2 py-1 rounded">https://nodejs.org/</code></li>
                    <li>点击 "LTS" 版本进行下载（推荐长期支持版本）</li>
                    <li>下载完成后双击 .msi 文件</li>
                    <li>按照安装向导完成安装，保持默认设置即可</li>
                  </ol>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">方法二：使用包管理器</h4>
                  <p className="text-sm mb-2">如果你安装了 Chocolatey 或 Scoop，可以使用命令安装：</p>
                  
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs text-gray-600 mb-1"># 使用 Chocolatey</p>
                      <CodeBlock id="choco-install">choco install nodejs</CodeBlock>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 mb-1"># 使用 Scoop</p>
                      <CodeBlock id="scoop-install">scoop install nodejs</CodeBlock>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <h4 className="font-semibold text-blue-800 mb-2">Windows 注意事项</h4>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>• 请优先使用 PowerShell 而不是 CMD</li>
                    <li>• 如果遇到权限问题，请以管理员身份运行</li>
                    <li>• 重启系统可以确保环境变量生效</li>
                    <li>• 某些杀毒软件可能会阻止安装，请临时关闭</li>
                  </ul>
                </div>
              </div>

              <div className="mt-6">
                <h4 className="font-semibold mb-2">验证安装是否成功</h4>
                <p className="text-sm mb-2">安装完成后，打开 PowerShell 或 CMD，输入以下命令：</p>
                <CodeBlock id="node-version">node --version
npm --version</CodeBlock>
                <p className="text-sm text-gray-600 mt-2">如果显示版本号，说明安装成功！</p>
              </div>
            </StepCard>

            <StepCard number={2} title="安装 Git Bash">
              <p className="mb-4">
                Windows 环境下需要使用 Git Bash 来获得更好的命令行体验，特别是在使用 Claude Code 时候需要更高的权限和更好的命令兼容性。
              </p>

              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2 flex items-center space-x-2">
                    <Download className="w-4 h-4" />
                    <span>下载并安装 Git for Windows</span>
                  </h4>
                  <ol className="list-decimal list-inside space-y-2 text-sm">
                    <li>访问：<code className="bg-gray-100 px-2 py-1 rounded">https://git-scm.com/downloads/win</code></li>
                    <li>点击 "Download for Windows" 下载安装包</li>
                    <li>运行下载的 .exe 安装文件</li>
                    <li>在安装过程中保持默认设置，直接点击 "Next" 完成安装</li>
                  </ol>
                </div>

                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                  <h4 className="font-semibold text-yellow-800 mb-2 flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4" />
                    <span>安装完成后</span>
                  </h4>
                  <p className="text-sm text-yellow-700">
                    在桌面右键菜单中可以看到 "Git Bash Here" 选项，或者可以在开始菜单中找到 "Git Bash"。
                  </p>
                </div>
              </div>
            </StepCard>

            <StepCard number={3} title="安装 Claude Code">
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2 flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    <span>安装 Claude Code</span>
                  </h4>
                  <p className="text-sm mb-2">打开 Terminal，输入以下命令：</p>
                  <CodeBlock id="install-claude">npm install -g @anthropic-ai/claude-code</CodeBlock>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">或者使用开发版本</h4>
                  <CodeBlock id="install-dev">npm install -g @anthropic-ai/claude-code</CodeBlock>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">验证 Claude Code 安装</h4>
                  <p className="text-sm mb-2">运行完成后，执行以下命令验证：</p>
                  <CodeBlock id="verify-claude">claude --version</CodeBlock>
                  <p className="text-sm text-gray-600 mt-2">显示版本号说明安装成功了！</p>
                </div>
              </div>
            </StepCard>

            <StepCard number={4} title="设置环境变量">
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2 flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 text-orange-500" />
                    <span>配置 Claude Code 环境变量</span>
                  </h4>
                  <p className="text-sm mb-2">为了让 Claude Code 正常工作，需要设置环境变量：</p>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">方法一：命令行设置（临时有效）</h4>
                  <CodeBlock id="env-temp">export ANTHROPIC_API_KEY="your-api-key-here"
export ANTHROPIC_AUTH_TOKEN="your-auth-token-here"</CodeBlock>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">方法二：永久设置</h4>
                  <p className="text-sm mb-2">编辑用户环境变量：</p>
                  <ol className="list-decimal list-inside space-y-1 text-sm">
                    <li>右键 "此电脑" → "属性" → "高级系统设置"</li>
                    <li>点击 "环境变量"</li>
                    <li>在 "用户变量" 中点击 "新建"</li>
                    <li>添加环境变量：<code>ANTHROPIC_BASE_URL</code></li>
                    <li>值设置为 Relay Service 的地址</li>
                  </ol>
                </div>

                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <h4 className="font-semibold text-green-800 mb-2">环境变量说明</h4>
                  <div className="text-sm text-green-700 space-y-2">
                    <div><code>ANTHROPIC_BASE_URL</code>: 设置为您的 AiCarpool Relay Service 地址</div>
                    <div><code>ANTHROPIC_AUTH_TOKEN</code>: 从 Relay Service 获取的认证令牌</div>
                  </div>
                </div>
              </div>
            </StepCard>

            <StepCard number={5} title="开始使用 Claude Code">
              <div className="space-y-4">
                <p>现在你可以开始使用 Claude Code 了！</p>
                
                <div>
                  <h4 className="font-semibold mb-2">基本使用</h4>
                  <CodeBlock id="basic-usage">claude</CodeBlock>
                  <p className="text-sm text-gray-600 mt-2">这将启动 Claude Code 交互式界面</p>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">项目中使用</h4>
                  <CodeBlock id="project-usage"># 在项目目录中启动
cd /path/to/your/project
claude</CodeBlock>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">查看帮助</h4>
                  <CodeBlock id="help">claude --help</CodeBlock>
                </div>
              </div>
            </StepCard>
          </TabsContent>

          {/* macOS 教程 */}
          <TabsContent value="macos" className="space-y-6">
            <StepCard number={1} title="安装 Node.js 环境">
              <p className="mb-4">Claude Code 需要 Node.js 环境才能运行。</p>
              
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">方法一：使用 Homebrew（推荐）</h4>
                  <CodeBlock id="homebrew-node">brew install node</CodeBlock>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">方法二：官网下载</h4>
                  <ol className="list-decimal list-inside space-y-2 text-sm">
                    <li>访问 <code className="bg-gray-100 px-2 py-1 rounded">https://nodejs.org/</code></li>
                    <li>下载 macOS 版本的 LTS 版本</li>
                    <li>双击 .pkg 文件进行安装</li>
                    <li>按照安装向导完成安装</li>
                  </ol>
                </div>

                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <h4 className="font-semibold text-blue-800 mb-2">macOS 注意事项</h4>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>• 建议使用 Terminal.app 或 iTerm2</li>
                    <li>• 某些操作需要管理员权限，使用 sudo</li>
                    <li>• 建议安装 Xcode Command Line Tools</li>
                    <li>• 使用 Homebrew 可以更方便地管理包</li>
                  </ul>
                </div>
              </div>

              <div className="mt-6">
                <h4 className="font-semibold mb-2">验证安装</h4>
                <CodeBlock id="macos-verify">node --version
npm --version</CodeBlock>
              </div>
            </StepCard>

            <StepCard number={2} title="安装 Claude Code">
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">使用 npm 安装</h4>
                  <CodeBlock id="macos-install">npm install -g @anthropic-ai/claude-code</CodeBlock>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">验证安装</h4>
                  <CodeBlock id="macos-verify-claude">claude --version</CodeBlock>
                </div>

                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <h4 className="font-semibold text-green-800 mb-2">安装成功</h4>
                  <p className="text-sm text-green-700">看到版本号说明 Claude Code 安装成功了！</p>
                </div>
              </div>
            </StepCard>

            <StepCard number={3} title="配置环境变量">
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">编辑配置文件</h4>
                  <p className="text-sm mb-2">根据你使用的 shell，编辑对应的配置文件：</p>
                  <CodeBlock id="edit-config"># 对于 bash
echo 'export ANTHROPIC_BASE_URL="your-relay-service-url"' &gt;&gt; ~/.bash_profile

# 对于 zsh
echo 'export ANTHROPIC_BASE_URL="your-relay-service-url"' &gt;&gt; ~/.zshrc</CodeBlock>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">重新加载配置</h4>
                  <CodeBlock id="reload-config"># 重新加载配置文件
source ~/.zshrc
# 或者
source ~/.bash_profile</CodeBlock>
                </div>
              </div>
            </StepCard>

            <StepCard number={4} title="开始使用">
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">启动 Claude Code</h4>
                  <CodeBlock id="macos-start">claude</CodeBlock>
                </div>

                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <h4 className="font-semibold text-green-800 mb-2">🎉 配置完成</h4>
                  <p className="text-sm text-green-700">现在可以在任何项目目录中使用 Claude Code 了！</p>
                </div>
              </div>
            </StepCard>
          </TabsContent>

          {/* Linux 教程 */}
          <TabsContent value="linux" className="space-y-6">
            <StepCard number={1} title="Linux 安装方法">
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">方法一：使用 NodeSource（推荐）</h4>
                  <CodeBlock id="linux-nodesource">curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs</CodeBlock>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">方法二：使用系统包管理器</h4>
                  <div className="space-y-2">
                    <div>
                      <p className="text-sm mb-1">Ubuntu/Debian:</p>
                      <CodeBlock id="ubuntu-install">sudo apt update
sudo apt install nodejs npm</CodeBlock>
                    </div>
                    <div>
                      <p className="text-sm mb-1">CentOS/RHEL:</p>
                      <CodeBlock id="centos-install">sudo yum install nodejs npm</CodeBlock>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <h4 className="font-semibold text-blue-800 mb-2">Linux 注意事项</h4>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>• 大部分操作需要 sudo 权限</li>
                    <li>• 建议使用发行版推荐的包管理器</li>
                    <li>• 某些发行版的 Node.js 版本较旧，推荐使用 NodeSource</li>
                    <li>• 确保网络连接正常，可以访问外网</li>
                  </ul>
                </div>
              </div>
            </StepCard>

            <StepCard number={2} title="安装 Claude Code">
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">全局安装</h4>
                  <CodeBlock id="linux-install-claude">sudo npm install -g @anthropic-ai/claude-code</CodeBlock>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">验证安装</h4>
                  <CodeBlock id="linux-verify">claude --version</CodeBlock>
                </div>
              </div>
            </StepCard>

            <StepCard number={3} title="环境变量配置">
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">编辑环境变量</h4>
                  <CodeBlock id="linux-env">echo 'export ANTHROPIC_BASE_URL="your-relay-service-url"' &gt;&gt; ~/.bashrc
source ~/.bashrc</CodeBlock>
                </div>

                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <h4 className="font-semibold text-green-800 mb-2">开始使用</h4>
                  <p className="text-sm text-green-700">
                    配置完成后，在任何目录运行 <code>claude</code> 即可开始使用！
                  </p>
                </div>
              </div>
            </StepCard>
          </TabsContent>
        </Tabs>

        {/* 升级指南 */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              <span>升级指南</span>
            </CardTitle>
            <CardDescription>
              如何升级到最新版本的 Claude Code
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">升级 Claude Code</h4>
                <p className="text-sm mb-2">运行以下命令更新到最新版本：</p>
                <CodeBlock id="upgrade">npm install -g @anthropic-ai/claude-code@latest</CodeBlock>
              </div>

              <div>
                <h4 className="font-semibold mb-2">检查当前版本</h4>
                <CodeBlock id="check-version">claude --version</CodeBlock>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 开始使用 */}
        <Card className="mt-8 bg-gradient-to-r from-blue-500 to-purple-600 text-white">
          <CardContent className="p-8 text-center">
            <h3 className="text-2xl font-bold mb-4">🎉 开始使用！</h3>
            <p className="text-lg mb-6">
              现在你已经完成了 Claude Code 的安装，开始你的 AI 编程之旅吧！
            </p>
            <Button 
              variant="outline" 
              className="bg-white text-blue-600 hover:bg-gray-100"
              onClick={() => window.open('/dashboard', '_blank')}
            >
              前往控制台
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
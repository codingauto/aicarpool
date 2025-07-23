import { LoginForm } from '@/components/auth/login-form';

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">AiCarpool</h1>
          <p className="mt-2 text-sm text-gray-600">
            AI编程工具拼车服务平台
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
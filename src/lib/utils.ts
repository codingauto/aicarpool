import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
 
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// 安全地获取错误消息
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

// 检查错误是否包含特定消息
export function errorHasMessage(error: unknown, message: string): boolean {
  if (error instanceof Error) {
    return error.message === message;
  }
  return String(error) === message;
}

// 检查错误消息是否包含特定文本
export function errorMessageIncludes(error: unknown, text: string): boolean {
  if (error instanceof Error) {
    return error.message.includes(text);
  }
  return String(error).includes(text);
}
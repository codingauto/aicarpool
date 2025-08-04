/**
 * AI平台选择器组件
 * 支持选择不同的AI服务平台
 */

'use client';

import React, { useState, useEffect } from 'react';
import { ChevronDownIcon, CheckIcon } from '@heroicons/react/24/outline';
import { ServiceType, PLATFORM_CONFIGS, getPlatformConfig } from '@/lib/ai-platforms/platform-configs';
import { getSupportedPlatforms } from '@/lib/ai-platforms/adapter-manager';

interface PlatformOption {
  serviceType: ServiceType;
  config: any;
  hasAdapter: boolean;
  supportsOAuth: boolean;
}

interface PlatformSelectorProps {
  selectedPlatform?: ServiceType;
  onSelect: (platform: ServiceType) => void;
  showOnlySupported?: boolean;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

export default function PlatformSelector({
  selectedPlatform,
  onSelect,
  showOnlySupported = true,
  disabled = false,
  className = '',
  placeholder = '选择AI平台'
}: PlatformSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [platforms, setPlatforms] = useState<PlatformOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPlatforms();
  }, [showOnlySupported]);

  const loadPlatforms = async () => {
    try {
      setLoading(true);
      const supportedPlatforms = getSupportedPlatforms();
      
      let filteredPlatforms = supportedPlatforms;
      if (showOnlySupported) {
        filteredPlatforms = supportedPlatforms.filter(p => p.hasAdapter);
      }

      setPlatforms(filteredPlatforms);
    } catch (error) {
      console.error('Failed to load platforms:', error);
      setPlatforms([]);
    } finally {
      setLoading(false);
    }
  };

  const selectedConfig = selectedPlatform ? getPlatformConfig(selectedPlatform) : null;

  const handleSelect = (platform: ServiceType) => {
    onSelect(platform);
    setIsOpen(false);
  };

  const getPlatformIcon = (platformId: ServiceType) => {
    const icons: Record<ServiceType, string> = {
      [ServiceType.CLAUDE]: '🤖',
      [ServiceType.CLAUDE_CONSOLE]: '🔧',
      [ServiceType.OPENAI]: '🎯',
      [ServiceType.GEMINI]: '💎',
      [ServiceType.QWEN]: '🌟',
      [ServiceType.GLM]: '🧠',
      [ServiceType.KIMI]: '🌙',
      [ServiceType.WENXIN]: '🎨',
      [ServiceType.SPARK]: '⚡',
      [ServiceType.HUNYUAN]: '☁️',
      [ServiceType.MINIMAX]: '📏',
      [ServiceType.BAICHUAN]: '🏔️',
      [ServiceType.SENSETIME]: '👁️',
      [ServiceType.DOUBAO]: '🎁'
    };
    
    return icons[platformId] || '🤖';
  };

  const getPlatformStatus = (platform: PlatformOption) => {
    if (!platform.hasAdapter) {
      return { text: '即将支持', color: 'text-gray-400', bgColor: 'bg-gray-100' };
    }
    if (platform.supportsOAuth) {
      return { text: 'OAuth支持', color: 'text-green-600', bgColor: 'bg-green-100' };
    }
    return { text: '已支持', color: 'text-blue-600', bgColor: 'bg-blue-100' };
  };

  if (loading) {
    return (
      <div className={`relative ${className}`}>
        <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 animate-pulse">
          <div className="h-5 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          relative w-full px-3 py-2 pl-3 pr-10 text-left bg-white border border-gray-300 rounded-md shadow-sm cursor-default focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500
          ${disabled ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'hover:border-gray-400'}
        `}
      >
        <span className="flex items-center">
          {selectedConfig ? (
            <>
              <span className="text-lg mr-2">
                {getPlatformIcon(selectedPlatform!)}
              </span>
              <span className="block truncate font-medium">
                {selectedConfig.displayName}
              </span>
              <span className="ml-2 text-sm text-gray-500">
                ({selectedConfig.name})
              </span>
            </>
          ) : (
            <span className="text-gray-500">{placeholder}</span>
          )}
        </span>
        <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
          <ChevronDownIcon
            className={`h-5 w-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </span>
      </button>

      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-96 overflow-auto">
          <div className="py-1">
            {platforms.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500 text-center">
                暂无可用平台
              </div>
            ) : (
              platforms.map((platform) => {
                const isSelected = selectedPlatform === platform.serviceType;
                const status = getPlatformStatus(platform);
                
                return (
                  <button
                    key={platform.serviceType}
                    onClick={() => handleSelect(platform.serviceType)}
                    disabled={!platform.hasAdapter}
                    className={`
                      relative w-full px-3 py-2 text-left hover:bg-gray-50 focus:outline-none focus:bg-gray-50
                      ${!platform.hasAdapter ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}
                      ${isSelected ? 'bg-blue-50 text-blue-700' : 'text-gray-900'}
                    `}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <span className="text-lg mr-3">
                          {getPlatformIcon(platform.serviceType)}
                        </span>
                        <div>
                          <div className="font-medium">
                            {platform.config.displayName}
                          </div>
                          <div className="text-sm text-gray-500">
                            {platform.config.description}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <span className={`
                          px-2 py-1 text-xs rounded-full
                          ${status.color} ${status.bgColor}
                        `}>
                          {status.text}
                        </span>
                        {isSelected && (
                          <CheckIcon className="h-5 w-5 text-blue-600" />
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
          
          {showOnlySupported && (
            <div className="border-t border-gray-200 px-3 py-2 bg-gray-50">
              <p className="text-xs text-gray-500">
                显示 {platforms.filter(p => p.hasAdapter).length} 个已支持的平台
              </p>
            </div>
          )}
        </div>
      )}
      
      {/* 点击外部关闭下拉框 */}
      {isOpen && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}

/**
 * 简化版本的平台选择器，只显示基本信息
 */
export function SimplePlatformSelector({
  selectedPlatform,
  onSelect,
  className = '',
  disabled = false
}: Omit<PlatformSelectorProps, 'showOnlySupported' | 'placeholder'>) {
  const platforms = Object.values(ServiceType).map(serviceType => ({
    serviceType,
    config: getPlatformConfig(serviceType)
  }));

  return (
    <select
      value={selectedPlatform || ''}
      onChange={(e) => onSelect(e.target.value as ServiceType)}
      disabled={disabled}
      className={`
        w-full px-3 py-2 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500
        ${disabled ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''}
        ${className}
      `}
    >
      <option value="">选择AI平台</option>
      {platforms.map(({ serviceType, config }) => (
        <option key={serviceType} value={serviceType}>
          {config.displayName} ({config.name})
        </option>
      ))}
    </select>
  );
}

/**
 * 平台卡片组件，用于网格布局
 */
interface PlatformCardProps {
  platform: PlatformOption;
  isSelected: boolean;
  onSelect: (platform: ServiceType) => void;
  disabled?: boolean;
}

export function PlatformCard({ 
  platform, 
  isSelected, 
  onSelect, 
  disabled = false 
}: PlatformCardProps) {
  const status = platform.hasAdapter 
    ? (platform.supportsOAuth ? { text: 'OAuth支持', color: 'text-green-600', bgColor: 'bg-green-100' }
                               : { text: '已支持', color: 'text-blue-600', bgColor: 'bg-blue-100' })
    : { text: '即将支持', color: 'text-gray-400', bgColor: 'bg-gray-100' };

  return (
    <button
      onClick={() => platform.hasAdapter && onSelect(platform.serviceType)}
      disabled={disabled || !platform.hasAdapter}
      className={`
        relative p-4 border-2 rounded-lg text-left transition-all
        ${isSelected 
          ? 'border-blue-500 bg-blue-50 shadow-md' 
          : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
        }
        ${disabled || !platform.hasAdapter ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}
      `}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xl">
          {getPlatformIcon(platform.serviceType)}
        </span>
        {isSelected && (
          <CheckIcon className="h-5 w-5 text-blue-600" />
        )}
      </div>
      
      <h3 className="font-medium text-gray-900">
        {platform.config.displayName}
      </h3>
      
      <p className="text-sm text-gray-500 mt-1">
        {platform.config.description}
      </p>
      
      <div className="mt-3">
        <span className={`
          inline-flex px-2 py-1 text-xs rounded-full
          ${status.color} ${status.bgColor}
        `}>
          {status.text}
        </span>
      </div>
    </button>
  );
}

function getPlatformIcon(platformId: ServiceType) {
  const icons: Record<ServiceType, string> = {
    [ServiceType.CLAUDE]: '🤖',
    [ServiceType.CLAUDE_CONSOLE]: '🔧',
    [ServiceType.OPENAI]: '🎯',
    [ServiceType.GEMINI]: '💎',
    [ServiceType.QWEN]: '🌟',
    [ServiceType.GLM]: '🧠',
    [ServiceType.KIMI]: '🌙',
    [ServiceType.WENXIN]: '🎨',
    [ServiceType.SPARK]: '⚡',
    [ServiceType.HUNYUAN]: '☁️',
    [ServiceType.MINIMAX]: '📏',
    [ServiceType.BAICHUAN]: '🏔️',
    [ServiceType.SENSETIME]: '👁️',
    [ServiceType.DOUBAO]: '🎁'
  };
  
  return icons[platformId] || '🤖';
}
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Clock, ChevronDown } from 'lucide-react';

type TimeRangeOption = '1d' | '7d' | '30d' | '90d' | 'custom';

interface TimeRangeValue {
  option: TimeRangeOption;
  startDate?: string;
  endDate?: string;
}

interface TimeRangeSelectorProps {
  value: TimeRangeValue;
  onChange: (value: TimeRangeValue) => void;
  className?: string;
}

export function TimeRangeSelector({ 
  value, 
  onChange, 
  className = "" 
}: TimeRangeSelectorProps) {
  
  const [customStartDate, setCustomStartDate] = useState(value.startDate || '');
  const [customEndDate, setCustomEndDate] = useState(value.endDate || '');
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  const timeRangeOptions = [
    { value: '1d', label: '今日', description: '最近24小时' },
    { value: '7d', label: '7天', description: '最近7天' },
    { value: '30d', label: '30天', description: '最近30天' },
    { value: '90d', label: '90天', description: '最近90天' },
    { value: 'custom', label: '自定义', description: '选择日期范围' },
  ];

  const getDisplayText = () => {
    const option = timeRangeOptions.find(opt => opt.value === value.option);
    if (value.option === 'custom' && value.startDate && value.endDate) {
      return `${value.startDate} 至 ${value.endDate}`;
    }
    return option?.label || '选择时间范围';
  };

  const handleOptionChange = (option: TimeRangeOption) => {
    if (option !== 'custom') {
      onChange({ option });
      setIsPopoverOpen(false);
    } else {
      onChange({ option, startDate: customStartDate, endDate: customEndDate });
    }
  };

  const handleCustomDateApply = () => {
    if (customStartDate && customEndDate) {
      onChange({ 
        option: 'custom', 
        startDate: customStartDate, 
        endDate: customEndDate 
      });
      setIsPopoverOpen(false);
    }
  };

  const formatDateForInput = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  const getDefaultCustomDates = () => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    
    return {
      start: formatDateForInput(startDate),
      end: formatDateForInput(endDate)
    };
  };

  // 如果没有设置自定义日期，使用默认值
  if (!customStartDate || !customEndDate) {
    const defaults = getDefaultCustomDates();
    setCustomStartDate(defaults.start);
    setCustomEndDate(defaults.end);
  }

  return (
    <div className={className}>
      <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
        <PopoverTrigger asChild>
          <Button 
            variant="outline" 
            className="w-full md:w-auto justify-between min-w-[200px]"
          >
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4" />
              <span>{getDisplayText()}</span>
            </div>
            <ChevronDown className="w-4 h-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="end">
          <div className="p-4">
            <div className="space-y-3">
              <div>
                <Label className="text-sm font-medium">选择时间范围</Label>
              </div>
              
              {/* 预设时间范围选项 */}
              <div className="space-y-2">
                {timeRangeOptions.map((option) => (
                  <div key={option.value}>
                    <Button
                      variant={value.option === option.value ? "default" : "ghost"}
                      className="w-full justify-start"
                      onClick={() => handleOptionChange(option.value as TimeRangeOption)}
                    >
                      <div className="text-left">
                        <div className="font-medium">{option.label}</div>
                        <div className="text-xs opacity-70">{option.description}</div>
                      </div>
                    </Button>
                  </div>
                ))}
              </div>
              
              {/* 自定义日期范围 */}
              {value.option === 'custom' && (
                <div className="space-y-3 pt-3 border-t">
                  <div>
                    <Label htmlFor="start-date" className="text-sm">开始日期</Label>
                    <Input
                      id="start-date"
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="end-date" className="text-sm">结束日期</Label>
                    <Input
                      id="end-date"
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  
                  <Button 
                    onClick={handleCustomDateApply} 
                    className="w-full"
                    disabled={!customStartDate || !customEndDate || customStartDate > customEndDate}
                  >
                    应用自定义范围
                  </Button>
                </div>
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
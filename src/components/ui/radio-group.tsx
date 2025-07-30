"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface RadioGroupProps {
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}

interface RadioGroupItemProps {
  value: string;
  id: string;
  className?: string;
}

const RadioGroupContext = React.createContext<{
  value: string;
  onValueChange: (value: string) => void;
} | null>(null);

const RadioGroup = React.forwardRef<HTMLDivElement, RadioGroupProps>(
  ({ className, value, onValueChange, children, ...props }, ref) => {
    return (
      <RadioGroupContext.Provider value={{ value, onValueChange }}>
        <div
          ref={ref}
          className={cn("grid gap-2", className)}
          role="radiogroup"
          {...props}
        >
          {children}
        </div>
      </RadioGroupContext.Provider>
    )
  }
)
RadioGroup.displayName = "RadioGroup"

const RadioGroupItem = React.forwardRef<HTMLInputElement, RadioGroupItemProps>(
  ({ className, value, id, ...props }, ref) => {
    const context = React.useContext(RadioGroupContext);
    if (!context) {
      throw new Error("RadioGroupItem must be used within a RadioGroup");
    }

    const { value: groupValue, onValueChange } = context;

    return (
      <input
        ref={ref}
        type="radio"
        id={id}
        value={value}
        checked={groupValue === value}
        onChange={() => onValueChange(value)}
        className={cn(
          "h-4 w-4 rounded-full border border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
          className
        )}
        {...props}
      />
    )
  }
)
RadioGroupItem.displayName = "RadioGroupItem"

export { RadioGroup, RadioGroupItem }
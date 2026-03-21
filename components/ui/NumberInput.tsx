'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface NumberInputProps {
  value: string | number
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  autoFocus?: boolean
  min?: number
  max?: number
  disabled?: boolean
}

function formatDisplay(val: string): string {
  if (!val) return ''
  const parts = val.split('.')
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return parts.length > 1 ? `${intPart}.${parts[1]}` : intPart
}

function parseRaw(display: string): string {
  return display.replace(/,/g, '')
}

export function NumberInput({
  value, onChange, placeholder, className, autoFocus, min, max, disabled,
}: NumberInputProps) {
  const [display, setDisplay] = useState('')
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!focused) {
      const raw = String(value ?? '')
      setDisplay(formatDisplay(raw))
    }
  }, [value, focused])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value.replace(/,/g, '')
    // Allow empty, digits, single dot, and leading minus
    if (input !== '' && !/^-?\d*\.?\d*$/.test(input)) return
    
    let num = Number(input)
    let finalInput = input
    
    // Enforce max synchronously
    if (max !== undefined && !isNaN(num) && num > max) {
      finalInput = String(max)
    }

    setDisplay(formatDisplay(finalInput))
    onChange(finalInput)
  }, [onChange, max])

  const handleFocus = useCallback(() => {
    setFocused(true)
  }, [])

  const handleBlur = useCallback(() => {
    setFocused(false)
    const raw = parseRaw(display)
    let num = Number(raw)
    if (isNaN(num)) { onChange(''); return }
    if (min !== undefined && num < min) num = min
    if (max !== undefined && num > max) num = max
    const final = String(num)
    onChange(final)
    setDisplay(formatDisplay(final))
  }, [display, onChange, min, max])

  return (
    <Input
      inputMode="decimal"
      value={display}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      placeholder={placeholder}
      className={cn(className)}
      autoFocus={autoFocus}
      disabled={disabled}
    />
  )
}

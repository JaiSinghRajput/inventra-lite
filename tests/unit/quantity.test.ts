import { describe, it, expect } from 'vitest';
import { formatQuantity, parseCleanQuantity } from '../../src/lib/quantity';

describe('Quantity formatting and parsing', () => {
  it('formats whole numbers without decimal places so 8.000 displays as 8', () => {
    expect(formatQuantity('8.000')).toBe('8');
    expect(formatQuantity(8)).toBe('8');
    expect(formatQuantity('0.000')).toBe('0');
    expect(formatQuantity(0)).toBe('0');
    expect(formatQuantity('15.000')).toBe('15');
  });

  it('formats stock quantities strictly as whole integers and not floats', () => {
    expect(formatQuantity('8.500')).toBe('9');
    expect(formatQuantity(8.25)).toBe('8');
    expect(formatQuantity('1.125')).toBe('1');
    expect(formatQuantity('12.300')).toBe('12');
    expect(formatQuantity('0.000')).toBe('0');
  });

  it('safely parses user string input with commas and spaces into whole integers', () => {
    expect(parseCleanQuantity('8')).toBe(8);
    expect(parseCleanQuantity('8.000')).toBe(8);
    expect(parseCleanQuantity('1,000')).toBe(1000);
    expect(parseCleanQuantity(' 25.5 ')).toBe(26);
    expect(parseCleanQuantity('')).toBe(0);
    expect(parseCleanQuantity(null)).toBe(0);
  });

  it('guards against negative quantities unless explicitly allowed', () => {
    expect(parseCleanQuantity('-5')).toBe(0);
    expect(parseCleanQuantity('-5', true)).toBe(-5);
  });
});

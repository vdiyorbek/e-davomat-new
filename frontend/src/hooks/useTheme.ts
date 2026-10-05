import { useContext } from 'react';
import { ThemeContext } from '@/app/providers/theme-context';

export function useTheme() {
    const value = useContext(ThemeContext);
    if (!value) throw new Error('useTheme ThemeProvider ichida ishlatilishi kerak.');
    return value;
}

// src/theme.js
export default {
  colors: {
    // Core backgrounds with depth
    background: '#FAFBFC',
    backgroundSecondary: '#F8FAFC',
    card: '#FFFFFF',
    cardElevated: '#FFFFFF',
    
    // Primary brand colors - aviation inspired
    primary: '#1E40AF',      // Deep sky blue
    primaryLight: '#3B82F6',  // Lighter blue
    primaryDark: '#1E3A8A',   // Darker blue
    
    // Accent colors for different states
    accent: '#F59E0B',        // Amber for highlights
    accentLight: '#FCD34D',   // Light amber
    success: '#10B981',       // Emerald for completed
    warning: '#F59E0B',       // Amber for caution
    danger: '#EF4444',        // Red for errors
    
    // Text hierarchy
    text: '#0F172A',          // Almost black for primary text
    textSecondary: '#475569', // Slate for secondary text
    textMuted: '#64748B',     // Lighter slate for muted text
    textLight: '#94A3B8',     // Very light for subtle text
    
    // Interactive elements
    link: '#2563EB',
    linkHover: '#1D4ED8',
    
    // Borders and dividers
    border: '#E2E8F0',
    borderLight: '#F1F5F9',
    borderDark: '#CBD5E1',
    
    // Status colors with transparency options
    scheduled: '#6B7280',
    scheduledBg: 'rgba(107, 114, 128, 0.1)',
    inTransit: '#3B82F6',
    inTransitBg: 'rgba(59, 130, 246, 0.1)',
    delivered: '#F59E0B',
    deliveredBg: 'rgba(245, 158, 11, 0.1)',
    read: '#10B981',
    readBg: 'rgba(16, 185, 129, 0.1)',
    
    // Shadows and overlays
    shadow: 'rgba(15, 23, 42, 0.08)',
    shadowStrong: 'rgba(15, 23, 42, 0.15)',
    overlay: 'rgba(15, 23, 42, 0.4)',
    overlayLight: 'rgba(248, 250, 252, 0.95)',
  },
  
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    page: 20,
    section: 32,
  },
  
  radius: {
    sm: 6,
    md: 8,
    lg: 12,
    xl: 16,
    card: 12,
    button: 8,
    full: 9999,
  },
  
  typography: {
    // Font sizes
    sizes: {
      xs: 12,
      sm: 14,
      base: 16,
      lg: 18,
      xl: 20,
      xxl: 24,
      title: 28,
      heading: 32,
    },
    
    // Line heights
    lineHeights: {
      tight: 1.2,
      normal: 1.4,
      relaxed: 1.6,
    },
    
    // Font weights
    weights: {
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
    },
  },
  
  shadows: {
    sm: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    md: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 6,
      elevation: 3,
    },
    lg: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 12,
      elevation: 5,
    },
    xl: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.15,
      shadowRadius: 20,
      elevation: 8,
    },
  },
  
  animations: {
    duration: {
      fast: 150,
      normal: 250,
      slow: 400,
      letter: 2000, // Letter opening animation
      transit: 3000, // Letter transit animation
    },
    
    easing: {
      linear: 'linear',
      easeIn: 'ease-in',
      easeOut: 'ease-out',
      easeInOut: 'ease-in-out',
      spring: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)', // Bouncy spring
    },
  },
};
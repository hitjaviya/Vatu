# ChatApp Branding Guide

This directory contains all branding assets for the ChatApp cross-platform chat application.

## 🎨 Brand Assets

### App Icon
![App Icon](file:///d:/Application/assets/branding/app-icon-512.png)

**File:** `app-icon-512.png`
- **Size:** 512x512px (can be scaled down as needed)
- **Usage:** Desktop app icon, mobile app icon, high-resolution displays
- **Formats Needed:**
  - Desktop (Electron): 16x16, 32x32, 64x64, 128x128, 256x256, 512x512
  - Mobile (iOS): 1024x1024 for App Store
  - Mobile (Android): 512x512 for Play Store

### Favicon
![Favicon](file:///d:/Application/assets/branding/favicon.png)

**File:** `favicon.png`
- **Usage:** Web application favicon, browser tabs
- **Recommended Sizes:** 16x16, 32x32, 48x48, 64x64
- **Format:** Convert to .ico for maximum browser compatibility

### Horizontal Logo
![Horizontal Logo](file:///d:/Application/assets/branding/logo-horizontal.png)

**File:** `logo-horizontal.png`
- **Usage:** 
  - Website headers
  - Email signatures
  - Splash screens
  - Marketing materials
  - Documentation headers

### Square Logo
![Square Logo](file:///d:/Application/assets/branding/logo-square.png)

**File:** `logo-square.png`
- **Usage:**
  - Social media profiles (Twitter, LinkedIn, Facebook)
  - App store listings
  - Square promotional materials
  - Avatar/profile images

## 🎨 Color Palette

The brand uses a vibrant, modern gradient color scheme:

### Primary Colors
- **Cyan:** `#00D9FF` - Represents communication and clarity
- **Purple:** `#B537F2` - Represents innovation and creativity
- **Dark Navy:** `#1A1D2E` - Primary background color

### Gradient
```css
background: linear-gradient(135deg, #00D9FF 0%, #B537F2 100%);
```

### Usage Guidelines
- Use the gradient for primary CTAs, icons, and brand elements
- Dark navy for backgrounds and dark mode interfaces
- Maintain high contrast for accessibility

## 📐 Design Principles

1. **Modern & Minimal:** Clean lines, ample whitespace, focused design
2. **Vibrant & Dynamic:** Use gradients and subtle animations
3. **Professional:** Maintain a premium, tech-forward aesthetic
4. **Accessible:** Ensure proper contrast ratios (WCAG AA minimum)

## 🔧 Implementation

### Web Application (favicon)
```html
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
<link rel="shortcut icon" href="/favicon.ico">
```

### Electron Application (app icon)
Update `package.json` in the desktop package:
```json
{
  "build": {
    "appId": "com.chatapp.desktop",
    "productName": "ChatApp",
    "icon": "../../assets/branding/app-icon-512.png"
  }
}
```

### React Components
```jsx
import logo from '../../assets/branding/logo-horizontal.png';

function Header() {
  return (
    <header>
      <img src={logo} alt="ChatApp" className="logo" />
    </header>
  );
}
```

## 📦 Next Steps

### Recommended Asset Generation

1. **Generate Multiple Icon Sizes**
   - Use an icon generator tool to create all required sizes
   - For Electron: 16, 32, 64, 128, 256, 512px
   - For Web: 16, 32, 48, 64px + .ico format

2. **Create Variations**
   - Light mode version (if needed)
   - Monochrome version for certain contexts
   - Transparent background versions

3. **Optimize Files**
   - Compress PNG files for web use
   - Consider SVG versions for scalability
   - Use WebP for modern browsers

## 📄 File Structure

```
assets/
└── branding/
    ├── app-icon-512.png       # Main application icon
    ├── favicon.png            # Web favicon
    ├── logo-horizontal.png    # Horizontal logo with text
    ├── logo-square.png        # Square logo for social media
    └── BRANDING_GUIDE.md      # This file
```

## 🎯 Brand Voice

When representing ChatApp in text:
- **Tone:** Professional yet approachable
- **Style:** Clear, concise, modern
- **Values:** Privacy, reliability, innovation

---

**Version:** 1.0  
**Last Updated:** November 2025  
**Maintained by:** ChatApp Team

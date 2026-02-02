---
name: web-design-spec-generator
description: Generate comprehensive visual design specification documents for web designers. Use when you need to create detailed design specs that list all required visual assets (banners, icons, UI elements, hero images), their dimensions, file formats, naming conventions, and design system guidelines. Ideal for communicating design requirements to visual designers, preparing handoff documentation, or creating asset production checklists for any web development project.
---

# Web Design Specification Generator

Generate professional visual design specification documents that clearly communicate all asset requirements to visual designers.

## What This Skill Produces

A comprehensive design specification document that includes:

1. **Asset Inventory** - Complete list of all visual elements needed
2. **Detailed Specifications** - Dimensions, formats, and technical requirements for each asset
3. **Design System Guidelines** - Colors, typography, spacing, and component standards
4. **Responsive Specifications** - Asset variations for desktop, tablet, and mobile
5. **Naming Conventions** - File naming standards for organized asset delivery
6. **Export Guidelines** - Technical requirements for file formats and optimization

## Usage Pattern

When the user requests a design specification document, follow this workflow:

### 1. Gather Project Context

Ask targeted questions to understand the project scope:

- **Project Type**: Landing page, web app, marketing site, e-commerce, dashboard?
- **Page Structure**: How many pages/sections? (e.g., Home, About, Services, Contact)
- **Design Style**: Modern, minimal, playful, corporate, luxury?
- **Brand Assets Available**: Do they have existing logos, colors, fonts?
- **Target Devices**: Desktop only, mobile-first, or full responsive?

**Important**: Avoid overwhelming with questions. Ask 3-5 key questions per round, then synthesize based on responses.

### 2. Generate Comprehensive Specification

Create a structured document covering:

#### A. Project Overview
- Project name and description
- Design style and aesthetic direction
- Target audience
- Technical constraints

#### B. Design System Specifications

**Color Palette**
```
Primary Colors:
- Primary: #HEX (RGB: r, g, b) - Usage: CTAs, links, accents
- Secondary: #HEX (RGB: r, g, b) - Usage: secondary actions
- Tertiary: #HEX (RGB: r, g, b) - Usage: backgrounds, subtle elements

Neutral Colors:
- Text Primary: #HEX
- Text Secondary: #HEX
- Background: #HEX
- Border: #HEX

Semantic Colors:
- Success: #HEX
- Warning: #HEX
- Error: #HEX
- Info: #HEX
```

**Typography System**
```
Font Families:
- Headings: [Font Name] (weights: 400, 600, 700)
  Source: Google Fonts / Adobe Fonts / Custom
- Body: [Font Name] (weights: 300, 400, 600)
  Source: Google Fonts / Adobe Fonts / Custom

Type Scale:
- H1: 48px / 3rem (Desktop), 36px / 2.25rem (Mobile)
- H2: 36px / 2.25rem (Desktop), 28px / 1.75rem (Mobile)
- H3: 28px / 1.75rem (Desktop), 24px / 1.5rem (Mobile)
- H4: 24px / 1.5rem (Desktop), 20px / 1.25rem (Mobile)
- Body: 16px / 1rem
- Small: 14px / 0.875rem
- Caption: 12px / 0.75rem

Line Heights:
- Headings: 1.2
- Body: 1.6
- Small: 1.5
```

**Spacing System**
```
Base Unit: 8px / 0.5rem

Scale:
- XS: 4px (0.25rem)
- S: 8px (0.5rem)
- M: 16px (1rem)
- L: 24px (1.5rem)
- XL: 32px (2rem)
- 2XL: 48px (3rem)
- 3XL: 64px (4rem)
- 4XL: 96px (6rem)
```

**Border Radius System**
```
- None: 0px
- Small: 4px
- Medium: 8px
- Large: 16px
- XLarge: 24px
- Full: 9999px (rounded-full)
```

**Shadow System**
```
- Small: 0 1px 3px rgba(0,0,0,0.12)
- Medium: 0 4px 6px rgba(0,0,0,0.1)
- Large: 0 10px 20px rgba(0,0,0,0.15)
- XLarge: 0 20px 40px rgba(0,0,0,0.2)
```

#### C. Asset Specifications by Category

**1. Hero Images**
```
Asset Name: hero-home
Purpose: Main homepage hero background
Dimensions:
  - Desktop: 1920 x 1080px (16:9)
  - Tablet: 1024 x 768px (4:3)
  - Mobile: 375 x 667px (9:16)
File Formats: 
  - Source: PSD/AI/Figma
  - Export: JPG (quality 85%), WebP
File Naming: hero-[page]-[device].jpg
  Examples: hero-home-desktop.jpg, hero-home-mobile.jpg
Notes: Ensure focal point remains visible across all breakpoints
```

**2. Section Backgrounds**
```
Asset Name: bg-[section-name]
Dimensions: 1920 x 600px (repeatable if pattern)
File Formats: JPG/PNG/SVG (for patterns)
File Naming: bg-[section-name]-[variant].jpg
```

**3. Feature Icons**
```
Asset Name: icon-[feature-name]
Purpose: Service/feature illustrations
Dimensions: 
  - Display size: 64 x 64px
  - Source: 256 x 256px (4x for retina)
File Formats:
  - Source: AI/Figma
  - Export: SVG (preferred), PNG @1x, @2x
File Naming: icon-[name].svg
Color Mode: Match primary brand color or monochrome
Style: Line, filled, or duotone (specify)
```

**4. UI Icons**
```
Asset Name: icon-ui-[action]
Purpose: Interface actions (menu, close, arrow, etc.)
Dimensions:
  - Display: 24 x 24px
  - Source: 96 x 96px (4x)
File Formats: SVG (preferred), PNG @1x, @2x
File Naming: icon-ui-[action].svg
  Examples: icon-ui-menu.svg, icon-ui-close.svg, icon-ui-arrow-right.svg
Stroke Width: 2px
Color: Solid black (#000000) for SVG recoloring
```

**5. Logos**
```
Asset Name: logo-[variant]
Variants Required:
  - Primary (full color)
  - White (for dark backgrounds)
  - Black (for light backgrounds)
  - Icon only (if applicable)
Dimensions: Vector (scalable), provide at 512px width minimum
File Formats:
  - Source: AI/EPS
  - Export: SVG, PNG @1x, @2x, @3x
File Naming: 
  - logo-primary.svg
  - logo-white.svg
  - logo-black.svg
  - logo-icon.svg
Clear Space: Minimum 1x logo height around all sides
```

**6. CTA Buttons (Design Reference)**
```
States Required:
  - Default
  - Hover
  - Active/Pressed
  - Disabled
  - Loading (if applicable)

Primary Button:
  - Background: Primary color
  - Text: White
  - Padding: 12px 24px (M size), 16px 32px (L size)
  - Border Radius: 8px
  - Font: Body font, 16px, weight 600

Secondary Button:
  - Border: 2px solid Primary color
  - Background: Transparent
  - Text: Primary color
  - Same padding as Primary
```

**7. Form Elements (Design Reference)**
```
Input Fields:
  - Height: 48px
  - Padding: 12px 16px
  - Border: 1px solid Border color
  - Border Radius: 8px
  - Font: Body, 16px
  
States: Default, Focus, Error, Disabled

Checkboxes/Radio:
  - Size: 24 x 24px
  - Border: 2px
  - Check icon: Export as SVG
```

**8. Illustrations**
```
Asset Name: illustration-[context]
Purpose: Support content sections
Dimensions: Variable, provide guidelines:
  - Small: 400 x 300px
  - Medium: 600 x 450px
  - Large: 800 x 600px
File Formats:
  - Source: AI/Figma
  - Export: SVG (preferred), PNG @2x
File Naming: illustration-[context].svg
Style: Match brand illustration style
Color Palette: Use brand colors only
```

**9. Product/Service Images**
```
Asset Name: img-[product/service]-[number]
Dimensions:
  - Thumbnail: 400 x 400px (1:1)
  - Medium: 800 x 600px (4:3)
  - Large: 1200 x 800px (3:2)
File Formats: JPG (85% quality), WebP
File Naming: img-[context]-[number].jpg
  Example: img-product-01.jpg, img-service-02.jpg
Background: White or transparent (specify)
```

**10. Social Media Assets**
```
Open Graph Image:
  - Dimensions: 1200 x 630px
  - File Format: JPG, PNG
  - File Name: og-image-[page].jpg

Twitter Card:
  - Dimensions: 1200 x 675px
  - File Format: JPG, PNG
  - File Name: twitter-card-[page].jpg

Favicon:
  - Sizes needed: 16x16, 32x32, 180x180 (Apple), 192x192, 512x512
  - File Formats: PNG, ICO, SVG
  - File Naming: favicon-[size].png
```

**11. Background Patterns/Textures**
```
Asset Name: pattern-[name]
Dimensions: Seamlessly tileable, typically 512 x 512px or 1024 x 1024px
File Format: PNG (with transparency), SVG
File Naming: pattern-[name].png
Opacity: Specify intended opacity level (e.g., 10%, 20%)
```

#### D. Responsive Specifications

**Breakpoints**
```
Mobile: 320px - 767px
Tablet: 768px - 1023px
Desktop: 1024px+
Wide: 1440px+
```

**Asset Variations Required**
- Specify which assets need multiple sizes
- Mobile-first approach: start with mobile dimensions
- Use srcset for responsive images

#### E. Export Guidelines

**Image Optimization**
- JPG: 85% quality for photos
- PNG: Use for transparency
- SVG: Preferred for icons and logos
- WebP: Modern format, provide fallback

**Retina/HiDPI**
- Provide @2x versions for raster images
- SVG handles all resolutions

**File Size Targets**
- Hero images: < 200KB
- Icons: < 10KB
- Thumbnails: < 50KB

**Color Profiles**
- sRGB color space
- RGB color mode (not CMYK)

#### F. Delivery Checklist

**File Organization**
```
/assets
  /logos
    - logo-primary.svg
    - logo-white.svg
    - logo-icon.svg
  /icons
    /ui
      - icon-ui-menu.svg
      - icon-ui-close.svg
    /features
      - icon-feature-01.svg
  /images
    /hero
      - hero-home-desktop.jpg
      - hero-home-mobile.jpg
    /products
      - img-product-01.jpg
  /illustrations
    - illustration-about.svg
  /patterns
    - pattern-dots.png
  /social
    - og-image-home.jpg
    - favicon-192.png
```

**Quality Assurance**
- [ ] All assets match specified dimensions
- [ ] File naming follows conventions
- [ ] Proper file formats used
- [ ] Images optimized for web
- [ ] Retina versions provided where needed
- [ ] SVGs cleaned and optimized
- [ ] Color profiles correct (sRGB)

## Output Format

Generate the specification as a well-structured Markdown document with:

1. Clear section headings
2. Tables for asset lists
3. Code blocks for technical specs
4. Visual hierarchy using headers
5. Checkboxes for delivery checklist

## Customization

Adapt specifications based on:
- Project complexity (simple landing page vs. complex web app)
- Device targets (mobile-only vs. full responsive)
- Brand maturity (established brand vs. startup)
- Design system existence (new vs. existing)

## Best Practices

1. **Be Specific**: Exact pixel dimensions, not "medium" or "large"
2. **Provide Context**: Explain the purpose/usage of each asset
3. **Include Examples**: Show naming conventions with real examples
4. **Think Responsive**: Specify requirements for all target devices
5. **Consider Performance**: Include optimization guidelines
6. **Facilitate Handoff**: Organize in a designer-friendly structure

## Common Asset Categories by Project Type

**Landing Page**
- Hero image
- Logo variants
- CTA buttons
- Feature icons (3-6)
- Social proof logos
- Social media images

**E-commerce Site**
- Product images (multiple angles)
- Category banners
- Shopping cart icons
- Payment method logos
- Promotional banners

**SaaS Dashboard**
- App icons/logo
- UI icons (20-30)
- Empty state illustrations
- Charts/data visualization elements
- User avatar placeholders

**Marketing Site**
- Hero images per page
- Team photos
- Case study images
- Testimonial avatars
- Blog post featured images

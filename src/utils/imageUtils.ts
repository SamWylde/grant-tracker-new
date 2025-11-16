/**
 * Image optimization utilities
 *
 * Provides helper functions for:
 * - Generating blur placeholders
 * - Creating responsive image sources
 * - Converting to WebP format
 * - Calculating optimal image dimensions
 */

/**
 * Generate a blur data URL for use as a placeholder
 * This creates a tiny, blurred version of solid color
 *
 * @param color - Hex color code (e.g., '#cccccc')
 * @returns Data URL for use in img src
 */
export function generateBlurDataURL(color: string = '#e5e5e5'): string {
  // Create a 10x10 SVG with the specified color
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">
      <filter id="blur">
        <feGaussianBlur stdDeviation="2"/>
      </filter>
      <rect width="10" height="10" fill="${color}" filter="url(#blur)"/>
    </svg>
  `.trim();

  // Convert to base64 data URL
  const base64 = btoa(svg);
  return `data:image/svg+xml;base64,${base64}`;
}

/**
 * Generate srcset attribute for responsive images
 *
 * @param basePath - Base path to the image (without extension)
 * @param ext - File extension (e.g., 'jpg', 'png')
 * @param sizes - Array of widths to generate (e.g., [320, 640, 1024])
 * @returns srcset string
 *
 * @example
 * ```ts
 * generateSrcSet('/images/hero', 'jpg', [320, 640, 1024])
 * // Returns: '/images/hero-320w.jpg 320w, /images/hero-640w.jpg 640w, /images/hero-1024w.jpg 1024w'
 * ```
 */
export function generateSrcSet(
  basePath: string,
  ext: string,
  sizes: number[]
): string {
  return sizes
    .map((size) => `${basePath}-${size}w.${ext} ${size}w`)
    .join(', ');
}

/**
 * Calculate responsive image dimensions maintaining aspect ratio
 *
 * @param originalWidth - Original image width
 * @param originalHeight - Original image height
 * @param maxWidth - Maximum width constraint
 * @param maxHeight - Maximum height constraint (optional)
 * @returns Object with calculated width and height
 */
export function calculateResponsiveDimensions(
  originalWidth: number,
  originalHeight: number,
  maxWidth: number,
  maxHeight?: number
): { width: number; height: number } {
  const aspectRatio = originalWidth / originalHeight;

  let width = Math.min(originalWidth, maxWidth);
  let height = width / aspectRatio;

  if (maxHeight && height > maxHeight) {
    height = maxHeight;
    width = height * aspectRatio;
  }

  return {
    width: Math.round(width),
    height: Math.round(height),
  };
}

/**
 * Generate WebP filename from original filename
 *
 * @param filename - Original filename (e.g., 'image.jpg')
 * @returns WebP filename (e.g., 'image.webp')
 */
export function getWebPFilename(filename: string): string {
  return filename.replace(/\.(jpe?g|png)$/i, '.webp');
}

/**
 * Check if browser supports WebP format
 *
 * @returns Promise that resolves to true if WebP is supported
 */
export function checkWebPSupport(): Promise<boolean> {
  return new Promise((resolve) => {
    const webP = new Image();
    webP.onload = webP.onerror = () => {
      resolve(webP.height === 2);
    };
    webP.src =
      'data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA';
  });
}

/**
 * Preload critical images for better performance
 *
 * @param urls - Array of image URLs to preload
 */
export function preloadImages(urls: string[]): void {
  urls.forEach((url) => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = url;
    document.head.appendChild(link);
  });
}

/**
 * Common responsive breakpoint sizes for images
 */
export const RESPONSIVE_SIZES = {
  mobile: 320,
  tablet: 768,
  desktop: 1024,
  wide: 1440,
  ultrawide: 1920,
} as const;

/**
 * Standard image optimization recommendations
 */
export const IMAGE_OPTIMIZATION_GUIDE = {
  hero: {
    sizes: [RESPONSIVE_SIZES.mobile, RESPONSIVE_SIZES.tablet, RESPONSIVE_SIZES.desktop],
    quality: 85,
    format: 'webp',
    lazy: false, // Hero images should load immediately
  },
  thumbnail: {
    sizes: [48, 96, 144], // 1x, 2x, 3x for 48px base
    quality: 80,
    format: 'webp',
    lazy: true,
  },
  content: {
    sizes: [RESPONSIVE_SIZES.mobile, RESPONSIVE_SIZES.tablet, RESPONSIVE_SIZES.desktop],
    quality: 85,
    format: 'webp',
    lazy: true,
  },
  avatar: {
    sizes: [48, 96, 144, 192], // Various avatar sizes
    quality: 80,
    format: 'webp',
    lazy: true,
  },
} as const;

/**
 * Optimize SVG by removing unnecessary attributes and whitespace
 *
 * @param svgString - SVG markup as string
 * @returns Optimized SVG string
 */
export function optimizeSVG(svgString: string): string {
  return svgString
    // Remove comments
    .replace(/<!--[\s\S]*?-->/g, '')
    // Remove unnecessary whitespace
    .replace(/\s+/g, ' ')
    // Remove empty groups
    .replace(/<g>\s*<\/g>/g, '')
    // Trim
    .trim();
}

/**
 * Get optimal image format based on content type
 *
 * @param hasTransparency - Whether the image needs transparency
 * @param isPhoto - Whether the image is a photograph
 * @returns Recommended format
 */
export function getOptimalImageFormat(
  hasTransparency: boolean,
  isPhoto: boolean
): 'webp' | 'png' | 'jpg' {
  if (hasTransparency) {
    return 'webp'; // WebP supports transparency and has better compression than PNG
  }
  if (isPhoto) {
    return 'webp'; // WebP has better compression than JPEG for photos
  }
  return 'jpg'; // Fallback
}

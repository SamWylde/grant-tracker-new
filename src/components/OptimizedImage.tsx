import { useEffect, useRef, useState } from 'react';
import { Box, Image, ImageProps, Skeleton } from '@mantine/core';

interface OptimizedImageProps extends Omit<ImageProps, 'src'> {
  /**
   * Image source URL
   */
  src: string;

  /**
   * Alternative text for accessibility
   */
  alt: string;

  /**
   * Width of the image (required for CLS prevention)
   */
  width?: number | string;

  /**
   * Height of the image (required for CLS prevention)
   */
  height?: number | string;

  /**
   * Enable lazy loading (default: true)
   */
  lazy?: boolean;

  /**
   * Show blur placeholder while loading (default: true)
   */
  blurPlaceholder?: boolean;

  /**
   * WebP source for browsers that support it
   */
  webpSrc?: string;

  /**
   * Additional sources for responsive images
   */
  sources?: Array<{
    srcSet: string;
    type?: string;
    media?: string;
  }>;

  /**
   * Placeholder color while loading (default: gray.1)
   */
  placeholderColor?: string;

  /**
   * Callback when image loads
   */
  onLoad?: () => void;

  /**
   * Callback when image fails to load
   */
  onError?: () => void;
}

/**
 * OptimizedImage component with lazy loading, blur placeholders, and WebP support
 *
 * Features:
 * - Lazy loading with Intersection Observer API
 * - Blur placeholder while loading
 * - WebP support with fallback
 * - Responsive images with picture element
 * - Proper width/height to prevent CLS
 * - Automatic aspect ratio preservation
 *
 * @example
 * ```tsx
 * <OptimizedImage
 *   src="/images/hero.jpg"
 *   webpSrc="/images/hero.webp"
 *   alt="Hero image"
 *   width={800}
 *   height={600}
 *   lazy={true}
 *   blurPlaceholder={true}
 * />
 * ```
 */
export function OptimizedImage({
  src,
  alt,
  width,
  height,
  lazy = true,
  blurPlaceholder = true,
  webpSrc,
  sources = [],
  placeholderColor = 'var(--mantine-color-gray-1)',
  onLoad,
  onError,
  radius = 'md',
  fit = 'cover',
  ...imageProps
}: OptimizedImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(!lazy);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (!lazy || isInView) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: '50px', // Start loading 50px before the image enters viewport
        threshold: 0.01,
      }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [lazy, isInView]);

  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  const handleError = () => {
    setHasError(true);
    onError?.();
  };

  // Calculate aspect ratio for proper layout
  const aspectRatio = width && height
    ? `${width} / ${height}`
    : undefined;

  // If sources or webpSrc provided, use picture element
  const shouldUsePicture = sources.length > 0 || webpSrc;

  return (
    <Box
      ref={imgRef}
      style={{
        position: 'relative',
        width: width || '100%',
        height: height || 'auto',
        aspectRatio,
      }}
    >
      {/* Blur placeholder */}
      {blurPlaceholder && !isLoaded && isInView && (
        <Skeleton
          width="100%"
          height="100%"
          radius={radius}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            zIndex: 1,
          }}
          animate
        />
      )}

      {/* Placeholder for non-visible images */}
      {!isInView && (
        <Box
          style={{
            width: '100%',
            height: '100%',
            backgroundColor: placeholderColor,
            borderRadius: `var(--mantine-radius-${radius})`,
          }}
        />
      )}

      {/* Image rendering */}
      {isInView && !hasError && (
        shouldUsePicture ? (
          <picture>
            {/* WebP source if provided */}
            {webpSrc && (
              <source srcSet={webpSrc} type="image/webp" />
            )}

            {/* Additional sources */}
            {sources.map((source, index) => (
              <source
                key={index}
                srcSet={source.srcSet}
                type={source.type}
                media={source.media}
              />
            ))}

            {/* Fallback image */}
            <Image
              src={src}
              alt={alt}
              w={width}
              h={height}
              radius={radius}
              fit={fit}
              onLoad={handleLoad}
              onError={handleError}
              style={{
                opacity: isLoaded ? 1 : 0,
                transition: 'opacity 0.3s ease-in-out',
                display: 'block',
                ...imageProps.style,
              }}
              {...imageProps}
            />
          </picture>
        ) : (
          <Image
            src={src}
            alt={alt}
            w={width}
            h={height}
            radius={radius}
            fit={fit}
            onLoad={handleLoad}
            onError={handleError}
            style={{
              opacity: isLoaded ? 1 : 0,
              transition: 'opacity 0.3s ease-in-out',
              display: 'block',
              ...imageProps.style,
            }}
            {...imageProps}
          />
        )
      )}

      {/* Error state */}
      {hasError && (
        <Box
          style={{
            width: '100%',
            height: '100%',
            backgroundColor: placeholderColor,
            borderRadius: `var(--mantine-radius-${radius})`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Box style={{ color: 'var(--mantine-color-gray-6)', fontSize: '0.875rem' }}>
            Image failed to load
          </Box>
        </Box>
      )}
    </Box>
  );
}

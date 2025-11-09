import { useEffect, useRef, useState } from "react";

interface CanvasSizeResult {
  width: number;
  height: number;
  viewportWidth: number;
  scrollLeft: number;
  scrollTop: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export const useCanvasSize = (keyHeight: number, pianoKeysLength: number): CanvasSizeResult => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(0);

  const width = viewportWidth || 1024; // Use viewport width, fallback for initial render
  const height = pianoKeysLength * keyHeight;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      setScrollLeft(container.scrollLeft);
      setScrollTop(container.scrollTop);
      if (process.env.NODE_ENV !== "production") {
        console.debug("[useCanvasSize] scroll", {
          scrollLeft: container.scrollLeft,
          scrollTop: container.scrollTop,
        });
      }
    };

    const updateViewportWidth = () => {
      setViewportWidth(container.clientWidth);
    };

    if (process.env.NODE_ENV !== "production") {
      console.debug("[useCanvasSize] initial sizing", {
        clientHeight: container.clientHeight,
        scrollHeight: container.scrollHeight,
        clientWidth: container.clientWidth,
        scrollWidth: container.scrollWidth,
      });
    }

    handleScroll();
    updateViewportWidth();

    container.addEventListener("scroll", handleScroll);

    const resizeObserver = new ResizeObserver(updateViewportWidth);
    resizeObserver.observe(container);

    return () => {
      container.removeEventListener("scroll", handleScroll);
      resizeObserver.disconnect();
    };
  }, []);

  return {
    width,
    height,
    viewportWidth,
    scrollLeft,
    scrollTop,
    containerRef,
  };
};

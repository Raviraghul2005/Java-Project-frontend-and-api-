import { useEffect, useLayoutEffect, type RefObject } from "react";

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * Parks an absolutely positioned "thumb" behind the active item of a list and lets CSS (.slider-thumb) glide it
 * to the next one. Writes straight to the DOM, so moving it never re-renders anything.
 */
export function useSlidingThumb(
  listRef: RefObject<HTMLElement | null>,
  thumbRef: RefObject<HTMLElement | null>,
  activeIndex: number,
  axis: "x" | "y"
) {
  useIsoLayoutEffect(() => {
    const list = listRef.current;
    const thumb = thumbRef.current;
    if (!list || !thumb) return;

    const place = () => {
      const item = list.children[activeIndex] as HTMLElement | undefined;
      if (!item) {
        thumb.style.opacity = "0";
        return;
      }
      thumb.style.opacity = "1";
      if (axis === "y") {
        thumb.style.transform = `translateY(${item.offsetTop}px)`;
        thumb.style.height = `${item.offsetHeight}px`;
      } else {
        thumb.style.transform = `translateX(${item.offsetLeft}px)`;
        thumb.style.width = `${item.offsetWidth}px`;
      }
    };

    place();
    const observer = new ResizeObserver(place);
    observer.observe(list);
    return () => observer.disconnect();
  }, [listRef, thumbRef, activeIndex, axis]);
}

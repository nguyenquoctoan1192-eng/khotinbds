"use client";

import { useEffect, useRef, useState } from "react";
import RelatedListingHorizontalCard from "@/app/components/map/RelatedListingHorizontalCard";
import type { PropertyMapListing } from "@/types/map";

type Props = {
  listings: PropertyMapListing[];
  selectedId: string | null;
  hoveredId: string | null;
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
  onOpen: (id: string) => void;
};

const AUTOPLAY_MS = 5000;
const RESUME_DELAY_MS = 5000;

export default function HorizontalListingsScroller({
  listings,
  selectedId,
  hoveredId,
  activeIndex,
  onActiveIndexChange,
  onHover,
  onSelect,
  onOpen,
}: Props) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const resumeTimerRef = useRef<number | null>(null);

  const [manualPaused, setManualPaused] = useState(false);
  const [interactionPaused, setInteractionPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  const isPaused =
    manualPaused ||
    interactionPaused ||
    reducedMotion;

  const clearResumeTimer = () => {
    if (resumeTimerRef.current !== null) {
      window.clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = null;
    }
  };

  const scrollToIndex = (index: number) => {
    const scroller = scrollerRef.current;

    const card = scroller?.querySelector<HTMLElement>(
      `[data-related-index="${index}"]`
    );

    if (!scroller || !card) return;

    scroller.scrollTo({
      left: card.offsetLeft - scroller.offsetLeft,
      behavior: reducedMotion ? "auto" : "smooth",
    });
  };

  const goToIndex = (
    index: number,
    userInitiated = false
  ) => {
    if (listings.length === 0) return;

    const nextIndex =
      (index + listings.length) % listings.length;

    onActiveIndexChange(nextIndex);
    scrollToIndex(nextIndex);

    if (userInitiated) {
      setInteractionPaused(true);
      clearResumeTimer();

      if (!manualPaused) {
        resumeTimerRef.current = window.setTimeout(
          () => {
            setInteractionPaused(false);
            resumeTimerRef.current = null;
          },
          RESUME_DELAY_MS
        );
      }
    }
  };

  const pauseForInteraction = () => {
    setInteractionPaused(true);
    clearResumeTimer();
  };

  const resumeAfterInteraction = () => {
    clearResumeTimer();

    if (!manualPaused) {
      resumeTimerRef.current = window.setTimeout(
        () => {
          setInteractionPaused(false);
          resumeTimerRef.current = null;
        },
        RESUME_DELAY_MS
      );
    }
  };

  const handleScrollInteraction = () => {
    pauseForInteraction();
    resumeAfterInteraction();
  };

  useEffect(() => {
    const query = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    );

    const update = () => {
      setReducedMotion(query.matches);
    };

    update();
    query.addEventListener("change", update);

    return () => {
      query.removeEventListener("change", update);
    };
  }, []);

  useEffect(() => {
    const handleVisibility = () => {
      setInteractionPaused(
        document.visibilityState !== "visible"
      );
    };

    document.addEventListener(
      "visibilitychange",
      handleVisibility
    );

    handleVisibility();

    return () => {
      document.removeEventListener(
        "visibilitychange",
        handleVisibility
      );
    };
  }, []);

  useEffect(() => {
    if (
      isPaused ||
      listings.length <= 1
    ) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      goToIndex(activeIndex + 1);
    }, AUTOPLAY_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [
    activeIndex,
    isPaused,
    listings.length,
  ]);

  useEffect(() => {
    return () => {
      clearResumeTimer();
    };
  }, []);

  useEffect(() => {
    const selectedIndex = listings.findIndex(
      (listing) => listing.id === selectedId
    );

    if (
      selectedIndex >= 0 &&
      selectedIndex !== activeIndex
    ) {
      onActiveIndexChange(selectedIndex);
      scrollToIndex(selectedIndex);
    }
  }, [selectedId]);

  if (listings.length === 0) {
    return null;
  }

  return (
    <div className="related-scroller-shell">
      <div className="related-scroller-controls">
        <button
          type="button"
          aria-label="Xem căn trước"
          onClick={() =>
            goToIndex(activeIndex - 1, true)
          }
        >
          ⬹
        </button>

        <button
          type="button"
          aria-label={
            manualPaused
              ? "Phát tự động"
              : "Tạm dừng tự động"
          }
          onClick={() => {
            clearResumeTimer();

            setManualPaused(
              (current) => !current
            );

            setInteractionPaused(false);
          }}
        >
          {manualPaused || reducedMotion
            ? "▶"
            : "Ⅱ"}
        </button>

        <button
          type="button"
          aria-label="Xem căn tiếp theo"
          onClick={() =>
            goToIndex(activeIndex + 1, true)
          }
        >
          ⬺
        </button>

        <span>
          {activeIndex + 1} / {listings.length}
        </span>
      </div>

      <div
        ref={scrollerRef}
        className="related-horizontal-scroller"
        onMouseEnter={pauseForInteraction}
        onMouseLeave={resumeAfterInteraction}
        onPointerDown={pauseForInteraction}
        onPointerUp={resumeAfterInteraction}
        onPointerCancel={resumeAfterInteraction}
        onTouchStart={pauseForInteraction}
        onTouchEnd={resumeAfterInteraction}
        onScroll={handleScrollInteraction}
      >
        {listings.map((item, index) => (
          <div
            key={item.id}
            data-related-index={index}
            className="related-horizontal-scroller__item"
          >
            <RelatedListingHorizontalCard
              item={item}
              active={
                selectedId === item.id ||
                activeIndex === index
              }
              hovered={
                hoveredId === item.id
              }
              onHover={onHover}
              onSelect={(itemId) => {
                onSelect(itemId);
                goToIndex(index, true);
              }}
              onOpen={onOpen}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
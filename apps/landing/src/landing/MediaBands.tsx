import { useEffect, useRef } from "react";
import { Reveal } from "./Reveal";
import { useLandingCopy } from "./LandingI18n";
import { useReducedMotion } from "./useReducedMotion";

const media = (file: string) => `${import.meta.env.BASE_URL}media/${file}`;

/**
 * Real pictures of the subject's world (publishing, printing, a home server), found in open
 * collections and credited in the footer. All share one treatment: monochrome, square corners.
 * They arrive large and few, as relief between the type sections.
 */
export function PressBand() {
  const { t } = useLandingCopy();
  return (
    <section className="lp-media lp-media--pair" aria-label={t.media.pressLabel}>
      <Reveal>
        <img src={media("press-drum.jpg")} width={1920} height={1436} alt={t.media.pressAlt} loading="lazy" />
      </Reveal>
      <Reveal delayMs={120}>
        <img src={media("brass-stamps.jpg")} width={1920} height={1348} alt={t.media.stampsAlt} loading="lazy" />
      </Reveal>
    </section>
  );
}

/** A silent loop with a poster frame; it stops when the band is off screen, and stays a still under reduced motion. */
export function PressVideoBand() {
  const { t } = useLandingCopy();
  const reduced = useReducedMotion();
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || reduced) return;
    const io = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) void el.play().catch(() => {});
      else el.pause();
    });
    io.observe(el);
    return () => io.disconnect();
  }, [reduced]);

  return (
    <section className="lp-media lp-media--video">
      <video
        ref={ref}
        muted
        loop
        playsInline
        preload="metadata"
        poster={media("printing-presses-poster.jpg")}
        width={854}
        height={480}
        aria-label={t.media.videoAlt}
      >
        <source src={media("printing-presses.webm")} type="video/webm" />
      </video>
    </section>
  );
}

export function ServerPicture() {
  const { t } = useLandingCopy();
  return <img className="lp-self__photo" src={media("home-server.jpg")} width={1920} height={1280} alt={t.media.serverAlt} loading="lazy" />;
}

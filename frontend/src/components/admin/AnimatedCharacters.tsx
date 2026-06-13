import { useEffect, useRef } from 'react';
import gsap from 'gsap';

type AnimatedCharactersProps = {
  isTyping?: boolean;
  showPassword?: boolean;
  passwordLength?: number;
};

type QuickToSet = {
  purpleSkew: (value: number) => void;
  blackSkew: (value: number) => void;
  orangeSkew: (value: number) => void;
  yellowSkew: (value: number) => void;
  purpleX: (value: number) => void;
  blackX: (value: number) => void;
  purpleHeight: (value: number) => void;
  purpleFaceLeft: (value: number) => void;
  purpleFaceTop: (value: number) => void;
  blackFaceLeft: (value: number) => void;
  blackFaceTop: (value: number) => void;
  orangeFaceX: (value: number) => void;
  orangeFaceY: (value: number) => void;
  yellowFaceX: (value: number) => void;
  yellowFaceY: (value: number) => void;
  mouthX: (value: number) => void;
  mouthY: (value: number) => void;
};

export function AnimatedCharacters({
  isTyping = false,
  showPassword = false,
  passwordLength = 0,
}: AnimatedCharactersProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const purpleRef = useRef<HTMLDivElement>(null);
  const blackRef = useRef<HTMLDivElement>(null);
  const orangeRef = useRef<HTMLDivElement>(null);
  const yellowRef = useRef<HTMLDivElement>(null);
  const purpleFaceRef = useRef<HTMLDivElement>(null);
  const blackFaceRef = useRef<HTMLDivElement>(null);
  const orangeFaceRef = useRef<HTMLDivElement>(null);
  const yellowFaceRef = useRef<HTMLDivElement>(null);
  const yellowMouthRef = useRef<HTMLDivElement>(null);

  const mouseRef = useRef({ x: 0, y: 0 });
  const rafIdRef = useRef(0);
  const purpleBlinkTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const blackBlinkTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const purplePeekTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lookingTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const isLookingRef = useRef(false);
  const quickToRef = useRef<QuickToSet | null>(null);

  const propsRef = useRef({ isTyping, showPassword, passwordLength });
  propsRef.current = { isTyping, showPassword, passwordLength };

  useEffect(() => {
    const container = containerRef.current;
    const purple = purpleRef.current;
    const black = blackRef.current;
    const orange = orangeRef.current;
    const yellow = yellowRef.current;
    const purpleFace = purpleFaceRef.current;
    const blackFace = blackFaceRef.current;
    const orangeFace = orangeFaceRef.current;
    const yellowFace = yellowFaceRef.current;
    const yellowMouth = yellowMouthRef.current;

    if (!container || !purple || !black || !orange || !yellow || !purpleFace || !blackFace || !orangeFace || !yellowFace || !yellowMouth) {
      return;
    }

    gsap.set(container.querySelectorAll('.pupil'), { x: 0, y: 0 });
    gsap.set(container.querySelectorAll('.eyeball-pupil'), { x: 0, y: 0 });

    quickToRef.current = {
      purpleSkew: gsap.quickTo(purple, 'skewX', { duration: 0.3, ease: 'power2.out' }),
      blackSkew: gsap.quickTo(black, 'skewX', { duration: 0.3, ease: 'power2.out' }),
      orangeSkew: gsap.quickTo(orange, 'skewX', { duration: 0.3, ease: 'power2.out' }),
      yellowSkew: gsap.quickTo(yellow, 'skewX', { duration: 0.3, ease: 'power2.out' }),
      purpleX: gsap.quickTo(purple, 'x', { duration: 0.3, ease: 'power2.out' }),
      blackX: gsap.quickTo(black, 'x', { duration: 0.3, ease: 'power2.out' }),
      purpleHeight: gsap.quickTo(purple, 'height', { duration: 0.3, ease: 'power2.out' }),
      purpleFaceLeft: gsap.quickTo(purpleFace, 'left', { duration: 0.3, ease: 'power2.out' }),
      purpleFaceTop: gsap.quickTo(purpleFace, 'top', { duration: 0.3, ease: 'power2.out' }),
      blackFaceLeft: gsap.quickTo(blackFace, 'left', { duration: 0.3, ease: 'power2.out' }),
      blackFaceTop: gsap.quickTo(blackFace, 'top', { duration: 0.3, ease: 'power2.out' }),
      orangeFaceX: gsap.quickTo(orangeFace, 'x', { duration: 0.2, ease: 'power2.out' }),
      orangeFaceY: gsap.quickTo(orangeFace, 'y', { duration: 0.2, ease: 'power2.out' }),
      yellowFaceX: gsap.quickTo(yellowFace, 'x', { duration: 0.2, ease: 'power2.out' }),
      yellowFaceY: gsap.quickTo(yellowFace, 'y', { duration: 0.2, ease: 'power2.out' }),
      mouthX: gsap.quickTo(yellowMouth, 'x', { duration: 0.2, ease: 'power2.out' }),
      mouthY: gsap.quickTo(yellowMouth, 'y', { duration: 0.2, ease: 'power2.out' }),
    };

    const calcPos = (el: HTMLElement) => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 3;
      const dx = mouseRef.current.x - cx;
      const dy = mouseRef.current.y - cy;
      return {
        faceX: Math.max(-15, Math.min(15, dx / 20)),
        faceY: Math.max(-10, Math.min(10, dy / 30)),
        bodySkew: Math.max(-6, Math.min(6, -dx / 120)),
      };
    };

    const calcEyePos = (el: HTMLElement, maxDist: number) => {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = mouseRef.current.x - cx;
      const dy = mouseRef.current.y - cy;
      const dist = Math.min(Math.sqrt(dx ** 2 + dy ** 2), maxDist);
      const angle = Math.atan2(dy, dx);
      return { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist };
    };

    const tick = () => {
      const quickTo = quickToRef.current;
      if (!quickTo) return;

      const { isTyping: typing, showPassword: showPw, passwordLength: pwLen } = propsRef.current;
      const hiding = pwLen > 0 && !showPw;
      const showing = pwLen > 0 && showPw;
      const looking = isLookingRef.current;

      if (!showing) {
        const pp = calcPos(purple);
        if (typing || hiding) {
          quickTo.purpleSkew(pp.bodySkew - 12);
          quickTo.purpleX(40);
          quickTo.purpleHeight(440);
        } else {
          quickTo.purpleSkew(pp.bodySkew);
          quickTo.purpleX(0);
          quickTo.purpleHeight(400);
        }
      }

      if (!showing) {
        const bp = calcPos(black);
        if (looking) {
          quickTo.blackSkew(bp.bodySkew * 1.5 + 10);
          quickTo.blackX(20);
        } else if (typing || hiding) {
          quickTo.blackSkew(bp.bodySkew * 1.5);
          quickTo.blackX(0);
        } else {
          quickTo.blackSkew(bp.bodySkew);
          quickTo.blackX(0);
        }
      }

      if (!showing) {
        const op = calcPos(orange);
        quickTo.orangeSkew(op.bodySkew);
      }

      if (!showing) {
        const yp = calcPos(yellow);
        quickTo.yellowSkew(yp.bodySkew);
      }

      if (!showing && !looking) {
        const pp = calcPos(purple);
        const purpleFaceX = pp.faceX >= 0 ? Math.min(25, pp.faceX * 1.5) : pp.faceX;
        quickTo.purpleFaceLeft(45 + purpleFaceX);
        quickTo.purpleFaceTop(40 + pp.faceY);
      }

      if (!showing && !looking) {
        const bp = calcPos(black);
        quickTo.blackFaceLeft(26 + bp.faceX);
        quickTo.blackFaceTop(32 + bp.faceY);
      }

      if (!showing) {
        const op = calcPos(orange);
        quickTo.orangeFaceX(op.faceX);
        quickTo.orangeFaceY(op.faceY);
      }

      if (!showing) {
        const yp = calcPos(yellow);
        quickTo.yellowFaceX(yp.faceX);
        quickTo.yellowFaceY(yp.faceY);
        quickTo.mouthX(yp.faceX);
        quickTo.mouthY(yp.faceY);
      }

      if (!showing) {
        container.querySelectorAll('.pupil').forEach((p) => {
          const el = p as HTMLElement;
          const maxDist = Number(el.dataset.maxDistance) || 5;
          const ePos = calcEyePos(el, maxDist);
          gsap.set(el, { x: ePos.x, y: ePos.y });
        });

        if (!looking) {
          container.querySelectorAll('.eyeball').forEach((eb) => {
            const el = eb as HTMLElement;
            const maxDist = Number(el.dataset.maxDistance) || 10;
            const pupil = el.querySelector('.eyeball-pupil') as HTMLElement | null;
            if (!pupil) return;
            const ePos = calcEyePos(el, maxDist);
            gsap.set(pupil, { x: ePos.x, y: ePos.y });
          });
        }
      }

      rafIdRef.current = requestAnimationFrame(tick);
    };

    const onMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    rafIdRef.current = requestAnimationFrame(tick);

    const purpleEyeballs = purple.querySelectorAll('.eyeball');
    const scheduleBlinkPurple = () => {
      if (!purpleEyeballs.length) return;
      purpleBlinkTimerRef.current = setTimeout(() => {
        purpleEyeballs.forEach((el) => {
          gsap.to(el, { height: 2, duration: 0.08, ease: 'power2.in' });
        });
        setTimeout(() => {
          purpleEyeballs.forEach((el) => {
            const size = Number((el as HTMLElement).style.width.replace('px', '')) || 18;
            gsap.to(el, { height: size, duration: 0.08, ease: 'power2.out' });
          });
          scheduleBlinkPurple();
        }, 150);
      }, Math.random() * 4000 + 3000);
    };
    scheduleBlinkPurple();

    const blackEyeballs = black.querySelectorAll('.eyeball');
    const scheduleBlinkBlack = () => {
      if (!blackEyeballs.length) return;
      blackBlinkTimerRef.current = setTimeout(() => {
        blackEyeballs.forEach((el) => {
          gsap.to(el, { height: 2, duration: 0.08, ease: 'power2.in' });
        });
        setTimeout(() => {
          blackEyeballs.forEach((el) => {
            const size = Number((el as HTMLElement).style.width.replace('px', '')) || 16;
            gsap.to(el, { height: size, duration: 0.08, ease: 'power2.out' });
          });
          scheduleBlinkBlack();
        }, 150);
      }, Math.random() * 4000 + 3000);
    };
    scheduleBlinkBlack();

    return () => {
      window.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(rafIdRef.current);
      clearTimeout(purpleBlinkTimerRef.current);
      clearTimeout(blackBlinkTimerRef.current);
      clearTimeout(purplePeekTimerRef.current);
      clearTimeout(lookingTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const quickTo = quickToRef.current;
    const purple = purpleRef.current;
    const black = blackRef.current;
    if (!quickTo || !purple || !black) return;

    const isShowingPassword = passwordLength > 0 && showPassword;

    if (isTyping && !isShowingPassword) {
      isLookingRef.current = true;
      quickTo.purpleFaceLeft(55);
      quickTo.purpleFaceTop(65);
      quickTo.blackFaceLeft(32);
      quickTo.blackFaceTop(12);
      purple.querySelectorAll('.eyeball-pupil').forEach((p) => {
        gsap.to(p, { x: 3, y: 4, duration: 0.3, ease: 'power2.out', overwrite: 'auto' });
      });
      black.querySelectorAll('.eyeball-pupil').forEach((p) => {
        gsap.to(p, { x: 0, y: -4, duration: 0.3, ease: 'power2.out', overwrite: 'auto' });
      });

      clearTimeout(lookingTimerRef.current);
      lookingTimerRef.current = setTimeout(() => {
        isLookingRef.current = false;
        purple.querySelectorAll('.eyeball-pupil').forEach((p) => {
          gsap.killTweensOf(p);
        });
      }, 800);
    } else {
      clearTimeout(lookingTimerRef.current);
      isLookingRef.current = false;
    }
  }, [isTyping, showPassword, passwordLength]);

  useEffect(() => {
    const quickTo = quickToRef.current;
    const purple = purpleRef.current;
    const black = blackRef.current;
    const orange = orangeRef.current;
    const yellow = yellowRef.current;
    if (!quickTo || !purple || !black || !orange || !yellow) return;

    const isHidingPassword = passwordLength > 0 && !showPassword;
    const isShowingPassword = passwordLength > 0 && showPassword;

    if (isShowingPassword) {
      quickTo.purpleSkew(0);
      quickTo.blackSkew(0);
      quickTo.orangeSkew(0);
      quickTo.yellowSkew(0);
      quickTo.purpleX(0);
      quickTo.blackX(0);
      quickTo.purpleHeight(400);
      quickTo.purpleFaceLeft(20);
      quickTo.purpleFaceTop(35);
      quickTo.blackFaceLeft(10);
      quickTo.blackFaceTop(28);
      quickTo.orangeFaceX(50 - 82);
      quickTo.orangeFaceY(85 - 90);
      quickTo.yellowFaceX(20 - 52);
      quickTo.yellowFaceY(35 - 40);
      quickTo.mouthX(10 - 40);
      quickTo.mouthY(0);

      purple.querySelectorAll('.eyeball-pupil').forEach((p) => {
        gsap.to(p, { x: -4, y: -4, duration: 0.3, ease: 'power2.out', overwrite: 'auto' });
      });
      black.querySelectorAll('.eyeball-pupil').forEach((p) => {
        gsap.to(p, { x: -4, y: -4, duration: 0.3, ease: 'power2.out', overwrite: 'auto' });
      });
      orange.querySelectorAll('.pupil').forEach((p) => {
        gsap.to(p, { x: -5, y: -4, duration: 0.3, ease: 'power2.out', overwrite: 'auto' });
      });
      yellow.querySelectorAll('.pupil').forEach((p) => {
        gsap.to(p, { x: -5, y: -4, duration: 0.3, ease: 'power2.out', overwrite: 'auto' });
      });
    } else if (isHidingPassword) {
      quickTo.purpleFaceLeft(55);
      quickTo.purpleFaceTop(65);
    }
  }, [showPassword, passwordLength]);

  useEffect(() => {
    const purple = purpleRef.current;
    const quickTo = quickToRef.current;
    if (!purple || !quickTo) return;

    const isShowingPassword = passwordLength > 0 && showPassword;

    if (!isShowingPassword || passwordLength <= 0) {
      clearTimeout(purplePeekTimerRef.current);
      return;
    }

    const purpleEyePupils = purple.querySelectorAll('.eyeball-pupil');
    if (!purpleEyePupils.length) return;

    const schedulePeek = () => {
      purplePeekTimerRef.current = setTimeout(() => {
        purpleEyePupils.forEach((p) => {
          gsap.to(p, { x: 4, y: 5, duration: 0.3, ease: 'power2.out', overwrite: 'auto' });
        });
        quickTo.purpleFaceLeft(20);
        quickTo.purpleFaceTop(35);

        setTimeout(() => {
          purpleEyePupils.forEach((p) => {
            gsap.to(p, { x: -4, y: -4, duration: 0.3, ease: 'power2.out', overwrite: 'auto' });
          });
          schedulePeek();
        }, 800);
      }, Math.random() * 3000 + 2000);
    };

    schedulePeek();

    return () => {
      clearTimeout(purplePeekTimerRef.current);
    };
  }, [showPassword, passwordLength]);

  return (
    <div ref={containerRef} style={{ position: 'relative', width: 550, height: 400 }}>
      <div
        ref={purpleRef}
        style={{
          position: 'absolute',
          bottom: 0,
          left: 70,
          width: 180,
          height: 400,
          backgroundColor: '#6C3FF5',
          borderRadius: '10px 10px 0 0',
          zIndex: 1,
          transformOrigin: 'bottom center',
          willChange: 'transform',
        }}
      >
        <div
          ref={purpleFaceRef}
          style={{ position: 'absolute', display: 'flex', gap: 32, left: 45, top: 40 }}
        >
          <div
            className="eyeball"
            data-max-distance="5"
            style={{
              width: 18,
              height: 18,
              borderRadius: '50%',
              backgroundColor: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              willChange: 'height',
            }}
          >
            <div
              className="eyeball-pupil"
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                backgroundColor: '#2D2D2D',
                willChange: 'transform',
              }}
            />
          </div>
          <div
            className="eyeball"
            data-max-distance="5"
            style={{
              width: 18,
              height: 18,
              borderRadius: '50%',
              backgroundColor: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              willChange: 'height',
            }}
          >
            <div
              className="eyeball-pupil"
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                backgroundColor: '#2D2D2D',
                willChange: 'transform',
              }}
            />
          </div>
        </div>
      </div>

      <div
        ref={blackRef}
        style={{
          position: 'absolute',
          bottom: 0,
          left: 240,
          width: 120,
          height: 310,
          backgroundColor: '#2D2D2D',
          borderRadius: '8px 8px 0 0',
          zIndex: 2,
          transformOrigin: 'bottom center',
          willChange: 'transform',
        }}
      >
        <div
          ref={blackFaceRef}
          style={{ position: 'absolute', display: 'flex', gap: 24, left: 26, top: 32 }}
        >
          <div
            className="eyeball"
            data-max-distance="4"
            style={{
              width: 16,
              height: 16,
              borderRadius: '50%',
              backgroundColor: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              willChange: 'height',
            }}
          >
            <div
              className="eyeball-pupil"
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: '#2D2D2D',
                willChange: 'transform',
              }}
            />
          </div>
          <div
            className="eyeball"
            data-max-distance="4"
            style={{
              width: 16,
              height: 16,
              borderRadius: '50%',
              backgroundColor: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              willChange: 'height',
            }}
          >
            <div
              className="eyeball-pupil"
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: '#2D2D2D',
                willChange: 'transform',
              }}
            />
          </div>
        </div>
      </div>

      <div
        ref={orangeRef}
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: 240,
          height: 200,
          backgroundColor: '#FF9B6B',
          borderRadius: '120px 120px 0 0',
          zIndex: 3,
          transformOrigin: 'bottom center',
          willChange: 'transform',
        }}
      >
        <div
          ref={orangeFaceRef}
          style={{ position: 'absolute', display: 'flex', gap: 32, left: 82, top: 90 }}
        >
          <div
            data-max-distance="5"
            className="pupil"
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              backgroundColor: '#2D2D2D',
              willChange: 'transform',
            }}
          />
          <div
            data-max-distance="5"
            className="pupil"
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              backgroundColor: '#2D2D2D',
              willChange: 'transform',
            }}
          />
        </div>
      </div>

      <div
        ref={yellowRef}
        style={{
          position: 'absolute',
          bottom: 0,
          left: 310,
          width: 140,
          height: 230,
          backgroundColor: '#E8D754',
          borderRadius: '70px 70px 0 0',
          zIndex: 4,
          transformOrigin: 'bottom center',
          willChange: 'transform',
        }}
      >
        <div
          ref={yellowFaceRef}
          style={{ position: 'absolute', display: 'flex', gap: 24, left: 52, top: 40 }}
        >
          <div
            data-max-distance="5"
            className="pupil"
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              backgroundColor: '#2D2D2D',
              willChange: 'transform',
            }}
          />
          <div
            data-max-distance="5"
            className="pupil"
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              backgroundColor: '#2D2D2D',
              willChange: 'transform',
            }}
          />
        </div>
        <div
          ref={yellowMouthRef}
          style={{
            position: 'absolute',
            width: 80,
            height: 4,
            backgroundColor: '#2D2D2D',
            borderRadius: 9999,
            left: 40,
            top: 88,
          }}
        />
      </div>
    </div>
  );
}

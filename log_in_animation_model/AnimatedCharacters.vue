<template>
  <div ref="containerRef" style="position: relative; width: 550px; height: 400px;">
    <!-- Purple -->
    <div ref="purpleRef" style="position: absolute; bottom: 0; left: 70px; width: 180px; height: 400px; background-color: #6C3FF5; border-radius: 10px 10px 0 0; z-index: 1; transform-origin: bottom center; will-change: transform;">
      <div ref="purpleFaceRef" style="position: absolute; display: flex; gap: 32px; left: 45px; top: 40px;">
        <!-- EyeBall -->
        <div class="eyeball" data-max-distance="5" style="width: 18px; height: 18px; border-radius: 50%; background-color: white; display: flex; align-items: center; justify-content: center; overflow: hidden; will-change: height;">
          <div class="eyeball-pupil" style="width: 7px; height: 7px; border-radius: 50%; background-color: #2D2D2D; will-change: transform;"></div>
        </div>
        <!-- EyeBall -->
        <div class="eyeball" data-max-distance="5" style="width: 18px; height: 18px; border-radius: 50%; background-color: white; display: flex; align-items: center; justify-content: center; overflow: hidden; will-change: height;">
          <div class="eyeball-pupil" style="width: 7px; height: 7px; border-radius: 50%; background-color: #2D2D2D; will-change: transform;"></div>
        </div>
      </div>
    </div>

    <!-- Black -->
    <div ref="blackRef" style="position: absolute; bottom: 0; left: 240px; width: 120px; height: 310px; background-color: #2D2D2D; border-radius: 8px 8px 0 0; z-index: 2; transform-origin: bottom center; will-change: transform;">
      <div ref="blackFaceRef" style="position: absolute; display: flex; gap: 24px; left: 26px; top: 32px;">
        <!-- EyeBall -->
        <div class="eyeball" data-max-distance="4" style="width: 16px; height: 16px; border-radius: 50%; background-color: white; display: flex; align-items: center; justify-content: center; overflow: hidden; will-change: height;">
          <div class="eyeball-pupil" style="width: 6px; height: 6px; border-radius: 50%; background-color: #2D2D2D; will-change: transform;"></div>
        </div>
        <!-- EyeBall -->
        <div class="eyeball" data-max-distance="4" style="width: 16px; height: 16px; border-radius: 50%; background-color: white; display: flex; align-items: center; justify-content: center; overflow: hidden; will-change: height;">
          <div class="eyeball-pupil" style="width: 6px; height: 6px; border-radius: 50%; background-color: #2D2D2D; will-change: transform;"></div>
        </div>
      </div>
    </div>

    <!-- Orange -->
    <div ref="orangeRef" style="position: absolute; bottom: 0; left: 0; width: 240px; height: 200px; background-color: #FF9B6B; border-radius: 120px 120px 0 0; z-index: 3; transform-origin: bottom center; will-change: transform;">
      <div ref="orangeFaceRef" style="position: absolute; display: flex; gap: 32px; left: 82px; top: 90px;">
        <!-- Pupil -->
        <div data-max-distance="5" class="pupil" style="width: 12px; height: 12px; border-radius: 50%; background-color: #2D2D2D; will-change: transform;"></div>
        <div data-max-distance="5" class="pupil" style="width: 12px; height: 12px; border-radius: 50%; background-color: #2D2D2D; will-change: transform;"></div>
      </div>
    </div>

    <!-- Yellow -->
    <div ref="yellowRef" style="position: absolute; bottom: 0; left: 310px; width: 140px; height: 230px; background-color: #E8D754; border-radius: 70px 70px 0 0; z-index: 4; transform-origin: bottom center; will-change: transform;">
      <div ref="yellowFaceRef" style="position: absolute; display: flex; gap: 24px; left: 52px; top: 40px;">
        <!-- Pupil -->
        <div data-max-distance="5" class="pupil" style="width: 12px; height: 12px; border-radius: 50%; background-color: #2D2D2D; will-change: transform;"></div>
        <div data-max-distance="5" class="pupil" style="width: 12px; height: 12px; border-radius: 50%; background-color: #2D2D2D; will-change: transform;"></div>
      </div>
      <div ref="yellowMouthRef" style="position: absolute; width: 80px; height: 4px; background-color: #2D2D2D; border-radius: 9999px; left: 40px; top: 88px;"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue';
import gsap from 'gsap';

const props = withDefaults(defineProps<{
  isTyping?: boolean;
  showPassword?: boolean;
  passwordLength?: number;
}>(), {
  isTyping: false,
  showPassword: false,
  passwordLength: 0
});

const containerRef = ref<HTMLDivElement | null>(null);
const purpleRef = ref<HTMLDivElement | null>(null);
const blackRef = ref<HTMLDivElement | null>(null);
const orangeRef = ref<HTMLDivElement | null>(null);
const yellowRef = ref<HTMLDivElement | null>(null);

const purpleFaceRef = ref<HTMLDivElement | null>(null);
const blackFaceRef = ref<HTMLDivElement | null>(null);
const orangeFaceRef = ref<HTMLDivElement | null>(null);
const yellowFaceRef = ref<HTMLDivElement | null>(null);

const yellowMouthRef = ref<HTMLDivElement | null>(null);

const mouseRef = ref({ x: 0, y: 0 });
const rafIdRef = ref(0);

const purpleBlinkTimerRef = ref<ReturnType<typeof setTimeout>>();
const blackBlinkTimerRef = ref<ReturnType<typeof setTimeout>>();
const purplePeekTimerRef = ref<ReturnType<typeof setTimeout>>();
const lookingTimerRef = ref<ReturnType<typeof setTimeout>>();

const isLookingRef = ref(false);

const isHidingPassword = computed(() => props.passwordLength > 0 && !props.showPassword);
const isShowingPassword = computed(() => props.passwordLength > 0 && props.showPassword);

let quickTo: any = null;

onMounted(() => {
  gsap.set('.pupil', { x: 0, y: 0 });
  gsap.set('.eyeball-pupil', { x: 0, y: 0 });

  if (!purpleRef.value || !blackRef.value || !orangeRef.value || !yellowRef.value || !purpleFaceRef.value || !blackFaceRef.value || !orangeFaceRef.value || !yellowFaceRef.value || !yellowMouthRef.value) return;

  quickTo = {
    purpleSkew: gsap.quickTo(purpleRef.value, 'skewX', { duration: 0.3, ease: 'power2.out' }),
    blackSkew: gsap.quickTo(blackRef.value, 'skewX', { duration: 0.3, ease: 'power2.out' }),
    orangeSkew: gsap.quickTo(orangeRef.value, 'skewX', { duration: 0.3, ease: 'power2.out' }),
    yellowSkew: gsap.quickTo(yellowRef.value, 'skewX', { duration: 0.3, ease: 'power2.out' }),
    purpleX: gsap.quickTo(purpleRef.value, 'x', { duration: 0.3, ease: 'power2.out' }),
    blackX: gsap.quickTo(blackRef.value, 'x', { duration: 0.3, ease: 'power2.out' }),
    purpleHeight: gsap.quickTo(purpleRef.value, 'height', { duration: 0.3, ease: 'power2.out' }),
    purpleFaceLeft: gsap.quickTo(purpleFaceRef.value, 'left', { duration: 0.3, ease: 'power2.out' }),
    purpleFaceTop: gsap.quickTo(purpleFaceRef.value, 'top', { duration: 0.3, ease: 'power2.out' }),
    blackFaceLeft: gsap.quickTo(blackFaceRef.value, 'left', { duration: 0.3, ease: 'power2.out' }),
    blackFaceTop: gsap.quickTo(blackFaceRef.value, 'top', { duration: 0.3, ease: 'power2.out' }),
    orangeFaceX: gsap.quickTo(orangeFaceRef.value, 'x', { duration: 0.2, ease: 'power2.out' }),
    orangeFaceY: gsap.quickTo(orangeFaceRef.value, 'y', { duration: 0.2, ease: 'power2.out' }),
    yellowFaceX: gsap.quickTo(yellowFaceRef.value, 'x', { duration: 0.2, ease: 'power2.out' }),
    yellowFaceY: gsap.quickTo(yellowFaceRef.value, 'y', { duration: 0.2, ease: 'power2.out' }),
    mouthX: gsap.quickTo(yellowMouthRef.value, 'x', { duration: 0.2, ease: 'power2.out' }),
    mouthY: gsap.quickTo(yellowMouthRef.value, 'y', { duration: 0.2, ease: 'power2.out' }),
  };

  const calcPos = (el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 3;
    const dx = mouseRef.value.x - cx;
    const dy = mouseRef.value.y - cy;
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
    const dx = mouseRef.value.x - cx;
    const dy = mouseRef.value.y - cy;
    const dist = Math.min(Math.sqrt(dx ** 2 + dy ** 2), maxDist);
    const angle = Math.atan2(dy, dx);
    return { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist };
  };

  const tick = () => {
    const container = containerRef.value;
    if (!container) return;

    const typing = props.isTyping;
    const hiding = isHidingPassword.value;
    const showing = isShowingPassword.value;
    const looking = isLookingRef.value;

    if (purpleRef.value && !showing) {
      const pp = calcPos(purpleRef.value);
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

    if (blackRef.value && !showing) {
      const bp = calcPos(blackRef.value);
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

    if (orangeRef.value && !showing) {
      const op = calcPos(orangeRef.value);
      quickTo.orangeSkew(op.bodySkew);
    }

    if (yellowRef.value && !showing) {
      const yp = calcPos(yellowRef.value);
      quickTo.yellowSkew(yp.bodySkew);
    }

    if (purpleRef.value && !showing && !looking) {
      const pp = calcPos(purpleRef.value);
      const purpleFaceX = pp.faceX >= 0 ? Math.min(25, pp.faceX * 1.5) : pp.faceX;
      quickTo.purpleFaceLeft(45 + purpleFaceX);
      quickTo.purpleFaceTop(40 + pp.faceY);
    }

    if (blackRef.value && !showing && !looking) {
      const bp = calcPos(blackRef.value);
      quickTo.blackFaceLeft(26 + bp.faceX);
      quickTo.blackFaceTop(32 + bp.faceY);
    }

    if (orangeRef.value && !showing) {
      const op = calcPos(orangeRef.value);
      quickTo.orangeFaceX(op.faceX);
      quickTo.orangeFaceY(op.faceY);
    }

    if (yellowRef.value && !showing) {
      const yp = calcPos(yellowRef.value);
      quickTo.yellowFaceX(yp.faceX);
      quickTo.yellowFaceY(yp.faceY);
    }

    if (yellowRef.value && !showing) {
      const yp = calcPos(yellowRef.value);
      quickTo.mouthX(yp.faceX);
      quickTo.mouthY(yp.faceY);
    }

    if (!showing) {
      const allPupils = container.querySelectorAll('.pupil');
      allPupils.forEach((p) => {
        const el = p as HTMLElement;
        const maxDist = Number(el.dataset.maxDistance) || 5;
        const ePos = calcEyePos(el, maxDist);
        gsap.set(el, { x: ePos.x, y: ePos.y });
      });

      if (!looking) {
        const allEyeballs = container.querySelectorAll('.eyeball');
        allEyeballs.forEach((eb) => {
          const el = eb as HTMLElement;
          const maxDist = Number(el.dataset.maxDistance) || 10;
          const pupil = el.querySelector('.eyeball-pupil') as HTMLElement;
          if (!pupil) return;
          const ePos = calcEyePos(el, maxDist);
          gsap.set(pupil, { x: ePos.x, y: ePos.y });
        });
      }
    }

    rafIdRef.value = requestAnimationFrame(tick);
  };

  const onMove = (e: MouseEvent) => {
    mouseRef.value = { x: e.clientX, y: e.clientY };
  };

  window.addEventListener('mousemove', onMove, { passive: true });
  rafIdRef.value = requestAnimationFrame(tick);

  // Blinking Logic Purple
  const purpleEyeballs = purpleRef.value?.querySelectorAll('.eyeball');
  const scheduleBlinkPurple = () => {
    if (!purpleEyeballs?.length) return;
    purpleBlinkTimerRef.value = setTimeout(() => {
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

  // Blinking Logic Black
  const blackEyeballs = blackRef.value?.querySelectorAll('.eyeball');
  const scheduleBlinkBlack = () => {
    if (!blackEyeballs?.length) return;
    blackBlinkTimerRef.value = setTimeout(() => {
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
});

onUnmounted(() => {
  const onMove = (e: MouseEvent) => {
    mouseRef.value = { x: e.clientX, y: e.clientY };
  };
  window.removeEventListener('mousemove', onMove);
  cancelAnimationFrame(rafIdRef.value);
  clearTimeout(purpleBlinkTimerRef.value);
  clearTimeout(blackBlinkTimerRef.value);
  clearTimeout(purplePeekTimerRef.value);
  clearTimeout(lookingTimerRef.value);
});

const applyLookAtEachOther = () => {
  if (quickTo) {
    quickTo.purpleFaceLeft(55);
    quickTo.purpleFaceTop(65);
    quickTo.blackFaceLeft(32);
    quickTo.blackFaceTop(12);
  }
  purpleRef.value?.querySelectorAll('.eyeball-pupil').forEach((p) => {
    gsap.to(p, { x: 3, y: 4, duration: 0.3, ease: 'power2.out', overwrite: 'auto' });
  });
  blackRef.value?.querySelectorAll('.eyeball-pupil').forEach((p) => {
    gsap.to(p, { x: 0, y: -4, duration: 0.3, ease: 'power2.out', overwrite: 'auto' });
  });
};

const applyHidingPassword = () => {
  if (quickTo) {
    quickTo.purpleFaceLeft(55);
    quickTo.purpleFaceTop(65);
  }
};

const applyShowPassword = () => {
  if (quickTo) {
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
  }

  purpleRef.value?.querySelectorAll('.eyeball-pupil').forEach((p) => {
    gsap.to(p, { x: -4, y: -4, duration: 0.3, ease: 'power2.out', overwrite: 'auto' });
  });
  blackRef.value?.querySelectorAll('.eyeball-pupil').forEach((p) => {
    gsap.to(p, { x: -4, y: -4, duration: 0.3, ease: 'power2.out', overwrite: 'auto' });
  });
  orangeRef.value?.querySelectorAll('.pupil').forEach((p) => {
    gsap.to(p, { x: -5, y: -4, duration: 0.3, ease: 'power2.out', overwrite: 'auto' });
  });
  yellowRef.value?.querySelectorAll('.pupil').forEach((p) => {
    gsap.to(p, { x: -5, y: -4, duration: 0.3, ease: 'power2.out', overwrite: 'auto' });
  });
};

watch([() => props.isTyping, isShowingPassword], ([typing, showing]) => {
  if (typing && !showing) {
    isLookingRef.value = true;
    applyLookAtEachOther();

    clearTimeout(lookingTimerRef.value);
    lookingTimerRef.value = setTimeout(() => {
      isLookingRef.value = false;
      purpleRef.value?.querySelectorAll('.eyeball-pupil').forEach((p) => {
        gsap.killTweensOf(p);
      });
    }, 800);
  } else {
    clearTimeout(lookingTimerRef.value);
    isLookingRef.value = false;
  }
});

watch([isHidingPassword, isShowingPassword], ([hiding, showing]) => {
  if (showing) {
    applyShowPassword();
  } else if (hiding) {
    applyHidingPassword();
  }
});

watch([isShowingPassword, () => props.passwordLength], ([showing, length]) => {
  if (!showing || length <= 0) {
    clearTimeout(purplePeekTimerRef.value);
    return;
  }

  const purpleEyePupils = purpleRef.value?.querySelectorAll('.eyeball-pupil');
  if (!purpleEyePupils?.length) return;

  const schedulePeek = () => {
    purplePeekTimerRef.value = setTimeout(() => {
      purpleEyePupils.forEach((p) => {
        gsap.to(p, { x: 4, y: 5, duration: 0.3, ease: 'power2.out', overwrite: 'auto' });
      });
      if (quickTo) {
        quickTo.purpleFaceLeft(20);
        quickTo.purpleFaceTop(35);
      }

      setTimeout(() => {
        purpleEyePupils.forEach((p) => {
          gsap.to(p, { x: -4, y: -4, duration: 0.3, ease: 'power2.out', overwrite: 'auto' });
        });
        schedulePeek();
      }, 800);
    }, Math.random() * 3000 + 2000);
  };

  schedulePeek();
});
</script>
// Мапа зміщення для заломлення. Червоний канал керує зсувом по X, зелений —
// по Y; 128 = нуль. Плоскі стопи в середині (0.3–0.7) лишають центр скла
// неспотвореним, а гнеться лише крайова фаска — саме так поводиться лінза.
const MAP_X =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='0'%3E%3Cstop offset='0' stop-color='%23ff0000'/%3E%3Cstop offset='0.3' stop-color='%23800000'/%3E%3Cstop offset='0.7' stop-color='%23800000'/%3E%3Cstop offset='1' stop-color='%23000000'/%3E%3C/linearGradient%3E%3Crect width='100' height='100' fill='url(%23g)'/%3E%3C/svg%3E";

const MAP_Y =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3ClinearGradient id='g' x1='0' y1='0' x2='0' y2='1'%3E%3Cstop offset='0' stop-color='%2300ff00'/%3E%3Cstop offset='0.3' stop-color='%23008000'/%3E%3Cstop offset='0.7' stop-color='%23008000'/%3E%3Cstop offset='1' stop-color='%23000000'/%3E%3C/linearGradient%3E%3Crect width='100' height='100' fill='url(%23g)'/%3E%3C/svg%3E";

// navigator.userAgentData реалізовано лише в Chromium — а SVG-фільтри всередині
// backdrop-filter працюють теж лише там. Це найдешевший чесний детект:
// CSS.supports() у Safari повертає true, хоча ефект не малюється.
const ENABLE_REFRACTION = `try{if(navigator.userAgentData)document.documentElement.classList.add('refract')}catch(e){}`;

/**
 * Фоновий шар сторінки + defs фільтра заломлення.
 * Градієнти читають --ambient-1/--ambient-2, тому сторінка може підфарбувати
 * фон під свої дані (див. сторінку проєкту).
 */
export default function Ambient() {
  return (
    <>
      <div className="ambient" aria-hidden="true" />

      <svg
        className="pointer-events-none absolute h-0 w-0"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          {/* sRGB обов'язковий: у linearRGB значення каналів мапи поїдуть
              і зміщення стане несиметричним */}
          <filter
            id="lg-refract"
            colorInterpolationFilters="sRGB"
            x="-8%"
            y="-8%"
            width="116%"
            height="116%"
          >
            <feImage href={MAP_X} preserveAspectRatio="none" result="mapX" />
            <feImage href={MAP_Y} preserveAspectRatio="none" result="mapY" />
            <feBlend in="mapX" in2="mapY" mode="screen" result="map" />
            <feGaussianBlur in="map" stdDeviation="0.6" result="mapSoft" />
            {/* scale підібраний стримано: помітно на фасці, але не перетворює
                панель на криве дзеркало. Більше за -60 вже читається як баг */}
            <feDisplacementMap
              in="SourceGraphic"
              in2="mapSoft"
              scale="-36"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>

      <script dangerouslySetInnerHTML={{ __html: ENABLE_REFRACTION }} />
    </>
  );
}

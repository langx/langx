const breakpoints = {
  xs: 0,
  sm: 320,
  md: 480,
  lg: 768,
  xl: 1024,
  xxl: 1440,
  mobile: 640,
};

export const getNumColumns = (width) => {
  if (width < breakpoints.sm) return 2; // xs
  else if (width >= breakpoints.sm && width < breakpoints.md) return 2; // sm
  else if (width >= breakpoints.md && width < breakpoints.lg) return 3; // md
  else if (width >= breakpoints.lg && width < breakpoints.xl) return 4; // lg
  else if (width >= breakpoints.xl && width < breakpoints.xxl) return 6; // xl
  else if (width >= breakpoints.xxl) return 8; // xxl
};

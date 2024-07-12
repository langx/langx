// fonts.ts
type FontMap = { [key: string]: ReturnType<typeof require> };

const fonts: FontMap = {
  // Comfortaa
  'Comfortaa-Light': require('@/assets/fonts/Comfortaa/Comfortaa-Light.ttf'),
  'Comfortaa-Regular': require('@/assets/fonts/Comfortaa/Comfortaa-Regular.ttf'),
  'Comfortaa-Bold': require('@/assets/fonts/Comfortaa/Comfortaa-Bold.ttf'),
  // Lexend
  'Lexend-Light': require('@/assets/fonts/Lexend/Lexend-Light.ttf'),
  'Lexend-Regular': require('@/assets/fonts/Lexend/Lexend-Regular.ttf'),
  'Lexend-Bold': require('@/assets/fonts/Lexend/Lexend-Bold.ttf'),
  // NotoSans
  'NotoSans-Regular': require('@/assets/fonts/NotoSans/NotoSans-Regular.ttf'),
};

export { fonts };

// Shared look of the menus: fonts, colours, sizes.

export const FONTS = {
  black: 'Nunito_900Black',
  extraBold: 'Nunito_800ExtraBold',
  bold: 'Nunito_700Bold',
};

export const UI = {
  red: '#FF5A5F',
  redDark: '#D9434A',
  blue: '#6C8EF5',
  blueDark: '#4F6FD8',
  green: '#4FBF5A',
  greenDark: '#3A9E45',
  yellow: '#FFE066',
  orange: '#F07A5A',
  grey: '#B9C2CF',
  greyDark: '#97A1B0',
  ink: '#2B3A55',
  inkSoft: '#5B6B88',
  card: '#FFFFFF',
  cardSoft: '#F3F8FF',
  backdrop: 'rgba(43,58,85,0.5)',
};

/**
 * Menus are designed for screens at least ~380pt tall (in landscape).
 * On smaller phones they are shrunk a little so nothing gets cut off.
 */
export function menuScale(height: number) {
  return Math.min(1, height / 380);
}

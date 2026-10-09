// All texts shown in the game. To translate, copy `en`, change the words,
// and add the new language to LANGUAGES at the bottom.

export const en = {
  title: 'Rocket Snail',
  tagline: 'Hold to fly up, let go to fall',
  play: 'Play',
  best: 'Best',
  holdToFly: 'Hold to fly!',
  gameOver: 'Ouch!',
  score: 'Score',
  newBest: 'New best!',
  lettuce: 'Lettuce',
  again: 'Again',
  menu: 'Menu',
};

export type Strings = Record<keyof typeof en, string>;

export const bg: Strings = {
  title: 'Охлюв Ракета',
  tagline: 'Задръж, за да летиш. Пусни, за да паднеш',
  play: 'Играй',
  best: 'Рекорд',
  holdToFly: 'Задръж, за да летиш!',
  gameOver: 'Опаа!',
  score: 'Точки',
  newBest: 'Нов рекорд!',
  lettuce: 'Маруля',
  again: 'Пак',
  menu: 'Меню',
};

export const LANGUAGES = { en, bg } satisfies Record<string, Strings>;
export type Lang = keyof typeof LANGUAGES;
export const LANGUAGE_NAMES: Record<Lang, string> = { en: 'EN', bg: 'БГ' };

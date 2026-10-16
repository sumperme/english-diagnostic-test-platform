export const heroImage =
  'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&q=80&w=1920';

export const universitiesHeroImage =
  'https://images.unsplash.com/photo-1568792923760-d70635a89fdc?auto=format&fit=crop&q=80&w=1920';

export const reportImage =
  'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&q=80&w=1000';

export const cardImages = [
  'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&q=80&w=800',
  'https://images.unsplash.com/photo-1711097383282-28097ae16b1d?auto=format&fit=crop&q=80&w=800',
  'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&q=80&w=800',
];

export function heroBackgroundStyleFor(image: string) {
  return {
    backgroundImage: `linear-gradient(to right, #1B2D2A 40%, rgba(27,45,42,0) 100%), url(${image})`,
  };
}

export const heroBackgroundStyle = heroBackgroundStyleFor(heroImage);

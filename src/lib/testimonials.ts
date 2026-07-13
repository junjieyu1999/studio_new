// Hardcoded reviews shown on the gallery's back wall. Edit these directly.
export interface Testimonial {
  quote: string;
  name: string;
  context: string;
}

export const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      "the work is genuinely so beautiful — you're very talented and thoughtful, and the attention to detail is actually crazy. you can really feel the care and intention behind it, which makes it feel super personal and meaningful. honestly, you have such a good eye 🥹✨ and i'm always left wanting more of your art",
    name: "Estefanía Fernández Pokou",
    context: "Commission · Watercolour · 2025",
  },
  {
    quote:
      "Add your second review here. Perhaps share how the piece has transformed your space or the reactions it draws from guests.",
    name: "Collector Name",
    context: "Collected · Landscape · 2023",
  },
  {
    quote:
      "Add your third review here. You might speak to the artist's process, communication style, or the final result.",
    name: "Collector Name",
    context: "Commission · Portrait · 2025",
  },
];

import React from 'react';

export default function EditorialGallery({ description, items, sheet, title }) {
  return (
    <section className="container-app py-14 sm:py-20" aria-label={title}>
      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase text-gold-300">Em detalhes</p>
        <h2 className="mt-3 font-display text-3xl font-semibold text-white sm:text-4xl">{title}</h2>
        <p className="mt-4 leading-relaxed text-ink-300">{description}</p>
      </div>

      <div className="mt-9 grid grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-5">
        {items.map((item, index) => {
          const column = index % 3;
          const row = Math.floor(index / 3);
          return (
            <figure className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]" key={item.title}>
              <div className="relative aspect-square overflow-hidden bg-ink-900">
                <img
                  src={sheet}
                  alt={item.alt}
                  className="absolute h-[200%] w-[300%] max-w-none object-cover"
                  style={{ left: `-${column * 100}%`, top: `-${row * 100}%` }}
                  loading="lazy"
                />
              </div>
              <figcaption className="min-h-16 px-4 py-3 text-sm font-medium leading-snug text-ink-200 sm:min-h-0">
                {item.title}
              </figcaption>
            </figure>
          );
        })}
      </div>
    </section>
  );
}

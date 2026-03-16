interface BannerSectionProps {
  heading: string;
  description: string;
}

export default function BannerSection({ heading, description }: BannerSectionProps) {
  return (
    <section id="banner" className="bg-white py-16 md:py-20 lg:py-24">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 mb-6 leading-tight">
          {heading}
        </h2>
        <p className="text-base md:text-lg text-gray-600 leading-relaxed max-w-3xl mx-auto">
          {description}
        </p>
      </div>
    </section>
  );
}

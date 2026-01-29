import Link from 'next/link';

interface AboutPreviewProps {
  title: string;
  philosophy: string;
  quote: string;
  missionPoints: string[];
  learnMoreText: string;
  learnMoreLink: string;
}

export default function AboutPreview({
  title,
  philosophy,
  quote,
  missionPoints,
  learnMoreText,
  learnMoreLink,
}: AboutPreviewProps) {
  return (
    <section id="about" className="py-16 md:py-24 bg-white scroll-mt-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left: Decorative Quote */}
          <div className="order-2 lg:order-1">
            <div className="relative bg-gradient-to-br from-brand-purple-50 to-brand-purple-100 rounded-2xl aspect-[4/3] flex items-center justify-center">
              <div className="p-8 text-center">
                <div className="text-5xl md:text-6xl text-brand-purple-300 mb-4 font-serif">&ldquo;</div>
                <p className="text-lg md:text-xl lg:text-2xl text-brand-purple-700 italic font-medium leading-relaxed">
                  {quote}
                </p>
                <div className="text-5xl md:text-6xl text-brand-purple-300 mt-4 font-serif">&rdquo;</div>
              </div>
            </div>
          </div>

          {/* Right: Content */}
          <div className="order-1 lg:order-2 space-y-6">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
              {title}
            </h2>

            <p className="text-lg text-gray-600 leading-relaxed">
              {philosophy}
            </p>

            {/* Mission Points */}
            <div className="space-y-4 pt-4">
              {missionPoints.map((point, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-brand-purple-100 rounded-full flex items-center justify-center mt-1">
                    <svg
                      className="w-4 h-4 text-brand-purple-600"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <span className="text-gray-700">{point}</span>
                </div>
              ))}
            </div>

            {/* Learn More Button */}
            <div className="pt-6">
              <Link
                href={learnMoreLink}
                className="inline-flex items-center px-6 py-3 bg-brand-purple-600 hover:bg-brand-purple-700 text-white font-medium rounded-lg transition-colors"
              >
                {learnMoreText}
                <svg
                  className="ml-2 h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

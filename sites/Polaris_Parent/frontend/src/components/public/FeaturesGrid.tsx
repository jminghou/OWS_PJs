'use client';

import { ReactNode } from 'react';

interface Feature {
  icon: ReactNode;
  title: string;
  description: string;
  comingSoon?: boolean;
}

interface FeaturesGridProps {
  title?: string;
  description?: string;
  features: Feature[];
  comingSoonLabel?: string;
}

export default function FeaturesGrid({
  title,
  description,
  features,
  comingSoonLabel = '即將推出',
}: FeaturesGridProps) {
  return (
    <section id="products" className="py-20 md:py-28 bg-warm-50 scroll-mt-14">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {(title || description) && (
          <div className="text-center mb-12">
            {title && (
              <h2 className="text-3xl md:text-4xl font-semibold tracking-wide text-gray-900 mb-4">
                {title}
              </h2>
            )}
            {description && (
              <p className="text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
                {description}
              </p>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="group bg-white rounded-banner p-8 border border-warm-200/70 shadow-[0_8px_30px_rgba(139,92,246,0.06)] hover:shadow-[0_14px_40px_rgba(139,92,246,0.14)] hover:-translate-y-1 transition-all duration-300 relative overflow-hidden"
            >
              {feature.comingSoon && (
                <div className="absolute top-4 right-4">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-brand-purple-100 text-brand-purple-800">
                    {comingSoonLabel}
                  </span>
                </div>
              )}

              <div className="w-14 h-14 bg-gradient-to-br from-brand-purple-100 to-warm-200 rounded-banner flex items-center justify-center mb-6 transition-transform duration-300 group-hover:scale-110">
                {feature.icon}
              </div>

              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                {feature.title}
              </h3>

              <p className="text-gray-600 leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

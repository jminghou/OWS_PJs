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
    <section id="products" className="py-16 md:py-20 bg-gray-50 scroll-mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {(title || description) && (
          <div className="text-center mb-12">
            {title && (
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
                {title}
              </h2>
            )}
            {description && (
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                {description}
              </p>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="bg-white rounded-xl p-8 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden"
            >
              {feature.comingSoon && (
                <div className="absolute top-4 right-4">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-brand-purple-100 text-brand-purple-800">
                    {comingSoonLabel}
                  </span>
                </div>
              )}

              <div className="w-14 h-14 bg-brand-purple-100 rounded-xl flex items-center justify-center mb-6">
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

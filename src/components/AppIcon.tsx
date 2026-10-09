import React, { useState } from 'react';

interface AppIconProps {
  className?: string;
  imgClassName?: string;
}

export const AppIcon: React.FC<AppIconProps> = ({
  className = 'w-8 h-8',
  imgClassName = 'w-full h-full object-contain',
}) => {
  const [hasError, setHasError] = useState(false);

  return (
    <div
      className={`relative flex items-center justify-center shrink-0 ${className}`}
    >
      {!hasError ? (
        <img
          src="/viddy-icon.png"
          alt="Viddy"
          onError={() => setHasError(true)}
          className={imgClassName}
        />
      ) : (
        <div className="w-full h-full rounded-lg bg-gradient-to-br from-cyan-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xs tracking-tight shadow-inner">
          V
        </div>
      )}
    </div>
  );
};

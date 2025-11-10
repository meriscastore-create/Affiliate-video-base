import React from 'react';

const Loader: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center space-y-2">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      <span className="text-xs text-text-secondary">Generating...</span>
    </div>
  );
};

export default Loader;

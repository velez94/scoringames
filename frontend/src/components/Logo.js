import React from 'react';

const Logo = ({ size = 'md', variant = 'full' }) => {
  const sizes = {
    sm: { height: 32, fontSize: 16 },
    md: { height: 48, fontSize: 24 },
    lg: { height: 64, fontSize: 32 },
  };

  const { height, fontSize } = sizes[size];

  if (variant === 'icon') {
    return (
      <svg width={height} height={height} viewBox="0 0 100 100" fill="none">
        {/* Anvil shape */}
        <path
          d="M20 60 L30 40 L70 40 L80 60 L75 80 L25 80 Z"
          fill="#6B7C93"
          stroke="#212121"
          strokeWidth="2"
        />
        {/* Hammer */}
        <path
          d="M45 20 L55 20 L55 45 L45 45 Z"
          fill="#B87333"
          stroke="#212121"
          strokeWidth="2"
        />
        <rect x="40" y="15" width="20" height="10" rx="2" fill="#B87333" stroke="#212121" strokeWidth="2" />
        {/* Flame/spark */}
        <circle cx="70" cy="35" r="5" fill="#FF5722" opacity="0.8" />
        <circle cx="75" cy="30" r="3" fill="#FF5722" opacity="0.6" />
      </svg>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <svg width={height} height={height} viewBox="0 0 100 100" fill="none">
        <path
          d="M20 60 L30 40 L70 40 L80 60 L75 80 L25 80 Z"
          fill="#6B7C93"
          stroke="#212121"
          strokeWidth="2"
        />
        <path
          d="M45 20 L55 20 L55 45 L45 45 Z"
          fill="#B87333"
          stroke="#212121"
          strokeWidth="2"
        />
        <rect x="40" y="15" width="20" height="10" rx="2" fill="#B87333" stroke="#212121" strokeWidth="2" />
        <circle cx="70" cy="35" r="5" fill="#FF5722" opacity="0.8" />
        <circle cx="75" cy="30" r="3" fill="#FF5722" opacity="0.6" />
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
        <span style={{
          fontSize: fontSize,
          fontWeight: 700,
          color: '#212121',
          letterSpacing: '-0.5px'
        }}>
          Athleon
        </span>
        <span style={{
          fontSize: fontSize * 0.5,
          fontWeight: 600,
          color: '#B87333',
          letterSpacing: '1px',
          textTransform: 'uppercase'
        }}>
          Forge
        </span>
      </div>
    </div>
  );
};

export default Logo;

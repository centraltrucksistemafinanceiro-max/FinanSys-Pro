
import React from 'react';

const LOGO_URL = "https://lh3.googleusercontent.com/d/10eVKUmKef7BQNeJHl8Cz1gJbX8UBSCVd";

interface LogoProps {
    className?: string;
}

const Logo: React.FC<LogoProps> = ({ className }) => {
    return (
        <div className={`relative group ${className}`}>
          <div className="absolute inset-0 bg-indigo-500/20 rounded-full blur-xl group-hover:bg-indigo-500/40 transition-all duration-700"></div>
          <img 
              src={LOGO_URL} 
              alt="FinanSys Pro v3.0 Logo" 
              className="relative w-full h-full object-contain filter drop-shadow-2xl transition-transform duration-500 group-hover:scale-110" 
          />
        </div>
    );
};

export default Logo;

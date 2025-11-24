import React from 'react';

const LOGO_URL = "https://lh3.googleusercontent.com/d/10eVKUmKef7BQNeJHl8Cz1gJbX8UBSCVd";

interface LogoProps {
    className?: string;
}

const Logo: React.FC<LogoProps> = ({ className }) => {
    return (
        <img 
            src={LOGO_URL} 
            alt="FinanSys Pro Logo" 
            className={className} 
        />
    );
};

export default Logo;

import React from 'react';

interface AvatarProps {
  imageUrl?: string | null;
  name: string;
  size?: number;
}

const Avatar: React.FC<AvatarProps> = ({ imageUrl, name, size = 40 }) => {
  const getInitials = (name: string) => {
    if (!name) return '';
    const names = name.split(' ').filter(n => n);
    if (names.length > 1) {
      return `${names[0][0]}${names[1][0]}`.toUpperCase();
    }
    return names[0] ? names[0].substring(0, 2).toUpperCase() : '';
  };

  const generateColor = (str: string) => {
    if (!str) return '#cccccc';
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colors = [
        '#f1603c', '#1abc9c', '#2ecc71', '#3498db', '#9b59b6',
        '#34495e', '#e67e22', '#d35400', '#c0392b', '#7f8c8d'
    ];
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };

  const initials = getInitials(name);
  const backgroundColor = generateColor(name);

  const containerStyle = {
    width: `${size}px`,
    height: `${size}px`,
  };

  const fallbackStyle = {
    ...containerStyle,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    backgroundColor: backgroundColor,
    fontSize: `${size / 2.5}px`,
    lineHeight: '1',
  };

  return (
    <div style={containerStyle} className="rounded-full overflow-hidden flex-shrink-0">
      {imageUrl ? (
        <img src={imageUrl} alt={name} className="w-full h-full object-cover" />
      ) : (
        <div style={fallbackStyle}>
          <span>{initials}</span>
        </div>
      )}
    </div>
  );
};

export default Avatar;

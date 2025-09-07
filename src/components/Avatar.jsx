import React from 'react';

const Avatar = ({ username, size = 40 }) => {
  const getInitials = (name) => {
    if (!name) return '?';
    const words = name.split(' ');
    return words.map(word => word[0]).join('').substring(0, 2).toUpperCase();
  };

  const stringToColor = (str) => {
    if (!str) return '#cccccc';
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    let color = '#';
    for (let i = 0; i < 3; i++) {
      const value = (hash >> (i * 8)) & 0xFF;
      color += ('00' + value.toString(16)).substr(-2);
    }
    return color;
  };

  const style = {
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: '50%',
    backgroundColor: stringToColor(username),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    fontSize: `${size * 0.5}px`,
    fontWeight: 'bold',
  };

  return (
    <div style={style}>
      {getInitials(username)}
    </div>
  );
};

export default Avatar;
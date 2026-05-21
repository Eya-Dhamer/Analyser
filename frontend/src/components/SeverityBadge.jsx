import React from 'react';

export default function SeverityBadge({ severity }) {
  const s = severity?.toLowerCase();
  return <span className={`badge badge-${s || 'low'}`}>{severity || 'info'}</span>;
}

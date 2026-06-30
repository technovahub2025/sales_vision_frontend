import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon';

const OPTIONS = [
  { format: 'excel', label: 'Excel', icon: 'table_view' },
  { format: 'csv', label: 'CSV', icon: 'csv' },
  { format: 'pdf', label: 'PDF', icon: 'picture_as_pdf' },
];

function ExportMenu({ onExport, label = 'Export', className = '', disabled = false }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const ref = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const menuWidth = menuRef.current?.offsetWidth || 176;
    const gutter = 8;
    const left = Math.min(
      window.innerWidth - menuWidth - gutter,
      Math.max(gutter, rect.right - menuWidth),
    );

    setPosition({
      left,
      top: rect.bottom + gutter,
    });
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (ref.current?.contains(event.target) || menuRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;

    updatePosition();
    const frame = window.requestAnimationFrame(updatePosition);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open, updatePosition]);

  const popover = open && mounted
    ? createPortal(
      <div
        ref={menuRef}
        className="sv-export-menu-popover"
        role="menu"
        style={{ left: `${position.left}px`, top: `${position.top}px` }}
      >
        {OPTIONS.map((option) => (
          <button
            key={option.format}
            type="button"
            className="sv-export-menu-item"
            role="menuitem"
            onClick={() => {
              onExport(option.format);
              setOpen(false);
            }}
          >
            <Icon name={option.icon} className="sv-export-menu-icon" />
            <span>{option.label}</span>
          </button>
        ))}
      </div>,
      document.body,
    )
    : null;

  return (
    <div ref={ref} className={`sv-export-menu ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        className="sv-ctl-btn btn-light sv-export-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => {
          updatePosition();
          setOpen((current) => !current);
        }}
      >
        <Icon name="download" className="sv-export-menu-icon" />
        <span>{label}</span>
        <Icon name="expand_more" className={`sv-export-menu-chevron ${open ? 'is-open' : ''}`} />
      </button>
      {popover}
    </div>
  );
}

export default ExportMenu;

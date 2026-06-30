import { createPortal } from 'react-dom';
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Icon from './Icon';

function normalizeItems(items) {
  return (Array.isArray(items) ? items : []).filter((item) => item && !item.hidden);
}

const RowActionMenu = memo(function RowActionMenu({
  open = false,
  onTrigger,
  onClose,
  items,
  ariaLabel = 'Open actions',
  className = '',
  triggerClassName = '',
  menuClassName = '',
  itemClassName = '',
  menuWidth = 196,
  menuMinHeight = 96,
  menuPlacement = 'auto',
  align = 'right',
}) {
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const optionRefs = useRef([]);
  const [menuStyle, setMenuStyle] = useState(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const visibleItems = useMemo(() => normalizeItems(items), [items]);

  const closeMenu = useCallback(() => {
    onClose?.();
    triggerRef.current?.focus();
  }, [onClose]);

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const viewportPadding = 12;
    const maxWidth = Math.max(180, Math.min(menuWidth, window.innerWidth - viewportPadding * 2));
    const estimatedHeight = Math.min(340, Math.max(menuMinHeight, visibleItems.length * 38 + 12));
    const fitsBelow = rect.bottom + estimatedHeight + 10 <= window.innerHeight;
    const placeAbove = menuPlacement === 'top' || (!fitsBelow && rect.top > estimatedHeight + 12);
    const top = placeAbove
      ? Math.max(viewportPadding, rect.top - estimatedHeight - 8)
      : Math.min(window.innerHeight - estimatedHeight - 8, rect.bottom + 8);
    const leftBase = align === 'left' ? rect.left : rect.right - maxWidth;
    const left = Math.min(
      Math.max(viewportPadding, leftBase),
      window.innerWidth - maxWidth - viewportPadding,
    );

    setMenuStyle({
      position: 'fixed',
      top,
      left,
      width: maxWidth,
      zIndex: 1200,
    });
  }, [align, menuMinHeight, menuPlacement, menuWidth, visibleItems.length]);

  const focusItem = useCallback((index) => {
    const nextIndex = Math.max(0, Math.min(index, visibleItems.length - 1));
    setActiveIndex(nextIndex);
    requestAnimationFrame(() => {
      optionRefs.current[nextIndex]?.focus();
      optionRefs.current[nextIndex]?.scrollIntoView({ block: 'nearest' });
    });
  }, [visibleItems.length]);

  useEffect(() => {
    if (!open) return;
    const nextIndex = visibleItems.findIndex((item) => !item.disabled);
    setActiveIndex(nextIndex >= 0 ? nextIndex : 0);
  }, [open, visibleItems]);

  useLayoutEffect(() => {
    if (!open) return undefined;

    updateMenuPosition();

    const handleResize = () => updateMenuPosition();
    const handleScroll = () => updateMenuPosition();
    const handlePointerDown = (event) => {
      if (triggerRef.current?.contains(event.target)) return;
      if (menuRef.current?.contains(event.target)) return;
      closeMenu();
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        closeMenu();
      }
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll, true);
    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll, true);
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeMenu, open, updateMenuPosition]);

  const handleTriggerKeyDown = useCallback((event) => {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onTrigger?.(event);
      requestAnimationFrame(() => focusItem(0));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      onTrigger?.(event);
      requestAnimationFrame(() => focusItem(visibleItems.length - 1));
    }
  }, [focusItem, onTrigger, visibleItems.length]);

  const handleItemKeyDown = useCallback((event, index, item) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      focusItem(Math.min(index + 1, visibleItems.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      focusItem(Math.max(index - 1, 0));
    } else if (event.key === 'Home') {
      event.preventDefault();
      focusItem(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      focusItem(visibleItems.length - 1);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (item.disabled) return;
      item.onClick?.(event);
      closeMenu();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      closeMenu();
    }
  }, [closeMenu, focusItem, visibleItems.length]);

  return (
    <div className={`sv-row-menu-container ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        className={`sv-row-menu-btn ${triggerClassName} ${open ? 'is-open' : ''}`}
        data-row-menu-trigger="true"
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          onTrigger?.(event);
        }}
        onKeyDown={handleTriggerKeyDown}
      >
        <Icon name="more_vert" className="text-lg" />
      </button>

      {open && typeof document !== 'undefined'
        ? createPortal(
          <div
            ref={menuRef}
            className={`sv-row-menu-popover sv-row-menu-popover-fixed ${menuClassName}`}
            style={menuStyle || undefined}
            role="menu"
            aria-label={ariaLabel}
          >
            {visibleItems.map((item, index) => {
              const selected = Boolean(item.selected);
              return (
                <button
                  key={item.key || item.label || index}
                  ref={(node) => {
                    optionRefs.current[index] = node;
                  }}
                  type="button"
                  role="menuitem"
                  className={`sv-row-menu-item ${item.danger ? 'is-danger' : ''} ${itemClassName}`}
                  disabled={item.disabled}
                  tabIndex={index === activeIndex ? 0 : -1}
                  data-active={index === activeIndex ? 'true' : undefined}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (item.disabled) return;
                    item.onClick?.(event);
                    closeMenu();
                  }}
                  onMouseEnter={() => setActiveIndex(index)}
                  onFocus={() => setActiveIndex(index)}
                  onKeyDown={(event) => handleItemKeyDown(event, index, item)}
                  aria-pressed={selected || undefined}
                >
                  {item.icon ? <Icon name={item.icon} className="sv-icon-btn-icon" /> : null}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>,
          document.body,
        )
        : null}
    </div>
  );
});

export default RowActionMenu;

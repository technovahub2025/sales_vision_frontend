import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, memo } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import Icon from './Icon';

function normalizeOptionValue(value) {
  return String(value ?? '');
}

const SelectDropdown = memo(function SelectDropdown({
  value,
  options,
  onChange,
  disabled = false,
  className = '',
  triggerClassName = '',
  menuClassName = '',
  optionClassName = '',
  align = 'left',
  placement = 'auto',
  placeholder = 'Select',
  renderValue,
  renderOption,
  ariaLabel,
}) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const optionRefs = useRef([]);

  const normalizedOptions = useMemo(
    () => Array.isArray(options) ? options : [],
    [options],
  );

  const selectedIndex = useMemo(
    () => normalizedOptions.findIndex((option) => normalizeOptionValue(option?.value) === normalizeOptionValue(value)),
    [normalizedOptions, value],
  );

  const selectedOption = selectedIndex >= 0 ? normalizedOptions[selectedIndex] : null;

  const displayValue = selectedOption
    ? (renderValue ? renderValue(selectedOption) : selectedOption.label)
    : placeholder;

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const viewportPadding = 12;
    const estimatedWidth = Math.max(rect.width, 180);
    const estimatedHeight = Math.min(320, Math.max(176, normalizedOptions.length * 40 + 12));
    const fitsBelow = rect.bottom + estimatedHeight + 12 <= window.innerHeight;
    const top = placement === 'top'
      ? Math.max(viewportPadding, rect.top - estimatedHeight - 8)
      : fitsBelow
        ? rect.bottom + 8
        : Math.max(viewportPadding, rect.top - estimatedHeight - 8);
    const width = Math.min(estimatedWidth, window.innerWidth - viewportPadding * 2);
    const leftBase = align === 'right' ? rect.right - width : rect.left;
    const left = Math.min(
      Math.max(viewportPadding, leftBase),
      window.innerWidth - width - viewportPadding,
    );

    setMenuStyle({
      position: 'fixed',
      top,
      left,
      width,
      zIndex: 1200,
    });
  }, [align, normalizedOptions.length, placement]);

  useEffect(() => {
    if (!open) return;
    const nextIndex = selectedIndex >= 0 ? selectedIndex : normalizedOptions.findIndex((option) => !option?.disabled);
    setActiveIndex(nextIndex >= 0 ? nextIndex : 0);
  }, [normalizedOptions, open, selectedIndex]);

  useLayoutEffect(() => {
    if (!open) return undefined;

    updateMenuPosition();
    const handleResize = () => updateMenuPosition();
    const handleScroll = () => updateMenuPosition();
    const handlePointerDown = (event) => {
      if (triggerRef.current?.contains(event.target)) return;
      if (menuRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
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
  }, [open, updateMenuPosition]);

  const focusOption = useCallback((index) => {
    const next = Math.max(0, Math.min(index, normalizedOptions.length - 1));
    setActiveIndex(next);
    requestAnimationFrame(() => {
      optionRefs.current[next]?.focus();
      optionRefs.current[next]?.scrollIntoView({ block: 'nearest' });
    });
  }, [normalizedOptions.length]);

  const handleTriggerKeyDown = useCallback((event) => {
    if (disabled) return;
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setOpen(true);
      requestAnimationFrame(() => focusOption(selectedIndex >= 0 ? selectedIndex : 0));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      requestAnimationFrame(() => focusOption(selectedIndex >= 0 ? selectedIndex : normalizedOptions.length - 1));
    }
  }, [disabled, focusOption, normalizedOptions.length, selectedIndex]);

  const handleOptionKeyDown = useCallback((event, index, option) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      focusOption(Math.min(index + 1, normalizedOptions.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      focusOption(Math.max(index - 1, 0));
    } else if (event.key === 'Home') {
      event.preventDefault();
      focusOption(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      focusOption(normalizedOptions.length - 1);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (option && !option.disabled) {
        onChange(option.value);
        setOpen(false);
        triggerRef.current?.focus();
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    }
  }, [focusOption, normalizedOptions.length, onChange]);

  return (
    <div className={`sv-page-dropdown ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        className={`sv-page-dropdown__trigger ${triggerClassName} ${open ? 'is-open' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className="sv-page-dropdown__value">{displayValue}</span>
        <ChevronDown size={14} strokeWidth={2.5} className="sv-page-dropdown__chevron" />
      </button>

      {open && typeof document !== 'undefined'
        ? createPortal(
          <div
            ref={menuRef}
            className={`sv-page-dropdown__menu ${menuClassName}`}
            style={menuStyle || undefined}
            role="listbox"
            aria-activedescendant={activeIndex >= 0 ? `sv-select-option-${normalizeOptionValue(normalizedOptions[activeIndex]?.value)}` : undefined}
          >
            {normalizedOptions.map((option, index) => {
              const selected = normalizeOptionValue(option.value) === normalizeOptionValue(value);
              return (
                <button
                  key={normalizeOptionValue(option.key ?? option.value ?? index)}
                  ref={(node) => {
                    optionRefs.current[index] = node;
                  }}
                  id={`sv-select-option-${normalizeOptionValue(option.value)}`}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  disabled={option.disabled}
                  tabIndex={index === activeIndex ? 0 : -1}
                  className={`sv-page-dropdown__option ${selected ? 'is-selected' : ''} ${optionClassName}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (option.disabled) return;
                    onChange(option.value);
                    setOpen(false);
                    triggerRef.current?.focus();
                  }}
                  onMouseEnter={() => setActiveIndex(index)}
                  onFocus={() => setActiveIndex(index)}
                  onKeyDown={(event) => handleOptionKeyDown(event, index, option)}
                >
                  {renderOption ? renderOption(option, selected) : (
                    <>
                      <span className="sv-page-dropdown__option-check">{selected ? <Icon name="check" /> : null}</span>
                      <span className="sv-page-dropdown__option-label">{option.label}</span>
                    </>
                  )}
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

export default SelectDropdown;

import React, { useState, useRef, useEffect } from 'react';
import { Check, ChevronDown, X, Plus, Search } from 'lucide-react';

interface MultiSelectInputProps {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  lang: 'ur' | 'en';
  placeholder?: string;
}

export function MultiSelectInput({ options, value, onChange, lang, placeholder }: MultiSelectInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [customValue, setCustomValue] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedItems = value ? value.split(', ').filter(Boolean) : [];

  const toggleItem = (item: string, shouldClose = true) => {
    let newItems;
    if (selectedItems.includes(item)) {
      newItems = selectedItems.filter(i => i !== item);
    } else {
      newItems = [...selectedItems, item];
    }
    onChange(newItems.join(', '));
    if (shouldClose) {
      setIsOpen(false);
    }
  };

  const addCustom = () => {
    const trimmed = customValue.trim();
    if (trimmed && !selectedItems.some(item => item.toLowerCase() === trimmed.toLowerCase())) {
      const newItems = [...selectedItems, trimmed];
      onChange(newItems.join(', '));
      setCustomValue('');
      setIsOpen(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter options based on customValue query
  const filteredOptions = options.filter(option =>
    option.toLowerCase().includes(customValue.toLowerCase())
  );

  const showAddCustomOption = customValue.trim() && 
    !options.some(o => o.toLowerCase() === customValue.trim().toLowerCase()) &&
    !selectedItems.some(i => i.toLowerCase() === customValue.trim().toLowerCase());

  const defaultPlaceholder = lang === 'ur' ? 'آئٹم منتخب کریں...' : 'Select items...';

  return (
    <div className="relative w-full text-left" ref={containerRef}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-3 border border-sky-200 rounded-lg bg-white flex items-center justify-between cursor-pointer focus-within:border-gold min-h-[50px] transition-all hover:bg-sky-50/30"
      >
        <div className="flex flex-wrap gap-1 flex-1">
          {selectedItems.length > 0 ? (
            selectedItems.map((item, idx) => (
              <span key={idx} className="bg-gold/10 text-gold-dark border border-gold/30 px-2.5 py-1 rounded-md text-sm font-semibold flex items-center gap-1.5 animate-in zoom-in-95 duration-200">
                {item}
                <X 
                  size={14} 
                  className="cursor-pointer hover:text-red-500 transition-colors" 
                  onClick={(e) => { e.stopPropagation(); toggleItem(item, false); }} 
                />
              </span>
            ))
          ) : (
            <span className={`text-zinc-400 ${lang === 'ur' ? 'urdu-text text-sm' : 'text-sm'}`}>
              {placeholder || defaultPlaceholder}
            </span>
          )}
        </div>
        <ChevronDown size={20} className={`text-zinc-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-sky-200 rounded-lg shadow-xl max-h-72 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Custom entry input & search */}
          <div className="p-2 border-b border-sky-100 sticky top-0 bg-zinc-50 flex gap-2 z-10 shadow-sm">
            <div className="relative flex-1 flex items-center">
              <Search size={16} className="absolute left-2.5 text-zinc-400" />
              <input 
                type="text"
                value={customValue}
                onChange={e => setCustomValue(e.target.value)}
                placeholder={lang === 'ur' ? 'تلاش کریں یا نیا لکھیں...' : 'Search or type custom item...'}
                className="w-full pl-8 pr-2.5 py-1.5 text-sm border border-sky-200 rounded outline-none focus:border-gold text-black bg-white"
                onClick={e => e.stopPropagation()}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addCustom();
                  }
                }}
              />
            </div>
            <button 
              type="button"
              onClick={(e) => { e.stopPropagation(); addCustom(); }}
              className="px-3 bg-gold text-black rounded-md font-bold text-xs flex items-center gap-1 hover:bg-gold-light transition-colors shadow-sm"
              title={lang === 'ur' ? 'شامل کریں' : 'Add Custom'}
            >
              <Plus size={14} />
              <span className="hidden sm:inline">{lang === 'ur' ? 'شامل کریں' : 'Add'}</span>
            </button>
          </div>

          <div className="py-1 max-h-52 overflow-y-auto">
            {/* Direct "+" Custom Add Option when keyword is unique */}
            {showAddCustomOption && (
              <div 
                onClick={(e) => { e.stopPropagation(); addCustom(); }}
                className="p-3 bg-amber-50 hover:bg-amber-100/80 flex items-center gap-2 cursor-pointer border-b border-sky-100 text-gold-dark font-bold text-sm transition-colors"
              >
                <Plus size={16} />
                <span className={lang === 'ur' ? 'urdu-text' : ''}>
                  {lang === 'ur' 
                    ? `شامل کریں: "${customValue}"` 
                    : `Add Custom Item: "${customValue}"`}
                </span>
              </div>
            )}

            {/* List options */}
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option, idx) => (
                <div 
                  key={idx}
                  onClick={(e) => { e.stopPropagation(); toggleItem(option); }}
                  className="p-3 hover:bg-sky-50 flex items-center justify-between cursor-pointer border-b border-sky-100 last:border-0 transition-colors"
                >
                  <span className={`text-zinc-900 ${lang === 'ur' ? 'urdu-text text-sm font-medium' : 'text-sm font-medium'}`}>
                    {option}
                  </span>
                  {selectedItems.includes(option) && (
                    <Check size={16} className="text-gold-dark stroke-[3px]" />
                  )}
                </div>
              ))
            ) : (
              !showAddCustomOption && (
                <div className="p-4 text-center text-zinc-400 text-xs">
                  {lang === 'ur' ? 'کوئی آئٹم نہیں ملا' : 'No items found'}
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}

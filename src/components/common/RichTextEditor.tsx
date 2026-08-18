import React, { useRef, useEffect } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignRight,
  AlignCenter,
  AlignLeft,
  AlignJustify,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
  RotateCcw,
  Palette,
  Minus
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
  maxHeight?: string;
  themeColor?: 'red' | 'amber' | 'blue' | 'indigo';
  id?: string;
  disabled?: boolean;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = 'اكتب تفاصيل ومحتوى التنبيه هنا...',
  minHeight = '180px',
  maxHeight = '350px',
  themeColor = 'amber',
  id = 'rich-text-editor',
  disabled = false,
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const isInternalChangeRef = useRef(false);

  // Sync external value to innerHTML when value changes from outside (e.g. modal open)
  useEffect(() => {
    if (editorRef.current) {
      if (!isInternalChangeRef.current && editorRef.current.innerHTML !== (value || '')) {
        editorRef.current.innerHTML = value || '';
      }
    }
    isInternalChangeRef.current = false;
  }, [value]);

  const handleInput = () => {
    if (editorRef.current) {
      isInternalChangeRef.current = true;
      const html = editorRef.current.innerHTML;
      onChange(html);
    }
  };

  const exec = (command: string, val: string | undefined = undefined) => {
    if (disabled) return;
    if (editorRef.current) {
      editorRef.current.focus();
    }
    document.execCommand(command, false, val);
    if (editorRef.current) {
      isInternalChangeRef.current = true;
      onChange(editorRef.current.innerHTML);
    }
  };

  const getRingColor = () => {
    switch (themeColor) {
      case 'red':
        return 'focus-within:ring-red-600 focus-within:border-red-600';
      case 'blue':
        return 'focus-within:ring-blue-600 focus-within:border-blue-600';
      case 'indigo':
        return 'focus-within:ring-indigo-600 focus-within:border-indigo-600';
      default:
        return 'focus-within:ring-amber-600 focus-within:border-amber-600';
    }
  };

  return (
    <div
      id={id}
      className={cn(
        'border-2 border-border rounded-xl overflow-hidden bg-card transition-all flex flex-col',
        getRingColor()
      )}
    >
      {/* Formatting Toolbar */}
      <div className="bg-muted/70 p-2 border-b border-border flex flex-wrap items-center gap-1 text-foreground select-none">
        {/* Text Styles */}
        <button
          type="button"
          onClick={() => exec('bold')}
          className="p-1.5 hover:bg-card hover:text-foreground text-muted-foreground rounded font-bold text-xs border border-transparent hover:border-border transition-colors cursor-pointer"
          title="غامق (Bold)"
        >
          <Bold className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => exec('italic')}
          className="p-1.5 hover:bg-card hover:text-foreground text-muted-foreground rounded font-bold text-xs border border-transparent hover:border-border transition-colors cursor-pointer"
          title="مائل (Italic)"
        >
          <Italic className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => exec('underline')}
          className="p-1.5 hover:bg-card hover:text-foreground text-muted-foreground rounded font-bold text-xs border border-transparent hover:border-border transition-colors cursor-pointer"
          title="تحته خط (Underline)"
        >
          <Underline className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => exec('strikeThrough')}
          className="p-1.5 hover:bg-card hover:text-foreground text-muted-foreground rounded font-bold text-xs border border-transparent hover:border-border transition-colors cursor-pointer"
          title="يتوسطه خط"
        >
          <Strikethrough className="w-3.5 h-3.5" />
        </button>

        <div className="w-px h-4 bg-border mx-1" />

        {/* Text Alignment */}
        <button
          type="button"
          onClick={() => exec('justifyRight')}
          className="p-1.5 hover:bg-card hover:text-foreground text-muted-foreground rounded font-bold text-xs border border-transparent hover:border-border transition-colors cursor-pointer"
          title="محاذاة لليمين"
        >
          <AlignRight className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => exec('justifyCenter')}
          className="p-1.5 hover:bg-card hover:text-foreground text-muted-foreground rounded font-bold text-xs border border-transparent hover:border-border transition-colors cursor-pointer"
          title="محاذاة للوسط"
        >
          <AlignCenter className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => exec('justifyLeft')}
          className="p-1.5 hover:bg-card hover:text-foreground text-muted-foreground rounded font-bold text-xs border border-transparent hover:border-border transition-colors cursor-pointer"
          title="محاذاة لليسار"
        >
          <AlignLeft className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => exec('justifyFull')}
          className="p-1.5 hover:bg-card hover:text-foreground text-muted-foreground rounded font-bold text-xs border border-transparent hover:border-border transition-colors cursor-pointer"
          title="ضبط النص (Justify)"
        >
          <AlignJustify className="w-3.5 h-3.5" />
        </button>

        <div className="w-px h-4 bg-border mx-1" />

        {/* Lists */}
        <button
          type="button"
          onClick={() => exec('insertUnorderedList')}
          className="p-1.5 hover:bg-card hover:text-foreground text-muted-foreground rounded font-bold text-xs border border-transparent hover:border-border transition-colors cursor-pointer"
          title="قائمة نقطية"
        >
          <List className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => exec('insertOrderedList')}
          className="p-1.5 hover:bg-card hover:text-foreground text-muted-foreground rounded font-bold text-xs border border-transparent hover:border-border transition-colors cursor-pointer"
          title="قائمة رقمية"
        >
          <ListOrdered className="w-3.5 h-3.5" />
        </button>

        <div className="w-px h-4 bg-border mx-1" />

        {/* Headings */}
        <button
          type="button"
          onClick={() => exec('formatBlock', '<h3>')}
          className="px-2 py-1 hover:bg-card hover:text-foreground text-muted-foreground rounded font-black text-[11px] border border-transparent hover:border-border transition-colors cursor-pointer"
          title="عنوان رئيسي"
        >
          H3
        </button>
        <button
          type="button"
          onClick={() => exec('formatBlock', '<h4>')}
          className="px-2 py-1 hover:bg-card hover:text-foreground text-muted-foreground rounded font-black text-[11px] border border-transparent hover:border-border transition-colors cursor-pointer"
          title="عنوان فرعي"
        >
          H4
        </button>
        <button
          type="button"
          onClick={() => exec('formatBlock', '<p>')}
          className="px-2 py-1 hover:bg-card hover:text-foreground text-muted-foreground rounded font-black text-[11px] border border-transparent hover:border-border transition-colors cursor-pointer"
          title="فقرة عادية"
        >
          P
        </button>

        <div className="w-px h-4 bg-border mx-1" />

        {/* Colors */}
        <button
          type="button"
          onClick={() => exec('foreColor', '#dc2626')}
          className="px-2 py-0.5 hover:bg-card rounded text-red-600 font-black text-[11px] border border-transparent hover:border-border transition-colors cursor-pointer"
          title="لون أحمر"
        >
          أحمر
        </button>
        <button
          type="button"
          onClick={() => exec('foreColor', '#2563eb')}
          className="px-2 py-0.5 hover:bg-card rounded text-blue-600 font-black text-[11px] border border-transparent hover:border-border transition-colors cursor-pointer"
          title="لون أزرق"
        >
          أزرق
        </button>
        <button
          type="button"
          onClick={() => exec('foreColor', '#16a34a')}
          className="px-2 py-0.5 hover:bg-card rounded text-emerald-600 font-black text-[11px] border border-transparent hover:border-border transition-colors cursor-pointer"
          title="لون أخضر"
        >
          أخضر
        </button>

        <div className="w-px h-4 bg-border mx-1" />

        {/* Divider & Clear */}
        <button
          type="button"
          onClick={() => exec('insertHorizontalRule')}
          className="p-1.5 hover:bg-card hover:text-foreground text-muted-foreground rounded font-bold text-xs border border-transparent hover:border-border transition-colors cursor-pointer"
          title="إدراج خط فاصل"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => exec('removeFormat')}
          className="p-1.5 hover:bg-card hover:text-foreground text-muted-foreground rounded font-bold text-xs border border-transparent hover:border-border transition-colors cursor-pointer"
          title="إزالة التنسيق"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Formatted Content Canvas */}
      <div
        ref={editorRef}
        contentEditable={!disabled}
        suppressContentEditableWarning
        onInput={handleInput}
        onBlur={handleInput}
        data-placeholder={placeholder}
        className={cn(
          'p-4 overflow-y-auto text-foreground text-xs md:text-sm font-medium leading-relaxed bg-card text-right custom-scrollbar focus:outline-none select-text',
          'prose dark:prose-invert max-w-none'
        )}
        style={{
          direction: 'rtl',
          minHeight,
          maxHeight,
        }}
      />
    </div>
  );
};

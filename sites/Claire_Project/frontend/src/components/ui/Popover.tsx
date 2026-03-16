'use client';

import { useState, cloneElement, isValidElement } from 'react';
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  useClick,
  useDismiss,
  useRole,
  useInteractions,
  FloatingFocusManager,
  FloatingPortal,
} from '@floating-ui/react';

interface PopoverProps {
  trigger: React.ReactNode;
  content: React.ReactNode;
  placement?: 'top' | 'top-start' | 'top-end' | 'bottom' | 'bottom-start' | 'bottom-end' | 'left' | 'right';
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

export default function Popover({
  trigger,
  content,
  placement = 'bottom-end',
  open: controlledOpen,
  onOpenChange,
  className = '',
}: PopoverProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);

  // 支援受控和非受控模式
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : uncontrolledOpen;
  const setIsOpen = isControlled ? (onOpenChange || (() => {})) : setUncontrolledOpen;

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    middleware: [offset(8), flip(), shift({ padding: 8 })],
    placement,
    whileElementsMounted: autoUpdate,
  });

  const click = useClick(context);
  const dismiss = useDismiss(context);
  const role = useRole(context);

  const { getReferenceProps, getFloatingProps } = useInteractions([
    click,
    dismiss,
    role,
  ]);

  return (
    <>
      {isValidElement(trigger) ? (
        cloneElement(trigger as React.ReactElement<any>, {
          ref: refs.setReference,
          ...getReferenceProps(),
        })
      ) : (
        <div ref={refs.setReference} {...getReferenceProps()}>
          {trigger}
        </div>
      )}
      {isOpen && (
        <FloatingPortal>
          <FloatingFocusManager context={context} modal={false}>
            <div
              ref={refs.setFloating}
              style={floatingStyles}
              {...getFloatingProps()}
              className={`z-50 bg-white rounded-lg shadow-xl border border-gray-200 ${className}`}
            >
              {content}
            </div>
          </FloatingFocusManager>
        </FloatingPortal>
      )}
    </>
  );
}

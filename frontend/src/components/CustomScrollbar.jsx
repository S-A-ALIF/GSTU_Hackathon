import React, { useState, useEffect, useRef, useCallback } from 'react';

export default function CustomScrollbar({ scrollContainerRef, className = '' }) {
  const [thumbHeight, setThumbHeight] = useState(0);
  const [thumbTop, setThumbTop] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const trackRef = useRef(null);
  const startDragYRef = useRef(0);
  const startScrollTopRef = useRef(0);
  
  const updateScrollbar = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    
    const { scrollTop, scrollHeight, clientHeight } = container;
    
    if (scrollHeight <= clientHeight) {
      setThumbHeight(0);
      return;
    }
    
    const scrollRatio = clientHeight / scrollHeight;
    // Keep a minimum height for the thumb so it's always grabbable
    const newThumbHeight = Math.max(clientHeight * scrollRatio, 30);
    
    const maxScrollTop = scrollHeight - clientHeight;
    const maxThumbTop = clientHeight - newThumbHeight;
    
    const newThumbTop = maxScrollTop > 0 ? (scrollTop / maxScrollTop) * maxThumbTop : 0;
    
    setThumbHeight(newThumbHeight);
    setThumbTop(newThumbTop);
  }, [scrollContainerRef]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    
    container.addEventListener('scroll', updateScrollbar, { passive: true });
    
    const resizeObserver = new ResizeObserver(() => updateScrollbar());
    resizeObserver.observe(container);
    
    const mutationObserver = new MutationObserver(() => updateScrollbar());
    mutationObserver.observe(container, { childList: true, subtree: true, attributes: true });
    
    updateScrollbar();
    
    return () => {
      container.removeEventListener('scroll', updateScrollbar);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [scrollContainerRef, updateScrollbar]);

  const handleDragStart = (clientY) => {
    setIsDragging(true);
    startDragYRef.current = clientY;
    if (scrollContainerRef.current) {
      startScrollTopRef.current = scrollContainerRef.current.scrollTop;
    }
  };

  const handleThumbMouseDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    handleDragStart(e.clientY);
  };

  const handleThumbTouchStart = (e) => {
    e.stopPropagation();
    handleDragStart(e.touches[0].clientY);
  };

  const handleTrackClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const container = scrollContainerRef.current;
    if (!container || !trackRef.current) return;
    
    const trackRect = trackRef.current.getBoundingClientRect();
    const clickY = e.clientY - trackRect.top;
    
    const { scrollHeight, clientHeight } = container;
    const scrollRatio = clickY / clientHeight;
    // Jump the scroll container so the clicked point becomes the center of the viewport
    container.scrollTop = scrollRatio * scrollHeight - (clientHeight / 2);
  };

  useEffect(() => {
    const handleDragMove = (clientY) => {
      if (!isDragging || !scrollContainerRef.current) return;
      
      const container = scrollContainerRef.current;
      const { scrollHeight, clientHeight } = container;
      const maxScrollTop = scrollHeight - clientHeight;
      const maxThumbTop = clientHeight - thumbHeight;
      
      if (maxThumbTop <= 0) return;
      
      const deltaY = clientY - startDragYRef.current;
      const scrollDelta = (deltaY / maxThumbTop) * maxScrollTop;
      
      container.scrollTop = startScrollTopRef.current + scrollDelta;
    };

    const handleWindowMouseMove = (e) => handleDragMove(e.clientY);
    const handleWindowTouchMove = (e) => handleDragMove(e.touches[0].clientY);

    const handleWindowDragEnd = () => {
      if (isDragging) setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleWindowMouseMove);
      window.addEventListener('mouseup', handleWindowDragEnd);
      window.addEventListener('touchmove', handleWindowTouchMove, { passive: false });
      window.addEventListener('touchend', handleWindowDragEnd);
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.userSelect = '';
    }

    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowDragEnd);
      window.removeEventListener('touchmove', handleWindowTouchMove);
      window.removeEventListener('touchend', handleWindowDragEnd);
      document.body.style.userSelect = '';
    };
  }, [isDragging, thumbHeight, scrollContainerRef]);

  if (thumbHeight === 0) return null;

  return (
    <div 
      className={`absolute right-0 top-0 bottom-0 z-20 w-3 pointer-events-none ${className}`}
    >
      <div 
        ref={trackRef}
        className="absolute right-0 top-0 bottom-0 w-full h-full pointer-events-auto"
        onClick={handleTrackClick}
      >
        {/* The massive hit area container */}
        <div 
          className="absolute"
          style={{ 
            transform: `translateY(${thumbTop}px)`, 
            height: `${thumbHeight}px`,
            left: '-48px',
            width: '56px',
            cursor: 'pointer'
          }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onMouseDown={handleThumbMouseDown}
          onTouchStart={handleThumbTouchStart}
        >
          {/* The visible thumb */}
          <div 
            className="absolute right-0 top-0 bottom-0 w-2 transition-colors rounded-full"
            style={{
              backgroundColor: isDragging || isHovered ? 'rgba(100, 116, 139, 0.9)' : 'rgba(148, 163, 184, 0.5)'
            }}
          />
        </div>
      </div>
    </div>
  );
}

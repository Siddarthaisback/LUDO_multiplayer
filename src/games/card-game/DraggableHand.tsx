import React, { useState, useRef, useEffect } from 'react';
import { Card } from '../../core/cards/Card';
import { PlayingCard } from './PlayingCard';
import { PlayingCardData, CardSuit } from '../../types/cardGame';

interface DraggableHandProps {
  cards: Card[];
  isUserTurn?: boolean;
  isPlayableCard?: (card: Card) => boolean;
  isSelectedCard?: (card: Card) => boolean;
  onCardClick?: (card: Card) => void;
  onPlayCard?: (card: Card) => void;
  onReorderCards?: (reordered: Card[]) => void;
  size?: 'sm' | 'md' | 'lg';
  renderBadge?: (card: Card) => React.ReactNode;
}

export const DraggableHand: React.FC<DraggableHandProps> = ({
  cards,
  isUserTurn = true,
  isPlayableCard = () => true,
  isSelectedCard = () => false,
  onCardClick,
  onPlayCard,
  onReorderCards,
  size = 'md',
  renderBadge,
}) => {
  const [orderedCards, setOrderedCards] = useState<Card[]>(cards);
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const startPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const handContainerRef = useRef<HTMLDivElement>(null);

  // Sync internal order if incoming cards array changes (e.g. drawn card, dealt, or external sort)
  useEffect(() => {
    const currentIds = new Set(cards.map((c) => c.id));
    const kept = orderedCards.filter((c) => currentIds.has(c.id));
    const keptIds = new Set(kept.map((c) => c.id));
    const newCards = cards.filter((c) => !keptIds.has(c.id));

    if (kept.length !== orderedCards.length || newCards.length > 0 || cards.length !== orderedCards.length) {
      setOrderedCards([...kept, ...newCards]);
    }
  }, [cards]);

  const suitMap: Record<string, CardSuit> = {
    S: 'spades',
    H: 'hearts',
    D: 'diamonds',
    C: 'clubs',
  };

  const formatCardData = (c: Card): PlayingCardData => ({
    id: c.id,
    suit: suitMap[c.suit] || 'spades',
    rank: c.rank,
    label: c.label,
    isFaceUp: true,
  });

  const handlePointerDown = (cardId: string, e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    startPosRef.current = { x: e.clientX, y: e.clientY };
    setDraggingCardId(cardId);
    setDragOffset({ x: 0, y: 0 });

    const idx = orderedCards.findIndex((c) => c.id === cardId);
    setHoverIndex(idx);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingCardId) return;
    const dx = e.clientX - startPosRef.current.x;
    const dy = e.clientY - startPosRef.current.y;
    setDragOffset({ x: dx, y: dy });

    // Calculate hover index based on horizontal offset
    const originalIndex = orderedCards.findIndex((c) => c.id === draggingCardId);
    if (originalIndex !== -1) {
      const cardSlotWidth = size === 'lg' ? 55 : size === 'md' ? 38 : 28;
      const slotDelta = Math.round(dx / cardSlotWidth);
      const newTarget = Math.max(0, Math.min(orderedCards.length - 1, originalIndex + slotDelta));
      setHoverIndex(newTarget);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!draggingCardId) return;

    const dx = e.clientX - startPosRef.current.x;
    const dy = e.clientY - startPosRef.current.y;
    const distanceMoved = Math.sqrt(dx * dx + dy * dy);

    const card = orderedCards.find((c) => c.id === draggingCardId);
    const originalIndex = orderedCards.findIndex((c) => c.id === draggingCardId);

    if (card) {
      // 1. DRAG-TO-THROW: Dragged upwards (dy < -30px) -> Play card immediately
      if (dy < -30 && isPlayableCard(card)) {
        if (onPlayCard) {
          onPlayCard(card);
        } else if (onCardClick) {
          onCardClick(card);
        }
      } 
      // 2. DRAG-TO-REORDER: Moved sideways horizontally across slots
      else if (Math.abs(dx) > 18 && hoverIndex !== null && hoverIndex !== originalIndex) {
        const newOrder = [...orderedCards];
        const [movedCard] = newOrder.splice(originalIndex, 1);
        newOrder.splice(hoverIndex, 0, movedCard);
        setOrderedCards(newOrder);
        onReorderCards?.(newOrder);
      } 
      // 3. CLICK / TAP: Clicked card (< 12px movement) -> Trigger click/play
      else if (distanceMoved < 12) {
        if (onCardClick) {
          onCardClick(card);
        } else if (onPlayCard && isPlayableCard(card)) {
          onPlayCard(card);
        }
      }
    }

    setDraggingCardId(null);
    setDragOffset({ x: 0, y: 0 });
    setHoverIndex(null);
  };

  const handlePointerCancel = () => {
    setDraggingCardId(null);
    setDragOffset({ x: 0, y: 0 });
    setHoverIndex(null);
  };

  return (
    <div
      ref={handContainerRef}
      className="flex items-center justify-center -space-x-3 sm:-space-x-4 overflow-visible pt-1 pb-1 w-full px-2 select-none touch-none"
    >
      {orderedCards.map((card, idx) => {
        const isDragging = card.id === draggingCardId;
        const isPlayable = isPlayableCard(card);
        const isSelected = isSelectedCard(card);
        const totalCards = orderedCards.length;

        // Gentle fan tilt angle
        const baseTilt = (idx - (totalCards - 1) / 2) * (size === 'lg' ? 2.5 : 2.0);
        // Subtle natural arc (center cards elevated by 0..6px)
        const arcY = Math.abs(idx - (totalCards - 1) / 2) * 0.8;
        const playableLift = isPlayable && isUserTurn ? -8 : 0;
        const selectedLift = isSelected ? -14 : 0;

        // Dynamic slot shifting preview when reordering
        let shiftX = 0;
        if (draggingCardId && !isDragging && hoverIndex !== null) {
          const originalDragIdx = orderedCards.findIndex((c) => c.id === draggingCardId);
          if (originalDragIdx < hoverIndex && idx > originalDragIdx && idx <= hoverIndex) {
            shiftX = size === 'lg' ? -48 : size === 'md' ? -36 : -26;
          } else if (originalDragIdx > hoverIndex && idx < originalDragIdx && idx >= hoverIndex) {
            shiftX = size === 'lg' ? 48 : size === 'md' ? 36 : 26;
          }
        }

        const cardStyle: React.CSSProperties = isDragging
          ? {
              transform: `translate3d(${dragOffset.x}px, ${dragOffset.y - 12}px, 0) scale(1.15) rotate(${
                baseTilt + dragOffset.x * 0.08
              }deg)`,
              zIndex: 100,
              transition: 'none',
              cursor: 'grabbing',
              boxShadow: '0 25px 35px rgba(0,0,0,0.6), 0 0 25px rgba(251,191,36,0.7)',
            }
          : {
              transform: `translate3d(${shiftX}px, ${arcY + playableLift + selectedLift}px, 0) rotate(${baseTilt}deg)`,
              transition: 'transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1)',
              zIndex: isPlayable && isUserTurn ? 40 : isSelected ? 30 : idx + 1,
            };

        return (
          <div
            key={card.id}
            onPointerDown={(e) => handlePointerDown(card.id, e)}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            className={`relative inline-block select-none ${
              isPlayable && isUserTurn
                ? 'cursor-pointer hover:scale-105 hover:-translate-y-2'
                : 'cursor-grab active:cursor-grabbing opacity-90'
            }`}
            style={cardStyle}
          >
            <PlayingCard
              card={formatCardData(card)}
              size={size}
              disableTransform={true}
              isSelectable={false}
              isSelected={isPlayable && isUserTurn}
            />

            {renderBadge && (
              <div className="absolute -top-2 left-1/2 -translate-x-1/2 pointer-events-none z-30">
                {renderBadge(card)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

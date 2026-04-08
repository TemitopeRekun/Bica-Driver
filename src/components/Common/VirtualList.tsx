import * as ReactWindow from 'react-window';

// Handle CommonJS/ESM interop for react-window in Vite
const List = ((ReactWindow as any).default?.FixedSizeList || (ReactWindow as any).FixedSizeList) as any;

interface VirtualListProps<T> {
  items: T[];
  height: number;
  itemSize: number;
  width?: string | number;
  renderItem: (item: T, index: number, style: React.CSSProperties) => React.ReactNode;
  overscanCount?: number;
}

/**
 * A standard wrapper for UI virtualization.
 * Use this for lists that may grow beyond 50-100 items (Drivers, Trips, Activity).
 */
export function VirtualList<T>({
  items,
  height,
  itemSize,
  width = '100%',
  renderItem,
  overscanCount = 5
}: VirtualListProps<T>) {
  return (
    <List
      height={height}
      itemCount={items.length}
      itemSize={itemSize}
      width={width}
      overscanCount={overscanCount}
      className="no-scrollbar"
    >
      {({ index, style }) => renderItem(items[index], index, style)}
    </List>
  );
}

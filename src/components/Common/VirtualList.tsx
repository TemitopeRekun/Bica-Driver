import * as ReactWindowNamespace from 'react-window';

// Handle CommonJS/ESM interop for react-window in Vite
// Using bracket notation to bypass Rollup's static analysis for non-standard CJS exports
const ReactWindow: any = ReactWindowNamespace;
const List = ReactWindow.FixedSizeList || ReactWindow['default']?.FixedSizeList || ReactWindow['FixedSizeList'];

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

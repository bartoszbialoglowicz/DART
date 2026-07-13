import { useVenues } from '../../hooks/useVenues';
import type { Venue } from '../../types/venue';
import { SelectableCard } from '../ui/SelectableCard';

type Props = {
  selectedId: number | null;
  onChange:   (venue: Venue | null) => void;
};

export function VenuePicker({ selectedId, onChange }: Props) {
  const { data: venues = [], isLoading } = useVenues();

  if (isLoading) {
    return <p className="text-sm text-content-secondary">Ładowanie lokali…</p>;
  }

  const allOptions: Array<{ id: number | null; name: string; description: string }> = [
    { id: null, name: 'Dowolny', description: 'Bez przypisanego lokalu' },
    ...venues.map(v => ({
      id:          v.id,
      name:        v.name,
      description: [
        v.address,
        `${v.board_count} ${v.board_count === 1 ? 'tarcza' : v.board_count < 5 ? 'tarcze' : 'tarcz'}`,
        v.default_sets > 1
          ? `${v.default_sets}s/${v.default_legs}l`
          : `${v.default_legs} legi`,
        v.max_darts_per_leg != null ? `max ${v.max_darts_per_leg} lok.` : '',
      ].filter(Boolean).join(' · '),
    })),
  ];

  return (
    <div className="flex flex-col gap-2">
      {allOptions.map(opt => (
        <SelectableCard
          key={opt.id ?? 'any'}
          layout="row"
          title={opt.name}
          description={opt.description}
          selected={selectedId === opt.id}
          onClick={() => {
            if (opt.id === null) { onChange(null); return; }
            const venue = venues.find(v => v.id === opt.id) ?? null;
            onChange(venue);
          }}
        />
      ))}
    </div>
  );
}

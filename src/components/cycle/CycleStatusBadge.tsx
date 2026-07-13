import { Badge, type BadgeVariant } from '../ui/Badge';

const STATUS_VARIANT: Record<string, BadgeVariant> = {
  draft:    'rank',
  active:   'up',
  finished: 'neutral',
};

const STATUS_LABEL: Record<string, string> = {
  draft:    'Szkic',
  active:   'Aktywny',
  finished: 'Zakończony',
};

export function CycleStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={STATUS_VARIANT[status] ?? 'neutral'} className="uppercase">
      {STATUS_LABEL[status] ?? status}
    </Badge>
  );
}

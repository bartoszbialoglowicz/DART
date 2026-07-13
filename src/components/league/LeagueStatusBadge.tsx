import { Badge, type BadgeVariant } from '../ui/Badge';
import { LEAGUE_STATUS_LABEL } from '../../utils/colors';

const STATUS_VARIANT: Record<string, BadgeVariant> = {
  draft:    'rank',     // amber — attention / in progress
  active:   'up',       // green — live
  finished: 'neutral',  // muted — done
};

export function LeagueStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={STATUS_VARIANT[status] ?? 'neutral'} className="uppercase">
      {LEAGUE_STATUS_LABEL[status] ?? status}
    </Badge>
  );
}

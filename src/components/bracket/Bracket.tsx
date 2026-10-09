import type { BracketData } from '../../types/bracket';
import { KnockoutBracket } from './KnockoutBracket';
import { GroupsBracket } from './GroupsBracket';

type Props = {
  data:                  BracketData;
  isOwner:               boolean;
  confirmed:             boolean;
  avgByName?:            Map<string, number>;
  onSimulate?:           (matchId: string) => void;
  onEnterResult?:        (matchId: string, topScore: number, bottomScore: number) => void;
  onSimulateGroup?:      (groupId: string, matchId: string) => void;
  onEnterGroupResult?:   (groupId: string, matchId: string, top: number, bottom: number) => void;
  onGeneratePlayoff?:    () => void;
};

export function Bracket({ data, isOwner, confirmed, avgByName, onSimulate, onEnterResult, onSimulateGroup, onEnterGroupResult, onGeneratePlayoff }: Props) {
  if (data.format === 'knockout') {
    return (
      <KnockoutBracket
        rounds={data.rounds}
        matchFormat={data.matchFormat}
        isOwner={isOwner}
        confirmed={confirmed}
        avgByName={avgByName}
        onSimulate={onSimulate}
        onEnterResult={onEnterResult}
      />
    );
  }
  return (
    <GroupsBracket
      data={data}
      isOwner={isOwner}
      confirmed={confirmed}
      avgByName={avgByName}
      onSimulateGroup={onSimulateGroup}
      onEnterGroupResult={onEnterGroupResult}
      onGeneratePlayoff={onGeneratePlayoff}
      onSimulatePlayoff={onSimulate}
      onEnterPlayoffResult={onEnterResult}
    />
  );
}

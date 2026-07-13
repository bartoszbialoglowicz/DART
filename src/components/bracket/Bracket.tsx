import type { BracketData } from '../../types/bracket';
import { KnockoutBracket } from './KnockoutBracket';
import { GroupsBracket } from './GroupsBracket';

type Props = {
  data:                  BracketData;
  isOwner:               boolean;
  avgByName?:            Map<string, number>;
  onSimulate?:           (matchId: string) => void;
  onEnterResult?:        (matchId: string, topScore: number, bottomScore: number) => void;
  onSimulateGroup?:      (groupId: string, matchId: string) => void;
  onEnterGroupResult?:   (groupId: string, matchId: string, top: number, bottom: number) => void;
  onGeneratePlayoff?:    () => void;
};

export function Bracket({ data, isOwner, avgByName, onSimulate, onEnterResult, onSimulateGroup, onEnterGroupResult, onGeneratePlayoff }: Props) {
  if (data.format === 'knockout') {
    return (
      <KnockoutBracket
        rounds={data.rounds}
        matchFormat={data.matchFormat}
        isOwner={isOwner}
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
      avgByName={avgByName}
      onSimulateGroup={onSimulateGroup}
      onEnterGroupResult={onEnterGroupResult}
      onGeneratePlayoff={onGeneratePlayoff}
      onSimulatePlayoff={onSimulate}
      onEnterPlayoffResult={onEnterResult}
    />
  );
}

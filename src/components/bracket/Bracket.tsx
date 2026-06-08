import type { BracketData } from '../../types/bracket';
import { KnockoutBracket } from './KnockoutBracket';
import { GroupsBracket } from './GroupsBracket';

type Props = {
  data:                  BracketData;
  isOwner:               boolean;
  onSimulate?:           (matchId: string) => void;
  onEnterResult?:        (matchId: string, topScore: number, bottomScore: number) => void;
  onSimulateGroup?:      (groupId: string, matchId: string) => void;
  onEnterGroupResult?:   (groupId: string, matchId: string, top: number, bottom: number) => void;
  onGeneratePlayoff?:    () => void;
};

export function Bracket({ data, isOwner, onSimulate, onEnterResult, onSimulateGroup, onEnterGroupResult, onGeneratePlayoff }: Props) {
  if (data.format === 'knockout') {
    return (
      <KnockoutBracket
        rounds={data.rounds}
        playerCount={data.playerCount}
        matchFormat={data.matchFormat}
        isOwner={isOwner}
        onSimulate={onSimulate}
        onEnterResult={onEnterResult}
      />
    );
  }
  return (
    <GroupsBracket
      data={data}
      isOwner={isOwner}
      onSimulateGroup={onSimulateGroup}
      onEnterGroupResult={onEnterGroupResult}
      onGeneratePlayoff={onGeneratePlayoff}
      onSimulatePlayoff={onSimulate}
      onEnterPlayoffResult={onEnterResult}
    />
  );
}

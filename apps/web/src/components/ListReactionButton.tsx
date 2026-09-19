import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ThumbUpOutlinedIcon from '@mui/icons-material/ThumbUpOutlined';
import { IconButton, Tooltip, Typography } from '@mui/material';
import type { ReactionKind } from '@music-rank/contracts';
import { PartyPopperFilledIcon, PartyPopperOutlinedIcon } from './PartyPopperIcon';

type ListReactionButtonProps = {
  kind: ReactionKind;
  songTitle: string;
  reactionCount: number;
  viewerHasReacted: boolean;
  disabled?: boolean;
  onToggle: () => void;
};

export function ListReactionButton({ kind, songTitle, reactionCount, viewerHasReacted, disabled = false, onToggle }: ListReactionButtonProps) {
  const isLike = kind === 'LIKE';
  const action = viewerHasReacted ? (isLike ? 'Remove like' : 'Remove cheer') : (isLike ? 'Like' : 'Cheer');
  const countLabel = `${reactionCount} ${isLike ? (reactionCount === 1 ? 'like' : 'likes') : (reactionCount === 1 ? 'cheer' : 'cheers')}`;
  const icon = isLike
    ? viewerHasReacted ? <ThumbUpIcon fontSize="small" /> : <ThumbUpOutlinedIcon fontSize="small" />
    : viewerHasReacted ? <PartyPopperFilledIcon fontSize="small" /> : <PartyPopperOutlinedIcon fontSize="small" />;

  return <Tooltip title={action} enterTouchDelay={500}>
    <span style={{ display: 'inline-flex', alignItems: 'center', verticalAlign: 'middle' }}>
      <IconButton
        aria-label={`${action} for ${songTitle}. ${countLabel}.`}
        aria-pressed={viewerHasReacted}
        disabled={disabled}
        onClick={onToggle}
        color={viewerHasReacted ? 'secondary' : 'default'}
        size="small"
        sx={{ border: 0, borderRadius: 999, gap: 0.5, px: reactionCount > 0 ? 1 : 0.75, minWidth: 34 }}
      >
        {icon}
        {reactionCount > 0 && <Typography component="span" variant="caption" fontWeight={800} lineHeight={1}>{reactionCount}</Typography>}
      </IconButton>
    </span>
  </Tooltip>;
}

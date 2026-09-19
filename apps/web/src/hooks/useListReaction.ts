import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError, request, type ListReactionSummary } from '../api';
import { queryKeys } from '../queries';
import { useAppShell } from '../shell/AppShellContext';

export type ReactionListType = 'top-list' | 'singing-list';

type ReactionVariables = {
  listType: ReactionListType;
  songId: string;
  viewerHasReacted: boolean;
};

export function useListReaction(ownerUsername: string) {
  const client = useQueryClient();
  const { user, requireUser, notify, onUnauthorized } = useAppShell();
  const mutation = useMutation({
    mutationFn: ({ listType, songId, viewerHasReacted }: ReactionVariables) => request<ListReactionSummary>(
      `/api/users/${encodeURIComponent(ownerUsername)}/${listType}/items/${encodeURIComponent(songId)}/reaction`,
      { method: viewerHasReacted ? 'DELETE' : 'PUT' }
    ),
    onSuccess: async (_summary, variables) => {
      const publicKey = variables.listType === 'top-list'
        ? queryKeys.publicTopList(ownerUsername)
        : queryKeys.publicSingingList(ownerUsername);
      const invalidations = [client.invalidateQueries({ queryKey: publicKey })];
      if (user?.username === ownerUsername.toLowerCase()) {
        invalidations.push(client.invalidateQueries({
          queryKey: variables.listType === 'top-list'
            ? queryKeys.topList(user.id)
            : ['personal', user.id, 'singing-list']
        }));
      }
      await Promise.all(invalidations);
      notify('success', variables.viewerHasReacted
        ? variables.listType === 'top-list' ? 'Like removed' : 'Cheer removed'
        : variables.listType === 'top-list' ? 'Liked' : 'Cheered');
    },
    onError: async (error, variables) => {
      if (error instanceof ApiError && error.status === 401) {
        await onUnauthorized();
        return;
      }
      if (error instanceof ApiError && error.code === 'LIST_ITEM_NOT_AVAILABLE') {
        await Promise.all([
          client.invalidateQueries({ queryKey: queryKeys.publicProfile(ownerUsername) }),
          client.invalidateQueries({ queryKey: variables.listType === 'top-list' ? queryKeys.publicTopList(ownerUsername) : queryKeys.publicSingingList(ownerUsername) }),
          user ? client.invalidateQueries({ queryKey: queryKeys.personal }) : Promise.resolve()
        ]);
      }
      notify('error', error instanceof ApiError ? error.message : 'Could not update this reaction. Please try again.');
    }
  });

  const toggleReaction = (listType: ReactionListType, songId: string, viewerHasReacted: boolean) => {
    requireUser(() => mutation.mutate({ listType, songId, viewerHasReacted }));
  };

  const isPending = (listType: ReactionListType, songId: string) => mutation.isPending
    && mutation.variables?.listType === listType
    && mutation.variables.songId === songId;

  return { toggleReaction, isPending };
}

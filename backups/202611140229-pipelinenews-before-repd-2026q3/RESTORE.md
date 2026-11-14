# Restore point: Ventusltd/pipelinenews before the October 2026 REPD update

Taken before merging pull request 3 (branch release/202611132345-repd-2026q3, head 42c97658) into main at 67aa2eb.
The pull request adds 118 files, deletes none, and changes four existing files; their bytes at 67aa2eb are under `files/` with SHA256SUMS.

To restore: revert the merge commit on pipelinenews main (`git revert -m 1 <merge sha>`), or copy the four files in `files/` back over their paths and remove `releases/202611132345-pipelinenews/`.

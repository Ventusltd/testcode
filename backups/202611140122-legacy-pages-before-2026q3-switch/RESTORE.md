# Checkpoint 202611140122: seven legacy pages before they were repointed to the October 2026 REPD files

Copies from Ventusltd/globalgrid2050 main at 19fdf4ab0c23e4af17cb91a6b5cc7a7a767327f0 of the seven root pages whose data URL is about
to change from the January files (repd.csv and its subsets) to the 2026q3 files. One line changes in each.
The January data files themselves are not touched.

Restore one page: copy it from this folder over the file in globalgrid2050 and commit; or revert the switch commit:

    git revert <commit "switch: seven current pages read the October 2026 REPD files">

Check: sha256sum against SHA256SUMS in this folder.
